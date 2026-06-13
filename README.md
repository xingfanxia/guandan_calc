# 掼蛋计分器 (Guandan Calculator) v10.0

A comprehensive web-based scoring and player tracking platform for Guandan (掼蛋), a popular Chinese climbing card game. Features persistent player profiles, real-time room sharing, achievement system, and complete game progression tracking.

[English](#english) | [中文](#中文)

## English

### Features

- **👤 Player Profile System** ⭐ **NEW in v10.0**
  - Persistent player identities with unique @handles
  - Career statistics tracking (sessions + individual rounds)
  - Time tracking: Total playtime, longest session, averages
  - All 16 honors synced to profiles automatically
  - 17 active achievement badges with auto-unlock system
  - Partner/rival relationship tracking with win rates
  - Recent rankings history (last 10 sessions)
  - Player browser with search and pagination
  - Community voting integration (MVP/burden votes)
  - Profile pages with 8 comprehensive stat sections

- **🏠 Room Browser** ⭐ **NEW in v10.0**
  - Browse all active and recent rooms
  - Filter rooms by player handle (@fufu)
  - Toggle between all rooms and favorites
  - Room metadata: players, status, teams, last updated
  - Click any room to join/view instantly
  - Automatic test player exclusion
  - Pagination support (20 rooms per page)
  - Relative time display (5分钟前, 3小时前)

- **🤝 Enhanced Partner/Rival Display** ⭐ **NEW in v10.0**
  - Show ALL partners and opponents (not just best/worst)
  - Sortable by win rate, games played, or total wins
  - Click any partner/rival to view their full profile
  - Win rate color coding (green ≥50%, red <50%)
  - Highlighted best/worst with fun Chinese labels
  - Smooth hover effects and transitions

- **🎮 Real-Time Room Sharing & Voting**
  - Create 6-digit room codes (e.g., `A1B2C3`) for live game sharing
  - Host mode: Full game control + auto-sync every 10 seconds + auth token protection
  - Viewer mode: Real-time spectating + anonymous voting for MVP/burden each round
  - Room favorites: ⭐ Mark important rooms for permanent storage (1-year default TTL)
  - Modern pill-style navigation across all pages

- **👥 Smart Player Management**
  - 8 customizable players with 77+ animal & food emoji avatars (no insects)
  - Profile integration: Search and add players by @handle
  - Bulk name input with space-separated format (`John Mike Sara Lisa`)
  - Quick start: Apply preset names with one click
  - Drag-and-drop team assignment supporting desktop and mobile touch
  - Smart reset: Preserve player setup while clearing game data
  
- **🎯 Game Scoring System**
  - Support for 4, 6, and 8 player modes
  - Drag-and-drop ranking with automatic upgrade calculation
  - Team level progression: 2→3→4→5→6→7→8→9→10→J→Q→K→A
  - A-level clear: teams must win on their own A round without last place; lenient mode only disables A-fail demotion
  - **Strict A failures**: 3 own-A failures (A1/A2/A3) → demote that team to level 2 across 4/6/8-player modes
  - 8-player sweep bonus: Top 4 positions = 4 level upgrade
  
- **🏆 Comprehensive Honor System** 
  - **16 full-session honors** with cultural references and whole-match algorithms, awarded after at least 5 rounds of evidence:
    - **吕布 / 阿斗**: dominance and burden scores across the full session
    - **石佛 / 团队中轴**: stability plus teammate-relative anchor impact
    - **波动王**: rank movement magnitude, range, and volatility across the full session
    - **节奏核心**: team-leading tempo pressure using teammate and opponent context
    - **奋斗王 / 逆转核心 / 燃尽王**: early-to-late trend arcs and comeback/burnout stories
    - **翻车王 / 赌徒 / 大满贯 / 连段王 / 保底核心 / 棋差一着 / 抗压王**: crash, extremes, coverage, top-half streak, no-last team safety net, repeated second, and pressure-rebound awards
  - **Clickable explanations**: Each honor shows detailed calculation and statistics
  - **Mode adaptive**: All algorithms properly scale for 4/6/8 player modes
  
- **🗳️ Community Voting System**
  - Anonymous viewer voting: Select MVP (最C) and burden (最闹) each round
  - Host confirmation: Review community votes and make final decisions
  - "人民的声音" panel: Track cumulative community MVP/burden recognition
  - Real-time voting: Host sees live vote counts with 1-second updates
  - Round-based organization: Separate voting for each completed game round
  - Voting results sync to player profiles automatically

- **📤 Advanced Export & Sharing**
  - Real-time room codes: 6-digit codes with favorite/browsing system
  - Room management: Favorite important rooms for permanent storage
  - Mobile PNG: 600px width with player stats + 16 honors + game history
  - Desktop PNG: Wide format (2200px) with complete data visualization
  - Static snapshots: URL-encoded data for permanent preservation
  - TXT/CSV export: Complete data analysis including honor calculations
  
- **🎨 Enhanced User Experience**
  - Modern ES6 modular architecture (20+ specialized modules)
  - Modern pill-style navigation tabs with smooth transitions
  - Player profile pages with comprehensive statistics
  - Collapsible player setup interface for reduced clutter
  - Optimized information hierarchy: setup → team status → ranking → results
  - Mobile-first drag & drop with long-press touch support
  - Clickable host banner for instant viewer link sharing  
  - Real-time voting updates and visual feedback systems
  - Complete UTF-8 Chinese character support with cultural gaming terminology

### Quick Start

**🚀 Solo Play:**
1. Visit the live app URL
2. Click **"Generate Players"** → **"Quick Start"** for instant setup
3. Drag players to assign teams (4 players per team)
4. Drag players to ranking positions after each round
5. Game auto-calculates and applies results
6. Continue until A-level victory and check honor rankings!

**👤 With Player Profiles (NEW):**
1. Navigate to **"👥 浏览玩家"** tab
2. Click **"创建新玩家"** to create your profile with @handle
3. In game, search and add players by @handle
4. Stats automatically sync after each A-level victory
5. View detailed profiles with career stats and achievements

**🏠 Room Browser (NEW):**
1. Navigate to **"🏠 浏览房间"** tab
2. Browse all active rooms or toggle to favorites
3. Filter by player handle (e.g., @fufu)
4. Click any room to join/view instantly
5. Favorite rooms you want to revisit

**📺 Multiplayer Room:**
1. **Host:** Click **"📺 创建房间"** → Get 6-digit code to share with friends
2. **Viewers:** Click **"🔗 加入房间"** → Enter code for real-time spectating
3. **Live Sync:** Viewers see host's game updates in real-time (every 5 seconds)
4. **One-Click Share:** Host clicks blue banner to copy viewer links instantly

**⚡ Bulk Name Setup:**
- Use space-separated names: `John Mike Sara Lisa Kate Tom Max Ben` (8-player mode)
- Quick start buttons provide example names for each mode (4/6/8 players)

### Game Rules Configuration

The calculator supports customizable scoring rules:
- **4-player mode**: Configure upgrade points for each ranking combination (1,2), (1,3), (1,4)
- **6/8-player mode**: Configure point thresholds for 1, 2, or 3 level upgrades based on score differences
- **A-level clear**: in both strict and lenient modes, teams must win on their own A round without last place
- **A-level failure**: in strict mode, 3 own-A failures (A1→A2→A3) reset that team to level 2 in every mode; lenient mode keeps teams at A without fail counters
- **Special bonuses**: 8-player sweep (positions 1,2,3,4) grants 4-level upgrade

### Browser Compatibility

- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+

## 中文

### 功能特点

- **👤 玩家档案系统** ⭐ **v10.0 新功能**
  - 永久玩家身份识别 (@用户名系统)
  - 职业生涯统计追踪（完整局数 + 单回合）
  - 时间追踪：总游戏时长、最长局、平均时长
  - 16项荣誉自动同步到档案
  - 17个活跃成就徽章自动解锁系统
  - 队友/对手关系追踪与胜率统计
  - 近期排名历史记录（最近10局）
  - 玩家浏览器：搜索与分页功能
  - 社区投票集成（MVP/闹王投票）
  - 档案页面：8大综合统计版块

- **🏠 房间浏览器** ⭐ **v10.0 新功能**
  - 浏览所有活跃和近期房间
  - 按玩家用户名筛选 (@fufu)
  - 全部房间/收藏房间切换
  - 房间元数据：玩家、状态、队伍、最后更新
  - 点击任意房间即可加入/观看
  - 自动过滤测试玩家
  - 分页支持（每页20个房间）
  - 相对时间显示（5分钟前、3小时前）

- **🤝 增强的队友对手显示** ⭐ **v10.0 新功能**
  - 显示所有队友和对手（不仅是最佳/最差）
  - 可按胜率、场次或胜场排序
  - 点击任意队友/对手查看完整档案
  - 胜率颜色编码（绿色 ≥50%，红色 <50%）
  - 最佳/最差队友特别标注（趣味中文标签）
  - 流畅的悬停效果和过渡动画

- **🎮 实时房间分享**
  - 创建6位房间代码（如：A1B2C3）进行实时游戏分享
  - 房主模式：完整游戏控制 + 自动同步（每10秒）
  - 观看模式：实时观看他人比赛进展（每5秒更新）
  - 安全认证：房主token保护，防止未授权控制
  - 现代化药丸式导航标签

- **👥 智能玩家管理**
  - 8个可自定义玩家，77+动物&食物表情头像（无虫类）
  - 档案集成：通过@用户名搜索添加玩家
  - 批量姓名输入：空格分隔格式（`小 超 豪 姐 哥 帆 夫 达`）
  - 快速开始：预设姓名一键应用
  - 拖放式团队分配，支持桌面和移动端触摸
  - 智能重置：保留玩家设置，清空比赛数据
  
- **🎯 游戏计分系统**
  - 支持4人、6人和8人模式
  - 拖放式排名系统，自动计算升级结果
  - 团队级别进程：2→3→4→5→6→7→8→9→10→J→Q→K→A
  - A级通关：必须在自己队A级胜利且胜方无末游；宽松模式只是不累计A失败
  - 8人横扫奖励：前4名位置 = 升4级
  
- **🏆 荣誉提名系统**
  - 基于整场趋势和全局分布的16项特殊荣誉：
    - 🥇 **吕布** / 😅 **阿斗**：全场统治力与全场低迷
    - 🗿 **石佛** / 🧭 **团队中轴**：稳定输出与强于队友均值的支点
    - 🌊 **波动王** / ⚡ **节奏核心**：全场波动与队伍领先节奏
    - 📈 **奋斗王** / 📈 **逆转核心** / 🔥 **燃尽王**：后程爬升、低谷翻盘和后程坠落
    - 🎪 **翻车王** / 🎲 **赌徒**：崩盘次数与极端名次组合
    - 👑 **大满贯** / 🔥 **连段王**：排名覆盖和上半区连段
    - 🛡️ **保底核心** / 🎯 **棋差一着** / 🧱 **抗压王**：不垫底且托住队友、无冠最强和低谷反弹
  - 可点击说明：每项荣誉显示详细计算和统计
  - 至少5局后才发放整场荣誉，避免小样本过早贴标签
  - 模式自适应：所有算法适配4/6/8人模式
  
- **📤 多格式导出分享**
  - 实时房间代码：6位代码即时分享观看
  - 静态快照：URL编码数据永久保存
  - 手机版PNG：600px宽度移动优化，大字体易读
  - 桌面版PNG：宽屏格式完整数据展示
  - TXT/CSV导出：数据分析和记录保存
  
- **🎨 用户体验优化**
  - 现代ES6模块化架构（20+专业模块）
  - 现代药丸式导航标签与流畅过渡
  - 玩家档案页面与综合统计数据
  - A级胜利庆祝动画和音效
  - 实时同步通知和视觉反馈
  - 可点击房主横幅快速分享观众链接
  - 响应式设计，完美适配手机和桌面
  - UTF-8完整中文字符支持

### 快速开始

**🚀 本地游戏：**
1. 访问线上应用
2. 点击 **"生成玩家"** → **"快速开始"** 即时设置
3. 拖拽玩家分配队伍（每队4人）
4. 拖拽玩家到排名位置，自动计算和应用结果
5. 继续游戏直到A级胜利，查看荣誉提名！

**👤 使用玩家档案（新功能）：**
1. 导航至 **"👥 浏览玩家"** 标签
2. 点击 **"创建新玩家"** 创建 @用户名 档案
3. 在游戏中，通过 @用户名 搜索添加玩家
4. A级胜利后统计数据自动同步
5. 查看详细档案和职业生涯统计

**🏠 房间浏览器（新功能）：**
1. 导航至 **"🏠 浏览房间"** 标签
2. 浏览所有活跃房间或切换到收藏
3. 按玩家用户名筛选（例如：@fufu）
4. 点击任意房间即可加入/观看
5. 收藏想要重访的房间

**📺 多人房间：**
1. **房主**：点击 **"📺 创建房间"** → 获得6位代码分享给朋友
2. **观众**：点击 **"🔗 加入房间"** → 输入代码实时观看  
3. **实时同步**：观众看到房主游戏的实时更新（每5秒）
4. **一键分享**：房主点击蓝色横幅即可复制观众链接

**⚡ 批量设置：**
- 使用空格分隔姓名输入：`豪 姐 哥 帆 夫 塔`（6人模式）
- 各模式都有快速开始按钮提供示例姓名

### 游戏规则配置

计算器支持自定义计分规则：
- **4人模式**：配置排名组合升级分数，如(1,2)、(1,3)、(1,4)对应的升级级数
- **6/8人模式**：基于分差配置升1、2或3级的分数阈值
- **A级通关**：严格和宽松模式都必须在自己的A级获胜且胜方无末游；严格模式三次A失败退回2，宽松模式不累计失败
- **特殊奖励**：8人横扫（占据1,2,3,4名位置）可获得4级升级

### 浏览器兼容性

- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+

## Technical Architecture

### Frontend Technology
- **Modern ES6 Modules**: 20+ specialized modules with clean dependencies
- **Vite Build System**: Fast development server and optimized production builds
- **Vanilla JavaScript**: No framework dependencies, pure web standards
- **UTF-8 Support**: Complete Chinese character processing throughout
- **Modern UI**: Pill-style navigation tabs with smooth transitions

### Player Profile System (v10.0)
- **Backend APIs**: 7 Edge Functions for profile CRUD operations
- **KV Storage**: Persistent player data with Vercel KV (Upstash Redis)
- **Auto-Sync**: Stats sync automatically after A-level victories
- **Dual Metrics**: Session-level + round-level statistics
- **Social Tracking**: Partner/rival relationships with win rates
- **Achievement System**: 17 active badges with auto-unlock logic

### Real-Time Backend Infrastructure
- **Vercel KV (Upstash Redis)**: Ultra-fast room data storage (<1ms reads)
- **Edge Functions**: Serverless API routes for global room management
- **Auto-Synchronization**: Host games sync automatically every 10 seconds
- **Live Polling**: Viewers poll for updates every 5 seconds with smart change detection
- **TTL Management**: Automatic 24-hour room expiration and cleanup
- **Room Index**: Global index for room browsing (last 100 rooms)

### Data Flow Architecture
1. **Room Creation**: `POST /api/rooms/create` → Generate 6-digit code → Store in KV
2. **Game Updates**: Host actions → Auto-sync to KV → `PUT /api/rooms/{code}`
3. **Live Viewing**: Viewers poll → `GET /api/rooms/{code}` → Update UI when changed
4. **Profile Sync**: A-level victory → `PUT /api/players/{handle}` → Update career stats
5. **Data Persistence**: LocalStorage for individual users + KV for shared rooms + profiles

### Performance Metrics
- **Sub-second sync**: Real-time game state updates
- **Global CDN**: Vercel edge network for worldwide low-latency access
- **Smart polling**: UI updates only when data actually changes
- **Optimized builds**: Vite bundling and minification for production
- **Token efficiency**: 58K → 3K tokens with player profile system

## License

MIT License - see [LICENSE](LICENSE) file for details

## Contributing

Contributions are welcome! Please feel free to submit issues or pull requests.

**Visual testing:** `npm run test:visual` is the LOCAL pixel gate — 21 baseline PNGs (4 pages × light/dark × mobile/desktop + canvas PNG exports) under `docs/reports/redesign/` + `docs/reports/png-export/`. CI (`visual-regression.yml`) runs the capture suite + a 14-assertion theme-toggle smoke as a structural check (zero page errors, full PNG set) — pixel comparison is local-only because the system-font stack renders differently across OSes. See [docs/guides/DEVELOPMENT_METHODOLOGY.md](docs/guides/DEVELOPMENT_METHODOLOGY.md#testing-methodology).

## Author

Created with ❤️ for Guandan players worldwide

---

*Note: Guandan (掼蛋) is a climbing card game popular in Jiangsu and Anhui provinces of China. This calculator helps manage the complex scoring and level progression system of the game.*
