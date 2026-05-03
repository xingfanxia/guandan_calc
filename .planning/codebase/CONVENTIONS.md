# Coding Conventions & Visual Design Audit

**Analysis Date:** 2026-05-03

This document has two parts:
- **Part A** — concise code conventions for the modular ES6 codebase
- **Part B** — exhaustive audit of the current visual identity, intended as the baseline reference for an upcoming `huashu-design` dark-themed redesign

---

# Part A — Code Conventions

## Module System

**ES Modules everywhere.** `package.json` declares `"type": "module"`. Every file in `src/` is an ES6 module loaded as `<script type="module">`.

**Pattern:**
- Named exports only, no default exports for utilities (`export function $`, `export function on`, `export function now`)
- Singletons exported as default instances (`src/core/state.js`, `src/core/config.js` export pre-instantiated singletons)
- Module-level constants UPPER_SNAKE (`KEYS`, `KEY_PREFIX`, `ANIMAL_EMOJIS`, `ACHIEVEMENTS`, `FOCUSABLE_SELECTOR`)

**Imports order (observed in `src/main.js`):**
1. Core modules (`./core/*`)
2. Controllers (`./controllers/*`)
3. Game logic (`./game/*`)
4. Player system (`./player/*`)
5. Ranking system (`./ranking/*`)
6. Statistics & UI (`./stats/*`, `./ui/*`)
7. Share/room features (`./share/*`)
8. API client (`./api/*`)

Each section is separated by a blank line and a single-line comment header (`// Core modules`, `// Controllers (NEW - extracted for maintainability)`).

**File extensions are required in import paths** (`.js`), Vite handles bare specifiers for npm packages only.

## Naming Patterns

| Construct | Convention | Example |
|-----------|------------|---------|
| Files | camelCase | `playerCreateModal.js`, `roomManager.js` |
| Directories | lowercase, no separators | `core`, `share`, `stats`, `controllers` |
| Functions | camelCase, verb-led | `applyTeamStyles`, `renderTeams`, `checkGameEnded` |
| Module constants | UPPER_SNAKE_CASE | `KEYS`, `ANIMAL_EMOJIS` |
| Local constants | camelCase | `currentMode`, `winningTeamColor` |
| Singleton classes | PascalCase | `class GameState` |
| Event names | colon-separated namespaces | `state:teamLevelChanged`, `voting:cast`, `ui:victoryModalShown` |
| DOM IDs | camelCase | `victoryModal`, `playerSearchInput`, `t1NameChip` |
| CSS classes | kebab-case | `player-tile`, `team-drop-zone`, `nav-tab` |
| LocalStorage keys | snake_case with prefix | `gd_v9_config`, `gd_v9_state` |

## DOM Helpers — `src/core/utils.js`

Single source of truth for DOM utilities. Two functions and one util:

```js
$(id)              // document.getElementById wrapper, returns null if missing
on(el, ev, fn)     // addEventListener with null-guard + IE8 attachEvent fallback
now()              // localized zh-CN timestamp string (yyyy-MM-dd HH:mm:ss)
escapeHtml(value)  // escape &<>"' for safe template-literal interpolation
```

**Rules:**
- Use `$` everywhere instead of repeated `document.getElementById`
- Always wrap user/API string interpolation in `escapeHtml(...)` when injecting into `innerHTML` or attribute templates — this is enforced by review (see `src/player/playerCreateModal.js`, `src/ui/victoryModal.js` for examples)
- `on()` warns to console when target element is null instead of throwing — preserves "soft-fail" UX for optional elements

## Storage Wrapper — `src/core/storage.js`

Thin localStorage abstraction with versioned key prefix `gd_v9_`. All keys exported as `KEYS`:

```js
KEYS = { CONFIG, STATE, PLAYERS, STATS }
load(key, defaultValue = null)   // JSON.parse with try/catch + console.warn
save(key, value)                 // JSON.stringify with try/catch
remove(key)                      // single key removal
clearAll()                       // wipes all gd_v9_* keys
isAvailable()                    // probes for localStorage support
```

**Rules:**
- Never use `localStorage.setItem/getItem` directly outside `storage.js`
- Always go through `KEYS` constants — no string literals
- Bumping the schema requires bumping `KEY_PREFIX` (currently `gd_v9_`)

## Event Bus — `src/core/events.js`

Pub/sub pattern for loose coupling between modules. API:

```js
on(event, callback) -> unsubscribe   // returns its own unsubscribe fn
off(event, callback)
emit(event, data)                    // try/catch around each listener
once(event, callback)
clear(event?)                        // clear one event or all
listenerCount(event)
eventNames()
```

**Conventions:**
- Event names are **`namespace:action`** (`state:hydrated`, `voting:cast`, `config:teamChanged`)
- Listener errors are caught and logged — never propagate
- Events with no listeners silently no-op
- Hydration events fire from singletons after `load(...)` succeeds (`emit('state:hydrated')`)

## State Discipline — `src/core/state.js`

Singleton enforced via class constructor returning the existing `instance`. Mutations always go through setters that:
1. Validate inputs (throw on invalid team key)
2. Update internal state
3. Call `this.persist()` to write to localStorage
4. Emit a typed event so subscribers can re-render

```js
state.setTeamLevel('t1', 'A')
// → validates 't1' is valid
// → updates this.teams.t1.lvl
// → save(KEYS.STATE, ...)
// → emit('state:teamLevelChanged', { team: 't1', level: 'A' })
```

