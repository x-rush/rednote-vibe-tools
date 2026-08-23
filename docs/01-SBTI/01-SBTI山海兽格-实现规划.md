# SBTI 山海兽格：实现规划

## 产品定义

正式名：**SBTI｜山海兽格测试**。英文释义：`Shanhai Beast Temperament Indicator`；中文解释：山海异兽性格倾向指标。它是娱乐性自我探索工具，不是专业心理测评。

一句话：如果 MBTI 描述你在人群中的倾向，SBTI 描述你在山海世界中的生存方式。

用户承诺：**以“被准确描述”为结果价值，以“进入山海世界冒险”为答题过程。**

关系说明：SBTI 只借鉴四组二元偏好的结构，不使用官方 MBTI 题目，也不声称输出官方 MBTI 结果。MBTI-like 关联只用于帮助用户理解，不作为心理测量效度声明。

参赛标签：`#国风vibecoding #小红书vibecoding大赛 #vibeknow`。

## MVP 范围

- 首发内置 48 道原创情境题，单次测试按规则抽取 24 道。
- 四个维度每轮各出现 6 道主测题；四个叙事章节每轮各出现 6 道题。
- 4 组原创维度：应世/隐世、察微/观象、衡理/感应、守形/化生。
- 16 种兽格，每种包含代号、中文名、对应异兽、核心描述、优势、盲点、关系需要、行动建议。
- 每种异兽显示古籍资料与“产品创意解读”的明确分界。
- 结果页、再测一次、历史结果、本地清空。

不做：好友匹配、在线排行、用户账号、AI 对话、实时生成图片。

## 核心流程

```text
封面 → 娱乐性说明 → 24 道山海情境 → 四维结果 → 异兽显形动画
→ 兽格结果 → 原典/创意解读 → 保存本地/重新测试
```

## 三层映射框架

SBTI 不直接把一个 MBTI 类型贴到一只异兽身上，而是经过三层转换：

```text
MBTI-like 偏好层
        ↓ 结构翻译
SBTI 山海行为维度层
        ↓ 类型目标向量
《山海经》异兽证据与文化原型层
        ↓ 程序匹配 + 人工策划
16 种山海兽格结果
```

必须坚持：

- MBTI-like 层描述偏好，不描述能力、品德或固定命运。
- SBTI 层是本产品原创世界观与题目体系。
- 古籍层只记录可追溯的原文、形貌、行为、栖息和作用。
- 人格层属于产品创意演绎，不能写成《山海经》直接记载的性格。

## MBTI-like 与 SBTI 维度对应

| MBTI-like 偏好 | 关注的问题 | SBTI 维度 | 山海世界中的问题 |
|---|---|---|---|
| E / I | 注意和能量更偏向外界还是内在 | 应世 R / 隐世 H | 面对陌生世界，是主动回应还是先退后观察 |
| S / N | 更信任具体经验还是模式与可能 | 察微 T / 观象 V | 是沿具体痕迹调查，还是从征兆推演全局 |
| T / F | 决策更偏规则逻辑还是价值关系 | 衡理 L / 感应 E | 优先维持规则，还是回应生命与关系 |
| J / P | 更偏确定结构还是开放适应 | 守形 S / 化生 M | 先确立边界秩序，还是保留变化空间 |

编码转换：

```text
E → R 应世       I → H 隐世
S → T 察微       N → V 观象
T → L 衡理       F → E 感应
J → S 守形       P → M 化生
```

示例：与 `INFP` 偏好结构相邻的 SBTI 结果为 `HVEM`，但产品只能写“INFP-like 偏好回声”或“结构上接近 I/N/F/P”，不能写“你测出了 INFP”。

## 八个偏好端点的定义要求

每个端点都必须拥有：短定义、可观察行为、优势、代价、常见误解、关系需要和成长动作。

```ts
type PreferencePole = {
  id: "R" | "H" | "T" | "V" | "L" | "E" | "S" | "M";
  dimension: "world" | "perception" | "decision" | "adaptation";
  name: string;
  shortDefinition: string;
  behaviors: string[];
  strengths: string[];
  risks: string[];
  needs: string[];
  growthActions: string[];
  nonMeanings: string[];
  mbtiEcho: "E" | "I" | "S" | "N" | "T" | "F" | "J" | "P";
};
```

必须明确的“并不等于”：

