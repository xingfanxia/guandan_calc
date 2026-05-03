# Vercel KV Storage Schema

> Documentation of all KV keys, data structures, TTLs, and access patterns for Guandan Calculator.

---

## Overview

The application uses **Vercel KV (Upstash Redis)** for:
1. Real-time room sharing data (temporary)
2. Player profile data (permanent)
3. Room favorites (permanent)

All keys use prefixes for namespace organization and efficient querying.

---

## Player Profile Keys

### Primary Storage: `player:{handle}`

**Format**: `player:{handle}`
**Value**: JSON string containing full player object
**TTL**: None (permanent storage)
**Example**: `player:xiaoming`

**Data Structure**:
```javascript
{
  // Identity
  id: "PLR_X7K2M9",              // Auto-generated unique ID
  handle: "xiaoming",            // Unique, lowercase, URL-safe
  displayName: "小明",           // Can be duplicated
  emoji: "🐱",                   // Avatar from 77+ options
  photoBase64: "data:image/jpeg;base64,/9j/4AAQ...",  // Optional profile photo (NEW v10.0)
  playStyle: "gambler",          // One of 8 predefined styles
  tagline: "运筹帷幄，决胜千里",  // Personal motto (max 50 chars)
  createdAt: "2024-12-09T10:30:00Z",
  ownershipTokenHash: "a3f5...",  // SHA-256 hex of self-edit token (since 2026-05-03);
                                  // never returned to client — stripped from all
                                  // player-shaped API responses



  // Aggregated Stats
  stats: {
    gamesPlayed: 142,
    wins: 83,
    winRate: 0.584,
    avgRanking: 2.3,
    recentRankings: [1, 2, 1, 3, 1, 2, 2, 1, 3, 1],  // Last 10 games

    // Honor counts (all 14 honors)
    honors: {
      "吕布": 3,
      "阿斗": 0,
      "石佛": 2,
      // ... all 14 honors
    },

    // Streak tracking
    currentWinStreak: 3,
    longestWinStreak: 7,
    currentLossStreak: 0,
    longestLossStreak: 4
  },

  // Recent game history (last 20)
  recentGames: [
    {
      roomCode: "A1B2C3",
      date: "2024-12-08T20:30:00Z",
      mode: "4P",
      ranking: 1,
      team: 1,
      teamWon: true,
      levelChange: "+3",
      honorsEarned: ["吕布", "连胜王"]
    }
    // ... up to 20 most recent
  ]
}
```

**Access Patterns**:
- Create: `kv.set(`player:${handle}`, JSON.stringify(player))`
- Read: `kv.get(`player:${handle}`)`
- List all: `kv.keys('player:*')`
- Update stats: `kv.set()` with merged data

---

### Reverse Lookup: `player_id:{id}`

**Format**: `player_id:{id}`
**Value**: String (player handle)
**TTL**: None (permanent storage)
**Example**: `player_id:PLR_X7K2M9` → `"xiaoming"`

**Purpose**: Enable lookups by player ID instead of handle

**Access Pattern**:
- Store on creation: `kv.set(`player_id:${id}`, handle)`
- Lookup: `kv.get(`player_id:${id}`)`

---

## Room Keys

### Primary Storage: `room:{code}`

**Format**: `room:{code}`
**Value**: JSON string containing full room data
**TTL**:
- Regular rooms: 31536000 seconds (1 year)
- Favorited rooms: None (permanent via `kv.set()`)

**Example**: `room:A1B2C3`

**Data Structure**:
```javascript
{
  // Room identity
  roomCode: "A1B2C3",
  createdAt: "2024-12-08T20:00:00Z",
  finishedAt: "2024-12-08T21:25:00Z",  // Set when A级通关 (NEW v10.0)
  lastUpdated: "2024-12-08T21:30:00Z",
  version: "v10.0",

  // Game configuration
  settings: {
    numPlayers: 4,
    teamNames: ["Team 1", "Team 2"],
    // ... full settings object
  },

  // Current game state
  state: {
    teamLevels: [5, 7],
    teamAFail: [0, 0],
    roundLevel: 7,
    roundOwner: 2,
    winner: null,
    history: [...]
  },

  // Players (enhanced with profile handles in future)
  players: [
    {
      name: "小明",
      emoji: "🐱",
      team: 1,
      handle: "xiaoming"  // Added in Phase 7
    }
  ],

  // Room metadata
  isFavorite: false,             // If true, permanent storage
  authToken: "<64-hex-chars>"    // Server-generated host auth token (since 2026-05).
                                 // Stripped from GET responses. Validated on PUT via
                                 // `Authorization: Bearer <token>` header (constant-time
                                 // compare). TOFU-pinned for legacy rooms in flight.
                                 // See docs/SECURITY.md.
}
```

> **Stats schema note (2026-05):** the `stats` object shown above is a simplified historical
> snapshot. The current canonical structure is in `api/players/_utils.js` `initializePlayerStats`
> and includes mode-specific sub-stats (`stats4P`, `stats6P`, `stats8P`), time tracking
> (`totalPlayTimeSeconds`, `longestSessionSeconds`, `avgSessionSeconds`), session vs. round
> separation (`sessionsPlayed`/`roundsPlayed`), partner/opponent maps, voting history, and
> 14 honors. Treat `_utils.js` as the source of truth.

