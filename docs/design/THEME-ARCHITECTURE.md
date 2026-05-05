# Theme Switching Architecture

> Production design for a 5-theme system (A Broadcast · C Tea-Table · D Trading · E Linear · F Atelier) where each theme owns its layout, not just its CSS variables.
> Generated 2026-05-03 alongside the v3 wireframe demos.

---

## 1. The Three Approaches (and which we're picking)

| Approach | What it can do | Why it's wrong here |
|---|---|---|
| **A. CSS-vars-only swap** | Change `--bg`, `--accent`, fonts | All themes look like the same app with different paint — defeats the point |
| **B. CSS classes + selective JS** | Theme can override section grids, sizes, even structural arrangements via `[data-theme="x"] .selector { ... }` | Hits a ceiling: sidebar nav (E) vs top nav (A,C,D,F), playing-card slots (F) vs ASCII slots (D), bottom action bar (mobile) vs no bottom bar (Atelier desktop) — these aren't CSS overrides, they're different DOMs |
| **C. Per-theme layout module + shared data** ✓ | Each theme owns its own top-level layout HTML + theme-specific component renderers; all themes import the same data layer (`state.js`, `calculator.js`, `rules.js`, `roomManager.js`, etc.) | The right answer. The 38-module architecture already separates data from UI cleanly, so this is a natural extension. |

We're picking C.

---

## 2. Target File Layout

```
src/
  themes/
    _shared/
      themeManager.js          // mount/unmount, localStorage persist, dispatch
      featureManifest.js        // declares which features each theme renders
      tokenSpec.js              // shared token names (themes provide values)
    broadcast/
      layout.js                 // top-level page scaffold (DOM mount points)
      theme.css                 // palette + fonts + spacing scale
      components/               // theme-specific component renderers
        TeamPanel.js
        RankingSlots.js
        PlayerPool.js
        VictoryHero.js
        HonorCard.js
        // ... per UX-FLOWS Section 9
      assets/                   // theme-only assets (e.g., card-back patterns, brushstroke SVGs)
    teatable/
      layout.js
      theme.css
      components/...
      assets/...
    trading/
      layout.js
      theme.css
      components/...
    linear/
      layout.js
      theme.css
      components/...
    atelier/
      layout.js
      theme.css
      components/...
  core/                         // SHARED across themes
    state.js                    // game state singleton (existing)
    events.js                   // pub/sub (existing)
    storage.js                  // localStorage (existing)
    config.js                   // settings (existing)
    utils.js                    // DOM helpers (existing)
  game/                         // SHARED — pure logic, never touches DOM
    calculator.js
    rules.js
    history.js
  controllers/                  // SHARED business logic
    gameControls.js
    playerControls.js
    exportControls.js
    roomControls.js
    settingsControls.js
  player/                       // SHARED player management
    playerManager.js
    dragDrop.js                 // works against any theme's slot/pool components
    touchHandler.js
    photoRenderer.js
  api/                          // SHARED API client (Vercel KV)
  share/                        // SHARED room sync
  stats/                        // SHARED stats/honors logic
  main.js                       // bootstrap → themeManager.mount(localStorage.theme || 'broadcast')
```

The split is clean: `themes/` owns presentation; everything else is pure logic + data the themes consume.

---

## 3. Theme Manager API

```js
// src/themes/_shared/themeManager.js

export const themeManager = {
  current: null,

  async mount(themeName, rootEl = document.getElementById('app')) {
    // 1. Unmount previous theme if any
    if (this.current) {
      await this.current.layout.unmount(rootEl);
      this.current.theme.styleEl?.remove();
    }

    // 2. Dynamically import the theme module (code-split)
    const theme = await import(`../${themeName}/index.js`);

    // 3. Inject theme CSS
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = `/src/themes/${themeName}/theme.css`;
    document.head.appendChild(link);

    // 4. Mount the theme's layout (renders DOM scaffold, hooks event listeners)
    await theme.layout.mount(rootEl, {
      state,           // shared singleton from core/state.js
      events,          // pub/sub
      controllers,     // game/player/room/etc.
      featureManifest: theme.featureManifest,
    });

    // 5. Subscribe to state changes — theme components re-render
    events.on('state:*', () => theme.layout.update());

    // 6. Persist
    localStorage.setItem('gd_v9_theme', themeName);
    this.current = { name: themeName, ...theme };

    events.emit('theme:changed', { theme: themeName });
  },

  async switch(themeName) {
    const stateSnapshot = state.getSnapshot();
    await this.mount(themeName);
    state.restore(stateSnapshot);  // state survives the theme swap
  },
};
```