- 隐世不等于社恐，应世不等于吵闹。
- 感应不等于不讲逻辑，衡理不等于没有感情。
- 守形不等于刻板，化生不等于没有计划。
- 察微不等于缺乏想象，观象不等于不切实际。

## 四层资料库

### A. 维度定义库

字段：`content.json.dimensions`。保存八个偏好端点，是题目、结果文案和成长建议的共同事实源。

### B. 异兽古籍证据库

字段：`content.json.creaturesClassical`。这里只保存古籍事实，不写现代人格。

```ts
type ClassicalCreature = {
  id: string;
  canonicalName: string;
  aliases: string[];
  sourceBook: string;
  sourceChapter: string;
  originalText: string;
  modernSummary: string;
  appearanceFacts: string[];
  behaviorFacts: string[];
  habitatFacts: string[];
  effectOrOmenFacts: string[];
  evidenceLevel: "direct" | "inferred" | "later-tradition";
  sourceIds: string[];
  approved: boolean;
};
```

例如鹿蜀的古籍表只可记录形如马、白首、虎纹、赤尾、声音如谣及“佩之宜子孙”等直接信息；不能写“鹿蜀性格温柔、擅长照顾别人”。

### C. 异兽文化原型库

字段：`content.json.creatureArchetypes`。负责把古籍事实转换为现代人格意象，并清楚记录哪些属于创作。

```ts
type CreatureArchetype = {
  creatureId: string;
  creativeArchetype: string;
  symbolicKeywords: string[];
  derivedFromFacts: string[];
  creativeExtensions: string[];
  prohibitedClaims: string[];
  candidateVector: Record<"R" | "H" | "T" | "V" | "L" | "E" | "S" | "M", number>;
  confidence: number;
  recognition: number;
  visualDistinctiveness: number;
  positiveIdentifiability: number;
  controversyRisk: number;
  editorialNote: string;
};
```

向量取值：`-2` 明显相反、`-1` 略微相反、`0` 无证据/中性、`1` 较符合、`2` 强符合。没有证据必须填 `0`，不能靠直觉补成强特征。

### D. 十六型结果库

字段：`content.json.profiles`。

```ts
type SbtiProfile = {
  code: string;
  chineseTypeName: string;
  mbtiEcho: string;
  requiredVector: Record<string, number>;
  creatureId: string;
  matchScore: number;
  evidenceConfidence: number;
  coreDescription: string;
  underStress: string;
  relationshipNeeds: string[];
  misunderstoodAs: string[];
  actuallyNeeds: string[];
  strengths: string[];
  blindSpots: string[];
  actionSuggestion: string;
  classicalSection: string;
  creativeSection: string;
  neighborCodes: string[];
  image: string;
};
```

每型必须同时有优势与真实代价，不能把盲点写成“过于善良”“太追求完美”一类假缺点。

## 异兽候选池

不要先决定 16 只再硬配，应先研究 24-32 只候选，程序计算后再做全局策划。第一批候选可包括：

- 鹿蜀、旋龟、九尾狐、凤凰、狌狌、猼訑、耳鼠、类。
- 毕方、朱厌、蛊雕、长右、帝江、精卫、烛阴、开明兽。
- 英招、陆吾、青鸟、当康、乘黄、天狗、夫诸、驺吾。
- 穷奇、讙、狰、朏朏等作为补充或对照候选。

每只正式进入候选池前必须核验：

- 是否直接见于《山海经》对应版本，还是后世或网络混入。
- 原文卷篇和可靠现代释义。
- 是否有足够行为/作用信息支持人格化。
- 是否存在明显灾异、食人或负面记载，结果页如何诚实呈现。
- 用户是否愿意认领，同时不能为了讨喜把凶兽洗成治愈萌宠。
- 美术轮廓是否与其他候选有足够差异。

白泽等常被纳入“山海异兽”的形象存在直接归属问题，未完成来源核验前不进入首发映射。

## 证据等级

```ts
type EvidenceItem = {
  claim: string;
  evidenceType:
    | "direct-text"
    | "behavior-inference"
    | "symbolic-inference"
    | "later-tradition"
    | "product-fiction";
  sourceId?: string;
  confidence: number;
};
```

内部审核等级：

| 等级 | 含义 |
|---|---|
| A | 有直接行为/作用证据，现代延伸自然 |
| B | 有明确象征或功能，但人格化包含较多创意解释 |
| C | 主要依赖外形、后世文化或产品设定，只能谨慎使用 |
| D | 映射牵强，不进入首发 16 型 |

