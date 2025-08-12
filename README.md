# 掼蛋计分器 (Guandan Calculator)

A comprehensive web-based scoring calculator for Guandan (掼蛋), a popular Chinese climbing card game. This single-page application helps track team scores, player rankings, and level progression throughout the game.

[English](#english) | [中文](#中文)

## English

### Features

- **Player Management System**
  - 8 customizable players with animal emoji avatars
  - Drag-and-drop team assignment
  - Editable player names
  
- **Game Scoring**
  - Support for 4, 6, and 8 player modes
  - Drag-and-drop ranking system for game results
  - Automatic score calculation based on player positions
  - Team-based level progression (2→3→4→5→6→7→8→9→10→J→Q→K→A)
  
- **Special Rules**
  - A-level victory conditions (strict/lenient modes)
  - A-level failure tracking (reset to level 2 after 3 failures)
  - 8-player sweep bonus (1,2,3,4 positions = 4 level upgrade)
  - "Must have first place" option for upgrades
  
- **Statistics & Analytics**
  - Player performance tracking (average ranking, first/last place counts)
  - Team MVP and burden identification
  - Color-coded game history by winning team
  - Detailed round-by-round progression tracking
  
- **Export Options**
  - Text export for sharing
  - CSV export for data analysis
  - PNG export for visual records
  - All exports include complete player ranking details
  
- **User Experience**
  - Celebration modal for A-level victories
  - Visual team indicators throughout
  - Persistent game state (survives page refresh)
  - Responsive design for various screen sizes

### Quick Start

1. Open `guodan_calc.html` in any modern web browser
2. Click "生成玩家" to generate 8 random players
3. Drag players to assign them to teams (4 players per team)
4. Select game mode (4, 6, or 8 players)
5. After each round, drag players to their ranking positions
6. Click "应用结果" to record the round
7. Continue until a team wins at A-level!

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

## Technical Details

- **Technology**: Pure HTML5, CSS3, and JavaScript (no external dependencies)
- **Storage**: LocalStorage for game state persistence
- **Canvas API**: Used for PNG export generation
- **Drag and Drop API**: HTML5 native drag and drop for intuitive UI

## License

MIT License - see [LICENSE](LICENSE) file for details

## Contributing

Contributions are welcome! Please feel free to submit issues or pull requests.

## Author

Created with ❤️ for Guandan players worldwide

---

*Note: Guandan (掼蛋) is a climbing card game popular in Jiangsu and Anhui provinces of China. This calculator helps manage the complex scoring and level progression system of the game.*