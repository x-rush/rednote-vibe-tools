# 大理寺字案录基础实现设计

状态：设计已确认，等待书面规格复核  
日期：2026-08-23

## 目标与边界

本阶段交付《大理寺字案录》的开发基础：8 案正式内容、可校验的剧情图、与 UI 解耦的选项式剧情引擎、线索/证物/推理/结案逻辑、结构化本地存档、语义页面骨架、测试与 `PREP_REPORT.md`。

本阶段不交付最终 UI、角色立绘、场景或证物插画、古文字图形、字体、动效、音效和发布包。应用保持纯前端静态构建，不使用后端、运行时外部 API、自由输入判题、NLP、`eval`、Service Worker 或用户媒体存储。

所有事实型汉字内容只采用冻结资料 `docs/03-大理寺字案录/28-大理寺字案录8案内容与数据契约.md` 已给出的结论边界、引文入口和措辞。未完成“早期字形数据库 + 字书/现代研究”双来源逐字复核的条目不得扩写成确定结论，并在 `PREP_REPORT.md` 列为待确认知识。

## 内容架构

运行时唯一业务内容入口为 `src/content/content.json`。顶层保留冻结根结构：

- `characters`：可跨案件复用的人物，包含稳定 ID、称谓、叙事职责和未来立绘 asset ID。
- `cases`：8 个案件元数据，包含标题、副标题、序号、难度、简介、开场、核心汉字知识摘要、人物引用，以及本案的场景与线索定义、节点/证物/结局引用、起始节点、推理题、评分与解锁条件。
- `nodes`：全部案件的规范化剧情节点；每个节点带 `caseId`。
- `evidence`：证物与知识证据，包含类别、说明、相关线索和未来证物 asset ID。
- `endings`：结案文案、参考判词、错误对照、来源与争议说明。

场景与线索嵌套在所属案件内，从而保持冻结的五个顶层业务字段不变。它们是案件运行必需实体，不复制到 TypeScript。每个案件通过人物、场景、证物、线索、节点和结局 ID 清单明确所有权；运行时建立 Map 索引。

节点类型为：

- `narration`：普通叙述。
- `dialogue`：人物对话。
- `choice`：2–3 个预设选项分支。
- `clue`：进入时幂等获得线索或证物。
- `condition`：按有限条件表达式选择分支。
- `scene`：进入时切换并解锁场景。
- `deduction`：展示预设推理问题与答案选项。
- `ending`：完成案件并生成评分。

叙述、对话和转场的“继续”也作为 JSON 中的正式选项，不由组件临时生成。选项效果只允许设置 flag、增加线索/证物、解锁场景和增加断案风格标签；事实结论不会随选择改变。

## 条件表达式

条件系统使用可递归 JSON AST：

- 组合：`all`、`any`、`not`。
- 叶子字段：`flags`、`clueIds`、`evidenceIds`、`unlockedSceneIds`、`visitedNodeIds`、`deductionAnswers`、`completedCaseIds`。
- 操作符：集合字段使用 `includes` / `not-includes`；flag 使用 `equals`；推理答案使用 `answer-is`。

校验器拒绝未知字段、字段与操作符的不合法组合、错误值类型和任意代码字符串。运行时解释器是纯函数，不使用动态代码执行。

## 内容校验与节点图分析

内容加载分成两层：

1. `validateContentPackage` 校验 envelope、数量、枚举、字段形状、稳定 ID、实体唯一性、引用、答案和失败反馈。
2. `analyzeCaseGraph` 分析单案有向图；`analyzeAllCaseGraphs` 汇总 8 案。

图边来自节点选项、条件分支和推理答案跳转。分析报告至少包含：

- `unreachableNodeIds`：从起点不能到达。
- `danglingTransitions`：目标节点不存在。
- `unexpectedDeadEndNodeIds`：非结局节点没有任何出边。
- `noEndingPathNodeIds`：从该节点不能到达任一结局。
- `unexpectedCycleNodeIds`：处于不能退出且不能到结局的强连通分量。
- `reachableEndingIds`：从起点可达的结局。

校验还会检查关键线索、所有推理节点和结局是否可达；人物、场景、线索、证物引用是否属于同案；每个推理问题是否有且仅有正确选项；每个错误选项是否包含反馈；条件字段是否合法。

## 剧情引擎

`src/game/engine.ts` 暴露纯函数接口：

- `createInitialCaseState`
- `enterNode`
- `chooseOption`
- `setFlag`
- `acquireEvidence`
- `acquireClue`
- `unlockScene`
- `evaluateCondition`
- `getAvailableOptions`
- `submitDeductionAnswer`
- `calculateVerdict`
- `restartCase`

