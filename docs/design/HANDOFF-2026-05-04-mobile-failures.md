# Mobile UX Handoff — 2026-05-04 — failure post-mortem + open issues

> Session ran ~30 commits across navbar / picker / pool / slot / scoreboard
> mobile work. **The user had to point out almost every visible bug
> manually because the agent's self-QC was insufficient.** This document
> exists so the next session does not repeat that failure mode.

## What went wrong with QC

The agent kept:
1. **Capturing screenshots and declaring success** without auditing them
   for obvious problems (duplicate text, misaligned columns, overflowing
   content, broken nav).
2. **Targeting selectors that don't exist** (`.pool-tile__display`,
   `.pool-tile__avatar--red`) without ever inspecting the actual rendered
   DOM. The renderer outputs `.pool-tile__name`, `.pool-tile__handle`,
   `.pool-tile__top`, `.pool-tile__dot`, `.pool-tile__avatar`; team color
   is added at the tile-level (`.pool-tile--red`/`--blue`), NOT the avatar.
3. **Iterating on partial fixes** when one issue deserved a comprehensive
   sweep — e.g., scoreboard ordering bug was fixed for Trading desktop in
   commit `9883e1d`, but the same fix wasn't ported to Linear desktop
   until the user pointed at a screenshot of a giant empty VS column 30+
   commits later (image 41 → fixed in `7da82a2`).
4. **Adding `overflow: hidden` to fix one symptom** (navbar overflow) and
   creating a worse bug (picker dropdown panel clipped, never appears).
   Reverted in `eda11f7`.
5. **Trying clever layouts before checking simple ones** — `aspect-ratio:
   1` on grid cells inside half-viewport columns made tiles 180×180px each
   for an 8-player game. User had to say "boxes too big, need to see and
   drag drop ALL tiles" before the agent reverted to compact rows.

**The QC discipline that should have been applied:**
- After every CSS change that touches rendered children, look at the
  ACTUAL HTML produced by the renderer (`rankingRenderer.js`,
  `playerRenderer.js`) BEFORE writing selectors.
- After every capture, do a section-by-section pass: count visible
  elements, spot duplications, check column widths add up.
- If a desktop fix is shipped for one theme (Trading), immediately port
  to all themes that share the affected DOM (Linear, Broadcast).

## Open issues — verified visible in user's screenshots

### Image 36/37 (commit `eda11f7` and after)
**Pool tiles in setup phase are buried below search/create UI.**

The user generates/selects players and wants to drag them to team
drop-zones in the scoreboard. Currently the page order on mobile is:

  scoreboard (with team drop-zones)
  → ROSTER section header
  → playerSearch.js card (search input + create button + recent profiles list)
  → THEN the actual draggable player tiles (the small square cards with `×` delete button shown in image 37)

The user has to scroll past the search/create UI just to reach the
draggable tiles. The drag target (team drop-zone) is now far above the
drag source (player tiles).

**Investigation pointer:** index.html line 242 starts
`<div class="card" id="playerSetupSection">`. Need to either:
- Reorder children inside `#playerSetupSection` on mobile via CSS
  `order` property if siblings, OR
- Hide the search/create card on mobile when `#playerSetupSection` has
  rendered tile children (use `:has()` selector if browser support is OK,
  otherwise JS toggle), OR
- Move the player tile container into a sticky-bottom drawer so it
  always sits adjacent to the scoreboard regardless of page scroll.

### Image 38
**Ticker should be sticky on top during scroll.**

Grep shows all 3 themes have `position: sticky` on `.ticker`, but it
may be either:
- Below the topnav with no `top:` offset (so it scrolls under the
  topnav and disappears), OR
- Conflicting with another sticky element

**Investigation pointer:** Set `top: <topnav-height>` on `.ticker`
across all 3 themes. Topnav heights:
- Broadcast desktop: 56px (mobile 48px)
- Linear: ~52px (mobile ~46px)
- Trading: ~46px (mobile ~40px)

