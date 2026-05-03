# Testing Patterns

**Analysis Date:** 2026-05-03

## Test Framework

**No automated test framework.** This is a vanilla ES6 SPA with no Jest, Vitest, Mocha, Playwright, Cypress, or Puppeteer. `package.json` declares only:

```json
"scripts": {
  "dev": "vite",
  "build": "vite build",
  "preview": "vite preview"
}
```

No `test`, `lint`, `typecheck`, or `coverage` scripts. No `devDependencies` for test tooling beyond Vite itself.

## Test Files Inventory

### Existing manual test pages

`temp/test/*.html` — 11 HTML files containing visual smoke tests for early modular extraction work:

| File | Module under test |
|------|-------------------|
| `test-utils.html` | `src/core/utils.js` |
| `test-storage.html` | `src/core/storage.js` |
| `test-events.html` | `src/core/events.js` |
| `test-state.html` | `src/core/state.js` |
| `test-config.html` | `src/core/config.js` |
| `test-calculator.html` | `src/game/calculator.js` |
| `test-rules.html` | `src/game/rules.js` |
| `test-history.html` | `src/game/history.js` |
| `test-playerManager.html` | `src/player/playerManager.js` |
| `test-phase1-integration.html` | Cross-module Phase 1 integration |
| `test-phase2-integration.html` | Cross-module Phase 2 integration |

**Pattern:** each file is a self-contained `<html>` page with inline `<script>` that asserts behavior, paints PASS/FAIL boxes (green left-border for pass, red for fail), and logs to a `<div class="log">`. They are run by opening the file in a browser via `python -m http.server` and visually inspecting.

These are **historical artifacts** from the modular rewrite — there's no CI runner, no headless harness, and the codebase has evolved past them (e.g., player profile system, voting system, room sync are NOT covered).

### Production test files

None. No `*.test.js` / `*.spec.js` outside of `temp/test/`.

## Manual Testing Process

Per `CLAUDE.md` "Development Workflow":

1. **Reference**: consult `src/app.js` (1,947-line legacy IIFE) for working implementation
2. **Modify** modular files in `src/`
3. **Test locally** with `npm run dev` (port 5173 with HMR)
4. **Verify build** with `npm run build`
5. **Fallback** to `guodan_calc.html` if modular issues persist (legacy single-file version)

Visual smoke testing is the primary correctness gate. Console logs are scattered through the codebase (`console.log('Player data loaded:', ...)`, `console.log('⏱️ Timer stopped...')`) for runtime introspection during manual testing.

## Critical Testing Areas

Per `CLAUDE.md` "Critical Testing Areas" — these are the high-risk surfaces that need extra manual verification on every change:

### 1. A-Level Logic — `src/game/rules.js`
- Strict-mode victory: must win at own A-level round (`ST.roundOwner === aTeam`)
- Lenient-mode: any team can win at A
- 4-player: A-fail counter, 3 fails → reset to 2
- 6/8-player: NO A-fail counter (per recent rule simplification 2026-05) — see `feedback_audit_thoroughness` memory
- `roundOwner` tracking accuracy

### 2. Room Sync — `src/share/roomManager.js`
- Auto-sync timing (10s host interval + immediate on apply/advance)
- Viewer poll (2s with smart change detection on `lastUpdated` timestamp)
- Auth token validation
- Reconnect on URL parameter `?room=ABC123`

### 3. Voting System — `src/share/votingManager.js` + `src/share/votingSync.js`
- Anonymous viewer vote submission (5-min auto-sync schedule)
- Idempotent profile sync (votingHistory tracking, safe to re-run)
- Live vote count updates (1s polling)
- Host confirmation flow + reset

### 4. Honor Calculations — `src/stats/honors.js`
- All 14 algorithms across 4/6/8 player modes
- Variance analysis, trend detection (3-segment for 奋斗王)
- Edge cases: ties, single-player extremes, sparse data

### 5. Mobile Touch Drag-Drop — `src/player/touchHandler.js` + `src/player/dragDrop.js`
- 200ms long-press threshold to initiate drag
- Touch clone cleanup
- Drop-zone detection via `elementFromPoint`
- iOS Safari + Android Chrome (must verify on real devices, not emulator)

