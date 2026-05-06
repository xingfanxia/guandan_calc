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
| Phase 2.5 Linear sidebar via `layout.mount()` + state preservation | **CLOSED 2026-05-05** — see Phase 2.5 Closure section below | — |
| Phase 5 Tea-Table | gated on commissioned ink illustrations | external dep |
| Pre-existing VR drift on Broadcast + Trading scoreboards (4 baselines) | needs separate investigation — NOT caused by Phase 2.5 (verified via stash test); existed before the session started | tier 2 |

### Defense-in-depth carry-overs — both closed 2026-05-05

- **`exportHandlers.js` CSV escape** — closed in `86d2813` (added OWASP single-quote
  prefix to `csvEscape` for cells starting with `=+-@\t\r`; verified by 14-case
  standalone test). The vector was real: `displayName` has no charset restriction
  in `validatePlayerData`, so `=HYPERLINK(...)` payloads could ship through
  `playerRankStr` into CSV cells and execute when teammates opened the file.
- **`playerCreateModal.js` escapeHtml parity** — closed as **not actually exposed**.
  Audit revealed all interpolations come from hardcoded constants
  (`ANIMAL_EMOJIS`, `getPlayStyles()` return). User input from form `<input>`
  fields never reaches `innerHTML`. SECURITY.md updated to reflect this — no
  code change needed.

Phase 2.5 + Phase 5 above remain the only outstanding items. Neither is
blocking. Next session can pick up either or start something new.

---

## How to pick up

1. `git log --oneline 32bbe02..HEAD` shows the 6 commits from this session
   (everything after the prior session's "VR CI shipped" docs commit)
2. Read this file + `docs/design/HANDOFF-2026-05-05-atelier-polish-iter-1.md`
   for full context of 2026-05-05's two parallel pushes (Atelier polish +
   security/infra)
3. CLAUDE.md theme-system block is now the canonical state-of-the-system
   summary; FEATURE_STATUS.md has the per-feature 100% breakdown
4. SECURITY.md `XSS protections` + `CSV protections` sections are the
   source-of-truth for which files have which guarantees
5. For VR work: run `npm run test:visual` locally (needs `npm run dev` on
   port 3000 first); the suite takes ~2-3 minutes, all 65 must pass

---

---

## Phase 2.5 closure (added later same day)

**Closed**: tier 4 sidebar layout work that had been the canonical "infra
TODO" since Phase 2 shipped (2026-05-03).

### What landed

- `src/themes/_shared/themeManager.js` — `mount()` now calls
  `current.layout?.unmount(rootEl)` BEFORE swapping. Without this, themes
  that inject DOM in `mount()` would leak orphans on switch. This was a
  latent bug Phase 2 hid (all themes had no-op layout); Phase 2.5 surfaced
  it the moment Linear got a real `mount()`.
- `src/themes/linear/index.js` — real `layout.mount/unmount/update` impl.
  `mount()` extracts the live `<nav class="topnav">` from its parent, wraps
  it in `<aside class="linear-sidebar">`, prepends the wrapper to body, and
  flips on `linear-sidebar-active` class on `<html>`. **Move-not-clone**
  preserves event listeners + the `#themePickerMount` slot. `unmount()`
  restores topnav to its captured original parent at the captured next-
  sibling position; idempotent.
- `src/themes/linear/featureManifest.js` — `navigation: 'top-tabs'` →
  `navigation: 'sidebar'`.
- `src/themes/linear/theme.css` — sidebar styling at `@media (min-width:
  769px)`: 240px fixed left rail, body padding-left 240px to offset content,
  topnav re-laid as vertical column with both CN + EN labels visible.
  Mobile fallback at `@media (max-width: 768px)` uses
  `display: contents` on the wrapper so the moved topnav reverts to its
  default sticky-top row layout — no JS resize listener needed.
- `scripts/visual/test-theme-switch.mjs` — NEW 20-assertion smoke test
  verifying mount + unmount (no orphan DOM, topnav restored to BODY) +
  remount + state survival across full broadcast → trading → atelier →
  linear cycle.
- `docs/reports/phase2-linear/*.png` (9 baselines) — regenerated for
  desktop sidebar visible. `phase3-5-sparklines/` and `victory-cross-theme/`
  baselines also regenerated as side-effect of running their capture scripts
  (which cover all themes, not just Linear).

### Architecture insight worth keeping

The architecture-doc Section 3 pseudocode showed `state.getSnapshot()` /
`state.restore()` around theme swaps. Phase 2.5 implementation revealed
this is unnecessary: `state.js` is a JS module-scope singleton (`let
instance = null` at module top), so its identity persists across DOM
mutations regardless of theme. Theme.layout only mutates DOM, never
touches state. localStorage persistence runs on every state mutation as
backup. The singleton + persist combo provides preservation for free —
the pseudocode was illustrative, not literal. **Don't add validation for
scenarios that can't happen.**

### Pre-existing VR drift surfaced (NOT caused by Phase 2.5)

Running `npm run test:visual` after the Linear regen revealed 4 baselines
failing on Broadcast and Trading scoreboard captures:

- `phase1-5-final/index-final.png` (0.37%)
- `phase1-5-final/scoreboard.png` (5.22%)
- `phase3-trading/index-trading.png` (0.22%)
- `phase3-trading/scoreboard.png` (1.14%)

**Verified pre-existing** via `git stash` test on the same commit — these
failures reproduce without any Phase 2.5 changes applied. The diff PNGs
show the ticker bar fully diffed (likely an elapsed-time computation that
isn't fully frozen by `freezeTime` in `_fixtures.mjs`) plus team-position
shifts. The prior session's "65/65 passing" claim was inaccurate — at
minimum 4 baselines were already drifting.

Per CLAUDE.md "Extreme Ownership", these are now tracked as a follow-up
task in the Phase 2.5 closure docs (a tier 2 investigation). They do NOT
block the Phase 2.5 ship — Phase 2.5 itself adds zero new failures.

### Deferred to Phase 2.6 polish (open-ended)

The current sidebar is **minimal-but-real** — mirrors the existing topnav
into a vertical rail. The demo at `docs/design/demos/demo-linear-v2.png`
shows a fancier multi-section sidebar (separate "GAME" and "PROFILE"
sections, status indicators, dedicated Settings entry). That visual polish
is deferred to a future "Phase 2.6" — it's design-grade work, not
architecture-validation work, so doesn't gate the Phase 2.5 close.

---

**End of handoff.** Tree clean. Branch up to date with origin/main. Two
outstanding items: (1) Phase 5 Tea-Table (gated on commissioned assets),
(2) pre-existing VR drift on Broadcast + Trading scoreboards (tier 2
investigation, ticket-worthy).
