# 大理寺字案录基础准备报告

日期：2026-08-24  
内容版本：`1.0.0`  
存档 Schema：`1`

## 交付范围

本阶段已建立 8 案正式结构化内容、剧情节点图、运行时校验、通用选项式剧情引擎、线索/证物/推理/评分逻辑、localStorage + IndexedDB 存档层、语义页面骨架和自动测试。

本阶段未制作最终 UI、人物立绘、场景插画、证物/古文字图、最终字体、动效、音效或发布包。应用不使用后端、运行时外部 API、自由输入判题、NLP、`eval`、Service Worker 或用户媒体存储。

## 8 案数据统计

| 案件 ID | 节点 | 涉案人物 | 场景 | 线索 | 证物 | 推理题 | 结局 |
|---|---:|---:|---:|---:|---:|---:|---:|
| `case-home-roof-pig` | 20 | 3 | 3 | 3 | 4 | 3 | 1 |
| `case-rest-under-tree` | 20 | 3 | 3 | 3 | 4 | 3 | 1 |
| `case-take-ear` | 20 | 3 | 3 | 3 | 4 | 3 | 1 |
| `case-pick-from-tree` | 20 | 3 | 3 | 3 | 4 | 3 | 1 |
| `case-look-into-basin` | 20 | 3 | 3 | 3 | 4 | 3 | 1 |
| `case-martial-stop-spear` | 20 | 3 | 3 | 3 | 4 | 3 | 1 |
| `case-law-water-go` | 20 | 3 | 3 | 3 | 4 | 3 | 1 |
| `case-autumn-insect-fire` | 20 | 3 | 3 | 3 | 4 | 3 | 1 |
| **总计** | **160** | **11 个全局人物；每案引用 3 人** | **24** | **24** | **32** | **24** | **8** |

每案结构为：开场叙述 → 人物对话 → 三选一初判 → 字形调查 → 字书/历史解释调查 → 现代流传辨析 → 必需线索条件门禁 → 三道推理 → 参考判词结局。节点覆盖 `narration`、`dialogue`、`choice`、`clue`、`condition`、`scene`、`deduction`、`ending` 八类；所有继续、追问、判断和提交均来自 JSON 正式选项。

## 剧情引擎

核心纯函数位于 `src/game/engine.ts`：

- `createInitialCaseState` / `restartCase`：初始化或重开单案。
- `enterNode`：校验节点归属、记录已读、幂等应用节点效果、解析条件分支。
- `chooseOption`：只接受当前节点已解锁的正式选项并应用白名单效果。
- `setFlag`、`acquireClue`、`acquireEvidence`、`unlockScene`：不可变、幂等状态更新。
- `submitDeductionAnswer`：检查必需线索；错误答案留在原节点并给出内容反馈；正确答案跳转。
- `calculateVerdict`：按 JSON 评分规则输出 0–100 分、评价、命中规则、结案与下一案 ID。

进入节点设置语义页面状态；意外缺失节点、无可用条件分支或无法退出的运行时循环返回可展示领域错误，不让普通操作异常造成白屏。已读节点去重且最多等于本案正式节点数，不无限累计日志。

## 条件表达式

条件使用有限 JSON AST，不使用任意代码执行：

- 组合：`all`、`any`、`not`。
- 集合字段：`clueIds`、`evidenceIds`、`unlockedSceneIds`、`visitedNodeIds`、`completedCaseIds`，操作符为 `includes` / `not-includes`。
- flag：`flags + equals + key + boolean`。
- 推理答案：`deductionAnswers + answer-is + key + optionId`。

运行时校验拒绝未知字段、字段/操作符错配、失效内容引用和任意动态脚本。

## 存档 Schema

localStorage key：`xhs-tool:dalisizian:state:v1`。

```ts
type StoredEnvelope<T> = {
  schemaVersion: 1
  contentVersion: string
  updatedAt: string
  data: T
}
```

入口数据保存当前案件 ID、案件解锁、已完成案件、最佳评价与设置。案件进度优先写入 IndexedDB `xhs_zi_an_lu`：

- `caseProgress`：当前节点、flags、线索、证物、场景、已读节点、推理答案、初判/终判和完成状态。
- `caseVerdicts`：初判、终判、参考判词、得分、评价和完成时间。

IndexedDB 被阻止或事务失败时，降级到 `xhs-tool:dalisizian:records:v1`，每类最多 8 案。读取按解析 → schema → 字段白名单 → 当前内容 ID → 去重/限长执行；当前节点失效时只重开该案，原损坏入口字符串不被静默覆盖。写入前递归拒绝 Base64、Blob 和循环对象。

## 自动可达性检查

`analyzeCaseGraph` 静态收集节点选项、条件分支和推理答案跳转，使用正向可达、反向结局可达和强连通分量分析。8 案检查结果：

- 不可达节点：0。
- 悬空跳转：0。
- 非预期死节点：0。
- 无结局路径节点：0。
- 无法退出且不能抵达结局的意外循环：0。
- 可达结局：每案 1 个，共 8 个。

家字、武字、法字三案另通过公开剧情引擎 API 自动完整跑通；其余五案执行同一图结构可达性验证。

## 未确认的汉字知识

以下项目按冻结规划保持审慎表述，不视为已完成发布级逐字核验：

