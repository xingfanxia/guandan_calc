# DESIGN.md — 闹掼计分器 web 版设计系统

> 2026-06-12 定稿。Ported from sibling repo `guandan-scorer-wxapp/DESIGN.md` (单一上游事实源)；
> 本文件是 web 版的落地适配。**所有 UI 改动以此为准；偏离需用户批准。**
> 方向：**简洁大方、可读性优先、不保留旧 5 主题美学、light + dark 双模式。**

## 0. 定位

- **主体**：线下掼蛋牌局的计分记录工具。手机平放在牌桌上/递着看；web 版兼任房间围观、玩家档案、战绩导出。
- **受众**：牌友局，年龄跨度大（含中老年）——字号、对比度、点按目标全部按"隔着桌子瞟一眼能读"设计。
- **三原则**：① 大字优先（数据 > 装饰）；② 一屏一主角（每屏只有一个视觉重心）；③ 牌桌行话做文案（打A/双上/末游，不说系统话）。
- **移动优先**：所有页面按 390px 宽设计验收；桌面是放宽（同一列加宽），不是另一套布局。

## 1. 双模式架构（实现规约）

- 内容色走 CSS 自定义属性：`:root { --token: ... }` 定义 **light** 值；
  `:root[data-theme="dark"] { --token: ... }` 覆盖 dark 值。
- 每个入口 HTML（index / players / rooms / player-profile）带内联 bootstrap `<script>`（在所有样式表之前）：
  读 `localStorage.gd_v9_theme`（`'light' | 'dark'`），缺省跟随 `prefers-color-scheme`，同步设置 `data-theme`。
- 手动切换：`src/ui/themeToggle.js` 挂在顶栏；切换持久化到 `gd_v9_theme` 并 emit `theme:changed`。
- **铁律**：组件 CSS 只许引用语义 token（`var(--ink)`），禁止硬编码色值。
  唯一文档化例外：canvas PNG 导出经 `src/styles/themePalette.js` 在运行时读 computed token（非硬编码）。
- Token 名契约沿用 `src/styles/tokenSpec.js`（TOKEN_SPEC）——既有模块全部引用这些名字，不动。

## 2. 色板

基调取自牌桌呢绒的深绿——做品牌色而非背景色，surfaces 保持中性偏冷灰绿调
（拒绝米黄+赤陶土、拒绝纯黑纯白、拒绝 #0D1117+霓虹的三套 AI 默认审美）。

### 基础色板（hex，light / dark 各一套）

| Token | Light | Dark | 用途 |
|---|---|---|---|
| `--bg` | `#F4F6F3` | `#111613` | 页面底（off-white / 带绿调 off-black） |
| `--bg-deep` | `#ECEFEA` | `#0C100D` | 输入框底、下沉区域 |
| `--surface` | `#FFFFFF` | `#1A201C` | 卡片/面板 |
| `--surface-2` | `#ECEFEA` | `#242B26` | 次级面板、seg 控件底 |
| `--surface-3` | `#E2E6E0` | `#2E372F` | hover 态 |
| `--ink` | `#1B221E` | `#F0F3EF` | 主文字（对 bg 对比度 ≥ 12:1） |
| `--ink-dim` | `#5A655E` | `#9AA69E` | 次要文字（≥ 4.5:1） |
| `--ink-dimmer` | `#8A948D` | `#6E7A72` | 弱辅助文字 |
| `--rule` | `rgba(27,34,30,.12)` | `rgba(240,243,239,.14)` | 1px hairline 分隔线/描边 |
| `--rule-soft` | `rgba(27,34,30,.07)` | `rgba(240,243,239,.08)` | 更弱分隔 |
| `--accent` | `#15694B` | `#46B98D` | 品牌呢绒绿：主按钮、激活态、roundOwner 标记 |
| `--accent-pressed` | `#0F523A` | `#37A179` | 按压态 |
| `--on-accent` | `#FFFFFF` | `#0E1411` | accent 上的文字 |
| `--accent-soft` | `rgba(21,105,75,.10)` | `rgba(70,185,141,.14)` | accent 弱底 |
| `--team-blue` | `#2A5DB0` | `#7CACFF` | 蓝队 (t1) |
| `--team-red` | `#B6403B` | `#FF8077` | 红队 (t2) |
| `--team-*-soft` | 12% alpha | 16% alpha | chip 选中底 |
| `--gold-a` | `#A37412` | `#E5B254` | A 级/通关时刻专用鎏金 |
| `--danger` | `#B6403B` | `#FF8077` | 破坏性操作（与 team-red 同值不同语义） |
| `--win` | = `--accent` | = `--accent` | 胜利语义 |
| `--loss` | = `--danger` | = `--danger` | 失败语义 |

规则：状态色从 `--accent`/`--gold-a`/`--danger` 派生，不再引入新色相。整页同一基调。

## 3. 字体与字阶

系统字栈（与 wxapp 一致——把约束做成风格：**字重与字号的极端对比**造个性，不靠字族；
不加载任何网络字体）：

```
--font-body / --font-display:
  -apple-system, "PingFang SC", "HarmonyOS Sans SC", "MiSans", "Microsoft YaHei", sans-serif;
--font-mono: ui-monospace, "SF Mono", Menlo, monospace;   /* 房间码等少量等宽场景 */
```