**Key invariant:** state survives the swap. Switching from Broadcast to Linear mid-game keeps the round, levels, players, history, room sync intact. State is in `core/state.js`, themes are pure presentation.

---

## 4. Feature Manifest Pattern

Not every theme renders every feature the same way (or at all). The manifest lets each theme declare what it includes.

```js
// src/themes/broadcast/featureManifest.js
export default {
  navigation: 'top-tabs',           // top-tabs | sidebar | bottom-only | minimal-top
  rankingInteraction: 'drag-drop',  // drag-drop | tap-select | both
  victorySurface: 'inline-hero',    // inline-hero | modal | sample-only
  sparklines: false,                // Trading uses these; broadcast doesn't
  commandPalette: false,            // Linear uses; others don't
  honorPortraits: 'gradient',       // gradient | ink | photo | tagged
  customRulesUI: 'broadcast-cards', // theme-specific render mode
  liveCalcStrip: 'editorial',       // editorial | monospace | italic | ascii | minimal
};
```

```js
// src/themes/trading/featureManifest.js
export default {
  navigation: 'top-status-bar',
  rankingInteraction: 'drag-drop',
  victorySurface: 'sample-only',    // Trading prefers terminal-style ticker over hero
  sparklines: true,                  // First-class
  commandPalette: false,
  honorPortraits: 'tagged',
  customRulesUI: 'env-style',
  liveCalcStrip: 'monospace',
};
```

Components then read the manifest:

```js
// src/themes/_shared/RankingSlot.js (or theme's variant)
function renderSlot(slot, manifest) {
  if (manifest.rankingInteraction === 'tap-select') {
    return renderTapSelectSlot(slot);
  }
  return renderDragDropSlot(slot);
}
```

This lets us add a feature once in shared logic, and themes opt in with one manifest line — instead of touching 5 codebases per feature.

---

## 5. Token Layer (shared spec, theme-supplied values)

Token names are STANDARDIZED across themes. Values vary.

```js
// src/themes/_shared/tokenSpec.js
export const TOKEN_SPEC = {
  color: ['bg', 'surface', 'surface-2', 'surface-3', 'ink', 'ink-dim', 'ink-dimmer',
          'accent', 'accent-dim', 'team-a', 'team-b', 'win', 'loss', 'rule'],
  font: ['display', 'body', 'mono'],
  scale: ['xs', 'sm', 'base', 'md', 'lg', 'xl', '2xl', '3xl', 'hero'],
  space: [0, 1, 2, 3, 4, 5, 6, 7, 8],
  radius: ['none', 'sm', 'md', 'lg', 'xl'],
};
```

```css
/* src/themes/broadcast/theme.css */
:root[data-theme="broadcast"] {
  --bg: oklch(18% 0.04 250);
  --surface: oklch(22% 0.04 250);
  /* ... */
  --accent: oklch(70% 0.20 45);     /* ember orange */
  --font-display: 'Fraunces', Georgia, serif;
  --font-body: 'Inter Tight', system-ui, sans-serif;
  --font-mono: 'DM Mono', monospace;
}
```

```css
/* src/themes/trading/theme.css */
:root[data-theme="trading"] {
  --bg: oklch(12% 0.005 240);       /* terminal black */
  --surface: oklch(16% 0.005 240);
  /* ... */
  --accent: oklch(80% 0.16 80);     /* amber HUD */
  --font-display: 'JetBrains Mono', monospace;
  --font-body: 'JetBrains Mono', monospace;
  --font-mono: 'JetBrains Mono', monospace;
}
```

Themes can also opt out of certain tokens (e.g., Trading doesn't need `--accent-dim` since amber doesn't get dimmed) — the unused `--var` just isn't referenced.

---

