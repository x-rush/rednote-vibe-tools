# 《物华录》V2 内容数据契约

## 每件文物新增字段

```ts
type StorySection = {
  id: 'first-look' | 'making' | 'lived-world' | 'journey' | 'why-now'
  title: string
  body: string
  sourceIds: string[]
  narrativeMode: 'verified-fact' | 'bounded-context' | 'open-question'
}

type ObservationSpot = {
  id: string
  x: number
  y: number
  radius: number
  label: string
  note: string
  clueCategory: 'shape' | 'material' | 'craft' | 'trace'
  assetRole: 'observation'
}

type ClueCard = {
  id: string
  category: 'shape' | 'material' | 'provenance'
  label: '看形' | '辨材' | '问来历'
  text: string
  npcHint: string
  starCost: 0 | 1
}

type MemoryChallenge = {
  prompt: string
  options: { id: string; label: string }[]
  answerId: string
  explanation: string
  sourceIds: string[]
}

type ArtifactV2 = ArtifactV1 & {
  setId: 'first-fire' | 'ritual-bronze' | 'chu-sound' | 'han-light' | 'tang-world'
  timelineOrder: number
  storyHook: string
  story: StorySection[]
  observationSpots: ObservationSpot[]
  clueCards: ClueCard[]
  memoryChallenge: MemoryChallenge
  relatedArtifacts: { artifactId: string; reason: string }[]
  guideLines: {
    beforeObservation: string[]
    clueOpened: string[]
    correct: string[]
    incorrect: string[]
    archived: string[]
  }
  storyFactCheckStatus: 'verified' | 'mixed-with-bounded-context' | 'pending'
  storyContentVersion: string
}
```

同一观察台上的全部 `observationSpots` 必须使用一张经过统一坐标校准的 `observation` 底图；拆开线索印不得更换这张底图或移动已显示的观察签。

## 内容长度门禁

- `storyHook`：18–48 字，必须具体，不使用“穿越千年”“古人智慧”等空泛模板。
- 每个 `StorySection.body`：80–180 汉字。
- 五段合计：480–800 汉字；资料确实不足时允许 360–480 字，但必须用 `open-question` 说明未知。
- `ObservationSpot.note`：18–60 字，只讲看得到或来源可证的细节。
- `ClueCard.text`：18–52 字；三条从不同证据维度出发，禁止同义改写。
- `MemoryChallenge.explanation`：30–100 字，错了也能学到信息。
- 每种 `guideLines` 至少 3 条，每条 12–42 字；不得泄露答案、冒充亲历或制造未证实故事。

## 事实门禁

1. `verified-fact` 的每一段至少一个 A 级来源。
2. `bounded-context` 可以描述时代环境，但必须避免给具体无名制作者编造姓名、对白、动机和一天中的精确场景。
3. `open-question` 必须明确指出尚无定论或本工具资料不足，不能用悬疑语气暗示存在唯一答案。
4. 铭文原文不得由 AI 生成；需要展示时只使用经过来源核对的文本字段，不烘焙进生成图片。
5. 生成图永远标为“创意重构”，不能称“复原图”“原貌”或“实拍”。
6. 文物实际损伤、修复痕迹和视角遮挡不能为好看而擅自补全。

## 存储迁移

- 继续使用结构化本地存储，不保存用户图片、Blob、Base64 或音视频。
- V1 的 `bestStars / unlockedAt` 原样迁移。
- V2 新增 `observedSpotIds / memoryCompleted / storyReadSections / setSealIds`。
- 缺失 V2 字段按空集合处理，不能因为升级清空旧图鉴。
- 内容版本与存储 schema 分开递增；内容扩写不应触发用户进度重置。

## 首个黄金样例标准

先以“曾侯乙编钟”制作完整 V2 黄金样例，因为馆方资料同时覆盖器形、数量、悬挂结构、铭文、双音、音域、出土和礼乐意义，足以验证五段故事、扫光观察、记忆回钩与关联文物。黄金样例通过后再批量扩写其余 19 件，避免 20 件同时复制不成熟模板。
