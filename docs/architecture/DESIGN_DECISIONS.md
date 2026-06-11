# Design Decisions & UX Philosophy

## 🎨 Design Philosophy

### Core Design Principles

#### 1. Mobile-First Approach
**Decision**: Prioritize mobile experience while maintaining desktop functionality
- **Touch-optimized controls**: Long-press drag initiation, large touch targets
- **Responsive typography**: Scalable font sizes for different screen sizes  
- **Mobile PNG exports**: 600px width optimized for phone viewing and sharing
- **Thumb-friendly interface**: All interactive elements sized for finger navigation

#### 2. Cultural Gaming Integration
**Decision**: Embrace authentic Chinese gaming culture and terminology
- **Honor system naming**: Historical references (吕布, 阿斗, 石佛) resonate with Chinese players
- **Gaming slang**: "很C" (carry) and "很闹" (troublesome) from gaming communities
- **Brand identity**: "闹麻家族" (Gaming/Mahjong Community) establishes cultural connection
- **Authentic terminology**: Real gaming terms over literal translations

#### 3. Progressive Disclosure
**Decision**: Show information contextually based on user role and game state
- **Viewer mode hiding**: Remove 5 sections irrelevant to viewers (setup, ranking, rules, results, room controls)
- **Clean viewer experience**: Focus on teams, statistics, history, and exports only
- **Mode-aware UI**: Different interfaces for hosts vs. viewers vs. normal play
- **Contextual controls**: Show only relevant actions for current game state

## 🎯 UX Decision Deep Dive

### Room Sharing UX Design

#### Problem: Complex Sharing Experience
Traditional game sharing requires screenshots or manual data entry

#### Solution: Three-Tier Sharing System
1. **Static snapshots**: URL-encoded data for permanent sharing
2. **Room codes**: 6-digit codes (A1B2C3) for live viewing  
3. **Host tokens**: Secure authentication for persistent management

#### Design Rationale:
- **6 digits vs. 4**: 21 billion combinations vs. 1.6 million (collision prevention)
- **No prefix**: "A1B2C3" vs. "ROOM-A1B2" (easier typing, cleaner aesthetics)
- **Clickable banner**: One-click viewer link copying (remove friction)
- **Auto-redirect**: Host enters room URL immediately (session persistence)

### Honor System UX Design

#### Problem: Generic Statistics Lack Personality
Standard MVP/stats are boring and don't engage players

#### Solution: Cultural Gaming References
- **Historical figures**: 吕布 (legendary), 阿斗 (weak) create narrative
- **Gaming terms**: 波动王, 奋斗王, 连段王, 棋差一着, 抗压王 add personality
- **Visual hierarchy**: Color-coded badges with emoji indicators
- **Data requirements**: 5+ completed rounds prevent small samples from assigning full-session labels too early

#### Design Rationale:
- **Emotional connection**: Players care more about being "吕布" than "highest average"
- **Social sharing**: Fun titles more shareable than dry statistics
- **Cultural authenticity**: Terms familiar to Chinese gaming communities
- **Balanced competition**: Multiple categories ensure everyone can "win" something

### Bulk Input UX Design

#### Problem: Tedious Individual Player Naming
8 individual text fields create setup friction

#### Solution: Smart Bulk Input + Quick Start
- **Space-separated input**: Natural format matching how people list names
- **Mode-aware placeholders**: Show correct example names for 4/6/8 player modes
- **Quick start buttons**: One-click application of placeholder names
- **Validation feedback**: Clear error messages for count mismatches or duplicates

#### Design Rationale:
- **Cognitive load**: One input field vs. eight separate fields
- **Error prevention**: Validation prevents common mistakes
- **Speed optimization**: Quick start enables 5-second setup
- **Flexibility**: Supports both bulk input and individual editing

## 🎨 Visual Design Decisions

### Color Psychology

#### Team Colors
- **蓝队 (Blue Team)**: #3b82f6 - Trust, stability, professional
- **红队 (Red Team)**: #ef4444 - Energy, passion, competition
- **Rationale**: High contrast for accessibility, cultural color associations

#### Status Colors  
- **Host mode**: #3b82f6 (Blue) - Authority, control, management
- **Viewer mode**: #22c55e (Green) - Passive, safe, observation
- **Success feedback**: #22c55e (Green) - Positive reinforcement
- **Warnings**: #f59e0b (Orange) - Attention without alarm

#### Honor Badge Colors
- **吕布**: #d4af37 (Gold) - Ultimate achievement, legendary status
- **阿斗**: #8b4513 (Brown) - Humble, earth-toned for last place
- **石佛**: #708090 (Gray) - Stable, solid, unchanging like stone
- **波动王**: #ff4500 (Orange-Red) - Dynamic, unpredictable energy
- **奋斗王**: #32cd32 (Green) - Growth, improvement, progress
- **抗压王**: #0f766e (Deep teal) - Pressure recovery and resilience

### Typography Hierarchy

#### Desktop/Web Interface
- **H1 Title**: Large, prominent branding
- **Section Headers**: Clear content organization
- **Body Text**: Optimized for reading at arm's length
- **UI Labels**: Concise, action-oriented

#### Mobile PNG Export
- **Title**: 48px - Immediate recognition when scrolling
- **Section Headers**: 28-36px - Clear content breaks
- **Honor Text**: 22-24px - Readable on phone screens
- **Game Details**: 16-18px - Dense information display
- **Descriptions**: 14-16px - Supporting information

