# REDESIGN — wxapp-style mobile-first UI/UX port (2026-06-12)

Goal: rebuild guandan-scorer web UI to match `guandan-scorer-wxapp` design (see root `DESIGN.md`).
Kill 5-theme system → light/dark only. Zero functional regression. Game logic (`shared/`,
`src/game/`, honors algorithms) untouched.

## State

| Phase | Scope | Status | Commit |
|---|---|---|---|
| RD-1 | DESIGN.md + tokens.css + new style.css + index.html restructure + theme system removal (themeToggle replaces themeManager/ThemePicker; statistics/honors/main.js de-themed; tokenSpec+themePalette relocated to src/styles/) | done | dd8239a |
| RD-2 | Tap-to-rank entry (click pool chip → next slot; click filled slot → unrank); hint copy updates | done | dd8239a (combined with RD-1) |
| RD-3 | rooms.html restyle | done | ff18751 |
| RD-4 | players.html restyle | done | ff18751 |
| RD-5 | player-profile.html restyle (incl. Chart.js token wiring) | done | ff18751 |
| RD-6 | Mobile+desktop screenshot QC (light+dark), victory modal + export smoke | done | QC pass |
| RD-7 | Tests: toggle smoke (14 assertions), capture-redesign + capture-png-exports, 21 baselines, CI structural smoke | done | f46e119 |
| RD-8 | Docs sync: CLAUDE.md, README, architecture, memory; THEME-ARCHITECTURE historical banner | done | 3ef256f |
| RD-9 | Adversarial multi-agent review → fix 8 confirmed light-mode regressions (search rows, create/edit modals, compact roster, victory MVP tagline, stats team colors, honors placeholder, share/settings/remove-btn) + empty-honors copy (本场无人达成 vs 数据采集中) | done | 629d239 |
| RD-10 | One-tap room gate: new-game-by-default = create room; skip reset confirm when blank; resolves the local-game profile-sync 403s (room host token authorizes all participants) | done | 15fc224 |

## Outstanding follow-ups

- votingManager viewer voting card tokenization (Task #1) — needs a live host+viewer room to verify; main #votingSection is hidden so low urgency.

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
