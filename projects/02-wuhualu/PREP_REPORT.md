# 物华录 FOUNDATION 准备报告

日期：2026-08-24  
范围：`projects/02-wuhualu/**`

## 1. 文件变化

- `src/content/content.json`：机械封装 20 件首发文物、20 条来源记录、59 个干扰候选、分类、回合/收藏规则、资源 manifest 与全部页面业务文案。
- `src/content/types.ts`、`src/content/validate.ts`：领域类型、运行时生产校验、带 JSON path 的错误。
- `src/game/random.ts`、`quiz.ts`、`progress.ts`、`collection.ts`、`view-models.ts`：可复现随机、选题、选项、线索、计分、连胜、图鉴与页面 ViewModel 纯函数。
- `src/state/game-state.ts`：覆盖 11 种页面状态的判别联合 reducer。
- `src/storage/storage.ts`：带版本 envelope 的可注入 localStorage 适配器与损坏恢复。
- `src/app/page-model.ts`、`src/App.tsx`、`src/App.css`、`src/index.css`：语义页面骨架、基础移动端样式、错误与空状态。
- `src/**/*.test.ts`：9 个测试文件，覆盖内容、算法、状态、存储、ViewModel 与三局完整模拟。
- `vite.config.ts`：构建 `base` 改为 `./`，支持非根路径与本地静态打开。
- `index.html`：中文语言、正式标题和主题色。
- `FOUNDATION_DESIGN.md`、`FOUNDATION_PLAN.md`：经确认的设计与 TDD 实施记录。

## 2. 20 件文物统计

总数 20，ID 20 个且全部唯一，每件恰好 3 条递进文字线索、至少 3 个审校干扰记录、完整图/局部图/轮廓 fallback/缩略图 asset ID、解锁文案、答错解释、来源及内容版本。

历史阶段分布：史前 4、商周 2、春秋战国 5、汉代 5、唐代 4。首发分类覆盖史前陶器、玉器、青铜礼器、兵器、灯具、乐器、雕塑、丧葬器、金银器、香具。

来源状态：

- 14 件标记 `verified-from-provided-source`：表示已按规划给出的独立馆方/权威页面机械封装，不表示本次实现重新联网完成事实复核。
- 6 件标记 `pending-review`，列于下一节。

规划未提供的尺寸或出土字段保留 `null`，没有根据常识补写。已明确提供的数据保留原有限定语，例如“约”“与……出土背景有关”。

## 3. 待事实核验项

- `artifact-jade-dragon`：需定位中国国家博物馆独立馆藏页，复核具体用途和公众称号边界。
- `artifact-cloud-bronze-jin`：需补河南博物院独立详情页，复核失蜡法相关表述。
- `artifact-liusheng-jade-suit`：当前为河北旅游官方二级来源，需补河北博物院独立馆藏页。
- `artifact-boshan-incense-burner`：需补馆方专题或考古报告复核山形纹饰细节。
- `artifact-grape-bird-sachet`：需以馆方研究来源复核多层同心机械结构的精确表述。
- `artifact-tricolor-music-camel`：需定位陕西历史博物馆独立藏品页。
- 全部 20 件图片许可仍待 Windows 设计/美术阶段逐项确认；事实页 URL 不视为图片授权。

## 4. 选项生成算法

`createQuizQuestion` 先读取目标文物的人工审校候选，再按 `shape/use/period/material/pattern/category` 标签重合度排序，最后用全局候选池确定性补足。候选按显示名称去重，并排除正确名称和别名；正确项使用唯一 `artifactId`，非首发干扰项不伪造 Artifact 外键。

莲鹤方壶的“立鹤方壶同器另一件”按原规划保存为 `eligible: false`，只用于揭晓说明，不进入普通错误选项；不足时走全局 fallback。若全局仍不足三个不同候选，返回 `insufficient-distractors` 结构化错误，不重复或虚构选项。

`selectRoundArtifacts` 对非近期文物优先做 seeded shuffle，再应用同材质和同历史阶段最多 2 件的软约束；约束不能凑足时按确定性顺序放宽，但不产生重复文物。

## 5. Seed 机制

字符串 seed 先经 FNV-1a 风格哈希生成 32 位状态，再由 Mulberry32 风格步骤产生 `[0, 1)` 数值。所有 shuffle、题序和选项序都显式接收 seed；组件 render 中没有随机调用，也没有使用 `Math.random`。

今日局 seed 为 `daily-YYYY-MM-DD`，自由练习 seed 在点击事件中由时间戳生成。保存的当前局包含 seed 与固定 artifact ID 顺序，刷新后按同一 seed 重建相同选项顺序。

