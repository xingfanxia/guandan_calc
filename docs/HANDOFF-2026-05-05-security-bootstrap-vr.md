# Session Handoff — 2026-05-05 (Security + FOUC + Sparkline VR + Threshold Override)

> Companion to `docs/design/HANDOFF-2026-05-05-atelier-polish-iter-1.md` (the
> Atelier polish session that preceded this one). This handoff covers four
> infra-and-security ships that landed later the same day, plus the docs
> reconciliation that closed the loop.

---

## TL;DR

Five commits on `main`, all tests green, all docs reconciled. No open work
items from this session — the three deferred items I picked from the prior
handoff (XSS hardening, cross-page FOUC, sparkline VR) are all closed.

| Commit | Title | Files |
|---|---|---|
| `f768ba7` | ci(visual): per-directory threshold overrides for canvas-rendered PNGs | 1 |
| `0bf1b90` | fix(security): escape user-controlled strings in player-tile renderers | 4 |
| `4a3d7e6` | fix(theme): inline synchronous bootstrap to eliminate cross-page FOUC | 6 (incl. test) |
| `c6da03a` | feat(visual): close VR coverage gap on sparkline rendering | 9 (3 src + 6 PNGs) |
| `81414d7` | docs: sync — 4 ships landed 2026-05-05 (XSS + FOUC + sparkline + threshold) | 7 |

VR coverage: **59 baselines / 6 capture scripts → 65 baselines / 7 capture
scripts**. XSS-escaped surfaces: **+4 files (~36 sites)**. FOUC source: 4
HTML files now carry an inline synchronous bootstrap; `themeBootstrap.js`
module deleted.

---

## What shipped — by ship

### 1. Per-directory VR threshold overrides (`f768ba7`)

**Why**: Canvas-rendered PNG exports (`png-export-themes/`) showed 100-160 px
of font subpixel-rendering noise on 1.2 MP images even on identical-input
back-to-back captures, pushing past the global 100 px floor and producing
spurious failures.

**Fix**: Added `THRESHOLD_OVERRIDES = { 'png-export-themes/': 250 }` map to
`scripts/visual/diff-baselines.mjs` with longest-prefix-wins lookup. Real
visual changes there measure 1000s+ px so the bump preserves regression
sensitivity.

**Verify**: Two consecutive PNG-export captures on identical code show
5-12 px drift between runs — pure nondeterminism, now absorbed.

### 2. XSS hardening (`0bf1b90`)

**Why**: Audit `fa18718` (2026-05) flagged escaping but only covered
`playerSearch.js`, `playerEditModal.js`, `victoryModal.js`. Four other
files emit player markup via innerHTML without `escapeHtml`. The real XSS
vector is `alt=""` attribute breakout in `photoRenderer.js:53` — a
malicious `displayName` containing `"><img src=x onerror=...>` would close
the alt attribute and inject markup. Player profiles propagate via room
sync, so a malicious host could compromise every viewer.

**Fix**: Wrapped every interpolation of `player.{name,emoji,tagline,displayName,id}`
+ team-name config values with the existing `escapeHtml()` from
`core/utils.js` across:

- `src/player/photoRenderer.js` (3 sites — alt + emoji fallback)
- `src/stats/statistics.js` (5 sites — stats table + team MVP/burden cards)
- `src/ui/panelManager.js` (4 sites — collapsed team-roster panel)
- `src/share/votingManager.js` (~24 sites — locked card, vote buttons,
  status, results, leaderboard, host UI)

**Verify**: 65/65 visual regression baselines pass with zero pixel diff —
escaping pure CJK + emoji content is byte-identical because none contain
`& < > " '` characters.

**Defense-in-depth follow-ups still listed in `docs/SECURITY.md`** (low priority):
- `playerCreateModal.js` — values come from form input, not API; lower risk
- `exportHandlers.js` — TXT/CSV concatenation; CSV escape exists, TXT/PNG
  use canvas (no HTML parse)
- `exportMobile.js` — Canvas `ctx.fillText` doesn't parse HTML; length
  validation at create endpoint already caps overflow

### 3. Cross-page FOUC fix (`4a3d7e6`)

**Why**: `src/themes/_shared/themeBootstrap.js` was loaded as
`<script type="module">` which is always deferred — meaning it ran AFTER
stylesheet cascade resolution. Users with a saved non-default theme
(`linear`/`trading`/`atelier`) saw a brief flash of Broadcast on every
page navigation before the bootstrap fired.

**Fix**: Replaced with an inline synchronous `<script>` at the top of
`<head>`, ABOVE all stylesheet `<link>`s, in all 4 entry HTMLs. Deleted
`themeBootstrap.js` (sole purpose was the bootstrap; no other code
imported it).

**Test artifact**: `scripts/visual/test-cross-page-theme.mjs` verifies
17 cases (3 themes × 4 pages + default fallback + invalid-payload
rejection). All pass.

**New maintenance burden**: Adding a 5th theme requires updating the
inline validation array `['broadcast','linear','trading','atelier']` in
all 4 HTMLs. This is captured as part of the updated must-do checklist
Rule 4 in `~/.claude/.../memory/feedback_new_theme_must_do.md`.