Use `position: sticky; top: var(--topnav-height); z-index: 30`.

### Image 39
**Mode selector shows duplicate `<select>` + chip buttons on mobile.**

`index.html` line 142-163 has BOTH:
- `<select id="mode" class="modeselect__native">` — the native dropdown
- `<div class="modeselect__group">` with three `<button>` chip elements

On desktop the chip buttons are the visible UI and the native select is
hidden (used for accessibility / form submission). On mobile, NEITHER
is hidden — both appear, creating the visual duplication.

**Investigation pointer:** add to all 3 theme mobile @media:
```css
:root[data-theme="X"] .modeselect__native { display: none; }
```
Verify accessibility — the chip buttons have `role="radio"` and the
inline script at line 919-940 syncs them to the hidden native select.
Hiding the native shouldn't break submit behavior.

### Image 35 / 41 (partially fixed but verify)
**Pool tile duplicate name — was using wrong selector.**

Earlier "fix" hid `.pool-tile__display` — selector doesn't exist.
Renderer outputs `.pool-tile__name` (display name) inside
`.pool-tile__top`. Fixed in commit `a37a474` by hiding `.pool-tile__name`
and `.pool-tile__top`. **Verify this still holds after any future
changes** — it's easy to add back a `.pool-tile__display` rule and miss
that the renderer never outputs that class.

### Image 28 / 32 / 34
**Setup-phase scoreboard team panels still cram on Broadcast/Linear.**

User showed multiple states where Broadcast team panel renders the
team chip + name-en + giant level glyph on the same row, looking like
they overlap. Linear similar.

This was partially addressed in commit `a37a474` by switching mobile
scoreboard to 2-col grid (RED LEFT / BLUE RIGHT, VS bar above), but the
internal layout of EACH team panel may still cram on small widths.

**Investigation pointer:** look at `.team__head` + `.card-level` flex
direction on mobile. They may need to be stacked column not row.

### Image 44 / 45 / 46
**Pool / slot column heights don't align on desktop and tablet widths.**

In the side-by-side rank-placement layout (pool LEFT, slots RIGHT), the
slot column is significantly TALLER than the pool column on desktop:
each slot ~80-90px tall, each pool tile ~36-44px. Pool tile 1 aligns
with slot 1 visually but tile 8 ends way above slot 8. Plus "↓ drop
here" text wraps to multiple lines on the drop-target slot, breaking
inside the slot bounds.

Affects all 3 themes:
- Broadcast (image 44): clean pool, tall slots, misaligned
- Linear (image 45): same — drop-here label overflows slot
- Trading (image 46): same — drop-here label wraps `↓ drop / here`

**Investigation pointer:**
- Slot desktop CSS sets `min-height: 96px` (Linear) / `90px` (Trading)
  / similar (Broadcast). These need to drop to ~44px to match pool
  tile heights, OR pool tile needs to grow to match slot heights.
- The mobile `height: 36px !important` only applies <768px. Desktop
  uses the original tall-card layout.
- Fix should make slots and pool tiles consistent across all viewports,
  not just mobile.
- For drop-here wrapping: `white-space: nowrap` on `.slot__target-label`
  + `.slot__target-icon` so they stay on one line.

## Selector mismatches the agent kept hitting

This list exists so the next session does not repeat them:

| What I wrote | What the renderer actually outputs |
|---|---|
| `.pool-tile__display` | `.pool-tile__name` (inside `.pool-tile__top`) |
| `.pool-tile__avatar--red` | `.pool-tile--red .pool-tile__avatar` (team class is on the TILE) |
| `.slot__pos` (sometimes) | `.slot__index` is the actual class |

**Always grep `src/ranking/rankingRenderer.js` and
`src/player/playerRenderer.js` for `el(` calls before writing pool-tile
or rank-slot selectors.** The DOM lives in those files, not the demo
HTML.

## What landed this session (chronological)

