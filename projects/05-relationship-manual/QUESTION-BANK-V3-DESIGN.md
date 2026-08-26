# 关系说明书 V3 独立题库设计

## 1. 目标

把当前“三种关系共用 21 道题、只替换章节引子”的结构，改为三套完全独立的场景题库：亲密关系、好友关系、家人关系各 21 道题。三套题库共用七个评估章节、偏好维度、安全原则和卡片版式，但不共用题干、选项、边界句或结果句。

完成后，用户选择一种关系，只会回答该关系题库中的问题，也只会得到该关系对应的结果表达。

## 2. 核心原则

### 2.1 独立题库，统一框架

- 每套题库固定 7 个章节，每章 3 题，共 21 题。
- 章节顺序保持：联系、倾听、分歧、空间、关心、边界、修复。
- 三套题可以测量相同维度，但必须使用关系中真实存在的事件来提问。
- 不在运行时从公共池随机抽题，也不以替换名词的方式伪造差异。

### 2.2 情感与逻辑准确

每个选项到结果句必须同时满足四项一致：

1. **场景一致**：回答的事件和生成的表达是同一件事。
2. **主语一致**：询问“希望对方怎样做”时生成需求句；询问“自己愿意怎样做”时才生成承诺句。
3. **强度一致**：普通偏好不能被升级为恶意、操控或伤害指控。
4. **动作一致**：陪伴、独处、询问、建议、道歉和后续行动不得互相替代。

每个结果片段增加 `voice`：

- `request`：我希望你怎样做。
- `boundary`：我不能接受什么，以及我会怎样保护自己。
- `self-commitment`：我愿意怎样回应和修复。

题目声明允许产出的 `resultVoices`，校验器禁止选项引用方向不符的结果片段。

### 2.3 不预设关系形态

- 亲密关系不默认异性恋、婚姻、同居、性关系或共享财务。
- 好友关系不默认每日联系、共同朋友圈、住在同一城市或承担无限支持责任。
- 家人关系不默认父母子女、同住、经济依赖、亲密无间或长辈天然拥有决定权。
- 仅适用于部分人的题目必须允许选择“不适用／这不是我在意的部分”；它不计分，也不生成错误结果句。
- “暂不确定”继续作为跳过答案，不将犹豫解释为低需求或默认同意。

### 2.4 安全规则不参与偏好竞争

遭遇威胁、暴力、强迫、跟踪或自伤要挟时可以寻求外部帮助，这是固定安全说明，不作为多选题中的一个候选答案，也不参与计分。

## 3. 三套题库范围

以下矩阵规定每道题必须覆盖的现实事件。正式文案可以更温柔，但不得改变事件、主语和输出方向。

### 3.1 亲密关系题库

| 章节 | 题 1 | 题 2 | 题 3 |
| --- | --- | --- | --- |
| 联系 | 忙碌时怎样保持联系 | 重要消息迟迟未回时需要什么信息 | 约会或共同计划临时改变怎样处理 |
| 倾听 | 难过时先陪伴还是先解决 | 分享压力时怎样提问才舒服 | 对方暂时没有精力倾听时怎样说明 |
| 分歧 | 争执时可以接受的语气 | 情绪过载时怎样暂停并约定回来 | 对同一件事记忆不同时怎样谈事实与感受 |
| 空间 | 想独处时怎样告知 | 独处期间可以怎样轻量确认 | 各自社交与共同时间怎样安排 |
| 关心 | 哪些具体行动让关心抵达 | 语言、行动与细节中更需要什么 | 身体接触前怎样确认意愿 |
| 边界 | 手机、账号与设备隐私 | 亲密接触中的拒绝与随时反悔 | 关系细节向朋友或社交平台公开的范围 |
| 修复 | 什么样的道歉才算听见影响 | 道歉之后需要怎样的实际改变 | 修复后怎样回访并调整约定 |

### 3.2 好友关系题库