### 4. Sparkline VR coverage (`c6da03a`)

**Why**: `capture-phase3-5-sparklines.mjs` was excluded from
`regression-test.mjs` because the live capture clicked `#randomRanking` 5
times per theme, and `Math.random` has no seed hook in the gameplay-flow
path. Result: the most theme-distinguishing UI element (Trading's 7-col
stats table with sparklines vs Broadcast/Linear's 6-col without) had zero
regression coverage.

**Fix**: Skip the live UI loop entirely. Inject the 5-round ranking
history directly into `state.playerStats` via a new
`setDeterministicPlayerStats(page, 8)` helper in `_fixtures.mjs`, keyed
off a fixed `FIXED_RANKINGS_8` matrix. Each column is a permutation of
1..8 (every round assigns 8 distinct ranks across the 8 players), and
per-player trajectories are designed for visually-interesting sparkline
shapes (P1 volatile, P3 oscillating, P5 strong-finish, P8 consistent
bottom).

**Verify**: Two consecutive captures on identical input now diff at
exactly **0 px** across all 6 baselines (3 themes × {desktop, mobile}).
Total VR count: 59 → 65.

### 5. Docs reconciliation (`81414d7`)

7 files updated to reflect the post-extension state:
- `CLAUDE.md` theme-system block
- `README.md` Contributing section
- `docs/FEATURE_STATUS.md` (new sections: Cross-Page Theme Bootstrap,
  XSS Hardening)
- `docs/SECURITY.md` (XSS protections + audit table extended)
- `docs/design/THEME-ARCHITECTURE.md` (VR + FOUC rows added)
- `docs/design/HANDOFF-2026-05-05-atelier-polish-iter-1.md` (VR row
  refactored to "Initial 59/6 → Extended same-day 65/7")
- `docs/guides/DEVELOPMENT_METHODOLOGY.md` (testing methodology)

Plus 3 memory files: `MEMORY.md`, `project_theme_system_handoff.md`,
`feedback_new_theme_must_do.md`.

---

## Patterns established (for the next session)

### Pattern: When fixing security debt, run VR after to prove no render change

Escaping CJK + emoji content is byte-identical (no `&<>"'` characters in
deterministic test fixtures). If the VR shows a diff after an XSS fix,
that's a signal — either the helper has a bug, or you escaped something
that the renderer doesn't actually want escaped.

### Pattern: New capture script wiring (3-step)

1. Honor `VISUAL_REPORT_BASE` env var (so the regression orchestrator can
   redirect output to a snapshot dir)
2. Use the `_fixtures.mjs` helpers (`freezeTime` + `setDeterministicPlayers`
   + `setDeterministicPlayerStats` + event re-render)
3. Add the script to the `CAPTURES` array in
   `scripts/visual/regression-test.mjs`

Verify with two back-to-back runs against `/tmp` — should diff at 0 px on
identical code. If not, hunt down the remaining nondeterminism (timestamps,
random IDs, font loading races) before adding to the suite.

### Pattern: Per-directory threshold overrides for noisy baseline categories

If a baseline category has known nondeterminism that exceeds the global
threshold (Canvas font subpixel rendering at 100-160 px is the canonical
example), add an entry to `THRESHOLD_OVERRIDES` in
`scripts/visual/diff-baselines.mjs` with the per-directory floor that
absorbs the noise while still catching real changes.

### Pattern: Inline synchronous script for FOUC prevention

`<script type="module">` is always deferred — bad for prevent-cascade-flash
work. Use inline `<script>` (no type, no src, no async/defer) at the top
of `<head>` ABOVE all stylesheet `<link>`s. This blocks parser only for
the few microseconds it takes to read localStorage.

---

## What's still TODO (not new — carried from prior handoffs)

| Item | Status | Effort |
|---|---|---|
| Phase 2.5 Linear sidebar via `layout.mount()` + state preservation | infra TODO | tier 4 → /big-task |
| Phase 5 Tea-Table | gated on commissioned ink illustrations | external dep |
| Defense-in-depth escapeHtml on `playerCreateModal.js` | low priority | tier 1 (~30 min) |
| Defense-in-depth on `exportHandlers.js` CSV/TXT escape | low priority | tier 1 (~30 min) |

None of the above are blocking. Next session can pick up any of them or
start something new.

---

## How to pick up

1. `git log --oneline 32bbe02..HEAD` shows the 5 commits from this session
   (everything after the prior session's "VR CI shipped" docs commit)
2. Read this file + `docs/design/HANDOFF-2026-05-05-atelier-polish-iter-1.md`
   for full context of 2026-05-05's two parallel pushes (Atelier polish +
   security/infra)
3. CLAUDE.md theme-system block is now the canonical state-of-the-system
   summary; FEATURE_STATUS.md has the per-feature 100% breakdown
4. SECURITY.md `XSS protections` section is the source-of-truth for which
   files have which guarantees
5. For VR work: run `npm run test:visual` locally (needs `npm run dev` on
   port 3000 first); the suite takes ~2-3 minutes, all 65 must pass

---

**End of handoff.** Tree clean. Branch up to date with origin/main. No
unfinished work.
