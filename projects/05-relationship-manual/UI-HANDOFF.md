# 我希望被这样对待 UI Handoff

黄金流程：首页 → 隐私/用途说明 → 分主题选择 → 回顾 → 关系说明书 → 编辑/分享。

组件：`LetterShell`、`TopicProgress`、`PreferenceChoice`、`MarginNote`、`ManualSection`、`BoundaryCallout`、`ShareLetter`、`LocalOnlyBadge`。

结果通过 ViewModel 生成，编辑只修改有限字段，不破坏安全文案。无图片也必须完整成立。分享卡可用 DOM 渲染，首发不要求下载图片才能分享截图。

新增统一四个 Guide 组件；小满不读取自由文本做心理分析，人物层不进入最终分享卡，除非用户主动选择带角色模板。详见 `NPC-SPEC.md`。
## NPC 四态实现冻结

| 状态 | 预览 ID | 触发 | 主动作 | 关闭／恢复后保留 |
|---|---|---|---|---|
| 首次引导 | `case-guide-xiaoman` | 首次整理关系卡 | 下一步／跳过 | 进入场景选择，不重播边界说明 |
| 节点反馈 | `case-guide-xiaoman-feedback` | 同主题选择两个近似冲突需要 | 保留两项／采用合并句 | 原选择和用户手工文字 |
| 召回帮助 | `case-guide-xiaoman-recall` | 编辑页点小满头像 | 回到编辑稿 | 当前章节、光标、可见性和敏感设置 |
| 异常恢复 | `case-guide-xiaoman-recovery` | IndexedDB 写入失败 | 复制／截图／重试 | 当前会话全部章节与手工编辑 |

正式资源使用 `public/assets/guide`；人物不在私密正文和分享确认页常驻，图片失败不影响复制、截图和继续编辑。