**Access Patterns**:
- Create: `kv.setex(`room:${code}`, 31536000, JSON.stringify(roomData))`
- Read: `kv.get(`room:${code}`)`
- Update: Check `isFavorite` → use `kv.set()` or `kv.setex()`
- Favorite: Update `isFavorite: true` → `kv.set()` (removes TTL)

---

## Play Styles Enum

**Valid Values** (8 options):
```javascript
[
  'gambler',      // 赌神 🎰
  'chill',        // 躺平大师 🛋️
  'scapegoat',    // 团队背锅侠 🎒
  'tilt',         // 心态爆炸王 💥
  'steady',       // 稳如老狗 🐕
  'yolo',         // 冲就完事 🚀
  'secondPlace',  // 千年老二 🥈
  'mystery'       // 神秘高手 🎭
]
```

---

## Handle Validation Rules

**Format Requirements**:
- Length: 3-20 characters
- Allowed: Alphanumeric (a-z, A-Z, 0-9) + underscore (_)
- Not allowed: @ symbol (displayed in UI but not stored)
- Case: Stored as lowercase, compared case-insensitively

**Regex**: `/^[a-zA-Z0-9_]{3,20}$/`

**Examples**:
- ✅ Valid: `xiaoming`, `player_123`, `abc_xyz`
- ❌ Invalid: `ab` (too short), `@xiaoming` (@ not allowed), `player-name` (hyphen not allowed)

---

## Player ID Generation

**Format**: `PLR_` + 6 random alphanumeric characters
**Character Set**: `ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789` (36 chars)
**Collision Detection**: Checks existence before assignment (max 10 attempts)

**Examples**: `PLR_X7K2M9`, `PLR_ZT8L8D`, `PLR_A1B2C3`

---

## Room Code Generation

**Format**: 6 random alphanumeric characters
**Character Set**: `ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789` (36 chars)
**Collision Detection**: Checks existence before assignment (max 10 attempts)

**Examples**: `A1B2C3`, `X7Y8Z9`, `GAME42`

---

## Query Patterns

### List All Players
```javascript
const keys = await kv.keys('player:*');
const players = await Promise.all(keys.map(k => kv.get(k)));
```

### Search Players
1. Fetch all players via `kv.keys('player:*')`
2. Filter in-memory by handle or displayName
3. Sort by createdAt DESC
4. Apply pagination (offset, limit)

### Get Player by ID
1. Lookup handle: `kv.get(`player_id:${id}`)`
2. Fetch player: `kv.get(`player:${handle}`)`

---

## Storage Quotas (Vercel Free Tier)

| Resource | Limit |
|----------|-------|
| Total Storage | 256 MB |
| Commands/Day | 100,000 |
| Bandwidth/Month | 200 MB |

**Current Usage Estimate**:
- Average player profile: ~1 KB (with 20 recent games)
- 256 MB = ~260,000 player profiles
- Average room: ~30 KB (with full history)
- Mixed storage: ~8,000 active rooms + thousands of players

---

## Migration Notes

### From Session-Only to Persistent Players (Phase 7)

**Before**:
```javascript
players: [
  { name: "小明", emoji: "🐱", team: 1 }
]
```

**After**:
```javascript
players: [
  {
    name: "小明",      // Display name (backward compatible)
    emoji: "🐱",
    team: 1,
    handle: "xiaoming" // NEW: Link to player profile
  }
]
```

**Backward Compatibility**: Rooms without handles still work with session-only names.

---

## Future Enhancements

### Planned Keys (Phase 7+)

- `player_stats:{handle}:{stat}` - Denormalized stats for leaderboards
- `room_index:{date}` - Room index by date for browsing
- `achievement:{id}` - Achievement definitions (Phase 2)
- `leaderboard:{season}` - Season leaderboard data (Phase 3)

---

## Best Practices

1. **Always JSON.stringify()**: Store all objects as JSON strings
2. **Parse on retrieval**: Handle both string and object types
3. **Use TTL wisely**: Only permanent data should skip TTL
4. **Batch operations**: Use `Promise.all()` for multiple reads
5. **Error handling**: Wrap all KV operations in try-catch
6. **Key naming**: Use consistent prefixes for querying efficiency
7. **Strip secrets on read**: when returning room data via GET, destructure out
   `authToken` before serializing — viewers must never see the host token

## Required Environment

| Variable | Purpose | What happens if unset |
|---|---|---|
| `KV_REST_API_URL` | Upstash REST endpoint | KV operations fail |
| `KV_REST_API_TOKEN` | KV write/read auth | KV operations fail |
| `ADMIN_TOKEN` (since 2026-05) | Admin endpoint gate (delete / reset-stats / migrate-modes); also accepted as override on PROFILE_UPDATE alongside per-user ownership tokens (since 2026-05-03) | All admin endpoints reject 403 (fail-closed); PROFILE_UPDATE still works for owners with their Bearer token |
