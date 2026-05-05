# Atelier Polish — Iterations 1 + 2 + 3 — 2026-05-05

> Polish pass on Phase 4 Atelier theme to close gaps from the 2026-05-04 ship
> (`docs/design/HANDOFF-2026-05-04-phase-4-atelier-shipped.md`). Three
> iterations landed on `main` 2026-05-05: aggregate moved from ~70% → ~95%
> (worst-section: calcpreview at ~90%). Sample/victory cream-parchment hero
> now captured via class-based victoryModal refactor (iter 3).

## Status: ✅ SHIPPED (iter 1 + iter 2 + iter 3)

- Iter 1 (`a392e15`): root-cause history grid fix + scaffolding polish — aggregate ~70% → ~88%.
- Iter 2 (`c852766`): pool/slots `__sub` captions mono uppercase → italic Fraunces; `__title` 17px → 19px — aggregate ~88% → ~93%.
- Iter 3 (`06c1137`): victoryModal class refactor (markup + JS) + per-theme victory-modal CSS for all 4 themes; cross-theme verification baseline added — aggregate ~93% → ~95%, sample/victory closed.

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

### Section-by-section gap closure (final, after iter 3)

| Section | Pre (iter 0) | After iter 1 | After iter 2 | After iter 3 | Net change |
|---|---|---|---|---|---|
| Topnav + ticker | ~85% | ~92% | ~92% | ~92% | brand-mark `Ⓐ` pseudo-element + padding 22 → 28px |
| Scoreboard pcards | ~90% | ~93% | ~93% | ~93% | `.team__role` uppercase sans → italic Fraunces 14px |
| Activegame head | ~80% | ~92% | ~92% | ~92% | `.activegame__head-line` 28 → 40px; `.glyph` 32 → 52px italic |
| Pool / slots | ~75% | ~88% | **~93%** | ~93% | iter 2: `__sub` mono uppercase → italic Fraunces 13px; `__title` 17 → 19px |
| Calcpreview | ~90% | ~90% | ~90% | ~90% | unchanged — current floor |
| **History** | **~50% (broken)** | **~95%** | ~95% | ~95% | iter 1: 5-col → 8-col grid; mobile `grid-template-areas` |
| Stats | ~70% (empty fixture) | ~92% | ~92% | ~92% | iter 1: capture script `renderStatistics()` + italic thead, mono numerics, accent rank |
| Team honors | ~85% (empty fixture) | ~92% | ~92% | ~92% | iter 1: capture populates; underline-only badges with accent on MVP |
| Honors gallery | ~90% | ~93% | ~93% | ~93% | unchanged — already strong |
| **Sample / victory** | **not captured** | not captured | not captured | **~95%** | iter 3: victoryModal class refactor + per-theme `.victory-modal*` styles |
| Mobile @ 390px | ~80% | ~90% | ~90% | ~92% | iter 1: head-line scaling + history grid-areas; iter 3: mobile victory modal |

**Aggregate (worst-section): ~70% → ~95%, except calcpreview ~90% (now the floor).** Phase 4 Atelier polish effectively complete; the only open gap is the calcpreview sub-section which has not been touched in this polish pass.

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

**Doc/memory sync** (`d5ddad2`):
- `CLAUDE.md`, `docs/design/THEME-ARCHITECTURE.md`, this handoff doc: brought current with iter 3
- Memory: `MEMORY.md`, `project_theme_system_handoff.md`, `feedback_new_theme_must_do.md` (rule 16 added: every theme MUST style `.victory-modal*`)

## How to pick up if more polish is wanted

The remaining gap is the calcpreview section at ~90%. Pool/slots could also push higher with cream-pcard mini-tile treatment if desired (~93% → ≥95%).

1. `GD_NO_API_PROXY=1 npm run dev` (port 3000).
2. Switch to Atelier via topnav theme picker.
3. `node scripts/visual/capture-atelier-theme.mjs` to regenerate baselines.
4. Audit `docs/reports/phase4-atelier/calcpreview.png` against `docs/design/demos/demo-atelier-v2.png` calcpreview region.
5. For cross-theme victory-modal verification: `node scripts/visual/capture-victory-cross-theme.mjs`.

## Roadmap state (after iter 3 ship)

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
| Atelier polish iter 4 | optional — calcpreview ~90% → ≥95%; pool/slots ~93% → ≥95% |
| 2.5 (Linear sidebar + state preservation) | TODO infra |
| 5 (Tea-Table) | gated on commissioned ink illustrations |
| Visual regression CI | TODO |
| PNG export theme-awareness | TODO |
| Cascade-safe sparkline baseline | TODO |

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
- Build: ✅ green (514ms last build, 244KB themeBootstrap CSS)
- Dev server: stopped
- Open file edits: none
- Themes registered (in order): broadcast / linear / trading / atelier
- 6 commits this session, all pushed to `origin/main` — `a392e15`, `c852766`, `df06046`, `9b2afc8`, `06c1137`, `d5ddad2`
