# Theme System Build-Out · Session Handoff

> Generated 2026-05-03 at the end of a discovery + prototype session.
> Next session should pick this up and execute the production build per `THEME-ARCHITECTURE.md`.

---

## TL;DR

A new dark-themed theme system with 5 distinctive layouts (not just CSS-variable swaps) was prototyped end-to-end. **All 10 demos exist** (5 desktop + 5 mobile). **Architecture is documented**. **A working switcher prototype** demonstrates the swap UX.

**Status update — 2026-05-03:** Phases 0 + 1 of the production build are **SHIPPED** on the
`feat/theme-system` branch (token contract + theme manager + Broadcast registered as the
default theme). Phases 2–5 (Linear / Trading / Atelier / Tea-Table) remain — each is its
own PR. See "Status: what's actually shipped" section below.

**Default theme:** A · Broadcast Editorial.
**Other themes preserved as alternates:** C · Tea-Table · D · Trading Terminal · E · Linear/Vercel Console · F · Atelier Console.

---

## Status: what's actually shipped (2026-05-03)

| Phase | Description | Status | Commit / branch |
|---|---|---|---|
| 0 | Token contract + Broadcast palette (oklch) + sRGB fallback for Safari iOS 15.0–15.3 + Google Fonts wiring | **DONE** | `feat/theme-system` 91fd44b |
| 1 | Theme manager + featureManifest + ThemePicker + Broadcast registered + main.js wiring | **DONE** | `feat/theme-system` 0caac67 |
| 1.5 | DOM restructure to match Broadcast demo pixel-perfect (`.activegame__head`, `.scorer`, `.pool-tile`) | TODO | (next PR) |
| 0b | Eliminate ~235 inline `style=""` attributes from HTML pages — they still hardcode legacy palette | TODO | (next PR; not blocking) |
| 2 | Add Linear theme (sidebar layout — most divergent, stress-tests the abstraction) | TODO | |
| 3 | Add Trading theme (monospace + sparklines) | TODO | |
| 4 | Add Atelier theme (warm graphite + photographic moments) | TODO | |
| 5 | Add Tea-Table theme (ink portraits + brushstroke SVGs — needs asset commission) | TODO | |
| — | Visual regression CI (Percy/Chromatic/pixelmatch) | TODO | (Phase 5+) |
| — | PNG export theme-awareness | TODO | (Phase 5) |

Visual baseline for the shipped state: `docs/reports/phase0-1-visual/` (4 routes × desktop+mobile, captured via `npm run capture:visual`).

---

## What's Already Done

### Reference docs (in `docs/design/`)

| File | Lines | Purpose |
|---|---|---|
| `GAME-TRUTH.md` | 270 | Game mechanics + terminology + LOCKED SCENARIO ground truth. **Read first.** Contains: levels-are-card-values, 16 honors, dual-MVP concept, mode-specific upgrade math, A-level rules. |
| `UX-FLOWS.md` | 200 | Hot-path interaction flows. Captures: rank-placement (drag-drop desktop / tap-select mobile), auto-advance loop, navigation IA, settings panel, mode selector, custom rules. **Read second.** |
| `THEME-ARCHITECTURE.md` | 311 | Production architecture for theme switching. Module layout, theme manager API, feature manifest pattern, token spec, **5-phase rollout plan**. **Read third.** |
| `HANDOFF.md` | (this file) | Handoff doc |

### Prototype demos (in `docs/design/demos/`)

10 hi-fi mid-fidelity HTML demos + 1 switcher + 11 PNG screenshots:

```
docs/design/demos/
├── index.html                          # Switcher prototype (open this first)
│
├── demo-broadcast-v3.html               # A · Broadcast Editorial · DESKTOP
├── demo-teatable-v3.html                # C · Tea-Table Contemplative · DESKTOP
├── demo-trading-v2.html                 # D · Trading Terminal · DESKTOP
├── demo-linear-v2.html                  # E · Linear/Vercel Console · DESKTOP
├── demo-atelier-v2.html                 # F · Atelier Console · DESKTOP
│
├── demo-broadcast-mobile-v2.html        # A · MOBILE
├── demo-teatable-mobile-v2.html         # C · MOBILE
├── demo-trading-mobile-v2.html          # D · MOBILE
├── demo-linear-mobile-v2.html           # E · MOBILE
├── demo-atelier-mobile-v2.html          # F · MOBILE
│
└── *.png                                # Screenshots of each
```

All demos use the **LOCKED SCENARIO** from `GAME-TRUTH.md` Section 9 + the v3 active-gameplay state from `UX-FLOWS.md` Section 8 (Round 5 mid-ranking, 6-player, level 4, Red owns, 大刘 mid-drag toward slot 三).

### Codebase map (in `.planning/codebase/`)

7 docs from a parallel `gsd-map-codebase` run that gave us the foundation:
- `STACK.md` / `INTEGRATIONS.md` (tech)
- `ARCHITECTURE.md` / `STRUCTURE.md` (arch)
- `CONVENTIONS.md` / `TESTING.md` (quality + visual audit — current dark theme scored 4.4/10)
- `CONCERNS.md` (risks + drift)

---

## What's NOT Done (next session's work)

### 0. Pending decisions before any code

Confirm with the user:

1. **Default theme:** A Broadcast (assumed) — or change?
2. **Theme picker location:** in settings drawer (consistent across themes) OR floating top-right gear (faster discovery)?
3. **Switch animation:** instant snap OR 200ms cross-fade?
4. **First-time user:** show theme picker as onboarding step OR default to A and let them discover?
5. **Mobile theme:** mirrors desktop choice OR independent?
6. **Storage key:** `gd_v9_theme` (assumed — consistent with existing `gd_v9_*` keys)
7. **Phasing:** ship A as default first (Phase 0 + 1), then add E (Phase 2) etc., per `THEME-ARCHITECTURE.md` Section 7? Or build all 5 in parallel?

