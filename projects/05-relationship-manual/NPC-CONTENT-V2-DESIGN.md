# 深夜信笺编辑部 · 小满与内容 V2 设计规格

状态：`IMPLEMENTED`
日期：2026-08-26
范围：`projects/05-relationship-manual/**`

## 1. 目标

把现有关系说明书升级为“编辑部视觉小说混合型”体验：玩家在深夜信笺编辑部中，由陪伴型 NPC 小满协助，把模糊感受整理为可执行、可修改、可安全分享的关系说明书。

成功标准：

- 小满具有高品质 Galgame 立绘和明确陪伴感，但不存在好感度、攻略路线或恋爱结局。
- 问卷扩充为七章、每章三题，共 21 题，完成时间约 5–7 分钟。
- 文案兼具温柔文学感与具体行动，不输出人格类型、关系评分或心理诊断。
- 支持亲密关系、好友、家人三种语境，不把所有重要关系恋爱化。
- NPC 不读取或分析用户自由文本；立绘、对话失败时不影响核心流程。
- 纯前端、离线可用，无运行时外部 API、CDN、用户图片存储或后端。

## 2. 世界观

场景是一间雨夜仍亮着暖灯的“深夜信笺编辑部”。桌面上有七个待整理的文件夹、暖白信纸、蓝铅笔、可移除便签和装订工具。玩家不是接受测试，而是和小满一起完成一份可以继续修改的说明书。

世界观只承担三项功能：

1. 用具象场景降低抽象关系问题的答题压力。
2. 用“修订、留白、装订”解释修改、跳过、生成和分享。
3. 让小满成为编辑搭档，而不是治疗师、裁判或替代真实关系的陪伴者。

不实现日期系统、好感度、礼物、角色路线、连续剧情存档、语音、聊天或多个 NPC。

## 3. 小满角色设计

### 3.1 身份与外观

- 姓名：小满。
- 身份：关系卡片整理员，虚构角色。
- 年龄观感：24–28 岁成年中国女性。
- 气质：温柔知性、清爽耐看、可信但不居高临下。
- 发型：深棕中长发，松散低马尾或半扎，额前有自然碎发。
- 服装：暖灰针织开衫、鼠尾草绿素色衬衣；不使用校服、女仆装、白大褂、制服或暴露服装。
- 工具：蓝铅笔、两张完全空白的暖白卡片、可移除便签。
- 禁止：爱心、戒指、听诊器、心理诊所、诊断表、聊天记录、可读私人文字、品牌标识和水印。

### 3.2 画风与构图

- 高品质日系 Galgame 立绘，精致线稿、柔和赛璐璐上色、成熟人体比例。
- 中国成年女性面部特征，原创脸部，不参考或复制现实人物。
- 透明背景，竖幅 3:4，从头顶到大腿中部完整，双手与工具清晰。
- 光源为编辑部暖灯的柔和侧光；服装颜色和人物身份在三张图中保持一致。
- 不在图片中生成任何文字；角色名、台词和状态始终由 DOM 渲染。

### 3.3 三态资源

| 状态 ID | 文件 | 姿态与表情 | 使用位置 |
|---|---|---|---|
| `daily` | `public/assets/guide/xiaoman-daily-v2.webp` | 轻微微笑，一手自然握蓝铅笔，另一手展开恰好两张空白卡片 | 首页、章节开场、结果装订 |
| `listening` | `public/assets/guide/xiaoman-listening-v2.webp` | 神情专注，铅笔略微放低，身体轻微前倾，双手自然 | 倾听、空间章节及用户需要停顿时 |
| `reminder` | `public/assets/guide/xiaoman-reminder-v2.webp` | 略带担心但不责备，用蓝铅笔指向一张空白可移除便签 | 冲突选择、边界章节、保存失败 |

头像不单独生成；使用同一立绘的固定 `object-position` 裁切，避免身份漂移。

### 3.4 生成提示规范

基础提示保持三张一致：

