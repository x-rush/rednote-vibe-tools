# SHBTI 山海兽格 Foundation 准备报告

日期：2026-08-24  
范围：仅 `projects/01-sbti/**`

## 本次任务范围

本次完成开发前工程基础：正式运行时内容、TypeScript 类型、运行时内容校验、确定性抽题与计分、应用状态模型、localStorage 适配、语义化页面骨架、自动化测试和移动端浏览器检查。

本次没有完成最终 UI、品牌色、字体、异兽插画、结果卡美术、显形动画、音效、发布或部署。

## 新增或修改文件

新增：

- `PREP_DESIGN.md`、`FOUNDATION_PLAN.md`、`PREP_REPORT.md`
- `src/content/types.ts`、`src/content/validate.ts`
- `src/quiz/types.ts`、`src/quiz/selection.ts`、`src/quiz/scoring.ts`、`src/quiz/scoring.test.ts`
- `src/app/state.ts`、`src/app/state.test.ts`、`src/app/useShbtiApp.ts`
- `src/storage/storage.ts`、`src/storage/storage.test.ts`
- `src/components/LandingPage.tsx`、`IntroPage.tsx`、`QuizPage.tsx`、`CalculatingPage.tsx`、`ResultPage.tsx`、`HistoryPage.tsx`、`ErrorPage.tsx`

修改：

- `src/content/content.json`、`src/content/content.test.ts`
- `src/App.tsx`、`src/App.css`、`src/index.css`
- `index.html`、`vite.config.ts`

未新增依赖，未修改根配置或锁文件，未执行任何 Git 写操作。

## 内容统计

- 题目：48 道正式题。
- 选项：96 个全局唯一稳定 ID；未使用数组下标作为业务 ID。
- 覆盖矩阵：4 章 × 4 主维度 × 每格 3 题。
- 选项位置：RH、TV、LE、SM 四维均为两端各 6 次出现在第一选项，计分只读显式 score。
- 单轮题量：24；每章 6、每维 6。
- 类型：16 个代码完整覆盖且唯一。
- 映射：16 种类型分别映射到 16 只唯一异兽，严格沿用 docs/30 冻结表。
- 内容版本：`1.0.0`；Schema：`1`。
- 每型包含核心描述、优势、压力状态、盲区、相处提示、自我照顾、分享标题/短句、原典说明、创作说明、免责声明和未来美术资源 ID。

## 核心抽题与计分规则

`selectQuestionIds(content, seed)` 使用内部 seeded PRNG，不调用 `Math.random()`。同一 seed 得到同一题序；题序生成后随进度保存。抽题采用 4×4 配额矩阵，每格取 1 或 2 题，使每章和每维均为 6 题；四道冻结平衡题必定入选。章内及跨章均避免连续出现相同主维度。

答案按 `questionId` 记录。再次回答同题会替换旧 `optionId`，全部分数每次从答案重新聚合，不做增量累加。每题只依据显式的 `dimension`、`pole` 和 `weight` 计分。

每维倾向强度：

```text
abs(leftScore - rightScore) / (leftScore + rightScore)
```

- `< 0.17`：游移
- `0.17–0.49`：轻偏
- `>= 0.50`：明显偏好

四个偏好端点依 RH、TV、LE、SM 顺序组成 16 型代码，再从冻结映射查找异兽。结果摘要翻转最弱维度选择相邻兽格提示；分享卡只显示主型。

## 平分规则

每维冻结一题作为 tie-breaker：

- RH：`question-mist-gate`
- TV：`question-broken-stones`
- LE：`question-breaking-bridge`
- SM：`question-journey-ending`

抽题器保证四题均进入本轮。维度总分相等时，以该平衡题实际选择的端点形成主类型，同时把该维标为“游移”、强度为 0。规则不依赖时间、`Math.random()` 或刷新次数；同一输入重复运行结果相同。

## 状态模型

页面状态：

```text
landing → intro → quiz → calculating → result
   ├─ history / empty
   └─ error → landing
```

支持开始、继续上次、上一题、修改答案、下一题、未完成阻止提交、完成计算、查看最近结果、返回首页、二次确认后重新测评、二次确认后清空数据、内容/存储异常 fallback。重新开始生成并保存新的显式 seed；修改答案不重新抽题。

