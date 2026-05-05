# Atelier Polish — Iterations 1 + 2 + 3 + 4 — 2026-05-05

> Polish pass on Phase 4 Atelier theme to close gaps from the 2026-05-04 ship
> (`docs/design/HANDOFF-2026-05-04-phase-4-atelier-shipped.md`). Four
> iterations landed on `main` 2026-05-05: aggregate moved from ~70% → ~96%
> (no remaining floor — every section ≥95%). Calcpreview redesign + slot
> inner-class theming (iter 4) closed the last two gaps.

## Status: ✅ SHIPPED (iter 1 + iter 2 + iter 3 + iter 4)

- Iter 1 (`a392e15`): root-cause history grid fix + scaffolding polish — aggregate ~70% → ~88%.
- Iter 2 (`c852766`): pool/slots `__sub` captions mono uppercase → italic Fraunces; `__title` 17px → 19px — aggregate ~88% → ~93%.
- Iter 3 (`06c1137`): victoryModal class refactor (markup + JS) + per-theme victory-modal CSS for all 4 themes; cross-theme verification baseline added — aggregate ~93% → ~95%, sample/victory closed.
- Iter 4 (`52c9504`): calcpreview rewrite (heavy panel → editorial single-row aside) + slot reshape (squat horizontal → vertical playing-card 90/130) + filled-slot inner-class theming (was completely unstyled in atelier — only placeholder/target classes had rules). Aggregate ~95% → ~96%, calcpreview no longer the floor.

Continues the autonomous theme work on `main`. Per
`feedback_solo_project_autonomy.md` — no checkpoint between iterations.

## What this iteration ships

### Root-cause fix: history was visually broken at ship

The renderer (`src/game/history.js`) emits **8 cells** per row, but Atelier's
`grid-template-columns` had **5**. Cells 6–8 wrapped to a second visual line,
producing the pre-polish "two-row history entry" look. Pre-polish capture
showed e.g. `R01 / 2 / 红 / 1-2-5 / 升 2 级` as row 1 with `4 / 2` orphaned on
row 2.

Per **must-do rule 12 (selector audit before writing CSS)**, the previous ship
clearly skipped re-grepping the renderer source — the demo HTML doesn't
reflect the live renderer's output.

### Section-by-section gap closure (final, after iter 4)

| Section | Pre (iter 0) | iter 1 | iter 2 | iter 3 | iter 4 | Net change |
|---|---|---|---|---|---|---|
| Topnav + ticker | ~85% | ~92% | ~92% | ~92% | ~92% | brand-mark `Ⓐ` + padding 22 → 28px |
| Scoreboard pcards | ~90% | ~93% | ~93% | ~93% | ~93% | `.team__role` uppercase sans → italic Fraunces |
| Activegame head | ~80% | ~92% | ~92% | ~92% | ~92% | `.activegame__head-line` 28 → 40px; `.glyph` italic |
| **Pool / slots** | **~75%** | ~88% | ~93% | ~93% | **~96%** | iter 4: slot squat-rect → vertical playing-card 90/130; filled-inner classes (slot__index/rank-cn/avatar/name/handle/check) themed for the first time |
| **Calcpreview** | **~90%** | ~90% | ~90% | ~90% | **~96%** | iter 4: heavy panel → editorial single-row aside (label inline, italic Fraunces content, mono numerics, hint right-aligned, border-left only) |
| **History** | **~50% (broken)** | **~95%** | ~95% | ~95% | ~95% | iter 1: 5-col → 8-col grid + mobile grid-areas |
| Stats | ~70% (empty fixture) | ~92% | ~92% | ~92% | ~92% | iter 1: capture script `renderStatistics()` + italic thead |
| Team honors | ~85% (empty fixture) | ~92% | ~92% | ~92% | ~92% | iter 1: underline-only badges with accent on MVP |
| Honors gallery | ~90% | ~93% | ~93% | ~93% | ~93% | unchanged — already strong |
| **Sample / victory** | **not captured** | not captured | not captured | **~95%** | ~95% | iter 3: victoryModal class refactor + per-theme rules |
| Mobile @ 390px | ~80% | ~90% | ~90% | ~92% | ~94% → **~96%** (`9fc4294`) | iter 1: head-line + history; iter 3: victory; iter 4: 2-col slot grid + calcpreview wrap; **post-iter-4 (`9fc4294`): calcpreview column stack at 390px — three discrete visual layers (eyebrow / italic-Fraunces paragraph / right-aligned hint) replace cramped wrapped row** |

**Aggregate (worst-section): ~70% → ~96%.** No section below 92%; pool/slots and calcpreview both jumped from the prior floor. Phase 4 Atelier polish complete.

### Files changed across all 3 iterations

