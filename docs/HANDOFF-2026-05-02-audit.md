# Session Handoff — Audit + 6/8 Rule Revision

**Date:** 2026-05-02
**Commit shipped:** `fa18718`
**Files touched:** 26 (+621 / -423)
**Build status:** ✅ green
**Pushed:** ✅ origin/main

This handoff is for the next session to pick up the deferred audit items.

---

## What this session shipped

1. **6/8-player rule revision** — A1/A2/A3 fail counter removed, no demotion to
   level 2, game continues until either side wins on their own A. 4-player rules
   unchanged. UI hides 失败 chips and shows `通关中` for 6/8.

2. **Security CRITICAL (5 fixes)** — see `docs/SECURITY.md` for the full model.
   - Server-side room auth token + Bearer validation + TOFU for legacy rooms
   - All admin endpoints validate `ADMIN_TOKEN` env var (constant-time compare)
   - Hardcoded password rotated out of source / CLAUDE.md / players.html
   - migrate-modes.js was previously PUBLIC — now admin-gated
   - XSS escapeHtml applied to player names / taglines / handles in 4 surfaces

3. **Game logic HIGH (8 fixes)** — `nextBaseByRule` after override; rollback
   restores `nextRoundBase` + `roundOwner`; ranks length validation; deep-clone
   history entries; idempotent hydrate; sync closure capture; double-submit
   guard; `Number()` team coercion; minimal config slice.

4. **Stats sync HIGH (4 fixes)** — snapshot N before increment for running avg;
   `??` not `||` for vote counts; defensive `|| 0` on streaks; combined
   MVP+burden in single PUT.

5. **Honor scaling** — 翻车王 / 鲤鱼王 thresholds now `ceil(N/3)` instead of
   fixed top-3 / bottom-3 (was triggering on 75% of field in 4P).

---

## ⚠️ Deployment action item (before next prod deploy)

Set `ADMIN_TOKEN` in Vercel project env. Without it, `delete`, `reset-stats`,
`migrate-modes`, and `PROFILE_UPDATE` all reject (fail-closed).

```bash
# Generate token
openssl rand -hex 32

# Add to Vercel
vercel env add ADMIN_TOKEN production
```

Until this is set, regular users CANNOT edit their profiles via
`playerEditModal` (the modal will get 403 from the server). Admins still can
by entering the token in `players.html`.

---

## Deferred follow-ups (for next session)

Ranked by impact. Each item links to the audit finding source so context is
preserved.

### P0 — ✅ Shipped 2026-05-03

#### 1. Per-user ownership tokens (unblocks self-edit profile) — DONE

Server issues 32-byte CSPRNG token at create, stores SHA-256 hash on the
player record (raw never persisted). PUT PROFILE_UPDATE accepts either
`adminToken` body field or `Authorization: Bearer <token>` header. Client
persists token to `localStorage` as `gd_owner_token_<handle>`. Edit modal
reveals admin-token input only when local owner token is absent.

Hash is stripped from every player-shaped API response (create / GET /
list / reset-stats / PROFILE_UPDATE return). 21-test verification script
at `scripts/ops/verify-ownership-tokens.mjs`.

Auth model documented in `docs/SECURITY.md` § "PROFILE_UPDATE auth".

### P0 — ✅ Shipped 2026-05-03 (uncovered + closed same day)

#### 1b. Stats-update path 3-tier auth gate — DONE

Previously `PUT /api/players/<handle>` with `mode !== 'PROFILE_UPDATE'` had no
auth and let any anonymous client pollute career stats. Closed the same day:

- 3-tier auth gate: admin token (body) OR owner Bearer (matches target hash)
  OR room-host Bearer (matches `room.authToken` AND target in `room.players[]`)
- Client wiring: `updatePlayerStats(handle, gameResult, roomAuthToken)`,
  `syncProfileStats` threads the host's room token through, `votingSync.js`
  does the same. main.js passes `getRoomInfo().authToken` for host-only auth
- Defense in depth: snapshot/restore of `ownershipTokenHash` + `id`
- 7 new tests in `scripts/ops/verify-ownership-tokens.mjs` (37 total, all pass)

Auth model documented in `docs/SECURITY.md` § "Stats-update auth".

#### 1c. No ownership-token rotation / revocation (P3)

