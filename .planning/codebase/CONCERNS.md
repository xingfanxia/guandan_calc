# Codebase Concerns

**Analysis Date:** 2026-05-03

This document inventories risk and debt for the Guandan scorer (vanilla ES6 + Vite + Vercel KV). The recent 2026-05 audit + follow-up work closed the major security holes (per-user ownership tokens, stats-path auth, vote forgery, vandalism, admin gating, A-fail rule simplification) — what remains is mostly drift and lower-tier polish.

Severity legend: **HIGH** (fix soon), **MED** (fix this quarter), **LOW** (track, fix opportunistically).

---

## 1. Open TODO / FIXME / HACK / XXX comments

A repo-wide grep across `src/` and `api/` returns exactly **one substantive marker**:

**[LOW] Voting confirmation never actually persists** — `src/ui/victoryModal.js:419`
```js
alert(`已确认：...`);
// TODO: Actually record to "人民的声音" section and sync
closeVictoryModal();
```
- Issue: The host clicks "confirm voting results" → an `alert()` fires claiming the result was recorded → modal closes → nothing persists to the "人民的声音" panel and no profile sync happens.
- Files: `src/ui/victoryModal.js:410-424`
- Impact: Voting results from the in-modal flow are lost. The auto-sync path (`scheduleAutoVotingSync` in `src/share/votingSync.js`) does still fire 5 minutes later for room games, so room hosts are partially covered — but the local/manual confirm flow shown in the modal is a no-op.
- Fix approach: Wire the click handler to call `syncVotingToProfiles` (already exported from `src/share/votingSync.js`) and write a "人民的声音" entry to wherever the panel reads from. Then drop the misleading alert.

The other hit (`api/players/_utils.js:5`) is a JSDoc `@example PLR_XXXXXX` placeholder, not a debt marker.

---

## 2. Drift between docs and code

**[MED] `CLAUDE.md` claims "38 modules" — actual count is 41**
- `find src -name '*.js' | wc -l` = **41** (project CLAUDE.md says 38)
- New since the 38-count snapshot: `src/core/modal.js` (accessibility helper), `src/player/playerEditModal.js` (added with ownership-token rotation), `src/stats/mvpBurden.js` (extracted MVP/burden logic). All three are imported and live.
- Files: `/Users/xingfanxia/projects/side-projects/guandan-scorer/CLAUDE.md` lines 18, 33 (the "38 modules" header)
- Impact: Docs lag, future readers double-check the wrong number. Cosmetic but corrosive.
- Fix: Replace "38 modules" with "41 modules" in CLAUDE.md `## Architecture Status` and `### Module Organization` headers; add bullets for `core/modal.js`, `player/playerEditModal.js`, `stats/mvpBurden.js`.

**[HIGH] `CLAUDE.md` repeatedly references `src/app.js` (1,947 lines) as a legacy reference — the file does not exist**
- Verified: `ls /Users/xingfanxia/projects/side-projects/guandan-scorer/src/app.js` → **no such file**.
- Cited locations in CLAUDE.md (still pointing at a deleted file):
  - L20-22: `**Legacy Reference**: src/app.js (1,947 lines)`
  - L107: `## Key Implementation Details (from working src/app.js)`
  - L113: `**A-Level Logic** (lines 1533-1592 in src/app.js)`
  - L188: `### Drag and Drop System (lines 188-599 in src/app.js)`
  - L208: `1. **A-Level Logic** (src/app.js:1533-1592)`
  - L227, L246, L268: more "src/app.js:1818-1893", "Reference: Consult src/app.js (1,947 lines)", "src/app.js contains all working game logic"
- Impact: This is the most dangerous drift in the repo — CLAUDE.md instructs future agents to "Consult src/app.js for working implementation" as the source of truth. An agent following that instruction reads nothing, may hallucinate logic, or worse, may try to recreate the file.
- Fix: Either (a) restore `src/app.js` from git history if it's still wanted as reference, or (b) delete every reference and update line citations to point at the actual modular files (e.g., `src/game/rules.js` for A-level logic, `src/player/touchHandler.js` for touch drag).

**[LOW] Spot-check: 5 modules described in CLAUDE.md match reality**
- Sampled `core/state.js`, `game/calculator.js`, `player/touchHandler.js`, `share/roomManager.js`, `stats/honors.js` — all exist with described responsibilities. Module-level descriptions are accurate.