### Layout Philosophy

#### Desktop: Information Density
- **Grid layouts**: Efficient space utilization
- **Side-by-side**: Team comparisons, statistics tables
- **Tabular data**: Dense information display for analysis

#### Mobile Export: Vertical Flow
- **Single column**: Eliminate horizontal scrolling
- **Card-based**: Each game as discrete information unit
- **Generous spacing**: Prevent content from feeling cramped
- **Clear separators**: Visual breaks between information sections

## 🎪 Gamification & Engagement

### Psychology of Honor System
- **Multiple win conditions**: 6 different ways to be "the best"
- **Narrative framing**: Historical references create stories
- **Social currency**: Shareable achievements for group dynamics
- **Balanced competition**: Prevent single-player dominance

### Sharing Psychology  
- **Immediate gratification**: One-click room creation and sharing
- **Social proof**: Live viewer counts and real-time updates
- **FOMO mechanics**: Live games create urgency to watch
- **Trophy sharing**: Mobile PNG exports perfect for social media

### Ease of Use Psychology
- **Cognitive load reduction**: Bulk input, quick start, smart defaults
- **Error prevention**: Validation and clear feedback
- **Progressive disclosure**: Show only relevant controls
- **Positive reinforcement**: Success animations and clear feedback

## 🎮 Cultural Design Integration

### Chinese Gaming Culture Elements
- **Honor terminology**: Borrowed from MOBAs, card games, and general gaming
- **Historical references**: Cultural figures everyone recognizes
- **Gaming slang**: "很C", "很闹" feel natural to Chinese gamers
- **Community identity**: "闹麻家族" suggests fun, social gaming group

### Accessibility Considerations
- **Language consistency**: Pure Chinese interface with no mixed languages
- **Cultural color meanings**: Red/blue team colors match cultural expectations
- **Familiar patterns**: Honor systems similar to popular gaming platforms
- **Generational appeal**: Historical references span age groups

This design approach creates an engaging, culturally relevant, and technically sophisticated gaming platform that serves both casual family games and serious competitive play.

---

## 🎲 Game Rule Decisions (2026-06)

### Strict A applies across 4/6/8-player modes

**Decision (2026-06-10):** In strict-A mode, all modes use the same own-A failure model:
an A-level team must win on its own A round with no 末游 to clear. Losing on its own A,
or winning its own A while carrying 末游, increments A1/A2/A3; the third failure demotes
only that team to level 2.

**Why:**
- The match ending condition depends on whose A round is being played, not player count.
- 6/8 sessions still need a deterministic strict-mode pressure valve; otherwise both teams
  can sit at A indefinitely while viewers see ambiguous "通关中" status.
- Host/viewer sync now carries structured `state.gameStatus`, so the frontend does not need
  to infer match-ended state from Chinese `aNote` text.

**Implementation:** `src/game/rules.js` records own-A failures when `strictA` is enabled,
regardless of mode. `src/ui/teamDisplay.js` shows A-fail chips in strict mode. `roundOwner`
is authoritative when both teams are at A.

**Trade-off:** Strict 6/8 sessions can demote from A again. Users who want the less punishing
long-session behavior can turn off `strictA`; lenient mode hides A-fail chips and keeps teams
at A until a valid clear.

---

## 🔒 Security Model Decisions (2026-05)

### Server-side room auth token (replacing client-only)

**Decision (2026-05-02):** Room hosts get a 32-byte hex `authToken` issued by the server at
create-time, stored in KV alongside the room data, validated on every PUT via
`Authorization: Bearer <token>` header with constant-time compare. GET strips the token from
responses. Legacy rooms in flight get TOFU-pinned on first PUT.

**Why:** The previous design generated tokens client-side (`Math.random()`) and the server
ignored them — anyone with a room URL could PUT corrupted state. The audit found this as
CRITICAL #1.

### Admin endpoints behind `ADMIN_TOKEN` env var

**Decision (2026-05-02):** All admin endpoints (`delete`, `reset-stats`, `migrate-modes`,
`PROFILE_UPDATE`) validate `adminToken` from request body against `process.env.ADMIN_TOKEN`
using `validateAdminToken` (constant-time compare). Fail-closed if env unset.

**Why:** The previous design hardcoded the admin password (`xiaofei0214`) in source AND in
CLAUDE.md AND in the client-side JS check on `players.html`. Three layers of leak for one
secret. `migrate-modes` was previously fully public and would mass-rewrite every player on
demand.

**Trade-off:** Profile editing in `playerEditModal` is admin-only until per-user ownership
tokens land (deferred follow-up P0 — see `docs/HANDOFF-2026-05-02-audit.md`).

### `escapeHtml` helper for all dynamic interpolation

**Decision (2026-05-02):** Add `escapeHtml(value)` to `src/core/utils.js`. Apply to every
dynamic string (player names, taglines, handles, photo URLs) interpolated into innerHTML
across `playerSearch`, `playerEditModal`, `victoryModal` (vote buttons + leaderboards +
results + MVP tagline).

**Why:** Vanilla JS template literals offer no auto-escaping. A malicious display name
(`<script>...</script>`) entered in profile-create would execute when rendered in another
user's victory modal or search results. Audit found this as CRITICAL #2.

**Pattern to maintain:** any new innerHTML interpolation must wrap dynamic values with
`escapeHtml`. Static HTML structure is fine raw.
