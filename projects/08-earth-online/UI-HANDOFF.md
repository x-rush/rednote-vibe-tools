# 地球 Online UI Handoff

黄金流程：公会大厅 → 状态登记 → 任务揭晓 → 接取 → 进行中 → 完成/放弃 → XP → 冒险日志。

组件：`GuildHall`、`AdventurerCheckIn`、`PreferenceControl`、`QuestBoard`、`QuestSheet`、`RequirementTags`、`ActiveQuest`、`XpReceipt`、`AdventureLog`、`BadgeShelf`。

所有条件和奖励来自 Foundation ViewModel。任务卡永远展示安全退出条件。图片缺失时用纸张、文字和 SVG 徽章正常工作；不接受用户图片。

新增统一四个 Guide 组件；弥拉消费任务 ViewModel，不自行发明任务；角色不得覆盖标题、耗时、地点、安全提示和领取按钮。详见 `NPC-SPEC.md`。
## NPC 四态实现冻结

| 状态 | 预览 ID | 触发 | 主动作 | 关闭／恢复后保留 |
|---|---|---|---|---|
| 首次引导 | `case-guide-intro` | 首次进入冒险者公会 | 下一句／跳过 | 进入状态登记与委托板 |
| 节点反馈 | `case-guide-mira-feedback` | 委托匹配完成 | 接受／重抽 | 当前结构化筛选条件和冷却次数 |
| 召回帮助 | `case-guide-mira-recall` | 用户点弥拉头像 | 返回当前委托 | 任务纸、筛选条件和已接受状态 |
| 异常恢复 | `case-guide-mira-recovery` | activeQuestId 写入失败 | 临时任务／重试 | 当前会话任务；不得伪造日志、XP 或永久徽记 |

正式资源只使用 `public/assets/earth-online/guide` 的 V2 三件套；V1 已归档为拒绝稿。弥拉保持西方异世界公会身份，不使用东方官署或现代游客中心语汇。