用户端不显示技术等级，而是分成三个区块：

1. 《山海经》怎么记载。
2. 后世或现代如何理解。
3. SBTI 如何重新想象。

## 十六型与异兽的匹配算法

### 1. 类型目标向量

每个四字母类型先形成独立人格原型和目标向量，不考虑具体异兽。例如：

```json
{
  "code": "HVEM",
  "name": "隐泉型",
  "vector": { "R": -2, "H": 2, "T": -1, "V": 2, "L": -1, "E": 2, "S": -1, "M": 2 }
}
```

### 2. 单项综合得分

```text
总匹配分 =
人格维度相似度 × 45%
+ 文化原型吻合度 × 20%
+ 古籍证据充分度 × 15%
+ 视觉辨识度 × 8%
+ 用户认领意愿 × 7%
+ 十六型整体差异贡献 × 5%
```

### 3. 全局唯一分配

不能让每个类型独立选择最高分，否则多型会抢同一只热门异兽。应生成“16 类型 × 24-32 候选异兽”的得分矩阵，再使用最大权重二分图匹配或匈牙利算法给出全局唯一方案。程序结果只作为候选，最终由人工检查：

- 16 只异兽的视觉与气质差异。
- 是否过多集中于狐、鸟、龟等同类形态。
- 是否全部是瑞兽或全部是凶兽。
- 是否存在牵强映射、历史误导或性别刻板印象。
- 每型是否拥有足够的资料和可写出独特结果。

### 4. 主兽与相邻兽

每型首发只显示一只主兽，可保留一个相邻型解释。例如用户在守形/化生维度接近中点时，提示“你也可能在某些情境中表现出相邻兽格倾向”。相邻兽不能替代主结果，也不在首发做复杂配对玩法。

## 运行时数据模型

```ts
type Dimension = "RH" | "TV" | "LE" | "SM";
type Question = {
  id: string;
  scene: string;
  optionA: { text: string; scores: Partial<Record<Dimension, number>> };
  optionB: { text: string; scores: Partial<Record<Dimension, number>> };
  tags: string[];
  approved: boolean;
};
type BeastResult = {
  code: string;
  title: string;
  beast: string;
  oneLiner: string;
  strengths: string[];
  blindSpots: string[];
  needs: string[];
  action: string;
  classicalRecord: string;
  creativeNote: string;
  sourceIds: string[];
  image: string;
};
```

推荐目录：

```text
src/content/sbti/
  content.json
```

`content.json` 顶层统一包含 `meta`、`dimensions`、`questions`、`creaturesClassical`、`creatureArchetypes`、`profiles`、`relationships` 和 `sources`。所有内容数据带版本号，保存历史结果时同时记录 `questionVersion`、`profileVersion` 和 `creatureMappingVersion`。

## 计分规则

- 每题只影响 1-2 个维度，避免所有题都显得相同。
- 结果分数转换为 0-100 的连续值，再根据中点决定字母。
- 平分时使用专门的平衡题结果，不能随机决定。
- 首发进行 3 次完整人工模拟：偏好明显路径、四维均衡路径、混合边界路径。另用代码级可达性检查确认 16 型均存在合法答案组合，不进行 10,000 次随机模拟。
- 页面显示“倾向比例”而非伪造精确心理学百分比。
- 先计算连续倾向，再确定四字母代码；接近中点的维度在结果页明确写“比较平衡”。
- 题目直接给维度加权，不直接给某只异兽加分；异兽由已审核的 16 型映射表决定。

题目示例结构：

```text
你在山谷中发现陌生足迹，远处同时出现反常云光。你会先做什么？

A. 测量足迹的大小、方向和间距，沿路径继续调查。
   → 察微 T +2，观象 V -1，衡理 L +1

B. 登上高处观察云光与群山的关系，判断整体变化。
   → 观象 V +2，察微 T -1，化生 M +1
```

题目应组成“进入、深入、危机、归来”四章的半连续旅程；每题仍可独立计分，避免剧情选择锁死人格结果。

## 资料与匹配生产流程