**Hydration is idempotent.** `state.hydrate()` early-returns on `_hydrated` flag, preventing late module init from clobbering in-flight mutations.

**Never mutate state directly** — always use setters. Direct `state.teams.t1.lvl = 'A'` would skip persist + emit and leak inconsistency.

## Controllers Pattern (v10.0)

`src/controllers/*` extracted in v10.0 to drop `main.js` from 1607 → 509 lines. Each controller:
- Exports a `setupXxxControls()` function called once during `init()`
- Wires DOM events to game logic
- No business logic — only orchestration

Files: `gameControls.js`, `playerControls.js`, `exportControls.js`, `roomControls.js`, `settingsControls.js`.

## File Length Norms

Observed sizing from the modular rewrite:

| Tier | Lines | Examples |
|------|-------|----------|
| Tiny utilities | 50-100 | `utils.js` (69), `events.js` (114), `modal.js` (88) |
| Standard module | 100-300 | `storage.js` (93), `state.js` (~300) |
| Larger surface modules | 300-500 | `roomUI.js` (282), `victoryModal.js` (505) |
| Heaviest | 500-700 | `main.js` (509), `style.css` (556) |
| Inline page scripts | 400-1021 | `players.html` (434), `player-profile.html` (1021) |

**Target: 200-400 lines per module, 800 max.** The HTML files exceed this because they bundle inline `<script type="module">` blocks alongside markup — refactoring opportunity flagged for future cleanup but not currently a violation.

## Comment Style

JSDoc on every exported function. Standard form:

```js
/**
 * Brief description.
 * @param {Type} name - Description
 * @returns {Type} Description
 */
```

In-code prose comments are reserved for **non-obvious "why"** decisions, especially security and a11y rationale (see `src/core/modal.js` lines 34-79, `players.html` lines 207-213). Style is direct, second-person, often references the threat model or fix history.

---

# Part B — Visual Design Audit (Current Baseline)

This section is exhaustive by design — it captures every visual decision in the existing UI so a redesigner can compare against without re-reading source.

## Style Locations (Where Visual Decisions Live)

| Location | Purpose | Lines |
|----------|---------|-------|
| `src/style.css` | **Single global stylesheet** — CSS variables, layout, components, mobile rules | 556 |
| `index.html` `<style>` block (lines 21-67) | Tab navigation styles only | ~46 |
| `players.html` `<style>` block (lines 13-88) | Tab nav + `.player-card`, `.player-grid`, `.stat-badge` | ~75 |
| `player-profile.html` `<style>` block (lines 13-69) | `.profile-header`, `.stat-grid/item/value/label`, `.honor-badge`, `.game-row` | ~56 |
| `rooms.html` `<style>` block (lines 13-149) | Tab nav + `.room-card`, `.room-grid`, `.player-tag`, `.status-badge`, `.filter-tab` | ~136 |
| Inline `style="..."` attributes | **109 in index.html, 85 in player-profile, 26 in players, 15 in rooms** | — |
| Inline JS-injected styles via `el.style.cssText = ...` | Modals, victory modal, host/viewer banners, vote buttons, lock icons | — |

**Major finding for redesigner:** The codebase has NO design system. Roughly 235 inline `style="..."` attributes across the four HTML pages plus dozens of `el.style.cssText = `\``...`\`` blocks in JS modules. Tokens exist in `:root` but only for 7 colors; everything else is ad-hoc hex literals scattered across files. This is the #1 redesign opportunity.

## Color Palette — Complete Inventory

### Defined CSS Variables (`src/style.css:1-10`)

```css
--bg:      #0b0b0c   /* near-black page background */
--card:    #16171b   /* card surface, one elevation up */
--ink:     #f5f6f8   /* primary text on dark */
--muted:   #b4b8bf   /* secondary text */
--stroke:  #2a2d35   /* borders, hairlines */
--chip:    #24262c   /* small pill background */
--accent:  #e6b800   /* warm gold — drag-target highlight, rank-number color */
```

### Background / Surface Hierarchy (most-to-least used)

| Hex | Role | Where |
|-----|------|-------|
| `#0b0b0c` | Page base background, `<input type=text>` background, theme-color meta | `--bg`, `body`, all `meta[theme-color]` |
| `#0f1115` | Recessed surfaces (drop zones, chips, unassigned-players area, text inputs) | `style.css` (multiple) |
| `#131419` | `<details>` background | `style.css:226` |
| `#16171b` | Standard card surface | `--card` |
| `#1a1a1a` | **Inline alternate dark** — heavily used in HTML pages but NOT a CSS variable | `index.html`, `players.html`, `player-profile.html`, `rooms.html` (tab containers, player cards, stat items) |
| `#1a1b1c` | Victory modal background, voting result panels | `index.html:505`, `victoryModal.js`, `votingManager.js` |
| `#1f2229` | Form controls background, player-tile background, rank-slot background | `style.css:84,253,344` |
| `#252525` | Hover state for `.nav-tab`, `.player-card`, `.room-card` | All HTML inline styles |
| `#232730` | `button:hover` background | `style.css:101` |
| `#24262c` | `.tile`, `.rank-slot.filled` background | `style.css:123,369` |
| `#2a2a2a` | `.stat-badge`, `.honor-badge`, `.player-tag` background | players/rooms/profile pages |
| `#2a2b2c` | Voting button background, vote-result cards | `victoryModal.js`, `votingManager.js` |