Once issued at create-time, the ownership token is the only credential
forever. If a user suspects compromise (browser shared, localStorage scraped),
they need an admin to delete + recreate. Future affordance: `POST
/api/players/<handle>/rotate-token` requiring current Bearer (or admin).

### P1 — ✅ All 5 shipped 2026-05-03

#### 2. Vote-count forgery — DONE
`PUT /api/players/<handle>` stats path now overrides client-supplied
`mvpVoteCount` / `burdenVoteCount` with authoritative values fetched from
`room.endGameVotes[mvp|burden][playerId]`. The room is loaded once at the top
of the stats branch and reused for both auth (host-Bearer check) and vote
fetch (single KV roundtrip). LOCAL games keep client values — there's no
shared store, and the auth gate already restricts LOCAL writes to the
player's own profile via owner Bearer.

#### 3. Vote fingerprint cap — DONE
`api/rooms/vote/[code].js` caps `fingerprints` to the last 1000 entries via
`.slice(-FINGERPRINT_CAP)` after each push. When the cap is reached, oldest
fingerprints fall off — acceptable trade for this app's threat model.

#### 4. Modal accessibility — DONE
New `src/core/modal.js` exposes `setupModalAccessibility(modalElement,
closeModal)`: sets `role="dialog"` + `aria-modal="true"`, locks body scroll,
adds Escape-to-close, traps Tab within the modal, and auto-focuses the first
focusable element. Wired into both `playerCreateModal.js` and
`playerEditModal.js`. Returns a cleanup function that close handlers invoke.

#### 5. Touch handler orphan-tile guard — DONE (surgical fix)
The audit's listener-leak concern is already mitigated by the existing
`dataset.touchHandlersAttached` guard, so the actual remaining bug was the
orphan-timer race: if a re-render detaches the tile during the 200ms
long-press window, the captured `tile` reference operates on an invisible
orphan. Fix: `if (!tile.isConnected) return;` inside the timer
(`src/player/touchHandler.js:44`). Full parent-zone delegation refactor
remains a future improvement if perf measurement ever shows attachment
overhead — surgical patch fixes the actual bug without disturbing 4 files.

#### 6. Mode change ranking-area refresh — DONE
`settingsControls.js` mode-change handler now calls `renderRankingArea(mode)`
explicitly after `generatePlayers`, regardless of whether the latter
early-returned. Imports `renderRankingArea` directly rather than relying on
the unconsumed `ui:modeChanged` event.

### P2 — Quality

#### 7. `isDevelopment` hardcoded (Agent C LOW)

`src/share/roomManager.js` line 24 has `const isDevelopment = false;` with a
stale comment. Should read `import.meta.env.DEV` so vite-dev sessions don't
hit prod KV.

#### 8. Unused achievements (Agent C LOW)

`src/stats/achievements.js` defines `comeback`, `sweep`, `iron_will` but they
are never checked in `checkAchievements()` — dead definitions.

#### 9. Honors variance n=1 edge (Agent C MEDIUM)

`calculateVariance` returns 0 for length===1 (population variance with n=1 is
degenerate). Add Bessel correction (n-1) for sample variance OR document
choice explicitly.

#### 10. `votingManager.js` undefined refs (Agent C MEDIUM)

Lines 175-178 and 920-926 reference `currentRoomCode` and `isHost` that aren't
imported into module scope — would throw `ReferenceError` in strict mode if
that codepath ever fires. Use `getRoomInfo()` instead.

### P3 — Drift / hygiene

- `roomManager.js` poll interval is 2000ms but CLAUDE.md says 5s and earlier
  comment says 10s — pick one and reconcile (Agent C MEDIUM).
- MVP/burden tie-breaker logic duplicated between `statistics.js` and
  `exportMobile.js` (Agent C LOW). Extract shared helper.
- `state.js` `getPlayerStats()` returns shallow copy — nested player objects
  still mutable (Agent A LOW).

---

## How to start the next session

```bash
git pull
cat docs/HANDOFF-2026-05-02-audit.md   # this file
cat docs/SECURITY.md                    # security model context
cat ~/.claude/projects/-Users-xingfanxia-projects-side-projects-guandan-scorer/memory/MEMORY.md  # memory index
```

The memory system has `project_audit_followups.md` keyed to this same list,
so any agent picking up the work has full context.

Recommended first move: implement P0 (ownership tokens) to unblock
user-facing self-edit. ~1 session of focused work.
