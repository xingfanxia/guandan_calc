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
| 1 | ✅ Complete | Utility functions created | |
| 2 | ✅ Complete | Create endpoint | |
| 3 | ✅ Complete | Get endpoint | |
| 4 | ✅ Complete | List endpoint | |
| 5 | ⏸️ Pending | Deploy & test | Ready for user deployment |
| 6 | Pending | Documentation | After testing |

## Implementation Notes
- All API endpoints follow existing pattern from `api/rooms/[code].js`
- Player handles normalized to lowercase for case-insensitive lookups
- No authentication in MVP - relying on handle uniqueness
- Player data stored permanently (no TTL), unlike rooms (1-year TTL)
- Using Vercel KV directly, no separate database layer
- CORS headers included for cross-origin requests

## Next Steps
1. **User Action Required**: Deploy to Vercel preview to test with real KV storage
2. After successful test: Document KV schema
3. Then proceed with frontend integration (player selection in game setup)
