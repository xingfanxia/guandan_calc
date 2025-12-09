# 技术架构文档 (Technical Architecture)

## 🏗️ 系统架构概览

### 前端架构 (Frontend Architecture)

```
src/
├── main.js                    # 主应用协调器
├── utils/                     # 工具函数模块
│   ├── constants.js           # 常量配置（表情、默认设置、房间代码）
│   ├── dom.js                 # DOM 操作工具
│   └── storage.js             # LocalStorage 管理
├── core/                      # 核心游戏逻辑
│   ├── gameState.js           # 游戏状态管理（单例模式）
│   └── gameRules.js           # 游戏规则引擎
├── players/                   # 玩家系统
│   ├── playerSystem.js        # 玩家管理、拖拽逻辑
│   └── touchHandlers.js       # 移动端触摸交互
├── ui/                        # 用户界面
│   ├── renderer.js            # UI渲染管理
│   └── victoryModal.js        # 胜利庆祝系统
├── statistics/                # 数据统计
│   └── statsManager.js        # 统计和历史记录
├── export/                    # 导出功能
│   └── exportManager.js       # TXT/CSV/PNG导出
└── share/                     # 分享功能
    ├── shareManager.js        # 静态快照分享
    └── roomManager.js         # 实时房间管理
```

### 后端架构 (Backend Architecture)

```
api/
└── rooms/
    ├── create.js              # 创建房间 API
    └── [code].js              # 房间数据 GET/PUT API

Vercel KV (Upstash Redis)
├── room:{CODE} → 游戏数据 (TTL: 24h)
├── 键值对存储结构
└── 全球边缘网络分布
```

## 🔄 数据流图 (Data Flow)

### 房间创建与同步
```
主持人操作游戏
    ↓
本地状态更新 (gameState)
    ↓
自动同步触发 (10秒 + 重要操作)
    ↓
PUT /api/rooms/{code}
    ↓
Vercel Edge Function
    ↓
Upstash Redis 存储
    ↓
全球 CDN 分发
```

### 观看者实时更新
```
观看者轮询 (每5秒)
    ↓
GET /api/rooms/{code}
    ↓
比较 lastUpdated 时间戳
    ↓
如有更新 → 刷新UI + 显示通知
    ↓
继续轮询循环
```

## 📊 数据结构

### 房间数据格式
```javascript
{
  // 游戏设置
  settings: {
    t1: {name: "蓝队", color: "#3b82f6"},
    t2: {name: "红队", color: "#ef4444"},
    strictA: true,
    autoNext: true,
    autoApply: true
  },
  
  // 游戏状态  
  state: {
    t1: {lvl: "K", aFail: 1},
    t2: {lvl: "A", aFail: 0},
    roundLevel: "A",
    nextRoundBase: null,
    roundOwner: "t2",
    hist: [/* 历史记录数组 */]
  },
  
  // 玩家信息
  players: [
    {id: 1, name: "超", emoji: "🐶", team: 1},
    {id: 2, name: "豪", emoji: "🍎", team: 1}
    // ...
  ],
  
  // 统计数据
  playerStats: {
    "1": {games: 5, totalRank: 15, firstPlaceCount: 2}
    // ...
  },
  
  // 当前排名
  currentRanking: {
    "1": 3,  // 第1名是玩家ID 3
    "2": 1   // 第2名是玩家ID 1
  },
  
  // 元数据
  roomCode: "ROOM-A1B2",
  createdAt: "2025-08-27T10:30:00.000Z",
  lastUpdated: "2025-08-27T10:35:00.000Z",
  version: "v9.0"
}
```

## ⚡ 性能优化

### 前端优化
- **模块化加载**: ES6模块按需加载
- **事件委托**: 减少事件监听器数量
- **防抖更新**: 玩家名称输入使用300ms防抖
- **条件渲染**: 只在数据变化时更新UI

### 后端优化
- **Edge Functions**: 全球边缘节点执行，低延迟
- **Redis缓存**: 亚毫秒级读取性能
- **智能轮询**: 只有数据变化时才更新前端
- **TTL管理**: 自动清理过期数据，节省存储

### 网络优化
- **CORS配置**: 支持跨域访问
- **JSON压缩**: 最小化传输数据量
- **时间戳比较**: 避免不必要的数据传输
- **错误重试**: 网络故障时自动重试

## 🔒 安全考虑

### 数据安全
- **房间隔离**: 每个房间独立命名空间
- **随机代码**: 4位随机字符，36^4 = 1.6M 组合
- **自动过期**: 24小时TTL防止数据泄露
- **只读模式**: 观看者无写入权限

### API安全
- **输入验证**: 所有API输入严格验证
- **错误处理**: 不暴露内部错误信息  
- **速率限制**: Vercel自动提供DDoS保护
- **环境隔离**: 生产/开发环境完全分离

## 🚀 部署架构

### 生产环境
```
用户浏览器
    ↓
Vercel Edge Network (全球CDN)
    ↓
静态文件服务 (HTML/CSS/JS)
+
Edge Functions (API路由)
    ↓
Upstash Redis (全球分布式)
```

### 开发环境
```
localhost:3000 (Vite开发服务器)
    ↓
本地模块热重载
+
Vercel dev (API函数模拟)
    ↓
相同的 Upstash Redis 实例
```

## 📈 扩展性考虑

### 当前限制
- **免费套餐**: 10K请求/天，约支持50个并发房间
- **房间大小**: 每个房间5-50KB，取决于游戏历史长度
- **并发观看**: 理论无限，受Redis连接池限制

### 扩展方案
- **付费套餐**: 100K请求/天支持500+并发房间
- **WebSocket**: 未来可升级为真正的实时推送
- **房间分片**: 大型比赛可使用多个房间
- **缓存层**: 添加Edge Config缓存频繁访问的房间