### 6. Canvas Export — `src/export/exportHandlers.js` + `src/export/exportMobile.js`
- PNG long-image generation
- UTF-8 Chinese character rendering (canvas fallback fonts)
- Team color visualization
- Mobile-optimized 600px-wide variant
- MVP photo at 320px (per CLAUDE.md, but not currently verified in code grep — may have regressed)

### 7. Modal A11y — `src/core/modal.js`
- Focus trap (Tab/Shift+Tab cycles within modal)
- Escape closes
- Body scroll lock (`document.body.style.overflow = 'hidden'`)
- Initial-focus auto-set
- Cleanup on close prevents listener leaks

### 8. Player Profile Stats Sync — `src/api/playerApi.js` `syncProfileStats()`
- All 6 parameters passed (historyEntry, roomCode, players, sessionStats, sessionHonors, votingResults)
- Relative ranking calculation (1-N within session)
- Partner/opponent extraction
- KV write per profile player

## CI Status

**No CI.** No `.github/workflows/`, no `.gitlab-ci.yml`, no `.circleci/`, no Vercel preview workflow file in repo (Vercel handles preview deploys via Git integration directly through their dashboard, not via repo config).

Vercel CD is configured via `vercel.json`:

```json
{
  "buildCommand": "npm run build",
  "outputDirectory": "dist",
  "framework": null
}
```

Pushes to `main` trigger production deploy. PR/branch pushes auto-create Vercel preview URLs (configured in Vercel dashboard, not repo). **No automated tests run on push.**

## E2E Tooling

None. No Playwright config, no Cypress, no Puppeteer scripts in `scripts/` or `package.json`.

## Browser DevTools Workflow (de facto)

The actual day-to-day "test" pattern, observable from console-log placement and code comments:

1. `npm run dev` → Vite serves at `http://localhost:5173`
2. Open browser DevTools → Console + Network + Application (LocalStorage)
3. Test specific feature manually
4. Inspect `localStorage` keys (`gd_v9_*`) to verify state persistence
5. Watch console for state-transition logs (`✓ State hydrated`, `Player data loaded:`, `Switched to ${selectedMode} mode:`, `⏱️ Timer stopped`)
6. For room sync: open second browser/tab as viewer with `?room=CODE` URL
7. For mobile touch: use Safari Web Inspector connected to physical iPhone, OR Chrome DevTools device emulation (caveat: emulation does NOT reproduce iOS long-press timing accurately)

## Test Coverage Gaps (Highest Priority for Future Work)

| Area | Risk | Priority |
|------|------|----------|
| Player profile stat sync (multi-mode, idempotent voting) | HIGH — silent drift between sessions and KV | P0 |
| A-level logic (4/6/8 modes, strict vs lenient, 6/8 no-A-fail rule from 2026-05) | HIGH — game-breaking if regressed | P0 |
| Mobile touch drag-drop on iOS Safari | HIGH — primary deployment target | P0 |
| Honor calculation algorithms across modes | MEDIUM — visible to users but not destructive | P1 |
| Room sync conflict resolution | MEDIUM — auth tokens prevent cross-write but no test for race conditions | P1 |
| Canvas PNG export Chinese rendering | MEDIUM — output quality regressions easy to miss | P1 |
| Voting idempotency under network retry | LOW — votingHistory tracking handles this defensively | P2 |
| Modal a11y (focus trap, Escape, scroll lock) | LOW — strong foundation in `src/core/modal.js` | P2 |

## Recommended Future Direction

If a test layer is added, the natural fit is:
- **Vitest** for pure-logic unit tests (calculator, rules, honors, achievements) — fast, ESM-native, plays well with Vite
- **Playwright** for E2E room-sync flows (host creates → viewer joins → vote → confirm)
- **Touch-event simulation** is hard to test; rely on real-device manual smoke + add `data-testid` hooks for Playwright assertion targets

No urgency to add tooling — the codebase is small enough, the manual flow is documented, and the risk surface is well-known. But the per-mode honor calculations and the player-profile sync are reaching the complexity ceiling where a unit-test net would catch real regressions.

---

*Testing analysis: 2026-05-03*
