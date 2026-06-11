# Player Profile System Specification

> Feature specification for persistent player profiles, game history, and achievements in Guandan Calculator.
>
> Created: 2025-12-09
> Status: Ready for Implementation

---

## Overview

Transform Guandan Calculator from a session-based tool into a **persistent gaming platform** with player profiles, game history tracking, honor collections, and achievements.

### Goals
- Enable players to build persistent identities across games
- Track career statistics and honor achievements
- Provide game history with links to past rooms
- Create browsable player and room directories
- Display MVP taglines on victory screens

---

## Phase 1: MVP Features

### 1. Player Profiles

#### Data Model

```javascript
{
  // Identity
  id: "PLR_X7K2M9",              // Auto-generated unique ID
  handle: "xiaoming",            // Unique, URL-safe (displayed as @xiaoming)
  displayName: "小明",           // Can be duplicated across players
  emoji: "🐱",                   // Avatar from 77+ options
  playStyle: "赌神",             // One of 8 predefined styles
  tagline: "运筹帷幄，决胜千里",  // Personal motto (shown on victory)
  createdAt: "2024-12-09T10:30:00Z",

  // Aggregated Stats (updated after each game)
  stats: {
    gamesPlayed: 142,
    wins: 83,
    winRate: 0.584,              // Calculated: wins / gamesPlayed
    avgRanking: 2.3,             // Average finishing position

    // Recent form (last 10 games)
    recentRankings: [1, 2, 1, 3, 1, 2, 2, 1, 3, 1],

    // Community voting and completed-session idempotency
    mvpVotes: 12,
    burdenVotes: 2,
    votingHistory: {},
    sessionHistory: {},

    // Honor counts (all 16 honors)
    honors: {
      "吕布": 3,
      "阿斗": 0,
      "石佛": 2,
      "波动王": 1,
      "奋斗王": 0,
      "逆转核心": 1,
      "翻车王": 1,
      "赌徒": 2,
      "大满贯": 1,
      "连段王": 5,
      "团队中轴": 3,
      "保底核心": 2,
      "节奏核心": 4,
      "燃尽王": 1,
      "棋差一着": 2,
      "抗压王": 0
    },

    // Streak tracking
    currentWinStreak: 3,
    longestWinStreak: 7,
    currentLossStreak: 0,
    longestLossStreak: 4
  },

  // Game history (recent games, full history in separate query)
  recentGames: [
    {
      roomCode: "A1B2C3",
      date: "2024-12-08T20:30:00Z",
      mode: "4P",
      ranking: 1,
      team: 1,
      teamWon: true,
      levelChange: "+3",
      honorsEarned: ["吕布", "连段王"]
    }
    // ... last 20 games
  ]
}
```

#### Play Styles (8 Options)

| Style | Chinese | English | Emoji | Description |
|-------|---------|---------|-------|-------------|
| `gambler` | 赌神 | God of Gamblers | 🎰 | High risk, high reward plays |
| `chill` | 躺平大师 | Lie-Flat Master | 🛋️ | Just here for the vibes |
| `scapegoat` | 团队背锅侠 | Team Scapegoat | 🎒 | Always takes the blame |
| `tilt` | 心态爆炸王 | Tilt King | 💥 | Emotional, easily tilted |
| `steady` | 稳如老狗 | Steady Old Dog | 🐕 | Calm and consistent |
| `yolo` | 冲就完事 | YOLO Charger | 🚀 | Aggressive, sends it |
| `secondPlace` | 千年老二 | Eternal Runner-up | 🥈 | Second place destiny |
| `mystery` | 神秘高手 | Mystery Master | 🎭 | Unpredictable |

---

### 2. URL Structure

| Route | Purpose | Auth Required |
|-------|---------|---------------|
| `/players` | Browse/search all players | No |
| `/players/new` | Create new player profile | No |
| `/players/[handle]` | Individual profile page | No |
| `/rooms` | Browse rooms (last 20 + favorites) | No |
| `/rooms/[code]` | Room detail/join (existing) | No |

**Note:** Handle is stored without `@`, displayed with `@` in UI. URLs use clean format: `/players/xiaoming` (not `/players/@xiaoming`).

---

### 3. API Endpoints

