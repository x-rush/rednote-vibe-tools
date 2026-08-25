# SBTI UI Handoff

状态：`DESIGN APPROVED / ASSET BASELINE IN PROGRESS`

## 实现顺序

1. 读取 `DESIGN.md`。
2. 保持现有 Foundation 数据、算法、状态机和测试，不重写业务层。
3. 先实现首页、说明、答题、计算、结果、分享卡六个黄金页面。
4. 先接入陆吾基准资源；未完成的异兽使用统一剪影 fallback，不使用 emoji。
5. 375/390/430px 完成视觉检查后，再批量接入 16 兽。

## 页面状态

| 页面 | 主要表面 | 必要内容 | 禁止 |
|---|---|---|---|
| 首页 | 夜读 | 品牌、剪影、承诺、2 分钟/24 题、CTA | 长说明、多个同级按钮 |
| 说明 | 暖纸叠页 | 娱乐性、隐私、偏好非优劣 | 法务文字墙 |
| 答题 | 夜读 | 章节、进度、题干、四项行动选项、返回 | 显示计分、装饰抢题 |
| 计算 | 夜读 | 四枚维度印、显形提示、跳过动效 | 假百分比加载 |
| 结果 | 暖纸 | 类型、异兽、一句话、维度、解释边界 | 混写原典与创作 |
| 分享卡 | 暖纸或青墨 | 4:5、主图、代码、称号、一句话、维度印 | 塞完整报告 |

## ViewModel 边界

UI 不直接读取计分底层对象。建议由 Foundation 层提供：

```ts
type QuizScreenViewModel = {
  chapterLabel: string;
  current: number;
  total: number;
  progress: number;
  question: string;
  options: Array<{ id: string; marker: "甲" | "乙" | "丙" | "丁"; text: string }>;
  canGoBack: boolean;
};

type ResultScreenViewModel = {
  code: string;
  typeName: string;
  beastId: string;
  beastName: string;
  oneLine: string;
  imageSrc: string;
  imageAlt: string;
  dimensions: Array<{ label: string; left: string; right: string; value: number; balance: string }>;
  strengths: string[];
  blindSpots: string[];
  growthTip: string;
  classicalText: string;
  creativeText: string;
  disclaimer: string;
};
```

## Asset Contract

- 资源根目录建议：`public/assets/sbti/`。
- 异兽主图：`beasts/{beastId}/profile.webp`。
- 低清占位：`beasts/{beastId}/placeholder.webp`。
- 剪影 fallback：`beasts/_fallback/silhouette.svg`。
- 章节背景：`chapters/chapter-{1..4}.webp`。
- 维度印：优先项目内 SVG，不使用 AI 位图。
- 组件不得引用外部 URL。

## Acceptance

- 390×844 首屏 CTA 无滚动可见。
- 375px 下题目与四个选项可自然滚动，无横向溢出。
- 430px 下内容不被过度拉宽。
- 动画关闭后所有状态仍可理解。
- 图片未加载时仍能完成答题并阅读结果。
- 原典与产品创作具有可见标签。
- 分享卡在 4:5 画布内不截断名称与一句话。

运行时统一使用 `GuidePresence` 与 `GuideSheet` 承载闻山的当前台词、首次引导、召回帮助和异常恢复；章节交接使用 `ChapterInterlude`。所有台词为 DOM 文本；跳过/下一句 ≥44px；`guideVersion` 独立存储；主图依次降级到 placeholder 与 CSS 墨影。
## NPC 四态实现冻结

| 状态 | 预览 ID | 触发 | 主动作 | 关闭／恢复后保留 |
|---|---|---|---|---|
| 首次引导 | `case-guide-wenshan` | `guideVersion` 首次进入 | 下一句／跳过 | 跳过直接进入答题，不阻断核心功能 |
| 节点反馈 | `case-guide-wenshan-feedback` | 主兽格与近邻差值 ≤ 2 | 比较两卷／查看主结果 | 四维分数、主兽格、近邻 |
| 召回帮助 | `case-guide-wenshan-recall` | 用户点闻山头像 | 回到当前题 | 当前题号和全部已答题 |
| 异常恢复 | `case-guide-wenshan-recovery` | 本地历史写入失败 | 保存分享卡／重试写卷 | 本次答案摘要、四维和结果；不得用旧结果覆盖 |

正式资源使用 `public/assets/sbti/guide` 的 master／avatar／placeholder；对话必须为 DOM 文本，图片失败仍允许跳过、继续和保存分享卡。

## WSL 真实应用接入基线（2026-08-25）

审查对象：`projects/01-sbti`

真实应用当前已经完成 48 题内容、选题、四维计分、结果映射、近邻型、状态机、历史记录、本地存储和错误恢复。`pnpm lint && pnpm test && pnpm build` 已通过，34/34 测试为绿。以下接入只改表现层和必要的 UI 状态，不重写 Foundation。

### 不得改写的稳定层