```text
Use case: stylized-concept
Asset type: transparent Galgame companion character sprite for a mobile web app
Primary request: original adult Chinese female editorial companion named Xiaoman, age appearance 24–28
Subject: deep-brown medium-length hair in a loose low ponytail or half-up style; warm-gray knitted cardigan; plain sage-green shirt; blue pencil; mature, gentle, intelligent expression
Style/medium: premium Japanese Galgame character sprite; refined line art; soft cel shading; mature anatomy; tasteful contemporary design
Composition/framing: transparent portrait 3:4, head to mid-thigh, full head and both hands visible, clean silhouette, mobile UI safe margins
Lighting/mood: warm editorial desk side light; calm rainy-night atmosphere without drawing a background
Constraints: original face; consistent identity, hairstyle, clothing, proportions and palette across all variants; no text; no watermark
Avoid: childlike proportions, school uniform, maid outfit, white coat, clinic symbols, heart motifs, romantic fan service, readable cards, private messages, diagnostic charts, extra fingers, hidden hands
```

三张图分别只改变姿态与表情，不改变身份、服装、发型和光线。先生成 `daily`，验收后将其作为后两张的身份与风格参考。

## 4. NPC 出场与交互

### 4.1 出场节奏

- 首页：显示 `daily` 半身立绘和一句使用边界说明。
- 首次进入每章：显示章节文件夹、小满立绘和一段不超过 70 字的章节引子；可以跳过。
- 答题：大立绘收起为 48–56px 头像，不遮挡问题和选项。
- 选择预定义的冲突组合：显示 `reminder` 和一条场景化合并建议；允许保留两项、采用建议或关闭。
- 结果生成：显示 `daily`，七个文件夹依次归位后进入结果；结果进入前已完成计算和保存。
- 保存失败：显示 `reminder`，先提供复制、截图和重试，不清空当前会话。

### 4.2 对话边界

- 小满只响应预定义页面状态、章节 ID、选择 ID 和冲突规则 ID。
- 小满不读取用户手工编辑文本，不对自由文本作心理分析或内容分类。
- 不使用“只有我懂你”“你需要我”“回来找我”等依赖性表达。
- 不称赞用户选择“正确”，只确认选择已经被记录或两种需要可以同时存在。
- 不替用户发送、分享或决定哪些敏感内容应该公开。

### 4.3 类型化数据

`content.json` 新增：

```ts
type NpcPose = 'daily' | 'listening' | 'reminder'

type NpcCue = {
  cueId: string
  trigger: 'landing' | 'chapter-intro' | 'conflict' | 'binding' | 'storage-error'
  category?: RelationshipCategory
  conflictRuleId?: string
  pose: NpcPose
  speaker: '小满'
  roleLabel: '关系卡片整理员'
  text: string
  primaryAction: string
  secondaryAction?: string
  skippable: boolean
}
```

对话组件只消费 `NpcCue`，不会在 JSX 中硬编码业务台词。

## 5. 三种关系语境

`RelationshipContext` 扩展为：

```ts
type RelationshipContext = 'close-relationship' | 'friendship' | 'family'
```

语境规则：

- 亲密关系：标签为“亲密关系”，可使用约定、亲密和共同生活等中性例子。
- 好友：标签为“好友关系”，侧重联系、支持、隐私和冲突修复。
- 家人：标签为“家人关系”，侧重关心方式、个人空间、公开谈论和拒绝压力。
- 核心问题和安全规则共用；只有场景引子、称呼和确实需要语境化的例子发生变化。
- 不假定性别、性取向、婚姻、同住、血缘完整或家庭结构。

内容结构：

```ts
type RelationshipContextCopy = {
  label: string
  subjectLabel: string
  chapterLeads: Record<RelationshipCategory, string>
}

type RelationshipQuestion = {
  // existing fields
  sceneLead: string
  sceneLeadByContext?: Partial<Record<RelationshipContext, string>>
}

type RelationshipOption = {
  // existing fields
  subtitle: string
}
```

## 6. 七章与 21 题