| 用途 | 字号/行高 | 字重 |
|---|---|---|
| **级牌大字**（签名元素，只在记分牌出现） | 72px / 1.0（≥768px 视口 96px） | 800 |
| 升级预览数字、结算数字 | 32px / 1.1 | 700 |
| 页面/卡片标题 | 20px / 1.3 | 600 |
| 正文（默认体） | 16px / 1.6 | 400 |
| eyebrow/标签 | 13px / 1.4，`letter-spacing: 1px` | 500 |
| 下限 | 12px | — |

- 所有数据数字：`font-variant-numeric: tabular-nums`（记分对齐）。
- 级牌字符集只有 `2-10 J Q K A`，w800 系统黑体直接渲染。

## 4. 空间 / 形状 / 层次

- **间距**：8px 网格 → token `--s1..--s8 = 4/8/12/16/24/32/48/64`；页面左右 gutter 16px。
- **容器**：主列 max-width 760px 居中（index / player-profile）；列表页（players / rooms）960px。
- **圆角**：卡片 `--radius-lg` 10px、控件 `--radius-md` 8px、玩家 chip 999px（胶囊）。
- **层次靠 hairline 不靠阴影**（dark 模式阴影失效）：卡片 = `--surface` + 1px `--rule` 描边；
  唯一允许的阴影在底部悬浮操作栏（`0 -4px 24px rgba(0,0,0,.08)`）。
- **点按目标**：最小 44px 高；操作栏主按钮 48px；相邻可点元素间距 ≥ 8px。

## 5. 签名元素 — 级牌记分牌

页面上半屏的双级牌大字是整个产品的识别物（纯文字，零牌面图形）：

```
┌─────────────────────────────────┐
│  本局打 10 · 蓝队的级 · 第4局   ← eyebrow（13px label，--accent）
│                                 │
│   蓝队            红队          │
│    10      ：      8            │ ← 72-96px 大字，各队 --team-* 色
│   ‾‾‾‾                          │   roundOwner 一侧 3px --accent 底线
│   A失败 1/3        —            │ ← strictA 模式才显示（label 字号）
└─────────────────────────────────┘
```

- 打到 A：该队级牌换 `--gold-a`；eyebrow 变「冲A · 自己的A级才能通关」。
- 通关时刻：victory modal 是全 app 唯一的大动效场合，`--gold-a` 主导。

## 6. 组件规范

- **主按钮**（应用结果/创建房间）：`--accent` 底 + `--on-accent` 字 17px w600，48px 高；
  按压/hover `--accent-pressed`。**一屏最多一个**。
- **次按钮**：transparent 底 + 1px `--rule` + `--ink` 字。破坏性（重置/删玩家）用 `--danger` 字色，必走确认。
- **玩家 chip**：胶囊形，emoji/头像 + 昵称 + 队色规则——已排名 = 队色 12% 透明底 + 队色描边 + 名次角标。
- **排名录入**：名次槽位横排（1..N），**点玩家 chip 填入下一空槽；点已排名 chip 取消该名次**
  （拖拽仍可用，但点选是主交互）。错误即时提示在槽位下方。
- **升级预览条**：录满名次自动出现——`双上 · 升 3 级 → 打 K`（32px 数字 + 行话），是"应用结果"的前置确认。
- **历史行**：`第 4 局 · 蓝队 双上 +3 → 打K`，左缘 4px 队色条；下行完整排名 `1.🐸名 2.🍎名 …`。
- **空态**：一句行动指引（"加 4 个玩家就能开局"），不放插画。
- **seg 控件**（人数/筛选）：`--surface-2` 槽 + 激活项 `--surface` 浮起 + hairline。
- **底部操作栏**（mobile）：fixed，`--surface` 底 + hairline 顶边 + 唯一阴影；撤销/重置 ghost + 应用结果 primary。

## 7. 动效（克制到只剩一个时刻）

- **唯一编排动效**：应用结果后级牌数字翻新（240ms ease-out translateY+opacity）；通关时 `--gold-a` + 放大 1.06 一次。
- 其余只有按压/hover 反馈（opacity/background，100ms）。**只动 transform/opacity/background**。
- 不做进场动画、不做滚动驱动、不做骨架屏闪光。`prefers-reduced-motion` 全部归零。

## 8. 文案声音

- 牌桌行话：双上 / 末游 / 打A / 通关 / 自己的A级；不说"提交""操作成功"。
- 按钮说结果：「应用结果」→ toast「已记一局，打K」；同一动作全程同名。
- 错误给出路不道歉：「名次不能重复，改一下再应用」。
- 全部 sentence 式，不堆叹号 emoji；去掉旧版的装饰性英文 meta 标签（"DRAG TO PLACE" 之类）。

## 9. Token 落地文件

- `src/styles/tokens.css` —— 本文件 §2-§4 的唯一实现处；所有入口 HTML 第一个样式表。
- `src/styles/tokenSpec.js` —— token 名契约 + `verifyTokensPresent()`（沿用原 `_shared/tokenSpec.js`）。
- `src/styles/themePalette.js` —— canvas 导出的运行时 token 读取器（文档化例外）。
- `src/style.css` —— 全部组件样式的唯一实现处（4 页共用），只引用 token。
- 验收：grep `src/style.css` 之外的页面/组件代码，出现 `#` 色值即违规
  （只允许出现在 tokens.css + themePalette.js fallback）。

## 10. 历史

- 2026-06-12 之前：5 主题系统（broadcast/linear/trading/atelier/teatable，12,759 行 theme CSS）。
  已整体移除，由本设计系统替代。旧文档 `docs/design/THEME-ARCHITECTURE.md` 仅作历史参考。