| 章节 | 题 1 | 题 2 | 题 3 |
| --- | --- | --- | --- |
| 联系 | 联系频率不同怎样保持安心 | 消息未回时怎样理解与提醒 | 见面计划变化怎样处理 |
| 倾听 | 倾诉时希望朋友怎样回应 | 对方支持容量有限时怎样说明 | 建议、陪伴和转移注意之间怎样选择 |
| 分歧 | 一对一说清还是在群体中讨论 | 玩笑造成不适时怎样停下 | 观点不同但仍想保留友情时怎样对话 |
| 空间 | 各自忙碌时如何避免把少联系等同疏远 | 暂时不想社交时怎样说明 | 一方结识新朋友后怎样面对失落与边界 |
| 关心 | 低落时怎样的问候最合适 | 帮忙前怎样确认实际需要 | 金钱、时间和情绪支持做到什么程度不会透支 |
| 边界 | 私密信息能否转述以及向谁转述 | 群聊截图、照片和动态发布的同意 | 拒绝邀约或帮忙后不被追问与施压 |
| 修复 | 失约或失言后怎样承认影响 | 群体误会中怎样澄清且不拉人站队 | 修复后怎样用行动重建可信度 |

### 3.3 家人关系题库

| 章节 | 题 1 | 题 2 | 题 3 |
| --- | --- | --- | --- |
| 联系 | 报平安的频率与方式 | 未及时回复时如何表达担心而不监控 | 探访或家庭安排变化怎样提前沟通 |
| 倾听 | 难受时希望家人先听见什么 | 建议与评价出现前怎样询问 | 家人无法理解时怎样仍尊重感受 |
| 分歧 | 不翻旧账地讨论当前事件 | 身份或辈分不代替理由 | 情绪升高时怎样暂停并重新谈 |
| 空间 | 房间、物品和独处时间的边界 | 个人决定需要分享多少 | 搬出或减少联系时怎样保持必要沟通 |
| 关心 | 饭菜、问候、陪同或实际帮忙中需要什么 | 生病或低落时怎样照顾不过度接管 | 担心怎样表达而不连续追问 |
| 边界 | 婚恋、工作、身体和收入等私人话题 | 未经同意不替自己作决定 | 私事不向亲属转述或公开讨论 |
| 修复 | “一家人”不能跳过道歉 | 承认影响时不以出发点抵消结果 | 改变反复发生的做法并在之后确认 |

## 4. 题目与选项编辑规则

### 4.1 题目结构

- `sceneLead` 只交代一个可辨认的生活事件，不暗示正确选项。
- `prompt` 明确询问需求、边界或自我承诺中的一种，不混合主语。
- 单选题的选项必须互斥；若多个答案可以同时成立，改为限制数量的多选，或把题目改成“其中最重要的是哪一项”。
- 多选题的上限必须有内容理由，不能让安全事项与个人偏好竞争名额。
- 每个选项包含一个主要动作，不把“说明原因并改期并补偿”等多项行为塞进同一个选项。
- 中性或不适用选项不产生惩罚性评分，也不生成虚构需求。

### 4.2 结果映射

- 每个非中性选项至少映射一个、最多映射两个结果片段。
- 映射必须通过逐项语义审查表：`questionId → optionId → selected meaning → output text → voice → intensity`。
- 同一个结果片段只表达一个动作；不得用宽泛句子代替不同答案。
- 每个结果片段至少被一个选项或明确的 fallback 使用；禁止死文案。
- 每个选项引用的结果片段必须来自同一关系题库。
- 结果卡中每章优先呈现一条需求／边界和一条自我承诺；没有回答依据时使用该关系专属的温和 fallback，不推断用户立场。

### 4.3 文案语气

- 使用具体、可商量、可执行的表达，避免人格判断和关系诊断。
- 不把“回复慢、需要空间、暂时无法倾听”自动解释为不爱、冷暴力或操控。
- 不使用“真正爱你就会”“家人都是为你好”“朋友就该两肋插刀”等道德绑架。
- 文学意象只用于承接氛围，不能遮住事件和选择的实际含义。
- 安全边界允许明确，不用温柔措辞稀释暴力、强迫或威胁的严重性。

## 5. 数据契约

内容包升级到 schema 3，业务内容继续只存在 `src/content/content.json`。