每章恰好三题。现有 16 个稳定问题 ID 保留；两题调整所属章节，但不改变 ID。新增五题：建议许可、关心细节、公开冲突、道歉方式、修复跟进。

### 6.1 回信的节奏 `contact`

| 问题 ID | 场景与问题 | 选项方向 |
|---|---|---|
| `question-busy-contact` | 忙碌的一天里，怎样的联系会让你感到彼此仍在同一页？ | 简短报平安／有空完整交流／重要变化及时说／当天直接询问 |
| `question-message-delay` | 一整天没有收到重要之人的消息时，什么最能让你安下心来？ | 简短说明／大概回来时间／有精力再认真交流／视当天情况而定 |
| `question-plan-change` | 原本约好的计划临时改变时，你希望对方怎样处理这处“修订”？ | 尽早说明／主动重新安排／先处理紧急情况再解释／共同确认影响 |

### 6.2 先让我被听见 `listening`

| 问题 ID | 场景与问题 | 选项方向 |
|---|---|---|
| `question-when-venting` | 当你终于把压在心里的事说出来，更希望对方先做什么？ | 听完／确认重点／安静陪伴／一起梳理 |
| `question-hard-feeling` | 当你的感受一时说不清，哪种回应更能让你继续说下去？ | 确认听见／问一个具体问题／给时间组织／温和陪伴 |
| `question-advice-permission` | 对方已经想到解决办法时，你希望建议在什么时候出现？ | 先问是否需要／听完再建议／直接给选择项／暂时不要建议 |

### 6.3 分歧摆上桌面 `conflict`

| 问题 ID | 场景与问题 | 选项方向 |
|---|---|---|
| `question-disagree-story` | 你们对同一件事记得不一样时，怎样开始会比较安全？ | 各自讲述／先复述对方／区分事实与解释／先找共同部分 |
| `question-conflict-timing` | 分歧已经发生，你更适合在什么时候继续谈？ | 当下说清／短暂停顿后谈／约明确时间／先处理最急部分 |
| `question-conflict-tone` | 哪些表达会让讨论从“事情”变成对你的伤害？ | 人身定性／讽刺羞辱／威胁离开或伤害／公开冲突；允许多选 |

### 6.4 给彼此留一页空白 `space`

| 问题 ID | 场景与问题 | 选项方向 |
|---|---|---|
| `question-pause-signal` | 当情绪已经写满整页，你希望怎样提出暂停？ | 说明原因／给出回来时间／确认不是结束关系／先完成必要信息 |
| `question-alone-space` | 当你需要独处，怎样的距离最能帮助你恢复？ | 完整空间／偶尔确认／保持日常联系／由我主动回来 |
| `question-space-not-rejection` | 为了不让留白被误解成拒绝，你愿意留下什么说明？ | 说明不是惩罚／约定联系时间／说清仍在乎／承认暂时不确定 |

### 6.5 关心如何抵达 `care`

| 问题 ID | 场景与问题 | 选项方向 |
|---|---|---|
| `question-care-language` | 哪一种关心最容易真正抵达你？ | 具体行动／直接语言／安静陪伴／记得重要细节；允许多选 |
| `question-help-without-asking` | 对方想帮助你时，怎样做能同时保留你的自主？ | 先问再做／给几个选择／处理明确小事／等待我开口 |
| `question-care-details` | 哪一种“小事被记住”的时刻，会让你感到自己被认真看见？ | 记得重要日期与安排／留意状态变化／兑现小约定／不要求记住细节 |

### 6.6 不能被翻过的页 `boundary`

| 问题 ID | 场景与问题 | 选项方向 |
|---|---|---|
| `question-private-sharing` | 涉及你的私事时，怎样才算获得了可以分享的同意？ | 每次先问／限定对象和范围／匿名也先确认／明确内容不可分享 |
| `question-saying-no` | 当你说“不”时，希望对方怎样接住这个答案？ | 先接受／只询问一次／给我重新考虑的空间／不把亲密当理由 |
| `question-public-conflict` | 冲突涉及他人或公开空间时，哪些界线不能被越过？ | 不公开私事／不拉人站队／不发布可识别信息／危险时优先求助；允许多选 |