**[LOW] `MODULAR_REWRITE_COMPLETE.md` claims "20 ES6 modules" (root file)**
- This is a historical snapshot dated 2025-12-06 and labels itself as such. Drift but not actively misleading. Consider archiving to `docs/history/` to remove confusion.
- Files: `/Users/xingfanxia/projects/side-projects/guandan-scorer/MODULAR_REWRITE_COMPLETE.md`, `/Users/xingfanxia/projects/side-projects/guandan-scorer/MODULAR_STATUS.md`

---

## 3. Dead code / unused modules

Spot-checked all modules in `src/share/`, `src/export/`, `src/stats/`, `src/player/` against grep for imports. **Result: zero dead modules in source tree.** Every file in `src/` has at least one importer somewhere in `src/`, `index.html`, `players.html`, `player-profile.html`, or `rooms.html`.

Notable connections verified:
- `src/stats/achievements.js` — imported only by `player-profile.html:98` (one consumer; intentional, used for badge display)
- `src/player/photoRenderer.js` — imported by `victoryModal.js`, `votingManager.js`, `players.html`, `player-profile.html`
- `src/player/playerEditModal.js` — imported by `player-profile.html:101` only
- `src/share/shareManager.js` — imported by `main.js` and `controllers/exportControls.js`
- `src/export/exportMobile.js` — imported by `export/exportHandlers.js:223`

**[LOW] `temp/` directory contains a stale parallel module tree**
- `/Users/xingfanxia/projects/side-projects/guandan-scorer/temp/{core,export,game,player,ranking,share,stats,test,ui}/` — 13 `.js` files dated Dec 2025
- Not imported by anything; not in `vite.config.js` inputs; not deployed.
- Impact: Confuses grep / IDE search, causes "which storage.js is current?" questions.
- Fix: Delete `temp/` or move to `.archive/` outside of source-search reach.

---

## 4. TODO.md content (outstanding work)

`TODO.md` last-updated 2025-12-11. Open items grouped by priority:

**High priority (User-facing):**
1. **Achievement unlock notifications** — toast / animation / sound on profile sync (effort: small, impact: high)
2. **Season system** — monthly/quarterly leaderboards + season honors (effort: large, impact: medium)
3. **Mobile optimizations** — touch-optimized profile cards, swipe nav, mobile emoji selector (effort: medium, impact: medium)

**Medium priority (Polish):**
4. **Profile share** — copy link, QR code, PDF export, dark mode (effort: small, impact: low)
5. **Voting UX** — countdown timer, sync-complete notification, vote history per player, all-time vote leaderboard (effort: small, impact: medium)

**Low priority (Future):**
6. **Authentication** — OAuth, profile claiming, password protection, admin panel (effort: large, impact: low) — *partially addressed by per-user ownership tokens shipped 2026-05-03*
7. **Advanced analytics** — perf trends, honor frequency, team composition suggester, predictive win rate

**Known minor issues** (called "by design"):
- Local voting results don't sync to profiles (only room voting)
- Partner/rival only tracks profile players, not session-only players
- Recent rankings not retrospective for old data

**Future improvements section:**
- Add TypeScript for type safety
- Add unit tests for critical algorithms ⚠ (see §9 below)
- Performance optimization for large histories
- Accessibility improvements (ARIA, keyboard nav)

---

## 5. Security posture summary

Source of truth: `docs/SECURITY.md` (last reviewed 2026-05-02 audit `fa18718`, updates through 2026-05-03).

**Threat model:** vandalism, stat forgery, XSS, DoS via expensive admin endpoints. No money / PII / chat — realistic threat is low.

**Auth gates currently in place:**

| Surface | Auth |
|---|---|
| `POST /api/rooms/create` | None (public — generates server-side `authToken`, returns ONCE) |
| `GET /api/rooms/<code>` | None (strips `authToken` from response) |
| `PUT /api/rooms/<code>` | `Authorization: Bearer <authToken>`, constant-time compare. TOFU on legacy rooms |
| `POST /api/players/create` | None (public — issues per-user ownership token, hash stored, raw returned ONCE) |
| `GET /api/players/<handle>` | None (strips `ownershipTokenHash`) |
| `PUT /api/players/<handle>` PROFILE_UPDATE | EITHER `adminToken` body OR `Authorization: Bearer <ownershipToken>` (SHA-256 + constant-time hex compare) |
| `PUT /api/players/<handle>` ROTATE_TOKEN | Same as PROFILE_UPDATE |
| `PUT /api/players/<handle>` stats path | 3-tier gate: admin OR owner-Bearer OR room-host-Bearer + handle-in-`players[]` |
| `POST /api/players/delete` | `validateAdminToken` |
| `POST /api/players/reset-stats` | `validateAdminToken` |
| `POST /api/players/migrate-modes` | `validateAdminToken` (added 2026-05-02 — was previously PUBLIC) |
| `POST /api/players/touch` | None (just bumps `lastActiveAt`) |
| `GET /api/players/list` | None (search-by-prefix; returns sanitized records) |
| `GET /api/players/backfill-duration` | **None** (rewrites player record from room timestamps) |
| `POST /api/players/migrate-single` | **None** (rewrites a single player record) |