#### Players API

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/players/create` | POST | Create new player profile |
| `/api/players/list` | GET | List/search players |
| `/api/players/[handle]` | GET | Get player profile |
| `/api/players/[handle]/stats` | PUT | Update stats after game |

##### POST `/api/players/create`

Request:
```json
{
  "handle": "xiaoming",
  "displayName": "小明",
  "emoji": "🐱",
  "playStyle": "gambler",
  "tagline": "运筹帷幄，决胜千里"
}
```

Response:
```json
{
  "success": true,
  "player": {
    "id": "PLR_X7K2M9",
    "handle": "xiaoming",
    ...
  }
}
```

Errors:
- `400` - Missing required fields
- `409` - Handle already exists

##### GET `/api/players/list`

Query params:
- `q` - Search query (matches handle or displayName)
- `limit` - Max results (default 20)
- `offset` - Pagination offset

Response:
```json
{
  "players": [
    {
      "id": "PLR_ABC123",
      "handle": "xiaoming",
      "displayName": "小明",
      "emoji": "🐶",
      "playStyle": "steady",
      "tagline": "稳扎稳打",
      "createdAt": "2026-01-01T00:00:00.000Z",
      "lastActiveAt": "2026-01-02T00:00:00.000Z",
      "stats": {
        "sessionsPlayed": 12,
        "sessionsWon": 7,
        "sessionWinRate": 0.583,
        "avgRankingPerSession": 3.25,
        "gamesPlayed": 12,
        "wins": 7,
        "winRate": 0.583,
        "avgRanking": 3.25
      }
    }
  ],
  "total": 150,
  "hasMore": true
}
```

List/search returns compact summaries only. It does not include large or
detailed fields like `photoBase64`, `recentGames`, achievements, voting
history, or partner/opponent maps. Use `GET /api/players/[handle]` for the full
profile when adding a selected player to a session.

##### GET `/api/players/[handle]`

Response: Full player object (see data model above)

Errors:
- `404` - Player not found

##### PUT `/api/players/[handle]/stats`

Request:
```json
{
  "roomCode": "A1B2C3",
  "ranking": 1,
  "team": 1,
  "teamWon": true,
  "levelChange": "+3",
  "honorsEarned": ["吕布", "连段王"],
  "mode": "4P"
}
```

Response:
```json
{
  "success": true,
  "updatedStats": { ... }
}
```

#### Rooms API (Enhanced)

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/rooms/list` | GET | List rooms with filters |

##### GET `/api/rooms/list`

Query params:
- `limit` - Max results (default 20)
- `favorites` - If `true`, only show favorites
- `player` - Filter by player handle
- `offset` - Pagination offset

Response:
```json
{
  "rooms": [
    {
      "code": "A1B2C3",
      "createdAt": "2024-12-08T20:00:00Z",
      "status": "completed",
      "mode": "4P",
      "players": [
        { "handle": "xiaoming", "emoji": "🐱", "team": 1 },
        ...
      ],
      "winner": 1,
      "isFavorite": false
    }
  ],
  "total": 45,
  "hasMore": true
}
```

---

### 4. Enhanced Room Data Model

```javascript
{
  code: "A1B2C3",
  createdAt: "2024-12-09T...",
  lastUpdated: "2024-12-09T...",
  status: "active" | "completed",
  isFavorite: false,

  // Player references (replaces simple names)
  players: [
    {
      playerId: "PLR_X7K2M9",
      handle: "xiaoming",
      displayName: "小明",
      emoji: "🐱",
      team: 1
    },
    // ... other players
  ],

  // Game config
  mode: "4P" | "6P" | "8P",
  teamLevels: { team1: "5", team2: "7" },
  roundHistory: [...],

  // Results (when completed)
  results: {
    winner: 1,  // Winning team number
    mvp: {
      playerId: "PLR_X7K2M9",
      handle: "xiaoming",
      tagline: "运筹帷幄，决胜千里"
    },
    playerHonors: {
      "PLR_X7K2M9": ["吕布", "连段王"],
      "PLR_ABC123": ["逆转核心"]
    }
  }
}
```

---

### 5. UI Components

#### Player Creation Page (`/players/new`)

