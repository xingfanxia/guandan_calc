# REDESIGN — wxapp-style mobile-first UI/UX port (2026-06-12)

Goal: rebuild guandan-scorer web UI to match `guandan-scorer-wxapp` design (see root `DESIGN.md`).
Kill 5-theme system → light/dark only. Zero functional regression. Game logic (`shared/`,
`src/game/`, honors algorithms) untouched.

## State

| Phase | Scope | Status | Commit |
|---|---|---|---|
| RD-1 | DESIGN.md + tokens.css + new style.css + index.html restructure + theme system removal (themeToggle replaces themeManager/ThemePicker; statistics/honors/main.js de-themed; tokenSpec+themePalette relocated to src/styles/) | pending | — |
| RD-2 | Tap-to-rank entry (click pool chip → next slot; click filled slot → unrank); hint copy updates | pending | — |
| RD-3 | rooms.html restyle | pending | — |
| RD-4 | players.html restyle | pending | — |
| RD-5 | player-profile.html restyle | pending | — |
| RD-6 | Mobile+desktop screenshot QC (iPhone 14 Pro / Pixel 7 / desktop, light+dark), victory modal + export smoke | pending | — |
| RD-7 | Tests: rewrite smoke test (light/dark), new capture script, regenerate VR baselines, CI workflow update | pending | — |
| RD-8 | Docs sync: CLAUDE.md, README, memory; delete dead theme docs refs | pending | — |

## Hard constraints

- All element IDs in index.html are JS hooks — keep every one (`grep '\$('` across src/).
- Renderer-emitted class contracts kept (restyle, don't re-mark): `.history__row/*`, `.roster-row/*`,
  `.pool-tile/*`, `.slot/*` + `.rank-slot`, `.player-tile`, `.honor/*`, stats table cells,
  `.victory-modal/*`, `.toast/*`.
- `gd_v9_theme` localStorage key reused with values `'light' | 'dark'` (old 5-theme values invalid → fallback).
- Drag-drop + touchHandler stay functional (tap-to-rank is additive primary interaction).
- PNG exports keep working via relocated `themePalette.js` (reads computed tokens).
- Page-specific CSS for players/rooms/profile currently lives in `src/themes/broadcast/theme.css`
  lines ~3107-4392 — must be re-implemented in new style.css before deleting themes.

## Decisions

- Sparkline stats column: REMOVED (was Trading-theme-gated; theme dies, feature manifest dies).
- Honor portraits (teatable): REMOVED + `public/themes/teatable/` assets deleted.
- Google Fonts (Fraunces/DM Mono/Inter Tight): REMOVED — system stack per DESIGN.md §3.
- featureManifest/themeManager/ThemePicker/sparkline/5 theme dirs: DELETED.
- tokenSpec.js + themePalette.js: MOVED to `src/styles/`.
- Ticker → slim status strip (IDs kept, tickerSync.js unchanged).
- Apply/advance buttons → sticky bottom actionbar on mobile (CSS only).
