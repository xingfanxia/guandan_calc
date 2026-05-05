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

### Section-by-section gap closure

| Section | Pre | Post | Change |
|---|---|---|---|
| Topnav + ticker | ~85% | ~92% | brand-mark `Ⓐ` pseudo-element + padding 22px → 28px |
| Scoreboard pcards | ~90% | ~93% | `.team__role` uppercase tracked sans → italic Fraunces 14px |
| Activegame head | ~80% | ~92% | `.activegame__head-line` 28px → 40px; `.glyph` 32px → 52px italic accent |
| Pool / slots | ~75% | ~88% | unchanged — already editorial; iteration 2 candidate |
| Calcpreview | ~90% | ~90% | unchanged |
| **History** | **~50% (broken)** | **~95%** | 5-col → 8-col grid; mobile uses `grid-template-areas` for 3-row stack |
| Stats | ~70% (empty) | ~92% | capture script: `renderStatistics()` (was empty fixture); table polish (italic Fraunces thead, mono numerics, accent rank column) |
| Team honors | ~85% (empty) | ~92% | capture script populates; underline-only badges with accent on MVP, team-colored titles |
| Honors gallery | ~90% | ~93% | unchanged — already strong |
| Sample / victory | not captured | not captured | iteration 2 candidate (capture script enhancement) |
| Mobile @ 390px | ~80% | ~90% | head-line scaling, history `grid-template-areas` |

**Aggregate (worst-section): ~88%** — pool/slots floor at ~88%, sample/victory
not captured. Per `feedback_compare_to_demo_before_done.md` rule 3, ≥95% per
section is the bar; iteration 2 needed to clear it.

### Files

- `src/themes/atelier/theme.css` — +230 LOC net. History grid (5 → 8 cols + missing
  `.history__lvl`, `.history__rollback`, `.history__winner--red/--blue` rules);
  hero head-line scale; topnav brand-mark; stats-table polish; team-honors
  underline badges; mobile breakpoints for new sizes; mobile history
  `grid-template-areas`.
- `scripts/visual/capture-atelier-theme.mjs` — `honorsMod.renderHonors()` →
  `statsMod.renderStatistics()` so stats card + team-MVP/burden actually
  populate under the fixture.
- `docs/reports/phase4-atelier/*.png` — 13 re-captured baselines.

## How to pick up Atelier polish iteration 2

1. `GD_NO_API_PROXY=1 npm run dev` (port 3000).
2. Switch to Atelier via topnav theme picker.
3. `node scripts/visual/capture-atelier-theme.mjs` to regenerate baselines.
4. Audit `docs/reports/phase4-atelier/` against `docs/design/demos/demo-atelier-v2.png`.
5. Push pool/slots from ~88% → ≥95%:
   - Demo's pool tile uses cream-on-darker-bg pcard treatment (similar to
     scoreboard pcards). Currently mine uses `--surface-2` with team-color
     left border — could switch tile body to `--card-stock` mini-pcard with
     dark serif name on cream.
   - Demo's slot grid header has a tighter 2-line label structure
     (`名次槽` + italic `RANKING SLOTS · DROP TARGETS · 6/6`).
6. Trigger sample/victory capture by extending the script:
   ```js
   // After history seed, simulate A级通关 to trigger victoryModal mount
   const rules = await import('/src/game/rules.js');
   // ... or directly mount the modal with a fixture and screenshot it
   ```

## Roadmap state

| Phase | Status |
|---|---|
| 0 / 1 / 1.5 (Broadcast) | ✅ shipped |
| 2 (Linear) | ✅ shipped |
| 3 (Trading) | ✅ shipped |
| 3.5 (sparklines) | ✅ shipped 2026-05-04 |
| 4 (Atelier) | ✅ shipped 2026-05-04 |
| **Atelier polish iter 1** | ✅ **shipped 2026-05-05 (this commit)** |
| Atelier polish iter 2 | recommended — push pool/slots + sample to ≥95% |
| 2.5 (Linear sidebar + state preservation) | TODO |
| 5 (Tea-Table) | gated on commissioned ink illustrations |
| Visual regression CI | TODO |
| PNG export theme-awareness | TODO |
| Cascade-safe sparkline baseline | TODO |

## Memory pointers (auto-loaded next session)

- `project_theme_system_handoff.md` — needs update to reflect polish iter 1
- `feedback_compare_to_demo_before_done.md` — populated-capture discipline
- `feedback_new_theme_must_do.md` — must-do rule 12 (selector audit before CSS)
  hit again here; lesson: future themes MUST grep the renderer source, never
  trust demo HTML class names

## State at end of session

- Branch: `main`
- Build: ✅ green (501ms, 244KB themeBootstrap CSS)
- Dev server: stopped
- Open file edits: none
- Themes registered (in order): broadcast / linear / trading / atelier