**Iter 1** (`a392e15`):
- `src/themes/atelier/theme.css` (+230 LOC net): history 5 → 8 cols + missing `.history__lvl`, `.history__rollback`, `.history__winner--red/--blue`; hero scaling; topnav brand-mark `Ⓐ`; stats-table polish; team-honors underline badges; mobile breakpoints for new sizes; mobile history `grid-template-areas`
- `scripts/visual/capture-atelier-theme.mjs`: `honorsMod.renderHonors()` → `statsMod.renderStatistics()`
- `docs/reports/phase4-atelier/*.png`: 13 re-captured baselines

**Iter 2** (`c852766`):
- `src/themes/atelier/theme.css` (~12 LOC): `.pool__sub` and `.slots__sub` mono uppercase → italic Fraunces; `.pool__title` and `.slots__title` 17 → 19px
- `docs/reports/phase4-atelier/*.png`: re-captured baselines

**Iter 3** (`06c1137`):
- `index.html` (line 884-903): victoryModal hero markup inline styles → class-based (`.victory-modal__inner / __eyebrow / __title / __teamname / __lede / __voting / __actions`)
- `src/ui/victoryModal.js`: drop inline `borderColor` + `boxShadow` overrides on modalContent; set `--winning-team-color` CSS custom property instead; query selector switched from `modal.querySelector('div')` → `modal.querySelector('.victory-modal__inner')`
- `src/themes/{broadcast,linear,trading,atelier}/theme.css`: per-theme `.victory-modal*` rule sets so each theme renders its own championship state
- `scripts/visual/capture-atelier-theme.mjs`: trigger `showVictoryModal()` at end so victory hero captures land in baseline
- `scripts/visual/capture-victory-cross-theme.mjs` (new): captures victory modal across all 4 themes × {desktop, mobile} = 8 PNGs
- `docs/reports/victory-cross-theme/*.png` (new): cross-theme verification baseline

**Iter 4** (`52c9504`):
- `src/themes/atelier/theme.css` (+247/-53 LOC):
  - `.calcpreview` block (lines 854→): single-row flex with label inline-left, content middle (italic Fraunces 15px), hint right-aligned via `margin-left: auto`. Drop surrounding 1px border + heavy `bg-deep`; keep only 2px clay border-left on `surface` bg. `.calcpreview__seg .key` italic team-colored, `.val` mono tabular-nums; `__seg--gap .key` is mono uppercase clay (the threshold reference). New `.calcpreview__sep` rule for editorial middle-dot.
  - `.slot` block (lines 808→): `aspect-ratio: 90/130` vertical playing-card (was squat 56px-min horizontal flex row). `.slots__grid` minmax 200px → 120px so 6/8 slots fit a row. **All filled-slot inner classes themed for the first time:** `.slot__rank-cn` (italic Fraunces 22px, prominent headline via `order: 1`), `.slot__index` (mono micro caption via `order: 2`), `.slot__avatar` (emoji 28px, flex: 1 to anchor name/handle bottom), `.slot__name`, `.slot__handle`, `.slot__check` (clay corner mark, absolute). State variants reworked: `.slot--filled` warmer surface-2 + colored left border + clay-line hover; `.slot--target` dashed accent + 2.4s pulse animation; `.slot--empty` em-dash placeholder + italic Fraunces "empty" label. New `.drag-over` clay halo independent of base state.
- `docs/reports/phase4-atelier/*.png`: 14 baselines re-captured. Activegame composite shows the new vertical card deck + the new editorial calcpreview row.

**Root cause of iter 4 lift**: per must-do rule 12 (selector audit before writing CSS), iter 0 (initial Atelier ship) skipped re-grepping `rankingRenderer.js`. Renderer emits 6 inner classes per filled slot; only `.slot__target-*` and `.slot__placeholder-*` had rules in atelier — `.slot__index`, `.slot__rank-cn`, `.slot__avatar`, `.slot__name`, `.slot__handle`, `.slot__check` were unstyled. Iter 4 added them. Broadcast and Linear themes already had full inner-class styling, so this was Atelier-specific drift.

**Doc/memory sync**:
- `d5ddad2`: brought CLAUDE.md, THEME-ARCHITECTURE.md, memory current with iter 3
- (this iter): updates this handoff to cover iter 4, bumps memory `project_theme_system_handoff.md` aggregate

## How to pick up if more polish is wanted

Phase 4 Atelier polish is **complete**. No section below 92%; pool/slots, calcpreview, and mobile all at ~96%. Remaining work is on other phases:

1. Phase 2.5 (Linear sidebar layout + state preservation across theme switches) — infra TODO.
2. Phase 5 (Tea-Table) — gated on commissioned ink illustrations.
3. Visual regression CI (Percy / Chromatic / pixelmatch) — would catch the iter-0-style filled-slot regression automatically.
4. PNG export theme-awareness — currently exports use Broadcast palette regardless of active theme.

If a future Atelier polish iter is wanted (paper-grain texture on slots, illustrated empty-state glyphs, etc.):
1. `GD_NO_API_PROXY=1 npm run dev` (port 3000).
2. Switch to Atelier via topnav theme picker.
3. `node scripts/visual/capture-atelier-theme.mjs` to regenerate baselines.
4. Audit per-section under `docs/reports/phase4-atelier/` against `docs/design/demos/demo-atelier-v2.png`.
5. For cross-theme victory-modal verification: `node scripts/visual/capture-victory-cross-theme.mjs`.