- `src/content/content.json`、`types.ts`、`validate.ts`：除非发现设计字段确实缺失，否则不改内容契约。
- `src/quiz/scoring.ts`、`selection.ts`：不得为了页面表现改计分、平分或选题规则。
- `src/storage/storage.ts`：保留版本校验、损坏回退和仅存结构化状态的边界。
- `src/app/state.ts`、`useSbtiApp.ts`：保留现有主屏状态；新增引导、动效和抽屉状态优先作为组件局部 UI 状态，只有需要跨刷新恢复时才进入 reducer／storage。
- 现有测试不得删除或弱化；表现层接入完成后仍执行原 34 项测试。

### 组件接入矩阵

| 现有组件 | 已有能力 | 必须接入的冻结设计 | 允许新增的局部状态 | 不能发生 |
|---|---|---|---|---|
| `LandingPage.tsx` | 新测评、继续、历史、设置、清空 | S01/S02 夜读封面、品牌印、闻山首引、主视觉、单主 CTA、次级历史入口、设置底屉 | `guideOpen`、`guideStep`、`settingsOpen`、图片失败 | 多个同权重 CTA；把长免责声明压在首屏视觉中心 |
| `IntroPage.tsx` | 三条说明、返回、开局 | S03 暖纸叠页、闻山短提示、娱乐性／隐私／偏好非优劣三块可扫读信息 | 说明展开、引导跳过 | 法务文字墙；新增自由输入 |
| `QuizPage.tsx` | 章节、进度、四选一、前后题、提交 | S04 章节过场；S05 未选；S06 已选未确认；S07 返回修改；四项行动、卷页层级、明确选中反馈 | `chapterIntroSeen`、选项入场／确认反馈 | 选中后自动跳题；显示分数或人格暗示；装饰抢夺题干 |
| `CalculatingPage.tsx` | 计算中语义状态 | S08 四枚维度印依次显形、可跳过、`aria-live` 最终结果提示 | `revealStep`、`skipAnimation` | 假百分比；依赖动画才能继续；超过 1.8 秒不可跳过 |
| `ResultPage.tsx` | 主结果、四维、优势、压力、关系、自护、原典边界、分享预览 | S09–S13 主兽格揭晓、真实兽像、近邻比较、四维弱偏好提示、原典／创作分层抽屉、4:5 分享卡 | `sourceOpen`、`neighborOpen`、`imageFailed`、`sharePreviewOpen` | 一次铺满所有长文；把原典与创作混成同一段；图片失败白屏 |
| `HistoryPage.tsx` | 最近一个结果、空状态 | S14/S15 闻山召回、最近结果卷签、兽像缩略图、空记录行动 | `imageFailed` | 伪造多条历史；空状态只有一句“暂无数据” |
| `ErrorPage.tsx` | 安全返回 | S16 闻山异常恢复、发生了什么／保住了什么／下一步 | `detailsOpen` | 用人格化角色掩盖数据丢失；承诺未实际保存的结果 |

### 新增表现组件

建议只新增下列薄组件，业务数据仍由父页面传入：

```text
src/components/guide/GuidePresence.tsx
src/components/guide/GuideSheet.tsx
src/components/BeastPortrait.tsx
src/components/VolumeProgress.tsx
src/components/ChoiceSlip.tsx
src/components/ChapterInterlude.tsx
src/components/RevealSequence.tsx
```

`BeastPortrait` 统一处理正式图、低清占位和失败剪影；页面组件不得各自实现另一套 `onError`。`SourceDrawer` 中“典籍记录”“形象参考”“SBTI 创意解读”必须是三个可见层级，不以颜色作为唯一差异。

### 结果代码到正式资源

真实应用以结果 `code` 作为唯一映射键，禁止根据中文兽名拼路径。表中 `beastId` 是资源目录 ID；内容库当前的 `creatureId` 采用 `creature-{beastId}`，接入层需显式映射，不得假设两者字符串完全相同。

