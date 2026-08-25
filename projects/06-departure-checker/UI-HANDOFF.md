# 出门检查官 UI Handoff

黄金流程：场景 → 条件 → 生成 → 分类清单 → 最后一分钟 → 保存。

组件：`ScenarioGrid`、`ConditionStepper`、`PrioritySection`、`ChecklistRow`、`WhyNeeded`、`LastMinuteMode`、`SavedListCard`、`CompletionStamp`。

必带/建议/可选不能只用颜色区分。每行点击区至少 48px。最后一分钟模式隐藏次要解释，保留退出和恢复入口。图标缺失时显示文字，不阻塞清单。

新增统一四个 Guide 组件；路岚只能读取用户已选场景和条件，不伪造实时天气；角色不覆盖勾选行和出门按钮。详见 `NPC-SPEC.md`。
## NPC 四态实现冻结

| 状态 | 预览 ID | 触发 | 主动作 | 关闭／恢复后保留 |
|---|---|---|---|---|
| 首次引导 | `case-guide-lulan` | 首次生成清单 | 下一步／跳过 | 进入场景选择 |
| 节点反馈 | `case-guide-lulan-feedback` | 清单首次生成 | 查看完整清单／关闭 | 场景条件和生成结果；最多解释三项 |
| 召回帮助 | `case-guide-lulan-recall` | 清单页点路岚头像 | 回到清单 | 当前视图、滚动位置与勾选状态 |
| 异常恢复 | `case-guide-lulan-recovery` | 天气服务不可用 | 手选天气／基础清单 | 场景、时长、同行和自定义项 |

正式资源使用 `public/assets/guide`；不得拿旧天气冒充实时数据，最后一分钟模式的人物层不得遮挡 56px 主按钮。