**Fail-closed for admin:** all `validateAdminToken` calls return false if `ADMIN_TOKEN` env is unset (`api/players/_utils.js:199-201` logs `⚠️ ADMIN_TOKEN env var not set — admin endpoints reject all requests`). Confirmed in code.

**Vote forgery (closed):** `gameResult.mvpVoteCount` / `burdenVoteCount` are now overridden by authoritative server values for room games (`api/players/[handle].js:575-595`). LOCAL games still trust client values, but the auth gate restricts LOCAL writes to owner-Bearer (self-spam only).

**Vote fingerprint cap (closed):** `api/rooms/vote/[code].js:68-73` enforces `FINGERPRINT_CAP = 1000`. The audit doc still mentions this as outstanding (`docs/SECURITY.md` "Vote fingerprint array is unbounded") — but the code shows it's resolved. Doc drift, not a real concern.

**Accepted LOW findings** (intentionally not fixed, documented in SECURITY.md):
- Room-existence timing oracle (`api/players/[handle].js:516-524` / `513-515`) — room codes already public via `/api/rooms/list`, so no confidential signal leak
- Per-path timing differential (admin → owner-SHA → host-KV+compare) — no actionable leak

---

## 6. Performance considerations

**[HIGH] `api/players/list.js:43` does `await kv.keys('player:*')` — unbounded scan**
- Vercel KV docs warn against `KEYS` in production. Every call to `GET /api/players/list` scans every key in the database, fetches every value, then paginates client-side.
- File: `api/players/list.js:43-47`
- Impact: Linear cost per request as players scale. Currently fine (~10 test players + a handful of real ones), but a viral moment or abuse triggers full-DB scans on every search keypress (the front-end calls this on every search input change).
- Fix approach: Maintain a separate `players:index` sorted set keyed by `lastActiveAt`, mirror the pattern already used for `rooms:index` in `api/rooms/list.js:34-45`.
- Note: `api/players/migrate-modes.js:113` uses `kv.scan` (cursor-based, count: 100) which is the correct pattern.

**[LOW] Polling intervals confirmed in source**
- Viewer poll: 2 seconds — `src/share/roomManager.js:329-331`
- Host auto-sync: 10 seconds — `src/share/roomManager.js:312-314`
- Vote leaderboard refresh during voting: 1 second (per CLAUDE.md, not directly verified)
- These cadences match docs. KV operations cost money; 2s polling per active viewer is the dominant cost driver — note for future "if Vercel KV bill spikes, this is why."

**[LOW] Photo upload pipeline confirmed client-side**
- `src/player/playerCreateModal.js:311-318` and `src/player/playerEditModal.js:357-364`: canvas resize to 400×400, JPEG quality 0.8, sent as data-URL.
- File-size cap is enforced server-side: `validatePlayerData` rejects `photoBase64 > ~150KB`.
- Client-side resize happens before upload — verified.

**[LOW] Bundle size — main bundle is 106KB (`dist/assets/main-Bc2ZfS54.js`), profile bundle 247KB**
- The 247KB profile bundle is dominated by Chart.js (`chart.js@^4.5.1` is the only heavy dep besides `@vercel/kv`). Reasonable for a chart-heavy page.
- Main bundle 106KB is fine for a vanilla SPA.
- No obvious bloat to address.