```
┌─────────────────────────────────────────────────────────┐
│  创建玩家档案                                           │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  选择头像                                               │
│  ┌────────────────────────────────────────────────┐    │
│  │ 🐱 🐶 🐰 🦊 🐻 🐼 🐨 🐯 🦁 🐮 🐷 🐸 🐵 ...   │    │
│  └────────────────────────────────────────────────┘    │
│                                                         │
│  用户名 (唯一标识)                                      │
│  ┌────────────────────────────────────────────────┐    │
│  │ @ xiaoming                                      │    │
│  └────────────────────────────────────────────────┘    │
│  ✓ 用户名可用                                          │
│                                                         │
│  显示名称                                               │
│  ┌────────────────────────────────────────────────┐    │
│  │ 小明                                            │    │
│  └────────────────────────────────────────────────┘    │
│                                                         │
│  游戏风格                                               │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐  │
│  │ 🎰 赌神  │ │ 🛋️ 躺平  │ │ 🎒 背锅  │ │ 💥 爆炸  │  │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘  │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐  │
│  │ 🐕 老狗  │ │ 🚀 冲冲  │ │ 🥈 老二  │ │ 🎭 神秘  │  │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘  │
│                                                         │
│  个人标语 (获胜时展示)                                  │
│  ┌────────────────────────────────────────────────┐    │
│  │ 运筹帷幄，决胜千里                              │    │
│  └────────────────────────────────────────────────┘    │
│                                                         │
│  ┌────────────────────────────────────────────────┐    │
│  │              创建档案                           │    │
│  └────────────────────────────────────────────────┘    │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

#### Player Profile Page (`/players/[handle]`)

```
┌─────────────────────────────────────────────────────────────┐
│  /players/xiaoming                                          │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─────┐  小明                                              │
│  │ 🐱  │  @xiaoming                                         │
│  └─────┘  🎰 赌神 · "运筹帷幄，决胜千里"                    │
│           ───────────────────────────                       │
│                                                             │
│  ══════════════════════════════════════════════════════════│
│                                                             │
│  📊 生涯数据                     🏆 荣誉收集 (8/16)         │
│  ┌────────────────────┐         ┌────────────────────┐     │
│  │ 场次: 142          │         │ 吕布 ×3  石佛 ×2   │     │
│  │ 胜场: 83 (58.4%)   │         │ 连段王 ×5 大满贯 ×1│     │
│  │ 平均名次: 2.3      │         │ 节奏核心 ×4        │     │
│  │ 连胜纪录: 7        │         │ 🔒 未解锁: 8       │     │
│  └────────────────────┘         └────────────────────┘     │
│                                                             │
│  📈 近期状态 (最近10场)                                     │
│  🥇🥈🥇🥉🥇🥈🥈🥇🥉🥇  (70% 前二)                          │
│                                                             │
│  📜 对战记录                                                │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ 12/8  │ A1B2C3 │ 🥇 第1 │ +3级 │ 吕布, 连段王     │→  │
│  │ 12/7  │ X9Y8Z7 │ 🥈 第2 │ +1级 │ -                │→  │
│  │ 12/5  │ P4Q5R6 │ 🥉 第3 │ 失败 │ 逆转核心         │→  │
│  │ ...                                                 │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

#### Player Browser Page (`/players`)

```
┌─────────────────────────────────────────────────────────────┐
│  玩家大厅                                    [+ 创建新玩家] │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ 🔍 搜索玩家...                                      │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  全部玩家 (150)                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ 🐱 小明 @xiaoming        │ 142场 │ 58.4% │ 🎰 赌神 │→  │
│  │ 🦊 老王 @laowang         │ 98场  │ 52.1% │ 🐕 老狗 │→  │
│  │ 🐰 小红 @xiaohong        │ 76场  │ 61.2% │ 🚀 冲冲 │→  │
│  │ 🐻 大李 @dali            │ 45场  │ 48.9% │ 🥈 老二 │→  │
│  │ ...                                                 │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  [加载更多]                                                 │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

#### Room Browser Page (`/rooms`)

```
┌─────────────────────────────────────────────────────────────┐
│  房间大厅                                                   │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ 🔍 按玩家筛选...                                    │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  ⭐ 收藏的房间                                              │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ A1B2C3 │ 12/1 │ 4人 │ 🐱🦊 vs 🐰🐻 │ 红队胜 │ ⭐  │→  │
│  │ X9Y8Z7 │ 11/28│ 6人 │ 🐱🦊🐯 vs... │ 进行中 │ ⭐  │→  │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  最近房间                                                   │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ B2C3D4 │ 12/8 │ 4人 │ 🐱🦊 vs 🐰🐻 │ 蓝队胜 │    │→  │
│  │ C3D4E5 │ 12/7 │ 8人 │ 🐱🦊🐯🦁 vs..│ 红队胜 │    │→  │
│  │ D4E5F6 │ 12/6 │ 4人 │ 🐱🦊 vs 🐰🐻 │ 红队胜 │    │→  │
│  │ ...                                                 │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

