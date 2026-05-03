# External Integrations

**Analysis Date:** 2026-05-03

## APIs & External Services

**Primary backing service:**
- **Vercel KV** (Upstash Redis under the hood) — sole external data store. Accessed via `@vercel/kv` SDK (`3.0.0`) in every file under `api/`. No other third-party APIs are called from the backend.
  - Auth: `KV_REST_API_URL` + `KV_REST_API_TOKEN` env vars (auto-injected by Vercel KV project integration; documented in `.env.example`).
  - Operations actually used: `kv.get`, `kv.set`, `kv.setex`, `kv.del`, `kv.keys`, `kv.scan`. No pub/sub, no streams, no transactions.

**No other external APIs.** Specifically NOT integrated:
- No Stripe / payment providers
- No OAuth providers (Google / GitHub / Apple)
- No third-party auth (Auth0 / Clerk / Supabase Auth / NextAuth)
- No email service (SendGrid / Resend / Postmark)
- No SMS service
- No analytics (PostHog / Mixpanel / Plausible / GA)
- No error tracker (Sentry / Bugsnag / Rollbar)
- No CDN beyond Vercel's edge cache
- No AI/LLM SDKs
- No image-CDN (Cloudinary / imgix)

## Data Storage

**Primary database — Vercel KV (Upstash Redis):**

Key patterns and TTLs:

| Key pattern | Type | Written by | TTL | Purpose |
|-------------|------|------------|-----|---------|
| `room:{6charCode}` | JSON string | `api/rooms/create.js:74`, `api/rooms/[code].js:141-143` | 1 year (`setex 31536000`); permanent if `isFavorite` (plain `set`) | Real-time game room state, host auth token, players, votes |
| `rooms:index` | JSON array | `api/rooms/create.js:80-83` | none | Capped to 100 most-recent room codes for `list.js` browsing |
| `favorites:index` | JSON array | `api/rooms/favorite/[code].js:48-65` | none | Permanent index of favorited rooms |
| `player:{handle}` | JSON string | `api/players/create.js:98`, plus all writes in `[handle].js` | none (permanent) | Full player profile: identity, photo (base64), stats, partners, opponents, recent games, achievements, ownership token hash |
| `player_id:{PLR_XXXXXX}` | string | `api/players/create.js:101` | none | Reverse lookup: ID → handle |

**File storage:**
- None. No S3, GCS, R2, Vercel Blob, or other object store.
- Profile photos are stored inline in `player:{handle}` as base64 data URLs (see `api/players/_utils.js:87-97` validation; ~150KB cap; resized client-side to 400x400 JPEG quality 0.8 in `src/player/playerCreateModal.js:312-318`).

**Caching:**
- Browser-side via Service Worker `public/sw.js` (network-first with cache fallback for static assets, network-only for `/api/*`).
- No server-side cache layer beyond Vercel's edge defaults.

**Local storage:**
- Game state, settings, player roster, stats: keys prefixed `gd_v9_*` (per `CLAUDE.md`) and `gd_v7_5_1_*` (legacy). Wrapped by `src/core/storage.js`.
- Per-handle ownership tokens: `gd_owner_token_{handle}` keys. Stored on the device that created the profile, used as `Authorization: Bearer ...` for self-edit. See `src/api/playerApi.js:10-38`.

## Authentication & Identity

**No external auth provider.** All credentials are self-issued and stored in KV.

**Three credential types in use:**

1. **Room host auth token** (per-room)
   - Generated server-side at room creation: 32 bytes (64 hex chars) via `crypto.getRandomValues` (`api/rooms/create.js:14-19`).
   - Returned ONCE in the create response (`api/rooms/create.js:88-101`); never retrievable later.
   - Stored as `authToken` field on the `room:{code}` record; STRIPPED from all GET responses (`api/rooms/[code].js:51-53`) so viewers cannot exfiltrate it.
   - Required as `Authorization: Bearer <token>` on every PUT to `/api/rooms/[code]` (`api/rooms/[code].js:91-129`). Constant-time compare via `constantTimeEqual` helper.
   - TOFU (trust-on-first-use) fallback: legacy rooms without a stored token accept the first PUT's token and pin it (`api/rooms/[code].js:114-129`).