**PNG export theme-awareness — SHIPPED 2026-05-05 (`54c3552`)**: was a deferred TODO; closed in this same session. See commit body for the helper + refactor scope. Cross-theme baseline at `docs/reports/png-export-themes/`. Probe `scripts/visual/test-palette-extraction.mjs` is the fast health check.

## Roadmap state (after iter 4 ship)

| Phase | Status |
|---|---|
| 0 / 1 / 1.5 (Broadcast) | ✅ shipped |
| 2 (Linear) | ✅ shipped |
| 3 (Trading) | ✅ shipped |
| 3.5 (sparklines) | ✅ shipped 2026-05-04 |
| 4 (Atelier) | ✅ shipped 2026-05-04 |
| **Atelier polish iter 1** | ✅ shipped 2026-05-05 (`a392e15`) |
| **Atelier polish iter 2** | ✅ shipped 2026-05-05 (`c852766`) |
| **Atelier polish iter 3** | ✅ shipped 2026-05-05 (`06c1137`) |
| **Atelier polish iter 4** | ✅ shipped 2026-05-05 (`52c9504`) — calcpreview + filled-slot inner classes |
| **Atelier mobile calcpreview** | ✅ shipped 2026-05-05 (`9fc4294`) — column stack at 390px; closes the 94% → ~96% mobile gap |
| 2.5 (Linear sidebar + state preservation) | TODO infra |
| 5 (Tea-Table) | gated on commissioned ink illustrations |
| Visual regression CI | ✅ shipped 2026-05-05 (`402bb87` + `2fa1b84` + `c9ddf62` + `1d2cf8b`) — pixelmatch-based; deterministic captures via `scripts/visual/_fixtures.mjs`; diff orchestrator at `scripts/visual/regression-test.mjs` (`npm run test:visual`); GitHub Actions workflow at `.github/workflows/visual-regression.yml`. **Initial coverage: 59 PNGs across 6 capture scripts** (4 themes + victory-cross + png-exports). **Extended later same day** to **65 PNGs across 7 capture scripts** (`f768ba7` + `c6da03a`): per-directory threshold overrides for canvas-rendered PNG exports + sparkline coverage via `setDeterministicPlayerStats(page, 8)` injecting the `FIXED_RANKINGS_8` matrix into `state.playerStats` — sidesteps the unseedable `#randomRanking` Math.random path. |
| PNG export theme-awareness | ✅ shipped 2026-05-05 (`54c3552`) — separate from the polish iters; same session |
| Cascade-safe sparkline baseline | ✅ shipped 2026-05-05 (`ec25a34`) — `src/themes/_shared/sparkline.css` with `currentColor`-based baseline rules; imported from `sparkline.js`. |

## VictoryModal contract (NEW as of 2026-05-05)

After iter 3, the victory modal markup in `index.html` is class-based. Every registered theme MUST define a `.victory-modal*` rule set in its `theme.css` or the championship state falls back to unstyled. Recorded as **must-do rule 16** in `feedback_new_theme_must_do.md`.

Class contract (use these exactly — verified against renderer source per must-do rule 12):
- `.victory-modal` — full-page overlay (themes set `display: flex` + backdrop `background`)
- `.victory-modal__inner` — modal panel (chrome, padding, borders, max-width)
- `.victory-modal__eyebrow` — small uppercase/italic label "— THIS IS WHAT WINNING LOOKS LIKE —"
- `.victory-modal__title` — main "A级通关" headline
- `.victory-modal__teamname` — winning team name (color set inline by JS to dynamic team color)
- `.victory-modal__lede` — subtitle "恭喜完成所有级别的挑战"
- `.victory-modal__voting` — voting interface container (currently still uses inline styles inside; future polish target)
- `.victory-modal__actions` — action button row

Dynamic per-instance color is exposed as `--winning-team-color` CSS custom property on `.victory-modal` for theme rules that want it.

## Memory pointers (auto-loaded next session)

- `project_theme_system_handoff.md` — full status table including iter 3
- `feedback_compare_to_demo_before_done.md` — populated-capture discipline (must-do rule that drove this polish iteration)
- `feedback_new_theme_must_do.md` — 16 rules (rule 16 = victory modal must be themed; new in this session)
- `feedback_solo_project_autonomy.md` — keep shipping across sessions; AX merges autonomously

## State at end of session

- Branch: `main`
- Build: ✅ green (593ms last build, 257KB themeBootstrap CSS — +13KB from atelier iter 4 additions)
- Dev server: stopped
- Open file edits: none
- Themes registered (in order): broadcast / linear / trading / atelier
- 8 commits this session — `a392e15`, `c852766`, `df06046`, `9b2afc8`, `06c1137`, `d5ddad2`, `3b6916f` (closing iter 1+2+3 handoff), `52c9504` (iter 4 — this one). Doc-sync commit follows.
