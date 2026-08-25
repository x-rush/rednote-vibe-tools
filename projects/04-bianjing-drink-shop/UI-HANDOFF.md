# 汴京饮子铺 UI Handoff

黄金流程：开张 → 日初 → 备货/定价/策略 → 营业 → 事件选择 → 日结账簿 → 里程碑/破产/百日结局。

组件：`ShopHud`、`ShopStage`、`DrinkTray`、`DecisionDock`、`EventSheet`、`Ledger`、`WeatherLayer`、`CustomerPortrait`、`EndingScroll`。

经营数字必须使用真实业务状态；美术层不能影响可点击区域。低性能模式关闭环境粒子。资源缺失时以账簿和文字继续游戏。

新增 `GuideIntro/GuideAvatarButton/GuideHelpSheet/GuideRecovery`；阿沅反馈消费当日 ViewModel，只读不改经营状态；不得遮挡现金、库存、日数和选择。详见 `NPC-SPEC.md`。
## NPC 四态实现冻结

| 状态 | 预览 ID | 触发 | 主动作 | 关闭／恢复后保留 |
|---|---|---|---|---|
| 首次引导 | `case-guide-ayuan` | 新经营档第 1 日 | 下一句／跳过 | 进入晨间决策 |
| 节点反馈 | `case-guide-ayuan-feedback` | 每日日结首次展开 | 查看逐笔账／下一日 | 已发生收入、成本、事件和人情变化 |
| 召回帮助 | `case-guide-ayuan-recall` | 用户点阿沅头像 | 回到铺面 | 时段、库存、已发生事件和营业进度 |
| 异常恢复 | `case-guide-ayuan-recovery` | 当前日记录无法验证 | 回上一日日结快照 | 历史账簿、人情、结局册；只失去未确认晨间草稿 |

正式资源使用 `public/assets/guide`；节点反馈不得泄露未来事件，关闭声音后必须保留完整文字反馈。