2. **Per-user ownership token** (per-player)
   - Generated server-side at profile creation: 32 bytes hex (`api/players/_utils.js:238-242`).
   - Returned ONCE in create response (`api/players/create.js:104-107`).
   - Server stores ONLY the SHA-256 hex hash (`ownershipTokenHash` field on player record, `_utils.js:244-248`). Preimage resistance means a KV leak can't be replayed.
   - Sent by client as `Authorization: Bearer <token>` for self-edit operations (PROFILE_UPDATE, ROTATE_TOKEN, stats writes from owner's own device).
   - Validated server-side via `validateOwnershipToken` (hash + constant-time compare; rejects if stored hash isn't 64 chars to prevent corruption oracles, `_utils.js:250-269`).
   - Rotation supported via `mode: 'ROTATE_TOKEN'` PUT to `/api/players/[handle]` (`api/players/[handle].js:422-480`). Last-write-wins on concurrent rotations (no CAS).

3. **Admin token** (single global)
   - Stored in `ADMIN_TOKEN` env var on Vercel project. Validated by `validateAdminToken` in `_utils.js:196-211`.
   - Fail-closed: if env var unset, every admin endpoint rejects all requests (`_utils.js:200-203`).
   - Constant-time compare (no length-leak).
   - Required for: `api/players/delete.js:29`, `api/players/reset-stats.js:29`, `api/players/migrate-modes.js:99`. Optionally accepted on PROFILE_UPDATE / ROTATE_TOKEN / stats-write paths in `api/players/[handle].js:351-360, 434-453, 539-555` as an override to ownership token.

**Three-tier auth gate on stats writes** (`api/players/[handle].js:526-566`):
- Admin token (body) — always wins
- Ownership Bearer matching the player's stored hash — owner self-update
- Room host Bearer matching `room:{code}.authToken` AND target handle in `room.players[]` — host writing for any participant

Without this gate, anyone could pollute career stats. Spelled out in detail in `docs/SECURITY.md` (per `CLAUDE.md` memory).

**Anti-fraud mechanism for community votes:**
- Browser fingerprint deduplication on end-game votes (`api/rooms/vote/[code].js:48-55`). Capped at last 1000 fingerprints per room to bound KV record size (`vote/[code].js:67-74`).

## Image Upload / Photo System

- **Client-side processing only** (no server upload pipeline). `src/player/playerCreateModal.js:306-318`:
  1. `FileReader.readAsDataURL` reads file
  2. `<canvas>` of fixed 400x400 resizes the image
  3. `canvas.toDataURL('image/jpeg', 0.8)` produces base64 JPEG
- Submitted as `photoBase64` field in POST `/api/players/create` body and stored inline on the player KV record.
- Server validates: must start with `data:image/`, length ≤ 150,000 chars (~100KB) (`api/players/_utils.js:87-97`).
- Display: `src/player/photoRenderer.js` renders the data URL inline. Used at 64px in player browser (`players.html:273`), 120px on profile page (`player-profile.html:633`), 320px in MVP victory modal and PNG export (per `CLAUDE.md`).

## Monitoring & Observability

**Error tracking:**
- None. Errors logged via `console.error(...)` in catch blocks (every API route, e.g., `api/rooms/create.js:104`, `api/players/[handle].js:933`). Visible only in Vercel function logs.

**Logs:**
- `console.log` / `console.error` throughout. Migration endpoints log progress (e.g., `api/players/[handle].js:147,170,171,308`). No structured logger, no log aggregation.

**Analytics:**
- None.

**Health checks / status endpoints:**
- None defined.

## CI/CD & Deployment

**Hosting:**
- Vercel (`vercel.json` present). Build command `npm run build`, output `dist/`, `framework: null` (Vercel auto-detects `api/` for Edge Functions).

**CI Pipeline:**
- No `.github/workflows/`, no `.gitlab-ci.yml`, no `circle.yml`. Per project memory and CLAUDE.md, deployment is push-to-Vercel via Git integration; the `gh` CLI is used for PR review loops but no GitHub Actions configured for build/test.

**Pre-deploy verification:**
- Manual `npm run build` locally. No automated tests block deploy.

## Environment Configuration

**Required env vars (production):**
- `KV_REST_API_URL` — auto-injected by Vercel KV
- `KV_REST_API_TOKEN` — auto-injected by Vercel KV
- `ADMIN_TOKEN` — must be manually set in Vercel project env (long random string). If missing, admin endpoints all fail-closed.

**Optional env vars:**
- `KV_URL` — direct Redis connection (alt path; not required when REST creds present)

**Secrets location:**
- Vercel project Environment Variables tab (production)
- `.env.local` for local dev (gitignored; existence confirmed in working tree, contents not read)
- Per-user ownership tokens in browser `localStorage` (per-handle key `gd_owner_token_{handle}`)

## Webhooks & Callbacks

**Incoming webhooks:** None.

**Outgoing webhooks:** None.

**Real-time pub/sub:** None. Coordination is poll-based:
- Host auto-syncs game state every 10s (`src/share/roomManager.js:312-314`) plus on critical actions
- Viewers poll every 2s with change detection (`src/share/roomManager.js:329-331`); UI repaints only when `lastUpdated` timestamp advances

## API Surface (this project's own routes)

All routes are Vercel Edge Functions. CORS is wide-open on every JSON response (`Access-Control-Allow-Origin: *`).

### `/api/rooms/`

| Route | Methods | File | Purpose |
|-------|---------|------|---------|
| `/api/rooms/create` | POST | `api/rooms/create.js` | Create new game room. Generates 6-char alphanumeric code (collision-checked, up to 10 retries) + 32-byte hex host auth token. Stores `room:{code}` with 1-year TTL. Adds entry to `rooms:index` (capped 100). Returns `{ roomCode, authToken, expiresIn: 31536000 }`. |
| `/api/rooms/[code]` | GET | `api/rooms/[code].js` | Get public room data. Strips `authToken` from response. Validates code matches `^[A-Z0-9]{6}$`. |
| `/api/rooms/[code]` | PUT | `api/rooms/[code].js` | Update room state. Requires `Authorization: Bearer <hostToken>` (constant-time match against stored token; TOFU fallback for legacy rooms). Persists with 1y TTL or no TTL if `isFavorite`. |
| `/api/rooms/list` | GET | `api/rooms/list.js` | Browse rooms. Query params: `page`, `limit`, `favorites=true`, `player=<handle>`. Sorts by `lastUpdated` DESC. Filters out rooms whose handles start with `test_`. |
| `/api/rooms/vote/[code]` | POST, GET | `api/rooms/vote/[code].js` | Submit (POST) or read (GET) end-game MVP/burden votes. POST requires `mvpPlayerId`, `burdenPlayerId`, `fingerprint`. Rejects same-person vote and duplicate fingerprint. Capped at last 1000 fingerprints per room. |
| `/api/rooms/favorite/[code]` | POST, DELETE | `api/rooms/favorite/[code].js` | POST: mark room favorite (no expiry, add to `favorites:index`). DELETE: unfavorite (revert to 1y TTL, remove from index). |
| `/api/rooms/reset-vote/[code]` | POST | `api/rooms/reset-vote/[code].js` | Archive `voting.currentRound` to `voting.history` and reset for next round. NOTE: this endpoint targets `voting` shape, distinct from `endGameVotes` written by `vote/[code].js`. |

### `/api/players/`

| Route | Methods | File | Purpose |
|-------|---------|------|---------|
| `/api/players/create` | POST | `api/players/create.js` | Create new profile. Validates handle (`/^[a-zA-Z0-9_]+$/`, 3-20 chars), display name, emoji, play style (one of 9 enums), tagline (≤50 chars), optional photoBase64 (≤150K chars, must start `data:image/`). Issues per-user ownership token (returned ONCE, hashed-only on server). Stores `player:{handle}` (permanent) and `player_id:{PLR_XXX}` lookup. |
| `/api/players/[handle]` | GET | `api/players/[handle].js` | Fetch player profile. Strips `ownershipTokenHash`. Optional `?migrate=true` triggers in-place mode-stats migration. |
| `/api/players/[handle]` | PUT | `api/players/[handle].js` | THREE branches based on body field `mode`: (1) `PROFILE_UPDATE` — edit profile fields, requires admin token OR ownership Bearer; (2) `ROTATE_TOKEN` — issue fresh ownership token, returns once, last-write-wins; (3) default (no `mode` or `mode: 'VOTE_ONLY'`) — game stats update, requires admin OR owner Bearer OR room-host Bearer with target in room.players[]. Vote counts are read authoritatively from the room (NOT trusted from request body). Snapshots `ownershipTokenHash` and `id` to prevent cross-path mutation. |
| `/api/players/list` | GET | `api/players/list.js` | Search players. Query: `q`, `limit` (1-100), `offset`. Sorts by `lastActiveAt` DESC. Strips token hash. |
| `/api/players/touch` | POST | `api/players/touch.js` | Update `lastActiveAt` for a handle. No auth (used when adding a player to a game). |
| `/api/players/delete` | POST | `api/players/delete.js` | Permanent delete. Requires admin token. Removes both `player:{handle}` and `player_id:{id}`. |
| `/api/players/reset-stats` | POST | `api/players/reset-stats.js` | Wipe stats and recent games but keep identity. Requires admin token. |
| `/api/players/migrate-modes` | POST | `api/players/migrate-modes.js` | Bulk migrate ALL players to mode-specific stats (4P/6P/8P breakdowns). Requires admin token (was previously public — security-fixed). Uses `kv.scan` cursor loop. `maxDuration: 60`. |
| `/api/players/migrate-single` | POST | `api/players/migrate-single.js` | Migrate one player by handle. NO auth (informational endpoint, intended for admin use during incident response — note: no token check, accepts plain `{handle}` body). |
| `/api/players/backfill-duration` | GET | `api/players/backfill-duration.js` | For a given handle, recompute missing `game.duration` fields by reading `room.createdAt` and `room.finishedAt` from KV. NO auth. `maxDuration: 30`. |

### Notable security features baked into this surface

- Constant-time compare everywhere a secret is checked (helpers in `api/players/_utils.js:196-269` and inline in `api/rooms/[code].js:7-15`).
- Authoritative vote counts: even authenticated hosts can't inflate `mvpVoteCount` / `burdenVoteCount` because the server overrides them from the actual room record before applying deltas (`api/players/[handle].js:568-595`).
- `votingHistory` makes vote sync idempotent — repeat syncs of the same room don't double-count.
- `mvpVotes` / `burdenVotes` running totals clamped at 0 (`api/players/[handle].js:701-702, 900-901`) so legacy negative deltas can't underflow.

---

*Integration audit: 2026-05-03*

## Anomalies and observations for follow-up

1. **`migrate-single.js` and `backfill-duration.js` have NO auth check** — they are state-mutating endpoints. `migrate-single` could be used by anyone to trigger expensive replay-and-write on any player; `backfill-duration` reads room data and writes player records. These look like they were intended as admin tools but were never gated. Worth flagging to CONCERNS.md if a "concerns" pass runs.
2. **`reset-vote/[code]` has no auth check at all** — anyone with a room code can wipe `voting.currentRound`. Lower impact (just resets vote tally for current round) but still unauthenticated state mutation.
3. **`touch.js` has no auth** by design — the server only updates `lastActiveAt`. Acceptable, but means anyone can trigger `kv.get` + `kv.set` per arbitrary handle (cheap DoS surface).
4. **Two distinct vote shapes** coexist in room records: `endGameVotes` (written by `vote/[code].js`, used as authoritative source for stats sync) and `voting.currentRound`/`voting.history` (touched by `reset-vote/[code].js`). Code search would clarify which is the active one — flagging because integration docs should not paper over this dual-track design.
5. **`docs/SECURITY.md`** is referenced as the source of truth for the auth model in CLAUDE.md and project memory. Not opened during this pass; recommended reading before any auth-touching change.