```ts
type ResultVoice = 'request' | 'boundary' | 'self-commitment'

type RelationshipQuestion = {
  questionId: string
  category: RelationshipCategory
  sceneLead: string
  prompt: string
  resultVoices: ResultVoice[]
  multiple: boolean
  selectionLimit: { min: number; max: number }
  options: RelationshipOption[]
  skipRule: { allowed: boolean; reason: string }
  version: number
}

type ManualSentence = {
  textKey: string
  sourceSectionId: string
  cardSectionId: CardSectionId
  kind: SentenceKind
  role: SentenceRole
  voice: ResultVoice
  intensity: 1 | 2 | 3
  text: string
  sensitive: boolean
  compactDefault: boolean
}

type RelationshipBank = {
  questions: RelationshipQuestion[]
  boundaryPreferences: BoundaryPreference[]
  sentenceFragments: ManualSentence[]
  conflictMergeRules: ConflictMergeRule[]
  boundaryCommitmentRules: Array<{ boundaryId: string; textKeys: string[] }>
  defaultCommitmentTextKeys: string[]
  sectionFallbacks: Record<CardSectionId, {
    needText: string
    actionText: string
  }>
}

type PreferenceDimension = {
  dimensionId: string
  label: string
  description: string
  important: boolean
  fallbackTextKeys: Record<RelationshipContext, string>
}

type RelationshipContent = {
  chapters: RelationshipChapter[]
  contextCopy: Record<RelationshipContext, RelationshipContextCopy>
  dimensions: PreferenceDimension[]
  relationshipBanks: Record<RelationshipContext, RelationshipBank>
  // npcCues 可带 relationshipContext；冲突提示只能引用同一题库的规则
  npcCues: NpcCue[]
  // cardRules 只保留版式、长度和章节顺序等共享规则
  cardRules: CardRules
  safetyRules: SafetyRule[]
  uiCopy: UiCopy
}
```

所有题目、选项、边界和结果片段 ID 使用关系前缀：`close-*`、`friend-*`、`family-*`。即使文本含义相近，也不跨题库复用 ID。

应用只通过以下选择器读取活动题库：

```ts
function getRelationshipBank(
  content: RelationshipContentPackage,
  context: RelationshipContext,
): RelationshipBank
```

题目页、进度、复核页、画像计算、结果生成和草稿校验都接收这个活动题库，不再直接读取全局 `content.questions`。

## 6. 草稿兼容

- 内容版本升级为 `3.0.0`，本地草稿结构暂时保持 schema 2，无需保存新的敏感数据。
- 在 `content.json` 中提供一次性的 `2.0.0 → 3.0.0` 答案迁移表，按草稿中的关系类型映射旧题目和旧选项。
- 能保持原意的答案迁移到新题；无法确认语义等价的答案不猜测，标记为待补答。
- 迁移后进入复核页，并明确告诉用户哪些答案已保留、哪些题需要补充；不得无提示清空整份草稿。
- 切换关系类型视为开始另一套题库，需要明确确认；不把一套关系答案套入另一套关系。

## 7. 校验与测试标准

### 7.1 内容结构

- 三种关系各自恰好 21 题、每章恰好 3 题。
- 每套题库内 question、option、boundary、sentence ID 唯一；跨库也保持全局唯一。
- 每个选项只能引用本题库存在的边界和结果片段。
- 每个重要维度在三套题库中都有各自存在的 fallback 结果键。
- 每个结果片段均可达，或被明确登记为 fallback。
- 单选题 `max = 1`；多选上下限合法；exclusive 选项不能与其他项并选。

### 7.2 语义约束

- 题目的 `resultVoices` 必须包含其所有选项结果片段的 `voice`。
- 选项强度与结果片段强度差值不得超过 1；涉及威胁、暴力、强迫的专门边界题除外。
- `not-applicable` 和 `neutral` 选项不允许引用敏感、边界或承诺结果。
- 固定禁止语言扫描覆盖三套题库、三套结果库、fallback 和 NPC 文案。
- 关系专属冲突提示只能引用同一关系题库中的冲突规则。
- 添加人工审查快照，逐项记录 63 道题的事件、主语、可选动作与结果句，避免仅靠词法测试假装完成语义审查。

### 7.3 行为与回归

- 选择亲密关系时，页面、复核、结果和分享卡中不能出现好友或家人题库 ID 与专属措辞；其余两类同理。
- 任意关系完成 21 题后都能生成七章卡片。
- 修改答案只进入当前关系题库，不要求重答无关题目。
- V2 草稿升级时保留可等价迁移的答案，并准确列出待补答题目。
- 现有卡片编辑、简洁模式、图片保存、限时 toast 和 NPC 展示行为保持不变。
- 最终执行 `pnpm lint && pnpm test && pnpm build`，并验证 375、390、430 CSS px 下三套题库的题目页、复核页和结果页。

## 8. 不在本次范围

- 不增加后端、账号同步、云端画像或外部 API。
- 不把结果解释为心理诊断、关系好坏评分或分手建议。
- 不根据答案自动判断对方有操控、依恋类型或人格问题。
- 不新增依赖，不修改项目外文件或根工作区配置。