## 本地存储 Schema

键：`xhs-tool:shbti:state:v1`

```ts
type StoragePayload = {
  schemaVersion: 1;
  quizVersion: string;
  updatedAt: string;
  data: {
    activeProgress?: {
      seed: string;
      questionIds: string[];
      currentIndex: number;
      answers: { questionId: string; optionId: string }[];
    };
    recentResult?: {
      code: string;
      completedAt: string;
      contentVersion: string;
      dimensions: DimensionResult[];
    };
    settings: { muted: boolean; reducedMotion: boolean };
  };
};
```

只保存一份最近结果，不形成无上限历史。最近结果不复制人格、异兽或分享文案，读取时按稳定 code 从当前内容包恢复。损坏 JSON、字段缺失、未来 schema、题库版本不匹配及悬空题目/选项引用均会返回明确恢复原因并只清除本项目键。不保存图片、Base64、音视频或 Blob；首发不使用 IndexedDB。

## 内容校验

启动和测试均执行 `validateContent`。错误使用 `ContentValidationError` 汇总带 JSON path 的问题。生产校验包括：48 题、题目及选项 ID 唯一、每题两选项、4×4×3 覆盖、合法维度/端点/权重、4 个平衡题及其维度引用、16 型完整唯一、异兽唯一映射、来源引用、相邻类型引用、美术 ID 格式，以及结果/分享必填文案。

## 自动化测试

最终测试：4 个文件、34 项测试、34 通过。

覆盖：

1. 48 题、96 选项、16 型、16 异兽计数。
2. 题目/选项/类型/异兽 ID 唯一。
3. 维度、端点、权重、4×4×3 矩阵和选项位置合法。
4. 16 型完整覆盖、每型异兽存在且唯一。
5. 结果文案、分享文案和美术 ID 完整。
6. 平衡题引用和悬空引用拒绝。
7. seeded 抽题确定、24 题配额、平衡题入选、相邻维度约束。
8. 改答替换而非重复累计。
9. 空/未完成答案不能生成正式结果。
10. 非法题目 ID、非法选项 ID 被拒绝。
11. 平分规则稳定且重复输入一致。
12. 16 型均可由合法完整答案抵达。
13. 三条完整端到端模拟：RTLS→陆吾、HVEM→九尾狐、HVLS→开明兽。
14. 分享 ViewModel 字段完整。
15. reducer 主流程、返回改答、历史、重测、恢复、清空和错误 fallback。
16. localStorage 无数据、有效往返、损坏 JSON、缺字段、未知 schema、未知题库版本、悬空引用和项目级清空。

## 验证结果

- `pnpm lint`：通过，0 error，0 warning。
- `pnpm test`：通过，4 files / 34 tests。
- `pnpm build`：通过；31 modules；JS gzip 85.07 kB、CSS gzip 1.30 kB。
- 生产预览控制台：0 error，0 warning。
- 375 / 390 / 430 CSS px：首页均无横向溢出；主要按钮高 48px。
- 答题页选项高 72px、按钮高 48px，无横向溢出。
- 375px 结果页无横向溢出，结果按钮高 48px。
- 浏览器完整路径：24 题可到结果页；刷新后显示“继续上次”并恢复到保存题号。
- 损坏 localStorage：显示文字恢复页并安全清除旧数据。
- 资源请求：仅本地 HTML、JS、CSS 与 SVG；无远程运行时请求。

## 文档冲突与保守处理

1. docs/11 将版本字段放在 `meta` 且给出 `xhs-tool:<project>:v<schema>`；docs/31 使用顶层版本字段及 `xhs-tool:<projectId>:state:v1`。采用日期更近、字段更精确且与脚手架一致的 docs/31。
2. docs/30 写 `abs(left-right) / questionCountOfDimension`，但冻结题目每次给端点 `+2`，会令“轻偏”区间基本失效。采用总已得端点分作为最大可能分归一化，保留 docs/30 的三档阈值语义。
3. docs/13 提到平衡题或最近有效选择趋势；docs/30 要求冻结 tie-breaker，仍平时显示双结果。当前任务要求稳定生成正式 16 型和单一异兽，因此采用“平衡题保证入选并决定主型，同时显示游移与相邻型”的保守规则。
4. docs/15 的 Q17–Q48 标为待盲审草案，而 docs/20、30、32 又将首发内容标为冻结/可开工。工程按冻结内容转写，但非作者盲测仍保留为发布门禁。
5. docs/18 要求 4 张章节背景、16 兽格印章和 8 个维度符号；`prep/asset-manifest.json` 只汇总为 6 个 UI pattern，没有逐项 ID。当前只预留稳定 ID，不制造或假定最终资源。