#### Game Setup with Player Selection

```
┌─────────────────────────────────────────────────────────────┐
│  🎴 房间设置 - 添加玩家                                     │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  红队                              蓝队                     │
│  ┌─────────────────┐              ┌─────────────────┐       │
│  │ 🐱 小明         │              │ [+ 添加玩家]    │       │
│  │ 🦊 老王         │              │                 │       │
│  └─────────────────┘              └─────────────────┘       │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ 🔍 搜索玩家...                                      │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  最近一起玩:                                                │
│  ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐ ┌──────────┐         │
│  │🐰小红│ │🐻大李│ │🐯阿强│ │🦁老刘│ │+ 新玩家  │         │
│  └──────┘ └──────┘ └──────┘ └──────┘ └──────────┘         │
│                                                             │
│  搜索结果:                                                  │
│  ├─ 🐱 小明 @xiaoming  (142场, 58.4%胜率)                  │
│  ├─ 🐶 小明 @xiaoming2 (15场, 47%胜率)  ← 不同的人         │
│  └─ 🐱 小敏 @xiaomin   (8场, 62%胜率)                      │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

### 6. Storage Design (Vercel KV)

#### Key Patterns

| Key Pattern | Type | TTL | Description |
|-------------|------|-----|-------------|
| `player:{handle}` | Hash | None | Player profile data |
| `player:id:{id}` | String | None | Maps ID to handle |
| `players:all` | Sorted Set | None | All handles (scored by games played) |
| `room:{code}` | Hash | 24h/1yr | Room data (existing, enhanced) |
| `rooms:recent` | List | None | Last 20 room codes |
| `rooms:favorites` | Set | None | Favorited room codes |

#### Example Operations

```javascript
// Create player
await kv.hset(`player:xiaoming`, playerData);
await kv.set(`player:id:PLR_X7K2M9`, 'xiaoming');
await kv.zadd('players:all', { score: 0, member: 'xiaoming' });

// Get player
const player = await kv.hgetall(`player:xiaoming`);

// Search players (by handle prefix)
const handles = await kv.zrange('players:all', 0, -1);
const matches = handles.filter(h => h.includes(query));

