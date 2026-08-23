# 物华录 FOUNDATION 设计规格

状态：已确认并实现  
日期：2026-08-23

## 1. 目标与边界

本阶段交付可静态构建、可离线运行的文物猜谜 FOUNDATION：机械封装 20 件首发文物，建立类型、运行时校验、确定性猜谜算法、图鉴与存储模型、页面状态机、语义页面骨架及自动测试。

本阶段不生成或下载文物图片，不实现最终视觉、最终分享卡、音效或发布部署；不增加依赖，不修改项目目录外文件。

## 2. 内容模型

唯一业务内容入口保持为 `src/content/content.json`。顶层包含统一 envelope、来源、20 件 `artifacts`、独立的 `distractorCandidates`、分类、回合规则、收藏规则、资源 manifest 和界面业务文案。

每件 Artifact 包含稳定 ID、名称和别名、时期、类别、材质、用途、可空的尺寸/出土/馆藏信息、简介、核心看点、文化知识点、三条递进文字线索、难度、干扰生成标签、解锁文案、答错解释、事实核验状态、来源备注、资源 ID 和内容版本。缺失事实使用 `null` 与明确的核验状态，不根据常识补写。

权威文档列出的多数干扰项不属于首发 20 件。它们封装为有稳定 ID、显示名称、匹配标签和来源 Artifact ID 的 `distractorCandidates`，不声明为 Artifact，也不参与图鉴。所有以 `artifactId` 命名的字段只允许引用 20 件正式文物。

## 3. 类型与校验

类型层至少公开 `Artifact`、`ArtifactCategory`、`ArtifactClue`、`AssetReference`、`QuizQuestion`、`QuizOption`、`QuizSession`、`GuessResult`、`CollectionEntry`、`ArtifactDetailViewModel` 和 `StoragePayload`。

运行时校验器返回带 JSON path 的错误列表，不静默修正内容。生产校验检查：项目 envelope、恰好 20 件 Artifact、稳定 ID 与全局/局部唯一性、枚举、非空文本、三条线索及递进级别、合法 asset ID、合法干扰标签、每件至少三个可用干扰候选、来源引用、Artifact 外键、图鉴文案和禁用的远程/Base64/媒体数据。

## 4. 猜谜与图鉴算法

随机数由字符串 seed 哈希后驱动确定性 PRNG；组件不得直接调用 `Math.random`。回合生成器优先满足 5 件、材质/时代分布和近期去重，在池太小时确定性降级，不生成重复题。

题目选项优先采用目标文物的人工候选，再按同类、同材质、同用途、同形制等标签补足，最后从全局候选池确定性回退。输出恰好四个不重名选项，正确答案唯一且必然存在；不足四项时返回结构化错误，不伪造或复制选项。

每件初始只展示第一条文字线索；用户最多逐级显示三条，重复请求同一级不重复计数。得分采用冻结星级规则：使用 0 条追加线索得 3 星，1 条得 2 星，2 条得 1 星；答错不继续扣星。每题同时产生数值得分、星级、连胜变化和可展示反馈。

图鉴在揭晓后解锁，不要求答对；重复解锁保持最早解锁时间，并仅提升最高星级。详情与总结页面均由纯 ViewModel 构建器生成。

## 5. 状态机

应用使用判别联合状态和纯 reducer，覆盖 `landing`、`intro`、`modeSelect`、`question`、`clueRevealed`、`answering`、`feedback`、`collection`、`artifactDetail`、`summary`、`error`。

事件包括开始、恢复、选择模式、使用线索、提交答案、查看解释、下一题、中途退出、查看/关闭图鉴、查看详情、重玩、存储恢复及内容异常。提交答案后锁定该题，快速重复提交不产生第二次计分或解锁。

## 6. 本地存储

存储键为 `xhs-tool:wuhualu:state:v1`。`StoragePayload` 保存 `schemaVersion`、`contentVersion`、更新时间、已解锁 ID 与最高星级、最佳得分、有限长度最近记录、可恢复当前局、近期文物 ID 和设置。

存储逻辑依赖可注入的 `StorageLike` 接口。读取执行解析、版本判断、字段校验和当前内容引用清理；损坏 JSON、未来 schema 或不兼容内容返回安全默认值及恢复原因。保存前限制数组长度并拒绝图片、Base64、音视频和 Blob 形状。MVP 不使用 IndexedDB。

## 7. 资源接口

所有路径由内容中的 asset manifest 集中管理。每件文物预留完整图、局部图列表、轮廓图和图鉴缩略图；全局预留默认占位图与总结/分享封面。FOUNDATION 中的资源状态均为 `planned`，运行时采用纯 CSS 占位容器和文字线索，不创建伪文物图片。

资源 ID 使用 `<kind>-<artifact-slug>` 或 `<kind>-<artifact-slug>-<level>` 的小写 kebab-case；组件只接收 `AssetReference`，不拼接路径。

## 8. 页面骨架与可访问性

React 页面只消费类型化 ViewModel 和状态机动作。建立启动、说明、模式选择、猜谜、线索/资源容器、选项、反馈、总结、图鉴列表、空图鉴、文物详情和错误恢复视图。

基础样式面向 375/390/430 CSS px，无横向溢出；主要触控目标至少 44px，支持安全区、键盘焦点、语义标题、状态播报和 `prefers-reduced-motion`。视觉仅使用中性博物档案柜结构，不决定最终品牌美术。

## 9. 测试策略

采用 Vitest 测试真实纯函数与 reducer，不依赖新增测试库。按 red-green-refactor 顺序覆盖：

- 内容数量、唯一 ID、线索、asset、来源及引用校验；
- 选项唯一、唯一正确项、seed 复现、近期去重和候选不足回退；
- 线索顺序、星级/得分、连胜、反馈和幂等解锁；
- 存储往返、损坏、未来版本和失效引用恢复；
- reducer 的提交锁定、退出恢复、图鉴和错误状态；
- 至少三局五题完整模拟及详情/总结 ViewModel 完整性。

最终只在项目目录运行 `pnpm lint`、`pnpm test`、`pnpm build`，再检查限定目录的 git diff。

## 10. 文件职责

- `src/content/content.json`：唯一业务内容和资源引用。
- `src/content/types.ts`：内容与领域公共类型。
- `src/content/validate.ts`：运行时内容校验与索引构建。
- `src/game/`：seed、题目、计分、图鉴和 ViewModel 纯函数。
- `src/state/`：应用状态、动作与 reducer。
- `src/storage/`：存储 envelope、校验和适配器。
- `src/App.tsx` 与样式：语义页面骨架和状态连接。
- `src/**/*.test.ts`：行为与内容测试。
- `PREP_REPORT.md`：转写、核验缺口、算法、接口和验证证据。

## 11. 完成判定

仅当 20 件内容、所有必需逻辑和页面状态完成，规定测试覆盖成立，且 lint/test/build 均以退出码 0 通过时输出 `FOUNDATION READY`。任何必须修改共享文件、无法消除的校验失败或指定命令失败均输出 `FOUNDATION BLOCKED`。