**Observation:** Five distinct "near-black" surfaces (`#0b0b0c`, `#0f1115`, `#1a1a1a`, `#1a1b1c`, `#1f2229`, `#24262c`, `#2a2a2a`, `#2a2b2c`) with no clear elevation system. A redesigner should collapse these into 3-4 elevation tokens (e.g., `bg`, `surface-1`, `surface-2`, `surface-3`).

### Text Colors

| Hex | Role |
|-----|------|
| `#f5f6f8` | Primary ink (white-off, `--ink`) |
| `#fff` | Pure white — used on team chips, MVP labels, button text, victory modal headline, `.nav-tab.active`, `.status-badge` text |
| `#000` | Pure black — used as text on warm-gold honor badges (`#d4af37`, `#32cd32`, `#eab308`, `#22c55e` on mode tab) |
| `#b4b8bf` | Muted secondary text (`--muted`) |
| `#888` | **Inline standard "secondary muted"** — used heavily on profile, players, rooms pages (NOT the CSS var) |
| `#999` | Vote count idle, victory modal body text, "暂无投票" |
| `#666` | Ultra-quiet text, divider labels ("——— 或使用快速设置 ———"), footer text |
| `#444` | Border on emoji button defaults, partner card border |

**Observation:** The CSS var `--muted: #b4b8bf` is rarely used; pages substitute `#888`, `#999`, `#666` ad-hoc. Three near-identical greys = no consistency.

### Border / Stroke Colors

| Hex | Role |
|-----|------|
| `#2a2d35` | `--stroke` — standard hairline |
| `#333` | Inline equivalent — pages use `border: 1px solid #333` everywhere instead of `--stroke` |
| `#444` | Photo border, vote button default border |
| `#5b1e1e` | "Reset Match" destructive button border (red-tinted) |
| `#3e526b` | `.tile.selected` border (cool blue-grey) |
| `#324056` | `.tile.selected` background |
| `#ddd` | Footer top border (legacy light value, looks wrong on dark — flag for redesigner) |

### Brand / Accent Colors

| Hex | Role | Usage |
|-----|------|-------|
| `#e6b800` | `--accent` warm gold | Drag-over outline (`var(--accent)`), rank-number digits, rgba tints (`rgba(230,184,0,.05)`, `.1`) |
| `#fbbf24` | Bright amber/yellow | Player tagline color, lifetime stats divider, lock indicator (`f59e0b`), "Recent Games" honors |
| `#f59e0b` | Orange-amber | Strict-A rule label, favorite room button (`background:#f59e0b`), lock icon, admin warning border |
| `#d4af37` | Old-gold | "吕布" (Lubu) honor badge background |

### Semantic / Win-Loss Colors

| Hex | Role |
|-----|------|
| `#22c55e` (green-500) | **Primary "win" green** — winner color, MVP green, "Apply Result" button, mode tab active background, status-active badge, partner "good" tier, success messages |
| `#16a34a` | Voting card gradient end (darker green) |
| `#4ade80` | "Quick start" button, "auto-apply" highlighted label, partner border |
| `#10b981` (teal-emerald) | Mobile PNG export button, viewer banner gradient start, viewer lock icon |
| `#059669` | Viewer banner gradient end (darker emerald) |
| `#ef4444` (red-500) | **Primary "loss" red** — burden color, "delete" admin button, error text, `#ranjinwang` honor, opponent "good" tier (you-win-a-lot semantic), reset-match foreground (`#ffb3b3`) |
| `#dc2626` | "翻车王" (Crashed) honor background, error variations |
| `#b91c1c` | "燃尽王" (Burnout) honor background |
| `#ffb3b3` | "Reset match" button text color (light pink-red) |

### Team Default Colors (`src/core/config.js:284`)

| Team | Hex | Notes |
|------|-----|-------|
| **t1 (蓝队 / Blue)** | `#3b82f6` (blue-500) | Used for many other UI affordances too — admin button, host banner gradient, Chart.js point color, opponent "easy" tier |
| **t2 (红队 / Red)** | `#ef4444` (red-500) | Same hex as semantic-loss red, creating overload |
| Default fallback | `#666` | When team config missing |

### Honor Badge Color Palette (`index.html:339-407`)

15 distinct hardcoded hex tints for the special-honor section:

| Honor | Background | Text |
|-------|------------|------|
| 吕布 (Lubu) | `#d4af37` | `#000` |
| 阿斗 (Adou) | `#8b4513` | `#fff` |
| 石佛 (Stone Buddha) | `#708090` | `#fff` |
| 波动王 (Volatility) | `#ff4500` | `#fff` |
| 奋斗王 (Struggler) | `#32cd32` | `#000` |
| 翻车王 (Crashed) | `#dc2626` | `#fff` |
| 赌徒 (Gambler) | `#7c3aed` | `#fff` |
| 大满贯 (Grand Slam) | `#059669` | `#fff` |
| 连胜王 (Streak King) | `#ea580c` | `#fff` |
| 佛系玩家 (Zen) | `#6b7280` | `#fff` |
| 鲤鱼王 (Carp King) | `#f97316` | `#fff` |
| 不粘锅 (Non-stick) | `#10b981` | `#fff` |
| 闪电侠 (Flash) | `#eab308` | `#000` |
| 燃尽王 (Burnout) | `#b91c1c` | `#fff` |
| 棋差一着 (One Move Short) | `#8b5cf6` | `#fff` |
| 🤡 (Clown) | `#f472b6` | `#fff` |

