# 当时这样说就好了 UI Handoff

黄金流程：用途/隐私 → 情境 → 事实 → 感受 → 推测 → 需要 → 请求 → 表达对比 → 复盘卡。

组件：`QuietShell`、`PrivacyBadge`、`ReplayStep`、`StatementLayer`、`ToneSwitcher`、`BeforeAfter`、`SafetyNotice`、`ReplayCard`。

所有关键输入为选项；UI 不接收聊天截图。安全情境优先展示安全提示。三种语气不能用绿/黄/红暗示好坏。

新增统一四个 Guide 组件；迟言不读取聊天记录或开放输入做诊断，人物不得遮挡前后句对照与安全退出。详见 `NPC-SPEC.md`。
## NPC 四态实现冻结

| 状态 | 预览 ID | 触发 | 主动作 | 关闭／恢复后保留 |
|---|---|---|---|---|
| 首次引导 | `case-guide-chiyan` | 首次复盘 | 下一步／跳过 | 进入结构化情境选择，不要求聊天记录 |
| 节点反馈 | `case-guide-chiyan-feedback` | 首次把动机判断移到推测 | 暂停／继续需要 | 已选事实、感受与当前步骤 |
| 召回帮助 | `case-guide-chiyan-recall` | 复盘页点迟言头像 | 回到当前步骤 | 情境、五步选择和当前编辑位置 |
| 异常恢复 | `case-guide-chiyan-recovery` | 保存失败 | 复制／截图／重试 | 五步选择、三语气草稿和手工修改 |

正式资源使用 `public/assets/guide`；帮助层不读取或上传聊天记录，高风险情境优先安全退出而非优化表达。