1. 冻结八个偏好端点“测什么、不测什么”。
2. 先写 16 种不含异兽的类型人格原型。
3. 收集并审核 24-32 只异兽古籍资料卡。
4. 为候选异兽建立证据等级和八维候选向量。
5. 程序输出每型 Top 3 和全局唯一分配方案。
6. 人工做文化、视觉、认领意愿和历史准确性评审。
7. 锁定 16 型映射后再生成 16 张美术和 16 份终稿文案。
8. 用黄金样例指导 Codex 扩写题目，人工审核后才写入正式题库。
9. 完成 3 次代表性人工答题模拟，并运行代码级 16 型可达性检查。

在第 6 步完成前，不批量生成 16 张异兽图，以免映射变更造成资源返工。

## UI 与美术

- 风格：古籍夜读 + 山海雾境，不做常见金红宫廷风。
- 首屏只保留标题、异兽剪影、开始按钮和“约 2 分钟”。
- 题目采用全屏情境卡，选择后用墨迹向对应方向扩散。
- 结果显形使用剪影、粒子和渐显，不依赖视频。
- 16 张异兽图统一：同一构图比例、同一纸张纹理、同一色板、无文字。
- 图片建议 WebP；每张提供低清占位图。

## 内容验收

- 题目不能直接问“你是否外向”。
- 两个选项都应当体面，没有明显“正确答案”。
- 16 个结果不能只是褒义词排列组合。
- 《山海经》原文、现代译释和产品设定分栏展示。
- 页面固定写明娱乐性质。
- 古籍事实、行为推断、后世传统和产品创作具有独立字段，不能混写。
- 对九尾狐等包含危险、食人或灾异记载的异兽不删改原典来讨好用户。
- 不使用未经核验的“网络山海经设定”。
- 用户可理解“为什么匹配到这只异兽”，结果不能只靠神秘文案。
- 16 型文案之间具有实质差异，模板重复和同义改写需通过自动检查。

## 事实与品牌边界

- 产品不得使用官方 MBTI 题目、量表文本、类型角色形象或声称得到官方认证。
- 对外表述使用“MBTI-like 偏好结构”“与某四字母偏好相邻”，避免冒充正式 MBTI 结果。
- 固定声明：SBTI 为娱乐性文化创作，不用于心理诊断、能力评估、招聘、教育分流或重要人生决策。
- 《山海经》原文优先参考可追溯古籍文本；每条现代解释记录具体来源。
- 资料初始参考：Myers & Briggs Foundation 的四组偏好说明，以及中国哲学书电子化计划《山海经》各篇原文。正式发布前保存访问日期和具体卷篇。

## 测试

- 单元测试：计分、平分、回退修改答案、结果映射、历史存储。
- 内容测试：所有结果可达；每型字段齐全；所有图片和来源存在。
- 体验测试：2 分钟内完成；连续点击不跳题；刷新能恢复。
- 性能测试：异兽显形动画在低性能模式下降级。
- 匹配测试：每型主兽唯一；每个映射达到最低证据置信度；无 D 级映射进入首发。
- 路径测试：分别验证偏好明显、四维均衡和混合边界三条完整路径；代码级检查 16 型均可由合法答案组合到达。
- 内容测试：原文与创意解释不会在 UI 中混成同一段；所有来源 ID 可解析。
- 版本测试：题库或异兽映射升级后，旧结果标注旧版本，不静默改写用户历史。

## 后续迭代

- 题库随机抽题。
- 兽格关系图和双人对照（仍然本地计算）。
- 更多异兽档案与“为什么不是另一型”。
- 每季新增情境，但保留计分版本号，避免结果不可比较。

## 初始研究入口

以下仅作为资料库建设的起点；正式内容仍需逐条记录具体卷篇、版本、访问日期与引用范围：

- [Myers & Briggs Foundation：类型与四组偏好概览](https://www.myersbriggs.org/my-mbti-personality-type/myers-briggs-overview/)
- [The Myers-Briggs Company：MBTI Facts](https://www.themyersbriggs.com/en-us/support/mbti-facts)
- [Myers & Briggs Foundation：如何理解个人结果](https://myersbriggs.org/my-mbti-personality-type/my-mbti-results/home.htm)
- [中国哲学书电子化计划：《山海经·南山经》](https://ctext.org/shan-hai-jing/nan-shan-jing/zh)

研究人员从《南山经》继续进入其他卷篇时，应把每只候选异兽的原文地址保存到 `content.json.sources`，不能只记录网站首页或二手文章。