## 6. Default Theme + User Choice

```js
// src/main.js (boot)
import { themeManager } from './themes/_shared/themeManager.js';

const userTheme = localStorage.getItem('gd_v9_theme');
const defaultTheme = 'broadcast';   // A is the default

await themeManager.mount(userTheme || defaultTheme);
```

A theme picker UI lives in `src/themes/_shared/ThemePicker.js` — accessible from the settings drawer (consistent across all themes). Switching is instant; state persists.

---

## 7. Phasing Plan (Don't Build All 5 At Once)

| Phase | What | Why | Status |
|---|---|---|---|
| **0** | Refactor existing app's `src/style.css` into `src/themes/_shared/tokenSpec.js` + `src/themes/broadcast/theme.css` (the new default) | Establishes the token contract before any other theme exists | **SHIPPED 2026-05-03** |
| **1** | Build `themeManager.js` + `ThemePicker.js`. Mount Broadcast as the only theme. Verify state persistence + switching mechanics work (with a single theme = no-op switch). | Architecture proven without the 5x cost | **SHIPPED 2026-05-03** |
| **1.5** | Editorial closure of all Broadcast sections — populated state ≥95% match per section vs `demo-broadcast-v3.png`. | Establishes "compare to demo" discipline before further themes. | **SHIPPED 2026-05-03** (99fcf5b) |
| **2** | Add Linear as 2nd theme. Density-first restyle of all shared components, Geist + Geist Mono, single Linear-purple accent. CSS-only. | Stress-test the abstraction with a divergent palette + scale. (Originally scoped to also include the sidebar layout — deferred to **Phase 2.5**.) | **SHIPPED 2026-05-03** (cf211a6) |
| **2.5** | Linear sidebar layout via `layout.mount()` + state preservation across theme switches. | Validates the layout mount/unmount path of the manager beyond CSS-only restyles. | TODO |
| **3** | Add Trading as 3rd theme. JetBrains Mono everywhere, near-black + amber HUD, 1px borders, ASCII bracket flair. CSS-only. | Validates monospace-only typography + accent-on-black contrast. | **SHIPPED 2026-05-03** (9883e1d) |
| **3.5** | Sparkline renderer (so Trading can flip `featureManifest.sparklines: true`). | Trading manifest declared the capability; Phase 3 ship reused existing renderers and left the chart work for a focused follow-up. | **SHIPPED 2026-05-04** — `src/themes/_shared/sparkline.js` (pure SVG, theme-CSS-styleable) wired into `src/stats/statistics.js`. Trading flipped to `true` and now renders a 近况 column in the stats-table with per-team-colored rank-trajectory sparklines. Broadcast / Linear stay `false` and render unchanged. Visual baseline: `docs/reports/phase3-5-sparklines/`. |
| **4** | Add Atelier (warm-graphite, photographic moments) — different in palette family + asset needs. | Validates theme-specific assets (illustrations, photos) | **SHIPPED 2026-05-04** — `src/themes/atelier/{theme.css, featureManifest.js, index.js}` registered as fourth theme. CSS-only restyle (no commissioned photo assets in this iteration). Editorial magazine framing: warm graphite oklch 60° hue, clay/caramel accent at 65°, Fraunces serif + Inter + JetBrains Mono, vintage card-stock pcards, gold rule between sections. Visual baseline: `docs/reports/phase4-atelier/`. **Polish iter 1+2+3+4 shipped 2026-05-05** (`a392e15` + `c852766` + `06c1137` + `52c9504`) — aggregate ~70% → ~96%, no remaining floor. Iter 1: root-cause history grid 5-col→8-col, capture script `renderStatistics()`, hero scaling. Iter 2: pool/slots editorial captions. Iter 3: victoryModal markup refactor (inline styles → class-based) + per-theme victory-modal CSS for all 4 themes (broadcast/linear/trading/atelier). Iter 4: calcpreview heavy panel → editorial single-row aside + slot squat-rect → vertical playing-card 90/130 + first-time theming of all filled-slot inner classes (`slot__index/rank-cn/avatar/name/handle/check` — never styled in atelier through iter 0/1/2/3, which was the root cause of the generic filled state). Cross-theme victory baseline: `docs/reports/victory-cross-theme/`. Combined handoff: `docs/design/HANDOFF-2026-05-05-atelier-polish-iter-1.md`. |
| **5** | Add Tea-Table last — needs custom illustrations (ink portraits, brushstroke SVGs) which is the most expensive asset work. | Don't gate the rollout on an asset commission | TODO |
| — | Visual regression CI (pixelmatch) — 65 baselines / 7 capture scripts, GitHub Actions workflow, deterministic state-injection fixtures incl. `FIXED_RANKINGS_8` for sparklines + per-directory threshold overrides for canvas font noise. | Protect themes from drift over time. | **SHIPPED 2026-05-05** (`402bb87` + `2fa1b84` + `c9ddf62` + `1d2cf8b` + extension commits `f768ba7` + `c6da03a`) |
| — | Cross-page FOUC fix — inline synchronous `<script>` in <head> of all 4 entry HTMLs reads `gd_v9_theme` and sets `data-theme` before cascade resolves. Replaces deferred `themeBootstrap.js` module which ran AFTER stylesheets. | Eliminate the saved-theme→Broadcast→saved-theme flash on navigation. | **SHIPPED 2026-05-05** (`4a3d7e6`) |