### 1. Phase 0 — Token refactor (1-2 days)

Refactor existing `src/style.css` (556 lines, 7 vars + ~30 hardcoded hexes) into:
- `src/themes/_shared/tokenSpec.js` — token name contract
- `src/themes/broadcast/theme.css` — A as the new default with full oklch palette (per demo)
- Replace ~235 inline `style=""` attributes across 4 HTML pages with class-based theme references
- Verify no visual regression (the existing dark theme stays "the same" but is now structured)

### 2. Phase 1 — Theme manager + Broadcast as default (3-5 days)

- Build `src/themes/_shared/themeManager.js` per `THEME-ARCHITECTURE.md` Section 3
- Build `src/themes/_shared/featureManifest.js` per Section 4
- Build `src/themes/_shared/ThemePicker.js` (the user-facing toggle)
- Mount Broadcast as the only theme; verify state survives switching mechanics work (no-op switch with single theme)
- Verify all existing functionality intact: drag-drop ranking, room sync, voting, victory modal, exports
- Mobile parity verified

### 3. Phase 2 — Add Linear (4-7 days)

Most-different layout from Broadcast (sidebar nav vs top tabs) → stress-tests the abstraction. If A→E switching works cleanly, anything will. Implementation per `THEME-ARCHITECTURE.md` file layout.

### 4. Phase 3 — Add Trading (4-7 days)

Different in density + monospace-only typography → validates feature-manifest opt-outs (no inline-hero victory, sparklines on, etc.).

### 5. Phase 4 — Add Atelier (4-7 days)

Different in palette family + asset needs → validates theme-specific assets (illustrations, photos).

### 6. Phase 5 — Add Tea-Table (4-7 days, longer if illustrations commissioned)

LAST because ink portraits + brushstroke SVGs are expensive asset work — don't gate the rollout on this.

**Total estimate:** 3-5 weeks for one engineer to ship all 5.

### 7. Cross-cutting work

- **Visual regression CI** (Percy / Chromatic / Playwright snapshot) — protect against theme drift over time
- **PNG export theme-awareness** — `src/export/exportHandlers.js` and `src/export/exportMobile.js` need theme-aware canvas rendering
- **`docs/CODEMAPS/`** generation per CLAUDE.md (not yet done)
- **Tests** — currently zero automated tests (per `.planning/codebase/TESTING.md`); the theme system is a good forcing function to add coverage

---

## How to validate before building

Open the switcher prototype:

```bash
open docs/design/demos/index.html
```

Try:
- Tap each theme tab (or press `1` / `2` / `3` / `4` / `5`)
- Switch viewport with `D` / `M`
- Reload — your last choice persists in localStorage

If the switcher feels right, the production architecture should feel similar — but with state surviving the swap, real keyboard shortcuts wired into the app, and the picker UI living in the settings drawer rather than a top tab strip.

---

## Risks & caveats

1. **Theme drift over time** is the #1 ongoing risk. Mitigation: visual regression CI + the feature manifest pattern (so themes only override what they need to).
2. **Maintenance multiplier:** every new feature multiplies by 5 themes. Mitigation: feature manifest opt-out, default rendering for themes that don't need to customize.
3. **PNG export complexity:** 5 themes × 2 export modes (long PNG, mobile PNG) = 10 export pathways. Phase 5 should include this work explicitly.
4. **Asset commission for Tea-Table:** ink portraits + brushstroke SVGs cost real money/time if commissioned. Prototype uses CSS-gradient placeholders. Decide before Phase 5 whether to use CSS placeholders in production OR commission a Chinese illustrator (a single illustrator round = $500-2000 typically; 16 honor portraits + 1 brushstroke = ~1-2 weeks of work).
5. **Mobile parity discipline:** desktop and mobile are designed in tandem in the prototypes. In production, ensure the theme manager renders responsive layouts correctly per theme (`@media` discipline OR per-viewport components per theme).

---

## What I'd do first if I were the next session

1. **Read in order:** `GAME-TRUTH.md` → `UX-FLOWS.md` → `THEME-ARCHITECTURE.md` → this `HANDOFF.md`
2. **Open the switcher** (`docs/design/demos/index.html`) and play with all 5 themes desktop + mobile to feel the target product
3. **Talk to user** to lock the 7 pending decisions above (especially #1 default theme, #5 mobile sync, #7 phasing)
4. **Phase 0 first** — token refactor is reversible, validates the contract, doesn't lock in any theme system yet
5. **Build Phase 1 (theme manager + Broadcast default)** in a feature branch, ship via Vercel preview URL, validate state persistence + production fidelity vs the prototype
6. **Only then** start Phase 2 (Linear) — hardest layout switch, proves the abstraction
7. **Don't skip the feature manifest** — it's the difference between maintainable and unmaintainable

---

## Final inventory

| Type | Path | Count |
|---|---|---|
| Reference docs | `docs/design/*.md` | 4 |
| Prototype demos | `docs/design/demos/*.html` | 11 (10 demos + switcher) |
| Demo screenshots | `docs/design/demos/*.png` | 11 |
| Codebase map | `.planning/codebase/*.md` | 7 |
| Memory entries | `~/.claude/projects/.../memory/*.md` | 6 (incl. domain-first design discipline + this handoff) |

Total ~7,500 lines of design artifact + ~16,000 lines of HTML demo + 22 screenshots.

The next session has everything needed to build the production system.
