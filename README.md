# 掼蛋计分器 (Guandan Calculator)

A comprehensive web-based scoring calculator for Guandan (掼蛋), a popular Chinese climbing card game. Features real-time room sharing, player management, and complete game progression tracking.

[English](#english) | [中文](#中文)

## English

### Features

- **🎮 Real-Time Room Sharing** ⭐ **NEW**
  - Create shareable room codes (e.g., `ROOM-A1B2`)
  - Live game viewing for remote players
  - Auto-sync every 10 seconds for hosts
  - Real-time updates every 5 seconds for viewers
  - 24-hour room persistence with Vercel KV

- **👥 Player Management System**
  - 8 customizable players with animal & food emoji avatars
  - Drag-and-drop team assignment
  - Bulk name input with space-separated format
  - Quick start with preset names
  
- **🎯 Game Scoring**
  - Support for 4, 6, and 8 player modes
  - Drag-and-drop ranking system for game results
  - Automatic score calculation based on player positions
  - Team-based level progression (2→3→4→5→6→7→8→9→10→J→Q→K→A)
  
- **⚖️ Special Rules**
  - A-level victory conditions (strict/lenient modes)
  - A-level failure tracking (reset to level 2 after 3 failures)
  - 8-player sweep bonus (1,2,3,4 positions = 4 level upgrade)
  - "Must have first place" option for upgrades
  
- **📊 Statistics & Analytics**
  - Player performance tracking (average ranking, first/last place counts)
  - Team MVP and burden identification
  - Color-coded game history by winning team
  - Detailed round-by-round progression tracking
  
- **📤 Export & Sharing**
  - Real-time room codes for live viewing
  - Static snapshot URLs for data sharing
  - Text export for sharing
  - CSV export for data analysis
  - PNG export for visual records
  
- **🎨 User Experience**
  - Modern modular ES6 architecture
  - Celebration modal for A-level victories
  - Visual team indicators throughout
  - Persistent game state (survives page refresh)
  - Mobile-optimized touch controls
  - Smart reset (preserves player setup)

### Quick Start

**🚀 Solo Play:**
1. Visit the live app URL
2. Click **"生成玩家"** → **"快速开始"** for instant setup
3. Drag players to assign teams (4 players per team)
4. Drag players to ranking positions after each round
5. Game auto-calculates and applies results
6. Continue until A-level victory!

**📺 Multiplayer Room (NEW):**
1. **Host:** Click **"📺 创建房间"** → Share room code with friends
2. **Viewers:** Click **"🔗 加入房间"** → Enter room code  
3. **Live Sync:** Viewers see real-time game updates as host plays
4. **Auto-Updates:** Game state syncs automatically every 10 seconds

**⚡ Bulk Name Entry:**
- Use space-separated names: `小 超 豪 姐 哥 帆 夫 达`
- Quick start buttons provide example names for each mode

### Game Rules Configuration

The calculator supports customizable scoring rules:
- **4-player mode**: Configure points for each ranking combination
- **6/8-player mode**: Configure point thresholds for 1, 2, or 3 level upgrades
- **A-level rules**: Choose between strict (must win at own A-level) or lenient (can win at any level)

### Browser Compatibility

- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+

## 中文

### 功能特点

- **玩家管理系统**
  - 8个可自定义的玩家，带动物表情符号头像
  - 拖放式团队分配
  - 可编辑的玩家名称
  
- **游戏计分**
  - 支持4人、6人和8人模式
  - 拖放式排名系统记录游戏结果
  - 根据玩家位置自动计算分数
  - 基于团队的级别进程（2→3→4→5→6→7→8→9→10→J→Q→K→A）
  
- **特殊规则**
  - A级胜利条件（严格/宽松模式）
  - A级失败跟踪（3次失败后重置到2级）
  - 8人横扫奖励（占据1,2,3,4名 = 升4级）
  - "必须有第一名"升级选项
  
- **统计分析**
  - 玩家表现跟踪（平均排名、第一/最后名次数）
  - 团队MVP和拖累识别
  - 按获胜团队颜色编码的游戏历史
  - 详细的逐轮进程跟踪
  
- **导出选项**
  - 文本导出用于分享
  - CSV导出用于数据分析
  - PNG导出用于可视化记录
  - 所有导出都包含完整的玩家排名详情
  
- **用户体验**
  - A级胜利庆祝弹窗
  - 全程可视化团队指示器
  - 持久游戏状态（刷新页面后保留）
  - 响应式设计适配各种屏幕尺寸

### 快速开始

1. 在任何现代浏览器中打开 `guodan_calc.html`
2. 点击"生成玩家"生成8个随机玩家
3. 拖动玩家分配到团队（每队4人）
4. 选择游戏模式（4人、6人或8人）
5. 每轮结束后，拖动玩家到他们的排名位置
6. 点击"应用结果"记录该轮
7. 继续直到某队在A级获胜！

### 游戏规则配置

计算器支持自定义计分规则：
- **4人模式**：配置每个排名组合的分数
- **6/8人模式**：配置升1、2或3级的分数阈值
- **A级规则**：选择严格（必须在自己的A级获胜）或宽松（可以在任何级别获胜）

### 浏览器兼容性

- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+

## Technical Architecture

### Frontend
- **Modern ES6 Modules**: Modular architecture with 12+ specialized modules
- **Vite Build System**: Fast development and optimized production builds
- **Vanilla JavaScript**: No framework dependencies, pure web standards
- **UTF-8 Support**: Full Chinese character support throughout

### Real-Time Backend
- **Vercel KV (Upstash Redis)**: Ultra-fast room data storage (<1ms reads)
- **Edge Functions**: Serverless API routes for room management
- **Auto-Sync**: Host games sync every 10 seconds automatically  
- **Live Polling**: Viewers poll for updates every 5 seconds
- **TTL Management**: Rooms auto-expire after 24 hours

### Data Flow
1. **Room Creation**: `POST /api/rooms/create` → Generate `ROOM-XXXX` code → Store in KV
2. **Game Updates**: Host plays → Auto-sync to KV → `PUT /api/rooms/{code}`
3. **Live Viewing**: Viewers poll → `GET /api/rooms/{code}` → Update UI if changed
4. **Persistence**: LocalStorage for individual users + KV for shared rooms

### Performance
- **Sub-second sync**: Real-time game state updates
- **Global CDN**: Vercel edge network for worldwide access
- **Efficient polling**: Only updates UI when data actually changes
- **Optimized builds**: Vite bundles and minifies for production

## License

MIT License - see [LICENSE](LICENSE) file for details

## Contributing

Contributions are welcome! Please feel free to submit issues or pull requests.

## Author

Created with ❤️ for Guandan players worldwide

---

*Note: Guandan (掼蛋) is a climbing card game popular in Jiangsu and Anhui provinces of China. This calculator helps manage the complex scoring and level progression system of the game.*