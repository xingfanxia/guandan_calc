# Web 旧天梯冻结记录（2026-08-10）

## 结论

按 D5 决策，网页端旧天梯自 2026-08-10 起冻结。网页战绩继续累计，
但 `stats.ladder.rating/peak/sessions` 和 `stats.ladderHistory` 不再由任何
直接写入或审核回放路径修改。小程序两级 PL 天梯是后续唯一权威评分，
不会继承或继续累加网页旧分。

## 边界

- 玩家列表与档案页明确展示“旧版网页天梯已停更、与小程序不互通”。
- 新 pending 记录不再保存 `ladderDelta`。
- 历史 pending 即使仍含 `ladderDelta`，审核回放也会忽略它。
- 房间仍存活、房间已过期、重复提交三条路径都只更新普通战绩。
- 旧天梯纯函数保留，供历史数据解释和回归使用；没有线上结算调用点。

## 验证

- `node scripts/ops/verify-ladder-sync.mjs`
- `node scripts/ops/verify-pending-queue.mjs`
- `node scripts/ops/verify-ladder-algorithms.mjs`
- 全量 `scripts/ops/verify-*.mjs`
- `npm run build`
- `npm run test:visual`（21 个明暗/移动/桌面快照通过）

更新后的视觉基线位于 `docs/reports/redesign/players-*.png` 和
`docs/reports/redesign/profile-*.png`。

## 回滚

如需临时恢复旧网页结算，应通过单独变更恢复旧结算函数、pending delta
快照与审核回放，并同步移除停更提示。不要直接修改生产玩家记录；冻结本身
没有迁移或删除任何历史评分数据。
