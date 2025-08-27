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

- **🎮 实时房间分享** ⭐ **全新功能**
  - 创建6位房间代码（如：A1B2C3）进行实时游戏分享
  - 房主模式：完整游戏控制 + 自动同步（每10秒）
  - 观看模式：实时观看他人比赛进展（每5秒更新）
  - 安全认证：房主token保护，防止未授权控制
  - 24小时房间持续时间，支持全球访问

- **👥 智能玩家管理**
  - 8个可自定义玩家，77+动物&食物表情头像（无虫类）
  - 批量姓名输入：空格分隔格式（`小 超 豪 姐 哥 帆 夫 达`）
  - 快速开始：预设姓名一键应用
  - 拖放式团队分配，支持桌面和移动端触摸
  - 智能重置：保留玩家设置，清空比赛数据
  
- **🎯 游戏计分系统**
  - 支持4人、6人和8人模式
  - 拖放式排名系统，自动计算升级结果
  - 团队级别进程：2→3→4→5→6→7→8→9→10→J→Q→K→A
  - A级规则：严格模式（必须自己A级获胜）vs 宽松模式
  - 8人横扫奖励：前4名位置 = 升4级
  
- **🏆 荣誉提名系统**
  - 基于真实数据的6个特殊荣誉：
    - 🥇 **吕布**：最多第一名（传说战力）
    - 😅 **阿斗**：最多垫底（需要保护）  
    - 🗿 **石佛**：排名最稳定（稳如磐石）
    - 🌊 **波动王**：排名波动最大（不可预测）
    - 📈 **奋斗王**：排名稳步提升（越战越勇）
    - 🛡️ **辅助王**：团队胜利时自己垫底最多（无私奉献）
  - 团队荣誉：很C（最强）和很闹（最弱）识别
  - 方差分析和趋势检测算法
  
- **📤 多格式导出分享**
  - 实时房间代码：6位代码即时分享观看
  - 静态快照：URL编码数据永久保存
  - 手机版PNG：600px宽度移动优化，大字体易读
  - 桌面版PNG：宽屏格式完整数据展示
  - TXT/CSV导出：数据分析和记录保存
  
- **🎨 用户体验优化**
  - 现代ES6模块化架构，快速响应
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

**📺 多人房间（全新）：**
1. **房主**：点击 **"📺 创建房间"** → 获得6位代码分享给朋友
2. **观众**：点击 **"🔗 加入房间"** → 输入代码实时观看  
3. **实时同步**：观众看到房主游戏的实时更新（每5秒）
4. **一键分享**：房主点击蓝色横幅即可复制观众链接

**⚡ 批量设置：**
- 使用空格分隔姓名输入：`豪 姐 哥 帆 夫 塔`（6人模式）
- 各模式都有快速开始按钮提供示例姓名

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

### 数据流程
1. **房间创建**: `POST /api/rooms/create` → 生成6位代码 → 存储到KV
2. **游戏更新**: 房主操作 → 自动同步到KV → `PUT /api/rooms/{code}`
3. **实时观看**: 观众轮询 → `GET /api/rooms/{code}` → 检测变化时更新UI
4. **数据持久**: 本地存储个人数据 + KV存储共享房间

### 性能表现
- **亚秒同步**: 实时游戏状态更新
- **全球CDN**: Vercel边缘网络支持全球访问
- **智能轮询**: 仅在数据实际变化时更新UI
- **优化构建**: Vite打包和压缩优化

## License

MIT License - see [LICENSE](LICENSE) file for details

## Contributing

Contributions are welcome! Please feel free to submit issues or pull requests.

## Author

Created with ❤️ for Guandan players worldwide

---

*Note: Guandan (掼蛋) is a climbing card game popular in Jiangsu and Anhui provinces of China. This calculator helps manage the complex scoring and level progression system of the game.*