This is the most chromatic surface in the entire app and is essentially a 15-color rainbow with no harmony scheme. Strong redesign target.

### Gradients

| Gradient | Where |
|----------|-------|
| `linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)` | Host banner (`roomUI.js:152`) |
| `linear-gradient(135deg, #10b981 0%, #059669 100%)` | Viewer banner (`roomUI.js:228`) |
| `linear-gradient(135deg, #1a1a1a 0%, #2a2a2a 100%)` | Profile header (`player-profile.html:17`) |
| `linear-gradient(90deg, #1a1a1a 0%, #2a2a2a 50%, #1a1a1a 100%)` | Lifetime achievements divider (`player-profile.html:740`) |
| `linear-gradient(135deg, #22c55e 0%, #16a34a 100%)` | Voting card win-state (`votingManager.js:319`) |
| `linear-gradient(135deg, #6b7280 0%, #4b5563 100%)` | Voting card pending-state |

### RGBA Tints (Glows / Shadows)

```
rgba(0, 0, 0, .25)            /* card box-shadow */
rgba(0, 0, 0, .28)            /* winbtn hover shadow */
rgba(0, 0, 0, .3)             /* player-tile hover shadow */
rgba(0, 0, 0, .8)             /* victory modal backdrop, chart tooltip bg */
rgba(255, 255, 255, .08)      /* winbtn.active inset glow */
rgba(255, 255, 255, .2)       /* voting card alpha overlay */
rgba(230, 184, 0, .05/.1)     /* drop-zone drag-over tint (gold) */
rgba(59, 130, 246, .3)        /* host banner shadow */
rgba(16, 185, 129, .3)        /* viewer banner shadow */
rgba(34, 197, 94, .8)         /* Chart.js partner bar (green) */
rgba(239, 68, 68, .8)         /* Chart.js partner bar (red) */
rgba(251, 191, 36, .3)        /* MVP tagline glow text-shadow */
```

## Typography

### Font Stack (`src/style.css:21`)

```
-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue",
Arial, "Noto Sans", "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei",
sans-serif
```

**Single stack for everything.** No display vs body distinction. CJK fallbacks handled gracefully:
- macOS: `PingFang SC`
- iOS: same
- Windows: `Microsoft YaHei`
- Other: `Noto Sans`, then generic sans

**No web fonts loaded.** No `@import` from Google Fonts, no `<link rel="preconnect">` for font CDN. PWA-friendly but limits design expressiveness.

**Canvas exports use `Arial` directly** (`exportMobile.js:92`) — no system fallback. Acceptable because Arial is universally available and Chinese glyphs fall back automatically per browser canvas rules.

### Font Sizes

| Size | Where | Role |
|------|-------|------|
| 48px | `<h1>` victory modal headline (`🎉 A级通关！🎉`), `<h2>` victory team name | Headline |
| 36px | Player profile `<h2>` name | Page header |
| 32px | Achievement badge emoji, MVP avatar fallback emoji | Decorative emoji |
| 24px | `.player-card h3`, mode-switcher tabs, vote button emoji, `.stat-value` | Section heading |
| 22px | Global `<h1>` (style.css) | Standard heading |
| 20px | Player tagline, MVP tagline, banner room code | Pull text |
| 18px | `.player-tile .emoji`, `.tile`, room code, host banner room code label | Strong text |
| 16px | Form input/select/button text, profile sub-headings, victory body, `<h4>` sizing | Body emphasis |
| 15px | `.nav-tab` text | Navigation |
| 14px | Table cells, "Recent Games" rows, edit profile button, mode tab text, `.stats-table td`, edit modal text, profile recent rankings header | Body |
| 13px | Vote leaderboard secondary text, banner secondary | Caption |
| 12px | `.small`, `.team-drop-zone .label`, `.actions button`, `.player-tile .name` | Caption |
| 11px | Vote count text | Tiny meta |
| 10px | Drag-handle `⋮⋮` hint | Tiny meta |

**No type scale.** Sizes fall on 11/12/13/14/15/16/18/20/22/24/32/36/48 — almost continuous. Modular scale (1.125 / 1.25 ratio) would tighten this dramatically.

### Font Weights

Only `normal` (default) and `bold` (`font-weight: 700` on `.winbtn`, `font-weight: bold` on display names, MVP labels, mode-tab active).

`font-weight: 500` shows up only on `.nav-tab` and `.status-badge` — slight upgrade from default but inconsistent.

`font-weight: 600` on `<details> > summary`.

### Line-Heights

Almost never specified. Defaults inherit. Only explicit values:
- `line-height: 1` on photoRenderer emoji span (`src/player/photoRenderer.js:44`)

This is a redesign opportunity — explicit `line-height: 1.5` for body, `1.2` for headlines would improve density consistency.

### Numeric Tabular Alignment

`.counter { font-variant-numeric: tabular-nums }` — used for stable counter display (e.g., level numbers) but only on `.counter` class which appears nowhere else in HTML. Effectively dead.

## Spacing & Sizing

