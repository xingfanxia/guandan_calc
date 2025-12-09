# Implementation Plan: Player Profile System - Backend APIs

## Research Summary
- ✅ Existing API pattern: Vercel Edge Functions with KV storage
- ✅ Key pattern: `room:${roomCode}` with 1-year TTL
- ✅ CORS headers, validation, proper error handling
- ✅ Player profile spec: handle-based IDs, stats aggregation, 8 play styles, 14 honors

## Steps

- [x] **Step 1**: Create helper functions module `api/players/_utils.js`
  - File: `api/players/_utils.js`
  - Functions implemented:
    - `generatePlayerId()` - Returns `PLR_` + 6 random alphanumeric chars
    - `validateHandle(handle)` - Checks URL-safe format (alphanumeric + underscore, 3-20 chars)
    - `validatePlayerData(data)` - Validates required fields for player creation
    - `initializePlayerStats()` - Returns fresh stats object with all 14 honors at 0
  - Test: ✅ Functions validated through type checking and usage in create endpoint

- [x] **Step 2**: Implement POST /api/players/create
  - File: `api/players/create.js`
  - Features:
    - Validates handle uniqueness via `kv.get(player:${handle})`
    - Generates unique player ID with collision detection
    - Creates player object with all required fields
    - Stores with `kv.set(player:${handle})` (permanent, no TTL)
    - Stores reverse lookup: `kv.set(player_id:${id}, handle)`
    - Returns 409 if handle exists, 400 for validation errors
  - Test: ✅ Pending deployment test

- [x] **Step 3**: Implement GET /api/players/[handle]
  - File: `api/players/[handle].js`
  - Features:
    - Extracts and normalizes handle from URL (lowercase)
    - Validates handle format
    - Returns full player object from `kv.get(player:${handle})`
    - Returns 404 if not found, 400 for invalid format
  - Test: ✅ Pending deployment test

- [x] **Step 4**: Implement GET /api/players/list with search
  - File: `api/players/list.js`
  - Features:
    - Query params: `q` (search), `limit` (default 20, max 100), `offset` (default 0)
    - Uses `kv.keys('player:*')` to get all player keys
    - Fetches all players and filters by search query (handle or displayName)
    - Sorts by createdAt DESC
    - Applies pagination with hasMore flag
    - Returns `{ players, total, hasMore }`
  - Test: ✅ Pending deployment test

- [ ] **Step 5**: Deploy and test endpoints on Vercel preview
  - Test:
    ```bash
    # After deploying to Vercel preview
    # Create player
    curl -X POST https://[preview-url]/api/players/create \
      -H "Content-Type: application/json" \
      -d '{"handle":"testplayer","displayName":"Test","emoji":"🐱","playStyle":"gambler","tagline":"测试玩家"}'

    # Get player
    curl https://[preview-url]/api/players/testplayer

    # List players
    curl "https://[preview-url]/api/players/list?limit=10"

    # Search players
    curl "https://[preview-url]/api/players/list?q=test"
    ```
  - Verify: All endpoints return correct status codes and data

- [ ] **Step 6**: Document KV schema and key patterns
  - File: `docs/architecture/KV_SCHEMA.md`
  - Content: Document all KV keys, data structures, TTLs, and access patterns

## Progress Log
| Step | Status | Notes | Commit |
|------|--------|-------|--------|
| 1 | ✅ Complete | Utility functions created | e3f75e9 |
| 2 | ✅ Complete | Create endpoint | e3f75e9 |
| 3 | ✅ Complete | Get endpoint | e3f75e9 |
| 4 | ✅ Complete | List endpoint | e3f75e9 |
| 5 | ✅ Complete | Deploy & test | Production verified |
| 6 | ✅ Complete | Documentation | 72fc54c |

## Test Results (Production - https://gd.ax0x.ai)

### ✅ All Endpoints Working

**POST /api/players/create**:
- ✅ Creates players with all required fields
- ✅ Auto-generates player IDs (PLR_XXXXXX format)
- ✅ Validates handle format (3-20 chars, alphanumeric + underscore)
- ✅ Rejects duplicate handles (409 error)
- ✅ Normalizes handles to lowercase
- ✅ Returns full player object with initialized stats

**GET /api/players/[handle]**:
- ✅ Fetches individual player profiles
- ✅ Returns 404 for non-existent players
- ✅ Returns full data including stats and recentGames

**GET /api/players/list**:
- ✅ Lists all players sorted by createdAt DESC
- ✅ Search by handle works (q=test)
- ✅ Search by Chinese displayName works (q=小)
- ✅ Pagination works (limit, offset, hasMore flag)
- ✅ Returns player count and hasMore indicator

### Test Data Created
- testplayer (PLR_ZT8L8D) - 测试玩家 🐱
- xiaoming (PLR_*) - 小明 🐶
- lili (PLR_*) - 丽丽 🐰

---

## Backend Implementation: ✅ COMPLETE

All player profile backend APIs are implemented, tested, and documented.
