# Phase 3.5 Sparkline Ship Handoff — 2026-05-04

> Companion to `HANDOFF-2026-05-04-mobile-qc-closed.md` (the mobile QC closure).
> This doc covers the Phase 3.5 sparkline session that landed on the same day.

## Status: ✅ SHIPPED

Two commits on `main`:

| Commit  | Title                                                    |
|---------|----------------------------------------------------------|
| 72f18e0 | feat(theme): Phase 3.5 — sparkline renderer + Trading 近况 column |
| 3a7b55f | docs: sync codebase docs with Phase 3.5 ship             |

Pushed to `origin/main`. No open PRs, no pending merges.

## What changed

### New module — `src/themes/_shared/sparkline.js` (~150 LOC)

Pure SVG renderer, no dependencies. Two exports:

- `renderSparkline({ data, width, height, range, invertY, color, accentColor, showDots, showGrid, ariaLabel })` — generic numeric sparkline.
- `renderRankingSparkline(rankings, mode, extra)` — ranking-specific helper that auto-inverts Y so rank 1 plots at the top of the viewBox; passes `range: [1, max(mode, ...rankings)]`.

Class hooks for theme CSS: `.sparkline`, `.sparkline__line`, `.sparkline__grid`, `.sparkline__dot`, `.sparkline__dot--last`. SVG presentation attributes are set inline as defaults; theme CSS overrides via specificity.

### Wiring — `src/stats/statistics.js`

- `renderPlayerStatsTable()` reads `getManifest().sparklines` per render.
- `syncSparklineHeader()` idempotently injects/removes the `近况` `<th>` based on the flag.
- Per-row: appends a sparkline `<td>` (color = team color) only when flag is true.
- Empty-state row migrated from `innerHTML` to `createElement` + `textContent` — strict XSS improvement.
- Module-top `theme:changed` subscription with **HMR `import.meta.hot.dispose()` teardown** so Vite hot-replaces don't stack listeners (caught by code-reviewer agent on first pass).

### Trading theme

- `src/themes/trading/featureManifest.js` — `sparklines: false → true`.
- `src/themes/trading/theme.css` — appended ~60-line `PHASE 3.5 — SPARKLINES (2026-05-04)` block at file end:
  - Sparkline cell width: 140px desktop / 96px mobile.
  - SVG: 120×24 desktop / 84×22 mobile, sharp 1px border (`var(--rule)`), `oklch(14% 0.005 240)` background.
  - `.sparkline__grid` stroke = `var(--rule)`, opacity 0.7.
  - `.sparkline__dot--last` filled with `var(--accent)` (amber HUD), 0.6px black hairline.
- `src/themes/trading/index.js` — header comment updated to mark Phase 3.5 shipped.

### Verification — `docs/reports/phase3-5-sparklines/`

Capture script: `scripts/visual/capture-phase3-5-sparklines.mjs` (390×844 mobile + 1440×900 desktop, 5 rounds played before screenshot for populated state).

Six PNGs verifying the manifest gate works both directions:

| Theme | Desktop | Mobile |
|---|---|---|
| Broadcast | 6 columns, no sparkline | 6 columns, no sparkline |
| Linear | 6 columns, no sparkline | 6 columns, no sparkline |
| Trading | 7 cols + 近况 sparklines | 7 cols compressed |

Per-team colors (blue 蓝队 / red 红队), amber accent on most recent point, grid lines visible, trajectory legible across 5 rounds.

## Review pass

Code-reviewer agent flagged two findings on the first pass:

1. **HIGH — HMR listener stacking** (`statistics.js`): module-top `onEvent` runs at import; Vite HMR didn't tear down old listeners. After N saves you'd get N re-renders per theme switch.
   - **Fixed inline** before commit by wrapping the listener in a named `onThemeChange` and adding an `import.meta.hot.dispose()` teardown.
2. **MEDIUM — cascade safety for future themes** (`theme.css` + `sparkline.js`): all sparkline styling is scoped under `:root[data-theme="trading"]`. If a future theme (Atelier, Tea-Table) flips the flag without bespoke CSS, the SVG renders with bare default colors and no grid styling.
   - **Deferred as TODO**: add a minimal unscoped baseline (e.g., `.sparkline__grid { stroke: currentColor; opacity: 0.2 }`) to a shared CSS file when the next theme opts in. Not a blocker — only Trading is enabled today.

## Doc sync (commit 3a7b55f)

Five docs had stale references after the main commit landed:

- `CLAUDE.md` — module count 38 → 39, `sparkline.js` added to `themes/_shared/` enumeration.
- `docs/architecture/CODEBASE_STRUCTURE.md` — new section documenting the sparkline renderer alongside siblings.
- `docs/design/HANDOFF-2026-05-04-mobile-qc-closed.md` — Phase 3.5 row TODO → SHIPPED.
- `docs/design/THEME-HANDOFF-2026-05-03.md` — Phase 3.5 row TODO → SHIPPED with commit + baseline pointers.
- `docs/design/HANDOFF.md` (older master) — Phase 3 (Trading, was TODO despite shipping 2026-05-03) and Phase 3.5 both flipped to SHIPPED.

Verified clean via grep: no `"Phase 3.5 ... TODO"` or `"TODO ... sparkline"` left in docs/ + CLAUDE.md + README.md.

