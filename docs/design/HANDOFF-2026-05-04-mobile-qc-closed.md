# Mobile QC Pass Handoff — 2026-05-04 (closing session)

> Companion to `HANDOFF-2026-05-04-mobile-failures.md` (the failure
> post-mortem). This doc covers the resolution session that closed all 11
> open issues + the user's `本局 N → 第N局` format request.

## Status: ✅ ALL CLOSED

Three commits on `main`:

| Commit  | Title                                                          |
|---------|----------------------------------------------------------------|
| 653635a | fix: close all 11 mobile QC issues from HANDOFF-2026-05-04     |
| 3098095 | fix: round number format 本局 N → 第N局                         |
| 33e5722 | docs: mark 2026-05-04 mobile handoff as RESOLVED               |

## What changed

### Renderers (cascade to all 3 themes)

- `src/ranking/rankingRenderer.js` — `avatarChar()` prefers `player.emoji`
  over name's first char. `handleText()` returns `''` for non-handle
  players (no more meaningless `#1`, `#2`).
- `src/player/playerRenderer.js` — same `avatarChar` fix; roster handle
  no longer duplicates emoji.
- `src/game/history.js` — new `makeComboCell()` emits all N positions
  split into winner-accent + loser-dim groups. Replaces flat
  `comboTextFor` string with structured DOM:
  ```html
  <span class="history__combo">
    <span class="history__combo-group history__combo-group--win history__combo-group--blue">1·2·4·7</span>
    <span class="history__combo-sep">│</span>
    <span class="history__combo-group history__combo-group--loss">3·5·6·8</span>
  </span>
  ```

### Theme CSS — `QC FIXES 2026-05-04` blocks appended

Each `src/themes/<theme>/theme.css` got a single block at the end. Source
order beats earlier `!important` rules — easy to audit, easy to revert.

Block contents (per theme, adapted to tokens):

- Image 38 sticky ticker (Linear added; Broadcast/Trading already had it)
- Image 39 native `<select>` SR-only (Linear + Trading added; Broadcast
  already had it)
- Image 36/37 setup-phase CSS `order` so player tiles surface above
  search/create card
- Image 51 team roster: vertical card layout (avatar top, name below) +
  hide POOL tag. Vertical was the second iteration after horizontal
  truncated `玩家1` to `玩..` on Broadcast.
- Image 47 honors gallery: 2-col mobile, bigger names, drop index +
  English subtitle
- Image 48 team awards: 2-col grid + bigger badges. Linear + Trading had
  no `.team-honors` styling at all before — now both themed.
- Image 28/32/34 setup-phase `.team__head` stacks column on mobile
- Image 44/45/46 desktop pool/slot alignment: pool tile grows to slot
  height; `white-space: nowrap` on `.slot__target-icon/-label/__placeholder-label`
- Image 49 history combo styling: `.history__combo-group--win/--loss/--blue/--red`
- Linear + Trading mobile history row uses `grid-template-areas` so combo
  gets its own full-width row (was clipping at 1fr ≈ 150px column)

### Round number format

`本局 N` → `第N局` in ticker + versus column. Drops `pad2` since `第02局`
reads weird in Chinese.

- `src/ui/tickerSync.js` — tickerRound element
- `src/ui/teamDisplay.js` — versusRound element
- `index.html` — placeholder strings (2 occurrences)

The active-game `本局：N · 红队的级` header keeps `本局：` because that's
a different concept (current round LEVEL, not count).

### Capture pipeline

- `scripts/visual/capture-mobile-final.mjs` — clicks visible chip
  button instead of `selectOption`-ing the now-hidden `<select>`
- `scripts/visual/capture-mobile-qc-2026-05-04.mjs` (NEW) — plays 5
  rounds per theme before screenshotting so honors / history /
  team-honors render populated state. 7 sections × 3 themes = 21 PNGs.

## Visual baseline

`docs/reports/mobile-qc-2026-05-04/` — 21 PNGs at 390×844 viewport.
Each section verified populated. The two QC self-catches that prevented
broken-state shipping are documented in
`HANDOFF-2026-05-04-mobile-failures.md` under "RESOLVED 2026-05-04".

## What worked (vs prior session's failure pattern)

1. **Renderer-source-first.** Read `*Renderer.js` files before writing
   any selector. No more `.pool-tile__display` selector mismatches.
2. **Renderer fixes cascade.** Changing `avatarChar` + `handleText` +
   `makeComboCell` once fixed image 49/52 across all three themes.
3. **Append, don't surgically insert.** One `QC FIXES 2026-05-04` block
   per theme appended at file end. Easy to audit, easy to revert,
   source-order beats earlier `!important` rules.
4. **POPULATED captures.** 5 rounds before screenshot → honors,
   history, team-honors all render real data instead of placeholders.
5. **Section-by-section audit BEFORE commit.** Caught two QC issues
   that would've shipped broken: broadcast `玩..` truncation +
   linear/trading combo clipping.

## What's next on the theme roadmap

Per `project_theme_system_handoff.md` memory + `THEME-ARCHITECTURE.md`:

| Phase | What                                                          | Status |
|-------|---------------------------------------------------------------|--------|
| 2.5   | Linear sidebar layout via `layout.mount()` + state-preservation across switches | TODO   |
| 3.5   | Sparkline renderer; flip Trading `featureManifest.sparklines` true | TODO   |
| 4     | Atelier Console theme                                         | TODO   |
| 5     | Tea-Table theme (needs commissioned ink illustrations)        | gated  |
| —     | Visual regression CI (Percy/Chromatic/pixelmatch)             | TODO   |
| —     | PNG export theme-awareness                                    | TODO   |

The mobile QC pass didn't advance any of these — they remain the open
infra/theme items.

## Memory pointers (auto-loaded next session)

- `feedback_qc_failures_2026-05-04.md` — discipline lessons (rules 11-15)
  remain applicable; "RESOLVED" section added below open-issue list
- `feedback_new_theme_must_do.md` — 15 must-do rules; rules 11-15 are
  what made this resolution session land cleanly
- `feedback_compare_to_demo_before_done.md` — populated capture rule
  drove this session's audit gates
- `feedback_solo_project_autonomy.md` — sessions ship across without
  "continue?" prompts
- `project_theme_system_handoff.md` — Phase 2.5 / 3.5 / 4 / 5 roadmap

## How to pick up

1. Run `npm run dev` (port 3000, requires `GD_NO_API_PROXY=1` for offline).
2. Open Chrome devtools at 390×844 to verify the QC baseline.
3. Run `node scripts/visual/capture-mobile-qc-2026-05-04.mjs` for fresh
   captures — output goes to `docs/reports/mobile-qc-2026-05-04/`.
4. The QC fix blocks live at the END of each theme's `theme.css` for
   easy review (search for `QC FIXES 2026-05-04`).
5. Next theme work continues per `THEME-ARCHITECTURE.md`. Phase 2.5
   (sidebar + state-preservation) is the next infra item; Phase 4
   (Atelier) is the next visual theme.