| code | beastId | 正式图 |
|---|---|---|
| `RTLS` | `luwu` | `/assets/sbti/beasts/luwu/profile-v2-reference-verified.webp` |
| `RTLM` | `ershu` | `/assets/sbti/beasts/ershu/profile-v2-reference-verified.webp` |
| `RTES` | `dangkang` | `/assets/sbti/beasts/dangkang/profile-v1-reference-verified.webp` |
| `RTEM` | `xingxing` | `/assets/sbti/beasts/xingxing/profile-v2-reference-verified.webp` |
| `RVLS` | `yingzhao` | `/assets/sbti/beasts/yingzhao/profile-v1-reference-verified.webp` |
| `RVLM` | `dijiang` | `/assets/sbti/beasts/dijiang/profile-v2-reference-verified.webp` |
| `RVES` | `huan` | `/assets/sbti/beasts/huan/profile-v1-reference-verified.webp` |
| `RVEM` | `fenghuang` | `/assets/sbti/beasts/fenghuang/profile-v1-reference-verified.webp` |
| `HTLS` | `xuangui` | `/assets/sbti/beasts/xuangui/profile-v3-reference-verified.webp` |
| `HTLM` | `bifang` | `/assets/sbti/beasts/bifang/profile-v1-reference-verified.webp` |
| `HTES` | `jingwei` | `/assets/sbti/beasts/jingwei/profile-v1-reference-verified.webp` |
| `HTEM` | `lushu` | `/assets/sbti/beasts/lushu/profile-v2-reference-verified.webp` |
| `HVLS` | `kaimingshou` | `/assets/sbti/beasts/kaimingshou/profile-v1-reference-verified.webp` |
| `HVLM` | `zhuyin` | `/assets/sbti/beasts/zhuyin/profile-v1-reference-verified.webp` |
| `HVES` | `feifei` | `/assets/sbti/beasts/feifei/profile-v2-reference-verified.webp` |
| `HVEM` | `jiuweihu` | `/assets/sbti/beasts/jiuweihu/profile-v3-reference-verified.webp` |

占位图从 manifest 的 `fallback` 读取；无独立占位图的结果统一进入 `_fallback/silhouette.svg`，不得临时使用 emoji、网络图片或另一只兽的图。

### 资源同步门禁

1. 从 Windows 设计工作区同步时，以 `public/assets/sbti/asset-manifest.json` 为白名单；参考原图、批次拼图、拒绝稿和 QA 截图不得进入首发包。
2. 同步后的每个 `src` 和 `fallback` 必须存在，文件字节不得超过 manifest 的 `maxBytes`。
3. 运行时不得读取 `research/`，考据档案只随仓库保存，不进入用户下载的静态包。
4. `<img>` 必须有固定 `width`／`height` 或 `aspect-ratio: 4 / 5`，避免显形页 CLS。
5. 首屏只预加载闻山头像或必要主视觉；16 张兽像按结果／历史使用时加载，禁止首屏全量下载。
6. 所有资源使用本地绝对站内路径，不使用运行时 CDN 和外部 URL。

### 视觉实现底线

- 首页是完整的“山海司夜读卷”构图，不是居中标题加按钮的脚手架；品牌、闻山或雾中卷门形成唯一主锚点。
- 功能页保持移动端任务密度，不把每段文字都包进同样圆角卡片。
- CSS 使用 `DESIGN.md` 的颜色、字号、间距和圆角变量；不继续使用当前单一系统字体与散落硬编码。
- 主按钮、选项、头像入口、抽屉关闭和分享预览均达到 44px 触控门槛。
- `prefers-reduced-motion: reduce` 与工具内“减少动态效果”都能关闭装饰动效，但不隐藏状态反馈。
- 375、390、430 三宽均以真实 WSL 应用截图验收；设计预览通过不能代替真实应用通过。

### 实施与提交顺序

1. 提交 A：同步 DESIGN／UX／NPC／资源白名单与正式资源，不改业务代码。
2. 提交 B：设计 tokens、全局表面、按钮、选项、可访问焦点与降级组件。
3. 提交 C：首页、说明、闻山首引与设置底屉。
4. 提交 D：章节过场、答题三态、进度与减少动效。
5. 提交 E：显形、16 型结果、近邻、来源抽屉、分享卡。
6. 提交 F：历史、空状态、异常恢复与图片失败路径。
7. 最终门禁：原测试 + 新 UI 测试 + build + 375／390／430 核心流截图 + 图片断链 + 控制台 + 包体检查。

每个提交完成后必须保持核心测评可运行；不得把“先删掉可用页面，最后一次性接回”作为实现策略。

## 2026-08-25 夜读卷组件交付

当前运行时以以下组件为准，取代上文尚未实现的候选命名：

- `GuidePresence`：头像、身份、当前台词和 44px 以上召回入口；图片失败为 CSS 墨影。
- `GuideSheet`：首次引导、章节交接、答题帮助和结果帮助共用卷页；打开聚焦标题，Escape 关闭，关闭后归还焦点。
- `VolumeProgress`：四枚卷印和 `第 N 章 · current / 24` 文本；完成、当前和未开始均有非颜色提示。
- `ChoiceSlip`：保留原生 radio 语义，整签可点，最小高度 72px；朱印只表示本题已选。
- `QuizExperience`：只管理递卷／收卷和帮助的瞬时 UI；正式答案、题号与存储仍由 `useSbtiApp` 管理。
- `RevealSequence`：`collecting → reading → complete`，可跳过，减少动态直接到 complete 语义终态。

稳定 CSS 入口为 `.landing-guide`、`.guide-presence`、`.guide-sheet`、`.volume-progress`、`.choice-slip`、`.chapter-interlude`、`.reveal-sequence`。任何后续调整不得把头像改为遮挡底部操作的 fixed 悬浮层，也不得把四个行动签压成双列或横滑。