## What worked

1. **Featuremanifest pattern paid off.** Phase 3.5 was 2 lines of "wiring" + ~150 LOC renderer + ~60 LOC theme CSS. Manifest gating means flipping `sparklines: false → true` is the only theme-side change; the renderer cascades behind the flag. Future themes opt in with one line each.
2. **Renderer-source-first discipline (rules 11-15 from QC failures).** Read `statistics.js` and the demo HTML before writing any selector. Single insertion point, no cross-file selector mismatches.
3. **POPULATED capture before commit.** 5 rounds played before screenshot so sparklines actually had data. Empty-state captures would've hidden the trajectory.
4. **Multipass review caught HMR leak.** Code-reviewer agent flagged the HIGH finding before commit. Self-review missed it — would've been a dev-mode footgun across HMR sessions.

## What's next on the theme roadmap

Per `project_theme_system_handoff.md` memory + `THEME-ARCHITECTURE.md`:

| Phase | What                                                          | Status |
|-------|---------------------------------------------------------------|--------|
| 2.5   | Linear sidebar layout via `layout.mount()` + state-preservation across theme switches | TODO  |
| 4     | Atelier Console theme — warm graphite + photographic moments | TODO  |
| 5     | Tea-Table theme (needs commissioned ink illustrations)       | gated |
| —     | Visual regression CI (Percy / Chromatic / pixelmatch)        | TODO  |
| —     | PNG export theme-awareness                                    | TODO  |
| —     | Cascade-safe sparkline baseline (MEDIUM finding from code review) | follow-up |

**Recommended next session focus**: Phase 4 (Atelier Console).

It's the next visual theme to ship and matches the demo set (`docs/design/demos/demo-atelier-v2.html` + mobile + PNG already exist). Pattern is well-proven now (Linear → Trading both shipped CSS-only with the same featureManifest opt-in approach). Atelier should follow the same path: register the theme, copy the warm-graphite palette + Fraunces serif from the demo, restyle components via `:root[data-theme="atelier"]`, capture populated state, audit section-by-section vs the demo PNG.

Phase 2.5 (sidebar layout) is structural infra — exercises `layout.mount()` for the first time and validates state-preservation on switch. Bigger lift, no visible user-facing payoff. Lower priority unless theme switching mid-game becomes a real use case.

## Memory pointers (auto-loaded next session)

- `project_theme_system_handoff.md` — Phase 0+1+1.5+2+3+3.5 status table; Phase 4 (Atelier) is next
- `feedback_qc_failures_2026-05-04.md` — discipline rules 11-15 from the mobile failure session
- `feedback_new_theme_must_do.md` — 15 must-do rules; especially relevant for Phase 4 (new theme ship)
- `feedback_compare_to_demo_before_done.md` — populated-capture discipline
- `feedback_solo_project_autonomy.md` — ship across sessions without "continue?" prompts

## How to pick up Phase 4 (Atelier)

1. Read the demo: `docs/design/demos/demo-atelier-v2.html` + `demo-atelier-mobile-v2.html` + their `.png` snapshots side-by-side.
2. Skim Phase 2 + Phase 3 ships for the playbook:
   - `src/themes/linear/{theme.css,featureManifest.js,index.js}` — Linear was the second theme.
   - `src/themes/trading/{theme.css,featureManifest.js,index.js}` — Trading was the third, plus the new `_shared/sparkline.js`.
3. Register Atelier in `src/main.js` (next to `register(broadcast)` / `register(linear)` / `register(trading)`).
4. Copy the demo's palette + typography into `src/themes/atelier/theme.css` under `:root[data-theme="atelier"]`. Token names must match the spec in `src/themes/_shared/tokenSpec.js`.
5. `featureManifest.js` for Atelier — `honorPortraits: 'photo'` is the demo's signature; check the demo for other defaults (sparklines false, navigation default, etc.).
6. Run `npm run dev` (port 3000, `GD_NO_API_PROXY=1`) and check the picker shows 4 themes.
7. Adapt the existing capture pipeline: copy `scripts/visual/capture-trading-theme.mjs` → `capture-atelier-theme.mjs`, run it, audit each section vs `demo-atelier-v2.png`.
8. Apply rules 11-15 from `feedback_new_theme_must_do.md` BEFORE declaring done. Worst-section score = aggregate.

## How to pick up the lighter follow-ups instead

If a full theme is too much for the next session:

- **Cascade-safe sparkline baseline (MEDIUM follow-up)**: add unscoped `.sparkline__grid { stroke: currentColor; opacity: 0.2 }` etc. to a shared CSS file (probably `index.html` `<style>` or a new `src/themes/_shared/sparkline.css`). Five-line lift; closes the MEDIUM finding from code review.
- **Phase 2.5 (sidebar)**: bigger lift, validates `layout.mount()`. Read THEME-ARCHITECTURE.md §3 for the API contract.
- **PNG export theme-awareness**: `src/export/exportMobile.js` currently renders Broadcast styling regardless of active theme. Plumb `getCurrent().name` into the canvas render path.

## State at end of session

- Branch: `main`
- HEAD: `3a7b55f docs: sync codebase docs with Phase 3.5 ship`
- Pushed: yes
- Dev server: stopped (was on :3000 during verification)
- Open file edits: none
- Pending todos: see "What's next" above