| Commit | Change |
|---|---|
| `eda11f7` | Pool LEFT, slots RIGHT side-by-side mobile (gameplay only, not setup) |
| `a37a474` | Scoreboard 2-col mobile, hide pool-tile__name/top duplicate, Linear pool-tile team color |
| `7da82a2` | Linear desktop scoreboard ordering (versus was in wrong column) |
| Earlier | Picker dropdown rewrite, navbar overflow fix, slot child styling, slot team color coding, NEW ROOM CTA, mobile rank-tile compaction (multiple iterations) |

## Lessons to elevate to memory

Add to `feedback_new_theme_must_do.md` (or successor):

**Rule 11 — explicit grid `order` on all siblings.** If a CSS Grid child
gets an `order` declaration, give explicit `order` to every other grid
sibling too. Do not leave any to source-order tiebreaks. Three different
themes hit the same `order: -1 on .team--red only` bug across this
project; each time the symptom was "huge empty VS column."

**Rule 12 — selector audit before writing CSS.** Before adding any rule
that targets a child of a JS-rendered component, grep the renderer
source for the literal class names. Demo HTML uses different class
names than the live renderer; do not copy from the demo into the live
theme CSS.

**Rule 13 — `overflow: hidden` clips absolutely-positioned descendants
too.** When fixing a navbar/row overflow, do NOT use `overflow: hidden`
on a container that holds a dropdown panel. The panel renders inside
the clipping box even though it's `position: absolute`. Use
`min-width: 0` + `flex-shrink` on the items, or move the dropdown to
`position: fixed` with manual coordinate math.

**Rule 14 — square tiles only when they fit.** `aspect-ratio: 1` on a
grid cell that's 180px wide gives 180px-tall tiles. For an 8-tile pool
that's 1440px of vertical space — won't fit any phone. Compact
horizontal rows (~36px tall) carry the same drag affordance and fit one
viewport. Don't choose "square" over "fits-on-screen."

**Rule 15 — QC every capture before declaring done.** Don't just save a
screenshot and move on. For each capture: (a) count visible elements,
(b) verify column widths add up to viewport width, (c) look for duplicate
text in tiles, (d) confirm the layout matches the demo, not just "looks
themed."

## How to pick up this work

1. Boot the dev server (`npm run dev`).
2. Open Chrome devtools, set viewport to 390×844 (iPhone 12 Pro).
3. Run through these scenarios and compare to the user's screenshots:
   a. Setup phase, no players: navbar fits, mode selector clean (no
      duplicate select), scoreboard team-drop-zones reachable
   b. Setup phase, 8 players generated: player tiles visible
      immediately below scoreboard (currently buried)
   c. Gameplay phase, players assigned: pool LEFT + slots RIGHT both
      compact, all 8 tiles + 8 slots visible
4. For each issue found, identify: which theme, which selector, which
   commit introduced (or failed to introduce) the relevant CSS.
5. Fix in the smallest scope possible. Don't bundle unrelated changes.
6. Capture BEFORE and AFTER. Compare them yourself before committing.
7. Run `node scripts/visual/capture-mobile-final.mjs` and review every
   PNG it outputs.

## Capture scripts

- `scripts/visual/capture-mobile-qc.mjs` — navbar crop + rank-placement viewport per theme
- `scripts/visual/capture-mobile-final.mjs` — scoreboard + rank-placement per theme at 390×844
- `scripts/visual/capture-mobile-setup.mjs` — setup phase with empty drop-zones
- `scripts/visual/capture-picker-dropdown.mjs` — picker closed/open at desktop+mobile

When you add a new mobile capture script, please match the existing
pattern (preset `data-theme` via localStorage, click `#generatePlayers`,
wait 400ms, screenshot specific elements with crop dimensions).

## Reference

- Open issues filed against user's images 35, 36, 37, 38, 39, 40, 41 (in
  conversation history — not in repo)
- Latest commit on `main`: `7da82a2`
- Last time the agent missed an issue the user had to point out: this
  whole session