Each phase ships independently. As of 2026-05-03 users have a 3-option theme picker (Broadcast default · Linear · Trading); Phase 4 and 5 add further options as they land.

---

## 8. Cost Honest Assessment

| Cost | Estimate |
|---|---|
| Phase 0 token refactor | 1-2 days |
| Phase 1 theme manager + Broadcast as default | 3-5 days |
| Each subsequent theme | 4-7 days (depending on assets needed) |
| **Total to ship all 5** | **3-5 weeks** for one engineer |

| Ongoing tax | What it adds |
|---|---|
| Adding a new feature | Touch 5 themes (mitigated by feature manifest — usually only 1-2 themes need custom rendering, others fall back to a default) |
| Adding a new screen | Build it in default theme, declare in manifest, other themes inherit OR opt to override |
| Theme drift over time | Real risk — needs visual regression CI to catch (Percy / Chromatic / Playwright snapshot) |

---

## 9. What This UNLOCKS

1. **A as default, 4 alternates** — you ship A first, then add themes one at a time. No big-bang migration.
2. **State survives theme swaps** — players mid-game can switch themes without losing the round
3. **Marketing differentiation** — "Choose your game-night vibe" becomes a real feature
4. **Per-user persistence** — each user's choice saved in `gd_v9_theme` localStorage
5. **A/B experimentation** — could randomize theme on first visit and measure engagement
6. **Future themes** — adding a 6th (or 16th) theme is a contained file-folder addition, not a refactor

---

## 10. What This Does NOT Solve

- **Mobile-specific layouts** still need explicit handling per theme (each `layout.js` handles `@media` breakpoints OR has separate mobile / desktop component variants)
- ~~**Print styles / PNG export**~~ — **SHIPPED 2026-05-05** (`54c3552`). `src/themes/_shared/themePalette.js` reads CSS custom properties at export time; `src/export/{exportMobile,exportHandlers}.js` use `palette.{bg,ink,accent,...}` instead of hardcoded hex. Cross-theme baseline: `docs/reports/png-export-themes/`. Honor brand colors (16 per-honor identity colors at `exportMobile.js:240-256`) stay hardcoded since they're brand markers, not theme tokens.
- **Email / share-card rendering** (if you add OG images later) — same: theme-aware
- **Deep linking** — when someone shares a room URL, does the recipient see the host's theme or their own? (Recommend: their own. The data is shared; the presentation is personal.)

---

## 11. Decision Points to Confirm Before Building

1. **Default theme:** A Broadcast (confirmed)
2. **Theme picker location:** in settings drawer (consistent across themes) OR floating top-right gear (faster discovery)?
3. **Switch animation:** instant snap OR cross-fade (200ms)?
4. **First-time user:** show theme picker as onboarding step OR default to A and let them discover later?
5. **Mobile theme:** same as desktop choice OR independent?
6. **Storage key:** `gd_v9_theme` (consistent with existing `gd_v9_*` keys)