### 6.7 把修改写进以后 `repair`

| 问题 ID | 场景与问题 | 选项方向 |
|---|---|---|
| `question-repair` | 一段关系需要修复时，你最先需要看见什么？ | 承认具体影响／完整听见／真诚道歉／共同决定下一步；允许多选 |
| `question-apology` | 哪一种道歉更能让你相信对方真的理解了发生什么？ | 说清具体行为／承认影响／不附带辩解／询问修复需要 |
| `question-repair-follow-through` | 对话结束后，什么能让修复不只停留在一句“对不起”？ | 约定具体行动／之后主动确认／允许继续调整／承认暂时做不到 |

## 7. 文案标准

### 7.1 场景引子

- 每题 28–70 个汉字。
- 只描写编辑部动作、纸张、天气、灯光和当前问题，不代替玩家描述情绪。
- 不使用“真正的你”“潜意识”“依恋类型”“灵魂”“命中注定”等测试或宿命话术。
- 文学感服务于理解，不连续堆叠比喻。

### 7.2 问题与选项

- 问题使用具体时刻和可观察行为，不询问人格本质。
- 每个选项包含 4–12 字标题和 16–42 字解释。
- 两端选项都使用体面语言；中性或不确定选项不是“逃避”。
- 多选题明确最大选择数；互斥项由结构化规则约束。
- 不把危险、威胁、监控、羞辱或强迫包装成普通偏好。

### 7.3 结果结构

最终说明书仍按七个内容章节组织；每个章节卡内部按四种句子职责组织：

1. `need`：我的需要。
2. `trigger`：容易让我不安、退缩或难以继续表达的情境。
3. `action`：对方可以采取的具体行动。
4. `repair`：我愿意共同承担的修复方式。

七章结果 ID 与问题分类统一为 `contact`、`listening`、`conflict`、`space`、`care`、`boundary`、`repair`。每章至少生成一条 `need` 和一条 `action`；只有内容依据充分时才显示 `trigger` 或 `repair`，不为填满模板而重复句子。边界章可以标记为敏感，简洁版默认排除其具体触发点。

每条结果继续使用第一人称，最多 120 字；简洁摘要最多 52 字。触发点只描述情境和影响，不诊断用户或对方。简洁版每章最多保留一条由 `need + action` 合并的安全句，共最多七条。

V2 将现有六个展示章节迁移为七章。手工编辑通过稳定的 `itemId`／`sourceTextKey` 对齐，而不是通过旧章节位置对齐：同一来源句即使移动到新章节仍保留用户改写；失去内容依据的旧改写作为“需要确认”条目保留，不静默删除或错贴到其他章节。

## 8. 页面与组件

新增或拆分组件：

- `XiaomanStage`：加载立绘、姿态切换、图片失败回退。
- `DialoguePanel`：姓名、身份、台词、跳过和主次动作。
- `ChapterIntro`：章节文件夹、场景引子、章节进度。
- `TopicProgress`：七章状态和当前章节。
- `QuestionSheet`：场景引子、问题、选项解释和选择规则。
- `ConflictNote`：结构化冲突提示，不覆盖原选择。
- `RelationshipCard`：显示 need／trigger／action／repair 职责标记。

移动端规则：

- 章节转场可使用约 42–48svh 立绘区；对话框位于下方且主按钮完整可见。
- 答题页只显示头像和一行可关闭提示，大立绘不常驻。
- 立绘不得覆盖七章进度、问题、选项、隐私标记和底部操作。
- 375 / 390 / 430px 下按钮至少 44px；连续英文、emoji 和长解释不得产生横向溢出。

桌面端规则：

- 立绘位于右侧编辑搭档区；问题和选项保持左侧主要阅读宽度。
- 对话框不跨越用户自由文本编辑区。

## 9. 状态与存储迁移

状态新增：