## 6. 图鉴与存储结构

存储键：`xhs-tool:wuhualu:state:v1`。

`StoragePayload` 保存 `schemaVersion: 1`、`contentVersion`、更新时间、图鉴条目、最佳分、最近 20 条作答、当前局、最近 10 件文物和静音/减少动态设置。图鉴解锁为幂等更新：保留最早解锁时间，只提升最高星级；按冻结玩法，文物完成揭晓后即进入图鉴，答对与否仍记录在最近作答中。

读取顺序为解析、schema 判断、字段校验、内容版本判断、Artifact ID 清理与数组限长。截断 JSON、未来 schema 或非法 payload 返回安全默认值和恢复原因，且不会自动覆盖原始坏值；用户明确执行恢复后才清空。内容版本变化保留仍有效的图鉴 ID，清除不可复现的旧题局。

持久化边界递归拒绝 Base64、`blob:`、HTTP(S) URL 和 Blob；没有 IndexedDB、图片缓存或媒体字段。

## 7. 资源 ID 约定

- 文物完整图：`asset-full-<artifact-slug>`
- 局部图：`asset-detail-<artifact-slug>-<level>`
- 轮廓/fallback：`asset-silhouette-<artifact-slug>`
- 图鉴缩略图：`asset-thumb-<artifact-slug>`
- 全局占位：`asset-global-placeholder`
- 分享封面槽位：`asset-global-share-cover`

manifest 路径规则集中为 `./assets/<usage>/<artifact-slug>.webp`，状态统一为 `planned`。FOUNDATION 不创建、下载或请求任何文物图片；页面用 CSS 几何占位和完整文字线索降级。

## 8. 页面接口

状态覆盖：`landing`、`intro`、`modeSelect`、`question`、`clueRevealed`、`answering`、`feedback`、`collection`、`artifactDetail`、`summary`、`error`。

页面骨架包括启动、说明、每日/练习模式、猜谜资源槽、线索、四选一、提交锁定、答题反馈、知识揭晓、五件总结、完整/空图鉴、详情与错误恢复。React 只读取类型化内容、状态和 ViewModel；文物事实、称号、标签及页面业务文案均来自 `content.json`。

## 9. 测试覆盖

Vitest 覆盖：

1. 20 件文物和唯一 ID。
2. 三条递进线索、asset ID、来源与引用。
3. 生产内容校验及未知根字段拒绝。
4. 题目四项唯一、正确项存在且仅一项。
5. seed 重现与近期题目降权。
6. 线索按序揭示且重复请求幂等。
7. 0/1/2 条追加线索对应 3/2/1 星及递减得分。
8. 连胜奖励和答错重置。
9. 图鉴重复解锁与最高星升级。
10. 干扰池不足的结构化 fallback，以及不可用同器候选过滤。
11. 存储往返、损坏、未来 schema、内容版本、旧 ID、限长和媒体拒绝。
12. reducer 主路径、重复提交、图鉴、详情、退出、重玩与错误恢复。
13. 全对、混合、全错三局完整五题模拟。
14. 文物详情和回合总结 ViewModel 完整性。
15. 11 种语义页面状态的标题/主操作与退出操作可见性。

## 10. 验证结果

- `pnpm lint`：退出码 0。
- `pnpm test`：9 个测试文件、34 个测试通过，0 失败。
- `pnpm build`：退出码 0；Vite 输出约 0.46 kB HTML、7.19 kB CSS、266.28 kB JS（gzip 约 80.35 kB）。
- 构建 HTML 使用 `./assets/...` 相对引用；本地 `file://` 首次加载成功。
- Chrome headless：首页和猜谜页在 375 / 390 / 430 CSS px 下均满足 `documentElement.scrollWidth === innerWidth`；测得最小按钮高度均为 44px。
- 关闭并重新打开同一本地构建后，首页显示“继续上次”，当前局恢复入口存在。

以上结果来自业务代码完成后的全新独立运行。

## 11. 等待 Windows 设计和美术

- 20 件文物完整图、局部图、轮廓/剪影和图鉴缩略图。
- 全局默认占位图与分享封面视觉；最终分享卡不在本阶段实现。
- 每张资产的图片性质、许可、署名、裁切和生成记录。
- 先批准 1 件基准图，再批量生成；AI 重构必须在界面标明性质，不得冒充馆藏实拍。
- 最终品牌字体、色彩、动效、音效、分享卡和发布适配。