### Padding / Margin Values Observed

`4px`, `6px`, `8px`, `10px`, `12px`, `14px`, `16px`, `20px`, `24px`, `32px`, `40px`

**No spacing scale.** Both 8px-grid (`8/16/24/32`) and 4px-grid (`4/12/20`) values mixed freely — `padding: 10px 12px` and `padding: 12px 24px` and `padding: 8px 12px` all appear in the same files.

### Border Radii

| Value | Where |
|-------|-------|
| `4px` | `.stat-badge`, `.player-tag`, `.status-badge`, message buttons |
| `6px` | Form inputs (inline), `.honor-badge`, `.filter-tab` |
| `8px` | Form inputs (additional), modal buttons, voting cards, `.profile-header`, banners, vote buttons |
| `10px` | Inputs, `.table-wrap`, `.player-tile` |
| `12px` | `.team-drop-zone`, `.rank-slot`, `.profile-header`, `.nav-tabs` container, victory modal inner cards |
| `14px` | `.card` (THE main card radius) |
| `16px` | Victory modal outer container (`#1a1b1c` 16px corner) |
| `999px` | Pill badges (`.badge`) |
| `50%` | Avatar circles, ripple keyframe |

**Six different "rounded" values, no system.** Cards use `14px`, modals use `16px`, banners and tabs use `12px`, inputs use `6/10px`, badges use `4/8/999px`. Redesigner should collapse to 3 tokens (e.g., `sm: 6px`, `md: 12px`, `lg: 16px`, plus pill).

### Layout Constraints

| Token | Value | Where |
|-------|-------|-------|
| Container max-width | 1150px | `.wrap` |
| Container padding | 16px desktop / 12px mobile | `.wrap` |
| Card vertical margin | `12px 0` | `.card` |
| Standard card padding | `16px` | `.card` |
| Form input padding | `10px 12px` | `input/select/button` |
| Grid auto-fit min | `260px` | `.grid` cards |
| Player-grid min | `300px` | `.player-grid` |
| Room-grid min | `350px` | `.room-grid` |
| Stat-grid min | `150px` | `.stat-grid` |

## Component Catalog

This is the full inventory of distinct UI components, organized by file. The redesigner should treat this as the component contract that must be preserved (visually) or intentionally deprecated.

### Global / Layout

| Component | Selector | Location | Description |
|-----------|----------|----------|-------------|
| Page wrapper | `.wrap` | `style.css:26` | Centered max-width 1150px container with 16px gutter |
| Card | `.card` | `style.css:32` | Primary content surface — `#16171b` bg, 14px radius, 16px padding, soft shadow |
| Row flex | `.row` | `style.css:59` | `display: flex, gap: 10px, flex-wrap, align-items: center` |
| Auto-fit grid | `.grid` | `style.css:66` | `grid-template-columns: repeat(auto-fit, minmax(260px, 1fr))` |
| Numeric grid | `.gridN` | `style.css:72` | Same with 8px gap, no min-width |

### Navigation

| Component | Selector | Location | Description |
|-----------|----------|----------|-------------|
| Tab nav | `.nav-tabs` + `.nav-tab` | inline in `index.html:23-67`, `players.html:14-58`, `rooms.html:14-58` | Pill-shaped tab group, dark `#1a1a1a` container with 12px radius. Active tab gets blue (`#3b82f6`), idle tabs grey (`#888`). Hover lifts to white on `#252525`. **Duplicated 3x across HTML files** — redesign should DRY this. |
| Filter tabs | `.filter-tabs` + `.filter-tab` | `rooms.html:126-148` | Square-cornered (6px) chip tabs in horizontal row |
| Mode tabs (player profile) | `.mode-tab` | `player-profile.html:647` (inline) | Game-mode switcher (全部/4P/6P/8P), green active state |

### Forms & Buttons

| Component | Selector | Location | Description |
|-----------|----------|----------|-------------|
| Standard input | `input[type=text]`, `select`, etc. | `style.css:78` | `#1f2229` bg (or `#0f1115` for text input), 1px stroke, 12px radius, 16px font (large to prevent iOS zoom) |
| Standard button | `button` | `style.css:82, 96` | Same as input plus `cursor: pointer`, hover `#232730` |
| Win button | `.winbtn` | `style.css:186` | 700 weight, ripple animation on click, transform-on-hover, min-width 96px |
| Action button (compact) | `.actions button` | `style.css:182` | Smaller — 12px font, 6px×8px padding |
| Ripple animation | `.ripple` | `style.css:208` | Radial scale 0→3, opacity .35→0 over 0.6s ease-out |
| Toggle (checkbox + label) | `.toggle` | `style.css:241` | inline-flex with 6px gap |

**Button color overrides are inline.** Common pattern in HTML: `<button style="background:#22c55e;color:white;padding:12px 20px;font-size:16px;">📺 创建房间</button>`. There's no `.btn-primary` / `.btn-secondary` / `.btn-success` class system — each call site picks colors. Redesign target.

### Display / Status