```ts
type AppPage =
  | 'landing'
  | 'intro'
  | 'chapterIntro'
  | 'questionnaire'
  | 'review'
  | 'result'
  | 'editCard'
  | 'savedResult'
  | 'error'

type RelationshipStateV2 = {
  // existing fields
  seenChapterIds: RelationshipCategory[]
  activeNpcCueId: string | null
}
```

存储规则：

- 草稿 schema 升级为 v2；读取器同时支持 v1。
- v1 的 16 个合法答案按稳定问题与选项 ID 保留。
- 调整章节归属的答案不丢失；新增五题显示为待完成。
- `seenChapterIds` 只保存七个有限分类 ID；`activeNpcCueId` 不需要持久化。
- 不保存立绘、头像、图片 URL、Base64、Blob、聊天历史或用户自由叙事。

章节转换：

- 开始答题先进入第一章 `chapterIntro`。
- 下一题跨越分类边界时进入下一章 `chapterIntro`。
- 跳过转场会记录该章已看，但不自动回答题目。
- 恢复草稿时直接恢复题目位置；仅当对应章节从未看过时显示一次章节转场。

## 10. 错误与降级

- 立绘解码失败：显示“满”字印章、角色名、身份和完整台词；不重复请求网络资源。
- NPC cue 引用无效：隐藏角色提示，核心问题继续可答；内容校验测试阻止正式包出现该状态。
- 旧草稿迁移失败：保留可解析的答案和手工编辑，显示需要确认，不覆盖原数据。
- 存储不可用：当前会话可完成，提供纯文字复制和本地截图；明确关闭后不会保留。
- `prefers-reduced-motion: reduce`：立绘、纸签和对话框即时出现，不做位移、逐字或装订动画。

## 11. 测试与验收

### 内容契约

- 恰好 7 章、21 题，每章恰好 3 题。
- 恰好 3 种关系语境、3 个 NPC 立绘状态。
- 每题有非空场景引子；每个选项有标题、解释、合法结果引用。
- 所有问题、选项、章节、NPC cue、冲突和结果 ID 唯一且引用合法。
- 现有 16 个问题 ID 继续存在；新增 5 个 ID 与规格一致。
- 禁止诊断、操控、服从测试、监控合理化、羞辱、依赖诱导和宿命化语言。

### 逻辑与状态

- 七章边界转换、跳过转场、返回上一题和草稿恢复。
- v1 草稿迁移后保留合法旧答案，并定位新增待答题。
- 三语境输入生成结构完整且不恋爱化的卡片。
- 冲突组合保留双方需要并生成场景化合并句。
- 人工编辑不被重新答题静默覆盖。

### NPC 与资源

- 每个 cue 对应合法姿态、触发条件和动作。
- 图片失败时回退内容可操作。
- 三张图身份、服装、发型、比例和配色一致；无文字、水印、爱心、诊断符号或手部错误。
- 立绘不进入最终分享卡，除非未来另行设计并取得用户确认；本期不实现该选项。

### 浏览器

- 375×812、390×844、430×932：首页、三类章节转场、单选、多选、冲突提示、回顾、编辑、完整与简洁预览、保存失败。
- document 宽度等于 viewport，0 断图，主要按钮至少 44px。
- 缩减动效、键盘操作、图片失败、长文案和本地存储拒绝场景可完成核心流程。

## 12. 实施顺序

1. 内容契约与 21 题失败测试。
2. 内容 JSON、三语境和 v1→v2 草稿迁移。
3. 生成并单独验收 `daily` 立绘。
4. 基于 `daily` 生成并验收 `listening` 与 `reminder`。
5. NPC cue、章节转场和图片失败回退。
6. 题目、结果和编辑卡组件装回。
7. 完整自动门禁与三宽浏览器验收。

## 13. 非目标

- 不实现在线 AI、自由聊天、语音、账号、云同步或发布。
- 不实现好感度、恋爱路线、角色解锁、付费剧情或多个 NPC。
- 不分析上传聊天记录，不允许上传或保存用户图片。
- 不把小满加入最终分享卡，不把敏感关系内容绘制进立绘。