// Update stats after game
await kv.hincrby(`player:xiaoming`, 'stats.gamesPlayed', 1);
await kv.zincrby('players:all', 1, 'xiaoming'); // Increment games count for sorting
```

---

## Phase 2: Post-MVP Features

### Partner/Rival Statistics

```javascript
// Added to player stats
partners: {
  "laowang": {
    handle: "laowang",
    displayName: "老王",
    emoji: "🦊",
    gamesAsTeammates: 32,
    winsAsTeammates: 23,
    winRateAsTeammates: 0.719,
    gamesAsOpponents: 15,
    winsAsOpponents: 8
  }
}
```

### Achievements System (17 Active Badges)

#### Milestone Achievements
| ID | Name | Chinese | Requirement | Badge |
|----|------|---------|-------------|-------|
| `newbie` | Newbie | 初来乍到 | Play 1 game | 🐣 |
| `started` | Getting Started | 小试牛刀 | Play 10 games | ⭐ |
| `veteran` | Veteran | 百战老兵 | Play 100 games | 🎖️ |
| `legend` | Legend | 千场传奇 | Play 1000 games | 👑 |

#### Performance Achievements
| ID | Name | Chinese | Requirement | Badge |
|----|------|---------|-------------|-------|
| `first_win` | First Blood | 首胜 | Win first game | 🩸 |
| `streak_5` | Streak Master | 连胜达人 | Win 5 in a row | 🔥 |
| `streak_10` | Unstoppable | 十连胜 | Win 10 in a row | ⚡ |
| `champion` | Champion | 常胜将军 | 70%+ win rate (min 20 games) | 🏅 |

#### Honor Collection Achievements
| ID | Name | Chinese | Requirement | Badge |
|----|------|---------|-------------|-------|
| `honor_5` | Honor Hunter | 荣誉猎手 | Earn 5 different honors | 🎯 |
| `honor_10` | Honor Collector | 荣誉收藏家 | Earn 10 different honors | 🏛️ |
| `honor_all` | Honor Master | 全荣誉大师 | Earn all 16 honors | 💎 |
| `lubu_10` | Lü Bu Main | 吕布专业户 | Earn 吕布 10 times | ⚔️ |

#### Social/Team Achievements
| ID | Name | Chinese | Requirement | Badge |
|----|------|---------|-------------|-------|
| `golden_partner` | Golden Partner | 黄金搭档 | Win 10+ games with same partner | 🤝 |
| `social_butterfly` | Social Butterfly | 社交蝴蝶 | Play with 20+ different players | 🦋 |
| `host_pro` | Host Pro | 房主达人 | Host 50 game rooms | 🏠 |

#### Fun/Special Achievements
| ID | Name | Chinese | Requirement | Badge |
|----|------|---------|-------------|-------|
| `comeback` | Comeback King | 大逆转 | Win after 3+ levels behind | 🔄 |
| `sweep` | Perfect Sweep | 零封对手 | Win with opponents at level 2 | 🧹 |
| `night_owl` | Night Owl | 深夜战士 | Play after midnight | 🦉 |

---

## Phase 3: Future Features

### Authentication System
- WeChat OAuth integration
- Phone/SMS verification
- Profile claiming/protection
- Cross-device sync

### Seasons & Leaderboards
- Monthly/quarterly seasons
- Global leaderboards (by win rate, games played, honors)
- Season rewards and badges

### Player Comparison Tool
- Head-to-head stats
- Side-by-side profile comparison
- Matchup history

---

## Implementation Roadmap

### Phase 1: MVP

```
Week 1-2: Backend Foundation
├── 1.1 Player KV schema implementation
├── 1.2 API: POST /api/players/create
├── 1.3 API: GET /api/players/[handle]
├── 1.4 API: GET /api/players/list
├── 1.5 API: PUT /api/players/[handle]/stats
└── 1.6 API: GET /api/rooms/list (enhanced)

Week 2-3: Frontend Pages
├── 2.1 /players/new - Player creation page
├── 2.2 /players/[handle] - Player profile page
├── 2.3 /players - Player browser page
└── 2.4 /rooms - Room browser page

Week 3-4: Game Integration
├── 3.1 Replace manual name input with player search
├── 3.2 Recent players section in game setup
├── 3.3 On-demand player creation modal
├── 3.4 Link game results to player profiles
├── 3.5 Update player stats after game completion
├── 3.6 MVP tagline on victory screen
└── 3.7 Store player IDs in room data

Week 4: Polish & Cleanup
├── 4.1 Data migration (clean old KV entries)
├── 4.2 Error handling and edge cases
├── 4.3 Mobile responsiveness
└── 4.4 Testing and bug fixes
```

### Phase 2: Post-MVP (Future Sprint)
- Partner/rival statistics
- Achievements system
- Recent form visualization
- Advanced room filters
- Tagline in PNG export

### Phase 3: Future
- Authentication system
- Seasons & leaderboards
- Player comparison tool

---

## Technical Notes

### Handle Validation Rules
- 2-20 characters
- Alphanumeric + underscore only
- Case-insensitive (stored lowercase)
- No leading/trailing underscores
- Cannot start with number

### ID Generation
```javascript
function generatePlayerId() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let id = 'PLR_';
  for (let i = 0; i < 6; i++) {
    id += chars[Math.floor(Math.random() * chars.length)];
  }
  return id;
}
```

### Stat Update Logic
After each game ends, for each player:
1. Increment `gamesPlayed`
2. If team won, increment `wins`
3. Recalculate `winRate`
4. Update `avgRanking` with weighted average
5. Push ranking to `recentRankings` (keep last 10)
6. Increment honor counts for earned honors
7. Update streak counters
8. Add game to `recentGames` (keep last 20)
9. Check and award any new achievements (Phase 2)

---

## Migration Plan

### Fresh Start Approach
1. Create new KV key patterns (`player:*`, `players:*`)
2. Keep existing room keys working during transition
3. Old rooms continue to work with name-based system
4. New rooms use player profile references
5. Optionally clean up old unused KV entries after 30 days