**[LOW] No legacy monolith ships**
- `vite.config.js` declares 4 inputs: `index.html`, `players.html`, `rooms.html`, `player-profile.html`. None reference `src/app.js` (which doesn't exist anyway).
- `index.html:8` loads `<script type="module" src="/src/main.js">` — modular only.
- `dist/` contains no `app.js` artifact.

---

## 7. Mobile / touch concerns

**[LOW] Touch drag has known guard against orphan-tile race**
- `src/player/touchHandler.js:44-54`: 200ms long-press timer wraps an `if (!tile.isConnected) return` guard. Comment cites "P1 #5 fix" from the 2026-05-02 audit — re-renders between `touchstart` and the timer firing would otherwise drag a detached node.
- Cleanup function `cleanupTouchDrag()` is called on every `handleTouchStart` (line 35) to flush any leftover state from a prior drag.
- `dataset.touchHandlersAttached` guard prevents duplicate listener attachment (per audit comment, line 52-53).

**[MED] Audit-recommended delegation refactor not done**
- The same comment block (lines 50-52) notes "the full delegation refactor recommended in the 2026-05-02 audit would attach listeners to parent zones instead." The surgical orphan-tile patch ships, but the deeper architectural fix is deferred.
- Impact: Other touch races may exist that the orphan guard doesn't cover (e.g., touch ending on a re-rendered drop zone). No reported bugs, but the audit flagged it for a reason.
- Fix approach: Replace per-tile listeners with delegated handlers on the team-pool / ranking-zone parents. Larger refactor, ~1 day.

---

## 8. API surface concerns

**[HIGH] `api/players/backfill-duration.js` — no auth, mutates player records**
- Path: `GET /api/players/backfill-duration?handle=xxx`
- Anyone with knowledge of an admin-only utility URL can trigger a player-record rewrite (recomputes `gameDurationSeconds` from room timestamps, then `kv.set` the player).
- File: `api/players/backfill-duration.js:1-end` — no `validateAdminToken`, no Bearer check.
- Impact: Vandalism / data corruption. The endpoint is "well-meaning data-fix utility" but is wide open. Worse, it iterates `player.recentGames` and writes back per game, so abuse can stack writes.
- Fix approach: Add `validateAdminToken(adminToken)` check at the top, same pattern as `delete.js` / `reset-stats.js`. Consider whether this endpoint should exist in production at all — it looks like a one-shot migration tool.

**[HIGH] `api/players/migrate-single.js` — no auth, mutates player records**
- Path: `POST /api/players/migrate-single` body `{ handle }`
- Same shape as `backfill-duration` — well-meaning utility, no auth gate.
- File: `api/players/migrate-single.js:1-end` — no `validateAdminToken`.
- Impact: Anyone can trigger schema migration on any player record. The migration is idempotent (lines 36-40 short-circuit if already migrated), so the practical attack surface is small, but this is inconsistent with the rest of the admin-gated endpoints.
- Fix: Add `validateAdminToken` or remove the endpoint (its sibling `migrate-modes.js` does the same job batch-style and IS gated).

**[MED] `api/rooms/reset-vote/[code].js` — no auth, mutates room voting state**
- Path: `POST /api/rooms/reset-vote/<code>`
- Anyone with the room code can wipe `voting.currentRound` and archive results to history.
- File: `api/rooms/reset-vote/[code].js:1-end` — no Bearer check.
- Impact: Vandalism — viewer can blow away a host's voting results between rounds. Not catastrophic (history archive preserves prior rounds), but inconsistent with `api/rooms/[code].js` PUT which IS Bearer-gated.
- Fix: Add same Bearer-token check used in `api/rooms/[code].js` (`extractBearerToken` + constant-time compare against `room.authToken`).

**[MED] `api/rooms/favorite/[code].js` — no auth, removes TTL on rooms**
- Path: `POST /api/rooms/favorite/<code>` (toggle favorite, store without expiration)
- Anyone with a room code can promote rooms to permanent storage, indefinitely consuming KV space.
- File: `api/rooms/favorite/[code].js:1-60` — no auth.
- Impact: KV storage growth via abuse. Per-room cost is small but unbounded over time.
- Fix: Add Bearer check (host-only favorite), or rate-limit, or cap total favorite count globally.

**[LOW] `api/players/touch.js` — no auth, bumps lastActiveAt**
- Path: `POST /api/players/touch` body `{ handle }`
- Anyone can mark any player as recently active. Affects `api/players/list.js` ordering and "last active" displays.
- File: `api/players/touch.js:1-end`
- Impact: Cosmetic — sort ordering can be gamed. Probably acceptable in this app's threat model.
- Fix: Optional. If addressed, accept owner-Bearer only.

---

## 9. Test gaps

**[MED] Zero automated test coverage for production code**
- `package.json` has no `test` script. No `jest`, `vitest`, `mocha`, etc. in dependencies.
- The only "tests" are 7 manual HTML harnesses in `temp/test/*.html` (calculator, config, events, history, phase1/2 integration, playerManager) — last touched 2025-12-06, predate ALL of the 2026-05 security work.
- Manual surface (per `TODO.md`'s pre-production checklist + features in CLAUDE.md): at minimum **9 critical flows** require manual regression each release:
  1. A-level victory in strict mode (`ST.roundOwner === aTeam` check)
  2. A-fail counter in 4P mode (cancelled in 6/8P per commit `617ac6e`)
  3. 6/8-mode point-threshold upgrades
  4. Touch drag-drop on iOS / Android (orphan-tile race per `touchHandler.js:44-54`)
  5. Room create → host PUT with Bearer → viewer GET → 2s poll update
  6. Voting submission + dedup + fingerprint cap (1000) + authoritative count override
  7. Profile create → ownership token issued → PROFILE_UPDATE with Bearer → token rotation
  8. Stats sync (`syncProfileStats` 6-param call from `main.js:230-251`)
  9. PNG export with Chinese text + MVP photo
- Impact: Every refactor risks silent regression. The 2026-05 audit fixes are particularly fragile — auth gates have edge cases that only manifest under specific token states.
- Fix approach: Start with unit tests for pure functions in `src/game/calculator.js` and `src/game/rules.js` (the A-level logic is the highest-leverage target). Add Playwright for the 4 integration flows touching the API.

---

## 10. Recently shipped & still warm (last 5 commits)

For the next reviewer's awareness — **NOT to re-litigate**:

1. **`5929eba` — P2/P3 audit follow-ups + token rotation endpoint** (2026-05-03)
   - Net new: `ROTATE_TOKEN` mode in `api/players/[handle].js`, "重新生成令牌" UI in edit modal
   - Watch: rotation invalidates ALL existing copies of the token instantly. If a user has the app open on phone + laptop and rotates from laptop, the phone session can't write until it re-fetches.

2. **`baf1f82` — 5 P1 audit follow-ups** (2026-05-03)
   - Net new: orphan-tile guard in `touchHandler.js:54`, authoritative vote-count override in `[handle].js:575-595`, stats-path 3-tier auth gate in `[handle].js:526-566`
   - Watch: the auth gate has 3 paths (admin / owner / host); a regression in any one breaks a different user persona

3. **`e24798c` — wire `clearOwnershipToken` to forget-device button** (2026-05-03)
   - One-liner connecting an existing function to a button. Low risk.

4. **`e474452` — per-user ownership tokens + 3-tier stats auth gate** (2026-05-03)
   - The big one. Schema change: `player.ownershipTokenHash` field, raw token returned ONCE on create, persisted client-side via `playerApi.js:21 saveOwnershipToken` to `localStorage` keyed `gd_owner_token_<handle>`.
   - Watch: legacy players (created before 2026-05-03) have NO `ownershipTokenHash`, so they fall through to admin-only edit. Token rotation cannot bootstrap one for them — by design, since rotation requires an existing token to authorize the swap.

5. **`617ac6e` — 6/8-mode rule (no A-fail counter) docs propagation** (2026-05-02)
   - 8 docs updated to reflect that 6/8-player modes no longer track 3-strike A-fail → reset-to-2.
   - Code change shipped earlier in `fa18718`; this commit was doc cleanup.
   - Watch: any new game-rule code touching `aFailCount` must check `mode !== '6P' && mode !== '8P'` before incrementing.

---

## Top 3 highest-severity items (executive summary)

1. **`CLAUDE.md` instructs agents to consult `src/app.js` as the source of truth — the file does not exist.** Future Claude sessions will follow stale instructions and either fabricate logic or chase a ghost. (§2)

2. **Three API endpoints lack auth gates and mutate state**: `api/players/backfill-duration.js`, `api/players/migrate-single.js`, `api/rooms/reset-vote/[code].js`. The first two were missed during the 2026-05 audit because they look like utilities; the third is inconsistent with the Bearer-gated `api/rooms/[code].js` PUT. (§8)

3. **`api/players/list.js:43` does an unbounded `kv.keys('player:*')` scan on every search keystroke.** Viable today (~10 players) but grows linearly forever — Vercel docs explicitly warn against `KEYS` in production. The pattern fix already exists (`rooms:index` in `api/rooms/list.js:34-45`). (§6)

---

*Concerns audit: 2026-05-03*