- 家：早期各字形、`豭省声` 的具体分期解释及其与社会生活推断的界线。
- 休：人依木传统会意分析对应的早期/篆文字形底本。
- 取：取耳制度材料与最初构形解释之间的关联强度和先后。
- 采：采、釆、彩的分期义项和字际关系。
- 监：监、鉴关系与人目、器皿构件的分期材料。
- 武：止的早期足/行进材料与“止戈为武”价值阐释、最初构形动机的关系。
- 法：灋各构件的早期实形、传统解释与现代研究对读。
- 秋：昆虫形、火等早期异体材料及不同研究观点的证据范围。

正式发布前必须按规划完成“早期字形数据库 + 字书/现代研究”两类资料交叉核验。当前不生成古文字图形，避免 AI 猜写。

## 后续 UI 所需接口

- 内容：`contentPackage`、`contentIndex`、`validateContentPackage`。
- 页面列表：`getCaseListItems`。
- 节点页面：`getNodeScreen`、`getReturnTarget`。
- 剧情操作：`enterNode`、`chooseOption`、`getAvailableOptions`、`submitDeductionAnswer`。
- 线索/证物：按 `caseState.clueIds/evidenceIds` 从 `contentIndex` 读取完整内容。
- 结案：`calculateVerdict`。
- 存档：`loadSave`、`saveLauncher`、`restoreCaseProgress`、`createIndexedDbCaseRecordStore`、`createResilientCaseRecordStore`。

页面状态已覆盖 `landing`、`caseList`、`briefing`、`investigation`、`scene`、`dialogue`、`clueBook`、`evidenceDetail`、`deduction`、`verdict`、`ending`、`error`。当前 CSS 仅提供单列移动骨架、44px 触控目标、安全区和长文本换行。

## 后续美术资源 ID

### 人物（11）

`asset-character-temple-official`、`asset-character-record-clerk`、`asset-character-evidence-keeper`、`asset-character-home-witness`、`asset-character-rest-witness`、`asset-character-take-witness`、`asset-character-pick-witness`、`asset-character-watch-witness`、`asset-character-martial-witness`、`asset-character-law-witness`、`asset-character-autumn-witness`。

### 场景（24）

每案固定三个语义槽：

- `asset-scene-home-{court|archive|street}`
- `asset-scene-rest-{court|archive|street}`
- `asset-scene-take-{court|archive|street}`
- `asset-scene-pick-{court|archive|street}`
- `asset-scene-watch-{court|archive|street}`
- `asset-scene-martial-{court|archive|street}`
- `asset-scene-law-{court|archive|street}`
- `asset-scene-autumn-{court|archive|street}`

大括号表示三个已实际写入 JSON 的独立稳定 ID，不是运行时 glob。

### 证物（32）

- 家：`asset-evidence-home-early-form`、`asset-evidence-home-shuowen`、`asset-evidence-home-phonetic`、`asset-evidence-home-social-leap`。
- 休：`asset-evidence-rest-components`、`asset-evidence-rest-gloss`、`asset-evidence-rest-method-limit`、`asset-evidence-rest-modern-shape`。
- 取：`asset-evidence-take-form`、`asset-evidence-take-rite`、`asset-evidence-take-semantic-change`、`asset-evidence-take-moral-fallacy`。
- 采：`asset-evidence-pick-form`、`asset-evidence-pick-bian-distinction`、`asset-evidence-pick-extensions`、`asset-evidence-pick-leaf-story`。
- 监：`asset-evidence-watch-form`、`asset-evidence-watch-gloss`、`asset-evidence-watch-mirror-relation`、`asset-evidence-watch-modern-story`。
- 武：`asset-evidence-martial-form`、`asset-evidence-martial-shuowen`、`asset-evidence-martial-foot`、`asset-evidence-martial-value-origin`。
- 法：`asset-evidence-law-old-form`、`asset-evidence-law-shuowen`、`asset-evidence-law-simplification`、`asset-evidence-law-water-fairness`。
- 秋：`asset-evidence-autumn-variants`、`asset-evidence-autumn-insect-fire`、`asset-evidence-autumn-modern-form`、`asset-evidence-autumn-debate`。

这些 ID 仅定义未来资源接口；当前没有创建、下载或引用图片。

## 测试与构建结果

2026-08-24 最终新鲜验证：

- `pnpm lint`：退出码 0，Oxlint 无警告。
- `pnpm test`：退出码 0；8 个测试文件、45 个测试全部通过。
- `pnpm build`：退出码 0；TypeScript project build 与 Vite 8.2.2 构建成功，26 个模块完成转换。
- 构建体积：HTML 0.46 kB（gzip 0.30 kB）、CSS 4.53 kB（gzip 1.65 kB）、JS 372.50 kB（gzip 91.92 kB）。
- 真实 Chrome 检查：入口、案卷列表、首案简报在 375、390、430 CSS px 下均满足 `documentElement.scrollWidth === innerWidth`；最小按钮高度约 45.38 CSS px。
- 内容长度：节点正文最长 61 字符，选项最长 15 字符；没有远程 asset、Base64、自由输入控件、`eval`、运行时 `fetch` 或 Service Worker。

Playwright CLI 未在本地依赖中提供；其 `npx` wrapper 会下载依赖，与本任务禁止依赖安装的规则冲突，因此移动检查改用系统已有 Chrome 的 DevTools 协议完成，没有修改依赖或锁文件。