| Component | Selector | Location | Description |
|-----------|----------|----------|-------------|
| Pill badge | `.badge` | `style.css:105` | 3px×8px pill, `#24262c` bg, 999px radius |
| Honor badge | (custom inline + #id) | `index.html:341-406` | 15 hardcoded color combos for special honors |
| Stat badge | `.stat-badge` | `players.html:80` | 4px×8px square pill, `#2a2a2a` bg |
| Player tag | `.player-tag` | `rooms.html:102` | Same shape, blue text on `#2a2a2a` |
| Status badge | `.status-badge` + `.status-active`/`.status-finished` | `rooms.html:111` | Green or grey, 4px radius |
| Team chip | `.team .chip` | `style.css:142` | 4px×8px chip with stroke border, `#0f1115` bg |

### Player Tiles & Drop Zones

| Component | Selector | Location | Description |
|-----------|----------|----------|-------------|
| Player tile (full) | `.player-tile` | `style.css:248` | Draggable name + emoji card, `#1f2229` bg, 2px stroke, 10px radius, 4px margin. Lifts on hover, dims on `.dragging`. |
| Ranking player tile | `.ranking-player-tile` | `style.css:462` | Compact variant — 8px radius, smaller padding, smaller fonts |
| Team drop zone | `.team-drop-zone` | `style.css:313` | Dashed-border drop target, `#0f1115` bg, 80px min-height. Glows gold (`var(--accent)` border + 5% gold tint bg) on `.drag-over`. |
| Rank slot | `.rank-slot` | `style.css:339` | 150px×60px target, 12px radius, gold drag-over state |
| Player pool | `.player-pool` | `style.css:436` | Same dashed-border style as drop zones |
| Unassigned-players area | `.unassigned-players` | `style.css:413` | Same dashed pattern, used as initial player pool |
| Tile (rank position) | `.tile` | `style.css:117` | 52px tall, `#24262c` bg, 18px font — used for level cells |

**Drag affordances on touch:** mobile shows `⋮⋮` hint via `::after` pseudo-element (`style.css:546-555`). Min-height 44px enforced for iOS touch targets.

### Tables

| Component | Selector | Location | Description |
|-----------|----------|----------|-------------|
| Wrapped table | `.table-wrap` + `.table` | `style.css:150,157` | Horizontal scroll on mobile, sticky header on desktop, 900px min-width |
| Stats table | `.stats-table` | `style.css:385` | Player ranking grid with `--chip` header bg, hairline rows |

### Cards (page-specific)

| Component | Selector | Location | Description |
|-----------|----------|----------|-------------|
| Player card | `.player-card` | `players.html:60` | `#1a1a1a` bg, 1px `#333` border, hover lifts -2px and brightens to `#252525`. Has avatar (64px), display name, handle, play style, tagline, stat badges. Admin mode overlays delete/reset buttons inside. |
| Player grid | `.player-grid` | `players.html:74` | `auto-fill, minmax(300px, 1fr)`, 16px gap |
| Room card | `.room-card` | `rooms.html:60` | Similar pattern, `.favorite` variant adds gold border + ⭐ pseudo-element top-right |
| Room grid | `.room-grid` | `rooms.html:85` | Same pattern with 350px min |
| Profile header | `.profile-header` | `player-profile.html:14` | Centered hero with linear gradient, 32px×16px padding, 12px radius |
| Stat item | `.stat-item` + `.stat-value` + `.stat-label` | `player-profile.html:27` | Centered tile with green big number (24px bold) and small grey label |
| Stat grid | `.stat-grid` | `player-profile.html:21` | `auto-fit, minmax(150px, 1fr)`, 12px gap |
| Honor badge (profile) | `.honor-badge` | `player-profile.html:45` | `#2a2a2a` bg, 1px `#444`, 6px radius, 8px×12px padding |
| Game row (recent games) | `.game-row` | `player-profile.html:53` | Horizontal flex item, hover brightens, color-coded win/loss text |

### Modals

| Component | Element | Location | Description |
|-----------|---------|----------|-------------|
| Victory modal | `#victoryModal` | `index.html:504` | Fixed full-screen overlay with `rgba(0,0,0,0.8)` backdrop. Inner `<div>` is `#1a1b1c` bg, 16px radius, 32px padding, max-width 500px, **3px winning-team-color border with team-color glow** (`box-shadow: 0 0 30px ${winningTeamColor}40`). Auto-shows tagline, voting interface, and 6 export buttons. |
| Player create modal | `#createPlayerModal` | `playerCreateModal.js:34` | `rgba(0,0,0,0.8)` backdrop, inner `#1a1a1a` 12px radius, 24px padding, 90% width, 90vh max-height, 1px `#333` border. Has emoji grid (40px square cells), photo upload, play-style select. |
| Player edit modal | (similar) | `playerEditModal.js` | Same pattern via shared `setupModalAccessibility` helper |
| Voting modal sections | `#votingSection` | `index.html:412` | Inline panel within main page when active, NOT a modal overlay |

**Modal a11y (`src/core/modal.js`):** All modals share `setupModalAccessibility()` which wires `role=dialog`, `aria-modal=true`, body scroll lock, Escape-to-close, focus trap (Tab/Shift+Tab cycle), auto-initial-focus. Returns cleanup function. Strong baseline.

### Banners (room mode)

| Component | Where | Description |
|-----------|-------|-------------|
| Host banner | `roomUI.js:147` | `position: sticky` top, blue gradient, sticky timer + room code + click-to-copy URL. Timer ticks every 1s. |
| Viewer banner | `roomUI.js:224` | Same pattern in green/emerald gradient. No copy interaction. |

### Charts (Chart.js theming)

`Chart.js v4.5.1` loaded via npm. Used in `player-profile.html` for:
- **Recent rankings line chart** — 2.5 aspect ratio, `#3b82f6` stroke, point colors green/blue/red by ranking, reversed Y-axis (1 at top), tooltip with `rgba(0,0,0,0.8)` bg
- **Partners bar chart** — horizontal bars colored by win-rate threshold (≥60% green, 50%+ blue, <50% red), click-to-navigate
- **Opponents bar chart** — same pattern with inverted color semantics

Chart styling consistently uses:
- Tick color `#888`
- Grid color `#333` (X-axis grid disabled)
- Tooltip bg `rgba(0,0,0,0.8)`
- Tooltip border `#333`
- Border colors match fill color hexes (`#22c55e/#3b82f6/#ef4444`)

This is the most polished visual surface in the app and demonstrates the redesigner's reference for a coherent dark theme.

## Iconography

**100% emoji.** No icon font, no SVG icon library, no Lucide/Heroicons.

| Category | Examples |
|----------|----------|
| Navigation | `👥` (players), `🏠` (rooms), `🎮` (game) |
| Action | `📺` (create room), `🔗` (join), `📋` (browse), `⭐` (favorite), `🗳️` (vote), `🔄` (sync), `🔒` (lock), `🔓` (unlock) |
| Status | `✅` (confirmed), `❌` (deleted), `⏱️` (timer), `📊` (stats), `📜` (history), `🏆` (honors), `🎖️` (achievements) |
| Player avatars | 80 emoji from `ANIMAL_EMOJIS` array (`playerManager.js:12`) — 53 animals + 27 fruits/vegetables, no insects |
| Honor badges | Various (`⚔️`, `🩸`, `🦋`, `🏃`, `⚡`, `✨`, `🎲`, `🐣`, `🎯`, `🏛️`, `💎`, `👑`, `🎖️`, `🏅`, `🔥`) |

**Implication for redesign:** Emoji rendering is platform-dependent (Apple Color Emoji on iOS/macOS vs. Segoe UI Emoji on Windows vs. Noto Color Emoji on Android). A premium redesign may want to introduce SVG icons for *navigation and chrome* while keeping emoji for *user identity* (player avatars + honor flavor) — this is the right hybrid. Per the global skill rules, replacing emoji with icon-circle grids is on the AI-slop list, so DO NOT swap player avatars to grayscale icons.

## Animations & Transitions

| Animation | Where | Duration / Easing |
|-----------|-------|-------------------|
| Ripple | `.ripple` keyframe | `0.6s ease-out` (transform scale 0→3, opacity .35→0) |
| Card / button micro-bounce | `.winbtn:hover` | `transform: translateY(-1px)`, `0.08s ease` |
| Player tile hover lift | `.player-tile:hover` | `transform: translateY(-2px)`, `0.2s` (default `transition: all`) |
| Tile drag-state shrink | `.player-tile.dragging` | `transform: scale(0.95)`, `0.2s` |
| Player card hover | `.player-card:hover` | `transform: translateY(-2px)`, `0.2s` |
| Drop-zone drag-over | various | `0.2s ease` border + bg color change |
| Nav tab hover | `.nav-tab` | `0.2s` background + color |
| Modal a11y | initial focus | `setTimeout 0` deferred focus |
| Touch clone | `.touch-clone` | `transition: none !important` (instant drag) |
| Vote button feedback | `victoryModal.js:294` | `transform: scale(0.95)`, 100ms timeout |
| Modal tagline | victory modal MVP | `text-shadow: 0 0 10px rgba(251, 191, 36, 0.3)` (static glow, no animation) |

**Style:** subtle, fast (`0.08-0.2s`), all `ease` or `ease-out`. No bounces, springs, or staggered choreography. Redesigner has clean ground to add motion if desired without conflicting with existing patterns.

## Responsive Breakpoints

Two breakpoints in `style.css:498-555`:

```css
@media (max-width: 768px) { ... }                 /* mobile layout */
@media (hover: none) and (pointer: coarse) { ... } /* touch device a11y */
```

**Mobile changes:**
- `.wrap` padding 16→12px
- `.grid` collapses to single column
- `.tile` height 52→48px
- `#winBtnsWrap .winbtn` becomes `flex: 1` (full row)
- `.btns-grid` becomes 2-column
- `.table` min-width 900→720px

**Touch-device additions:**
- `.player-tile`, `.ranking-player-tile` get min-height 44px (iOS HIG)
- `.rank-slot` grows to 70×170px
- `.team-drop-zone` grows to 100px min
- Pseudo-element `⋮⋮` drag hint added top-right

**No tablet breakpoint** (768-1024px). No desktop-XL breakpoint. The single `1150px` max-width handles "anything bigger than mobile" with the same layout.

## Accessibility

**Strong:** Modal infrastructure (focus trap, aria-modal, escape-to-close, scroll lock) via `src/core/modal.js`.

**Mixed:** Inline buttons get `title` attribute tooltips (`title="游戏进行中，无法修改玩家"`) but no `aria-label` for screen readers.

**Weak / Missing:**
- No `:focus-visible` rules — keyboard focus is invisible (browser default outline only)
- No `aria-live` regions for dynamic state (vote counts, timer, "已复制" toast)
- Color-only signals: win/loss is communicated by green/red text only (no icon or text alternative). `text-shadow: 0 0 20px currentColor` on victory team name gives it a glow but doesn't help colorblind users distinguish team identity.
- Avatar `<img>` tags include `alt` (`alt="${player.displayName || player.name}"`) — good
- Hardcoded `#888` text on `#1a1a1a` bg measures ~3.7:1 contrast — fails WCAG AA (4.5:1)
- `#666` text on `#1a1a1a` bg measures ~2.3:1 — fails even AA Large

**This is a redesign opportunity.** A dark-theme redesign should use OKLCH for predictable contrast and explicitly verify each text-on-surface pair hits AA.

## Photos / Avatars

Per `CLAUDE.md` and verified in source:

| Size | Where | Source |
|------|-------|--------|
| 64px | Player browser cards (`players.html:273`) | `renderProfileAvatar(player, 64)` |
| 120px | Profile page header (`player-profile.html:633`) | `renderProfileAvatar(player, 120, { borderWidth: 3 })` |
| 320px | MVP photo in PNG export (`exportMobile.js`) — **per CLAUDE.md, NOT VERIFIED** in current code grep; may have been refactored | Canvas drawing |
| Variable | Victory modal MVP avatar | `renderProfileAvatar(mvpPlayer, 64, { marginRight: false })` |
| Default circular | All sizes via `renderProfileAvatar` helper | `border-radius: 50%`, 2-3px `#444` border |

**Pattern (`src/player/photoRenderer.js`):**
- If `player.photoBase64` present: render `<img>` with circular crop, fallback `<div>` with emoji on `onerror`
- Else: render emoji at `size * 0.6` font size

Photos are JPEG-compressed base64 (per `CLAUDE.md` "auto-resize to 400x400 JPEG") stored on the player profile in KV.

## Edge Cases & Inconsistencies (for redesigner)

1. **Footer (`index.html:536`)** uses `border-top: 1px solid #ddd; color: #666` — leftover light-theme values that look broken on the dark page. Quick fix.
2. **Two near-identical "near-black" greys**: `#1a1a1a` (HTML inline) vs `#1a1b1c` (modal/voting JS) — pick one.
3. **The `--accent: #e6b800` warm gold** is used for drag-over highlights, but `#fbbf24` and `#f59e0b` are used for almost everything else amber/yellow. Three almost-identical gold tokens.
4. **`#3b82f6` (blue-500)** does triple duty: team color, navigation accent, and "info" semantic. Hard to redesign teams without refactoring nav/info.
5. **Honor badges are 15 hardcoded combos** — opportunity for a tier system (`tier-1: gold`, `tier-2: silver`, `tier-3: bronze`, etc.) with the rest using neutral surface tints.
6. **Victory modal team-color glow** (`box-shadow: 0 0 30px ${winningTeamColor}40`) is the most distinctive moment in the app — preserve this visual identity.
7. **Tab navigation duplicated 3x** across HTML pages — redesign should extract to a shared component, possibly via JS injection.
8. **Inline gradients** — six distinct `linear-gradient(135deg, ...)` calls. A redesigner can collapse to gradient tokens (`gradient-host`, `gradient-viewer`, `gradient-hero`, `gradient-pending`).
9. **`text-shadow: 0 0 20px currentColor`** on victory team name is the closest the app gets to a "glow effect" hero treatment. Worth preserving / extending.

## Design System Maturity Score

| Dimension | Score (1-10) | Notes |
|-----------|--------------|-------|
| **Color system** | 3 | 7 CSS vars exist but ~30 hardcoded hex values bypass them. Multiple near-duplicate greys. No semantic tokens (success/error/warning) — semantic colors are inline literals. |
| **Type scale** | 2 | 12+ font sizes spanning 10-48px with no ratio. No type-purpose tokens (display/headline/body/caption). Single font stack — at least consistent. |
| **Spacing rhythm** | 3 | Mix of 4px and 8px grids. 11 distinct padding values (4, 6, 8, 10, 12, 14, 16, 20, 24, 32, 40). No spacing tokens. |
| **Component reusability** | 4 | `.card`, `.row`, `.grid`, `.player-tile`, `.team-drop-zone`, `.rank-slot` are well-defined. But buttons, badges, and panels are reinvented inline at every call site. |
| **Dark theme cohesion** | 6 | Genuinely dark — `#0b0b0c` base, no light-mode leakage (except footer). But too many surface elevations (8+ greys) and contrast failures on muted text. |
| **Mobile polish** | 7 | Real touch-device media query, 44px iOS targets enforced, drag handles, larger drop zones on coarse pointers, viewport-fit cover for notched devices, theme-color meta correct. |
| **Iconography consistency** | 5 | All emoji — coherent voice but platform-dependent rendering. No icon system for chrome elements. |
| **A11y baseline** | 5 | Strong modal infrastructure (focus trap, ARIA), but missing `:focus-visible`, contrast failures on `#888/#666`, no `aria-live` regions. |

**Overall: 4.4 / 10.** A passable dark theme that's clearly evolved feature-by-feature without a unifying system. The hard work of choosing dark colors and laying out responsive layouts is done; the redesign opportunity is consolidation, tokenization, contrast cleanup, and a coherent component library.

---

*Code conventions analysis: 2026-05-03*
*Visual baseline audit: 2026-05-03 (pre-huashu-design redesign)*