状态更新采用不可变数据与集合幂等语义。进入节点会记录有限去重的已读节点，并应用该节点的一次性效果。选项必须属于当前节点且满足条件，否则返回可展示的领域错误。推理错误保留在当前推理节点并返回对应反馈；正确或允许继续的答案按数据跳转。

评分由数据定义：必需线索收集比例、推理正确数、结论是否匹配参考判词、可选线索和风格标签。评分函数输出数值、等级、命中的评分规则和结案文案；不会用正确率羞辱玩家。成功结案后解锁 `order + 1` 的案件，最后一案不产生无效解锁 ID。

## 页面状态与 React 骨架

应用页面状态覆盖：`landing`、`caseList`、`briefing`、`investigation`、`scene`、`dialogue`、`clueBook`、`evidenceDetail`、`deduction`、`verdict`、`ending`、`error`。

页面控制器只将内容和引擎状态映射为 view model。语义骨架包括入口、案卷列表、简报、调查场景、人物名牌、对话文本、选项列表、线索簿、证物详情、推理提交、错误反馈、结案结果和错误/空状态。查看线索或证物时记录返回页面与节点；关闭后恢复原对话。返回案卷列表会先持久化当前案件。已通关案件可重玩，重玩仅重置该案当前进度，不删除最佳评价或其他案件。

CSS 只提供结构、44px 级触控目标、安全区、文字换行和 375/390/430 宽度无横向溢出的基础约束，不实现最终品牌视觉。

## 存档架构

存储访问集中在 `src/storage/`：

- localStorage key：`xhs-tool:dalisizian:state:v1`，保存入口状态、当前案件 ID、案件解锁/完成状态、最佳评价和设置。
- IndexedDB：`xhs_zi_an_lu`，对象仓库 `caseProgress` 与 `caseVerdicts`，分别保存案件进度和结案记录。
- IndexedDB 不可用时，统一仓库可降级为同一 envelope 下的有限 localStorage 结构，并返回降级状态供 UI 提示。

每个 envelope 包含 `schemaVersion`、`contentVersion`、`updatedAt` 和 `data`。读取顺序为 JSON 解析、schema 检查、字段白名单、数组长度限制、内容 ID 复核和安全默认值恢复。损坏数据不导致白屏；返回默认存档和可展示的恢复原因。已读节点去重并限制为当前内容全部节点数，不保存逐次访问日志。写入层递归拒绝 Base64、Blob、图片、音频和视频值。

测试通过注入 `StorageLike` 与案件记录适配器，不依赖浏览器全局或第三方 IndexedDB 模拟库。

## 测试策略

采用测试先行：每组生产能力先写最小失败测试并确认预期失败，再实现使其通过。

- 内容测试：8 案、数量和 ID 唯一、所有引用、正确答案、失败反馈、事实来源、资源 ID、条件字段。
- 图测试：全部案件无悬空、关键不可达、意外死节点、无结局路径和意外闭环；每案至少一个可达结局。
- 引擎测试：条件选项解锁、线索/证物幂等、flag、场景、回看、错误推理、正确结案、评分和下一案解锁。
- 存档测试：保存/恢复、损坏 JSON、未来 schema、过量数组、失效 ID、媒体值拒绝。
- 路径测试：自动完整跑通家、武、法三案；其他五案执行全图结构验证。
- 构建门禁：`pnpm lint`、`pnpm test`、`pnpm build`。

移动宽度通过 CSS 静态断言与构建后人工可检查说明覆盖 375、390、430 CSS px；本阶段不引入浏览器自动化依赖。

## 文件边界

预计创建或修改：

- `src/content/content.json`
- `src/content/types.ts`
- `src/content/validate.ts`
- `src/content/graph.ts`
- `src/content/*.test.ts`
- `src/game/conditions.ts`
- `src/game/engine.ts`
- `src/game/*.test.ts`
- `src/storage/types.ts`
- `src/storage/storage.ts`
- `src/storage/*.test.ts`
- `src/App.tsx`
- `src/App.css`
- `src/index.css`
- `PREP_REPORT.md`

不会修改项目外文件、依赖或锁文件，不执行任何 Git 写操作。

## 验收结论规则

只有在限定目录内的内容校验、测试、lint 和 build 全部以退出码 0 完成，且 `git diff --name-only -- projects/03-dalisizian` 只列出允许文件后，最终输出 `FOUNDATION READY`。任何必须修改共享文件、无法满足内容/图门禁或验证失败的情况输出 `FOUNDATION BLOCKED`。