## 后续 UI 应调用的核心接口

- 内容：`validateContent(raw)`、`ShbtiContentPackage`
- 抽题：`selectQuestionIds(content, seed)`
- 答案：`recordAnswer`、`isQuestionAnswered`、`calculateProgress`
- 计分：`aggregateDimensionScores`、`determineTypeCode`、`generateQuizResult`
- 结果：`findBeastForType`、`generateResultSummary`、`generateShareCardViewModel`
- 重置：`resetQuiz`
- 状态：`createInitialState`、`appReducer`、`restoreQuizProgress`
- 存储：`loadStorage`、`saveStorage`、`clearStorage`、`toStoredResult`、`hydrateStoredResult`

React 页面通过 `useShbtiApp` 组合这些接口；后续 UI 不应把计分或 localStorage 调用移进组件点击逻辑。

## Windows 端待提供资源 ID

结果主视觉需与内容中的 `artAssetId` 一致：

```text
creature-luwu
creature-ershu
creature-dangkang
creature-xingxing
creature-yingzhao
creature-dijiang
creature-huan
creature-fenghuang
creature-xuangui
creature-bifang
creature-jingwei
creature-lushu
creature-kaimingshou
creature-zhuyin
creature-feifei
creature-jiuweihu
```

建议在 Windows 端 `asset-manifest.json` 冻结以下附加槽位 ID；接入前以 UI-HANDOFF 最终命名为准：

```text
hero-shbti
chapter-entry-background
chapter-trace-background
chapter-change-background
chapter-return-background
share-template-primary
share-template-compact
pattern-mist
pattern-cloud
pattern-scroll-border
pattern-reveal-particle
pattern-dimension-mark
pattern-result-seal
```

后续还需明确 16 个兽格印章和 8 个维度符号是独立资源，还是从上述主视觉/UI pattern 派生，避免与 prep 汇总数量冲突。

## 尚未完成的 UI 与美术

- 最终品牌色、字体、排版密度与组件视觉规范。
- 16 张异兽主视觉、4 章背景、兽格印章、维度符号和分享卡模板。
- 异兽显形动画、减少动态版本及最终资源加载 fallback。
- 音效与静音体验；当前只保留设置字段。
- DESIGN.md、UI-HANDOFF.md 和 Windows 端最终 asset-manifest 接入。
- Android/iOS 小红书 WebView 真机、平台上传包和发布规则验证。

## 当前已知风险

- Q17–Q48 仍需至少两名非作者完成题意/价值诱导盲审；Q11 已按黄金文档要求补入明确安全上限。
- 古籍链接、底本版本、异文、现代释义与发布许可仍需发布前人工复核；`source-dong` 目前只记录篇名，等待统一底本链接。
- 当前历史能力按冻结 localStorage 范围只保存最近一条结果，不是多条长期档案；以后扩展必须重新设计上限与迁移。
- UI 新一轮 seed 在控制器边界由当前时间生成，但抽题与计分核心只接收显式 seed，测试和结果均不依赖当前时间。
- 当前显形页是无动画的结构占位，设计资产接入后仍需低性能和减少动态模式复测。
- 本次只验证桌面 Chromium 模拟的 CSS 视口，不替代小红书 Android/iOS WebView 真机验收。

## 目录边界

已执行 `git diff --name-only -- projects/01-sbti`、`git diff --stat -- projects/01-sbti` 和项目限定的 `git status --short`。本实例新增与修改的全部文件均位于 `projects/01-sbti/**`；共享工作区中其他七个项目的并行修改未被分析、恢复、暂存或改动。
