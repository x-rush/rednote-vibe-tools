# 大理寺字案录 UI Handoff

黄金流程：大理寺门厅 → 案卷架 → 案情简报 → 场景查验 → 选项对话 → 线索簿 → 推理 → 结案。

组件边界：`CaseShelf`、`BriefingSheet`、`SceneStage`、`DialogueBox`、`DialogueChoice`、`ClueBook`、`GlyphTimeline`、`DeductionBoard`、`VerdictSeal`。

所有分支来自剧情数据；UI 不写死案件答案。角色和背景使用 asset ID；无图时用姓名签与场景文字 fallback。古文字 SVG 必须有来源字段。

新增 `GuideIntro/GuideAvatarButton/GuideHelpSheet/GuideRecovery`；沈砚不得覆盖证物、GAL 选项与判词，反馈通过事件数据注入而非写死正确答案。详见 `NPC-SPEC.md`。
## NPC 四态实现冻结

| 状态 | 预览 ID | 触发 | 主动作 | 关闭／恢复后保留 |
|---|---|---|---|---|
| 首次引导 | `case-guide-shenyan` | 首案首次进入 | 下一句／跳过 | 进入首个 GAL 选项节点 |
| 节点反馈 | `case-guide-shenyan-feedback` | 证词与物证首次出现矛盾 | 回证据板／继续追问 | 已得物证与当前对话位置 |
| 召回帮助 | `case-guide-shenyan-recall` | 用户点沈砚头像 | 回到当前证词 | 案情、证据、字义线索和当前选项 |
| 异常恢复 | `case-guide-shenyan-recovery` | 节点缺页或不可验证 | 回最近完整节点 | 初判与已得证据；缺页节点不标完成 |

正式资源使用 `public/assets/guide`；人物不得使用 multiply 混合模式。沈砚只指出证据不合，不替玩家定罪。
