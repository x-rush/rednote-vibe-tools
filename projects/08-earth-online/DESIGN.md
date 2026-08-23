# 地球 Online：冒险者公会大厅——基础实现设计

日期：2026-08-23  
状态：已确认方案，待书面规格复核

## 目标与范围

在现有 React、TypeScript、Vite 静态工程内建立可测试的首发基础：100 条现实支线任务、运行时内容校验、确定性本地匹配、领取与结算状态机、XP/等级/连续记录/徽章、版本化本地存储，以及覆盖全部业务状态的语义页面骨架。

本阶段不制作最终视觉、公会插画、徽章美术或任务图标；不增加依赖；不调用后端、定位、设备能力或运行时 AI；不接受或保存图片、音视频、Base64、Blob、位置或完成证明。

## 内容契约

唯一业务内容入口为 `src/content/content.json`。顶层保持统一 envelope：`schemaVersion`、`contentVersion`、`projectId`、`meta`、`sources`、`content`。`content` 包含 `tasks`、`categories`、`goals`、`badges`、`filters`、`cooldown`、`fallback` 和 `safetyRules`。

首发恰好 100 条任务，机械保留权威文档中的任务 ID、标题、分钟、精力、环境、昼夜和社交条件，并补齐用户指定的描述、类别、地点条件、难度、XP、完成方式、放弃规则、冷却标签、安全标签、不适用条件、接取/完成/放弃/分享文案、未来图标 asset ID、未来徽章关联及内容版本。所有任务均为 0 元；E/D 两个任务等级只表示投入，不评价用户能力。

任务 asset ID 统一使用 `quest-icon-<category-slug>`；徽章 ID 和任务引用必须存在。户外任务必须同时具备白天、熟悉区域和公开安全区域标签；运动任务必须具备舒适范围和不适即停标签；全部任务必须具备无需购买、无需照片和无需个人资料标签。

## 模块边界

- `src/content/schema.ts`：领域枚举、Quest 等要求类型、内容包类型。
- `src/content/validate.ts`：无依赖运行时校验，返回带 JSON path 的问题列表；生产模式执行数量、引用、可匹配性和安全门禁。
- `src/content/index.ts`：只负责校验、建立 ID 索引和暴露类型化内容。
- `src/domain/random.ts`：字符串 seed 哈希、确定性 PRNG 和下一 RNG 状态。
- `src/domain/matcher.ts`：硬过滤、分阶段候选集、评分、seed 选择和解释。
- `src/domain/progression.ts`：XP、等级、连续记录、徽章及档案 ViewModel。
- `src/domain/quests.ts`：领取、接受、更换、放弃、完成和历史摘要纯函数。
- `src/app/state.ts`：页面状态联合类型、应用状态和 reducer；领域函数不依赖 React。
- `src/storage/storage.ts`：版本化 localStorage 状态、迁移/损坏恢复、白名单与历史上限。
- `src/storage/adventure-log.ts`：IndexedDB 日志和反馈仓储；不可用时返回明确降级，不让主流程白屏。
- `src/App.tsx`：只消费 ViewModel，呈现语义页面和基础交互。

生产代码按这些边界保持小而独立；测试与模块相邻或放入 `src/tests`，使用现有 Vitest，不增加测试依赖。

## 匹配流程

`matchQuest(quests, preference, context)` 是纯函数；context 显式提供 seed、日期/时间条件、近期推荐、近期完成、近期放弃及安全上下文。

硬条件在任何阶段都不可放宽：

1. 任务必须通过内容安全规则且 `approved` 为真。
2. 分钟不得超过用户可用时间。
3. 任务环境必须包含用户明确选择的室内或户外。
4. 白天/夜间必须匹配；户外任务只允许白天和安全、熟悉、公开区域。
5. 任务精力不得高于用户当前可用精力。
6. 用户选择不花钱时，任务费用必须为 0。
7. 用户选择不社交时，只允许 `solo`；允许社交时可加入 `optional`，首发无 `required`。
8. 用户选择的明确不适用条件不得命中任务。

候选阶段按以下顺序执行：

1. `exact`：满足全部硬条件、目标匹配、精力相等，且不在近期展示/完成/放弃排除窗口。
2. `goal-relaxed`：取消目标必须命中，仍把目标匹配作为最高软权重。
3. `energy-relaxed`：允许低于当前精力的任务，不允许超过当前精力。
4. `recent-relaxed`：按最旧记录优先释放近期展示和放弃排除；仍对其降权。完成任务在 `cooldownDays` 内继续排除。
5. `safe-fallback`：从满足全部硬条件的低投入安全池选择，忽略目标和类别偏好；若完成冷却耗尽全部候选，可按最早完成时间释放，但绝不释放安全、时间、地点、预算或社交硬条件。

如果连安全回退池也为空，返回结构化 `no-match`，页面说明哪些不可放宽条件导致无匹配，并允许用户返回修改状态；不伪造任务。

评分为可解释整数：目标匹配 +40、精力相等 +20、偏好类别 +10、未近期出现 +30、低于时间上限的贴合度最高 +10；近期放弃 -25、近期完成但已释放 -35、同类连续出现 -10。先取最高分组，再用 seed 在该组内选择。解释包含满足的偏好、应用的放宽阶段及未放宽的安全条件。

seed 先以 FNV-1a 32 位散列字符串，再用确定性整数 PRNG。相同内容版本、候选 ID 集、偏好、历史摘要和 seed 必须得到相同任务；更换任务推进 RNG 状态并排除当前 offer，因此刷新可恢复、测试可复现。

## 任务生命周期与奖励

每次接受任务生成稳定 `acceptanceId`，由显式时间戳与 RNG 状态构造；同一时刻只允许一个进行中任务。

- 领取：创建 offer，写最近推荐，但不奖励 XP。
- 接受：把 offer 转成 ActiveQuest；重复接受为幂等操作。
- 更换：记录 `swapped` 反馈与当前 offer，推进 seed 后重新匹配。
- 放弃：ActiveQuest 写入 `abandoned` 历史，不扣 XP、不改变连续记录。
- 完成：ActiveQuest 写入 `completed` 历史并结算 XP；同一 `acceptanceId` 再次完成不奖励、不新增完成记录。

首发 XP 由任务内容显式给出：E 级通常 20 XP，D 级通常 35 XP；校验范围为 1–100。等级采用累计阈值公式：到达等级 `L + 1` 需要累计 `100 × L × (L + 1) / 2` XP，即等级 1/2/3/4 的起点为 0/100/300/600 XP。档案同时返回当前等级、当前级进度、下一级阈值和剩余 XP。

连续记录接收显式 `YYYY-MM-DD` 日期键，不读取真实当前时间：首次完成为 1；同一自然日再次完成保持不变；紧邻下一自然日加 1；间隔一天以上重置为 1；放弃和更换不影响连续记录。测试覆盖月末、年末和同日重复。

徽章由内容中的 BadgeDefinition 驱动，规则只读取结构化统计。首发接口支持首次完成、累计完成数、连续天数、类别完成数和等级条件；解锁集合只增不减，返回本次新增徽章 ID。

## 状态模型与页面

页面状态为判别联合：`guildHall`、`preferenceSelect`、`questOffer`、`questAccepted`、`questComplete`、`questAbandoned`、`adventurerProfile`、`questHistory`、`badgeList`、`error`。reducer 处理打开偏好、领取、换一个、接受、完成、放弃、查看档案/历史/徽章、返回大厅、恢复成功和恢复失败。

刷新时先校验内容，再恢复存储。存在 ActiveQuest 时优先恢复执行页；只有 offer 时恢复任务告示；否则回大厅。重复点击完成由 `acceptanceId` 幂等保护。语义页面使用 `main`、`header`、`nav`、`section`、`form`、`fieldset`、`article`、`dl`、`ol` 和真实 `button`；主要触控目标不小于 44px，并在 375/390/430 CSS px 下无横向溢出。

## 存储

localStorage key 使用 `xhs-tool:earth-online:state:v1`，envelope 含 `schemaVersion`、`contentVersion`、`updatedAt` 和 `data`。StoragePayload 保存偏好、offer/active quest 的稳定 ID 与时间、最近推荐、有限历史摘要、完成任务 ID、XP、连续记录、徽章 ID、RNG 状态和设置；等级由 XP 派生。

历史上限为 100 条，最近推荐上限为 10 条，反馈只保存任务 ID、次数和时间。读取流程为 JSON 解析、版本判断、字段白名单、类型检查、内容引用检查、截断上限；损坏、未来 schema 或关键引用失效时保留原始 key，不静默覆盖，并返回可恢复错误。用户确认重置后才删除本项目 key 和 IndexedDB。

IndexedDB 数据库为 `xhs_earth_online`，提供 `adventureLogs` 与 `questFeedback` 两个 object store；仅保存结构化 ID、状态、数值和 ISO 时间。数据库不可用时，本轮仍可通过 localStorage 的有限历史运行，并明确告知长期日志降级。

## 错误与安全恢复

内容错误在应用入口转成可读错误页，开发测试保留具体 JSON path。存储损坏、未知版本、配额失败和 IndexedDB 被阻止均不得白屏或永久加载。`no-match` 是正常可恢复状态，不等同程序异常。

任务库校验拒绝危险/违法、陌生人骚扰、私人区域、隐私公开、高额消费、上传/定位依赖、不合理身体要求和治疗性承诺。运动文案必须允许根据自身状态停止。运行时安全过滤独立于分数，任何权重均不能恢复已过滤任务。

## 测试与验收

按 TDD 逐个建立失败测试，再写最小实现。自动测试覆盖：100 条任务、ID/枚举/引用/asset 格式、安全标签、可匹配性；全部硬条件；seed 复现；近期去重和分级放宽；领取/接受/更换/放弃/幂等完成；XP/等级边界；跨日连续记录；徽章；历史摘要；存储损坏/未来版本/上限；reducer 恢复；至少 12 组黄金偏好。

最终只在项目目录执行 `pnpm lint`、`pnpm test`、`pnpm build`，并运行 `git diff --name-only -- projects/08-earth-online` 与 `git diff --stat -- projects/08-earth-online`。`PREP_REPORT.md` 记录内容分布、算法、放宽、安全、seed、奖励、存储、黄金条件、验证结果以及后续 UI/美术需求。

## 约束冲突处理

权威文档要求 IndexedDB 保存长期日志，而任务文字也要求有限本地历史。实现采用 IndexedDB 为长期结构化日志、localStorage 为当前状态和有限恢复摘要，两者同时满足。用户要求的扩展 Quest 字段是对冻结 schema 的兼容补充，因此提升内容版本但保持 `schemaVersion: 1`；若实现发现字段形状不兼容，优先在本项目报告中记录，不修改共享文档。

技能模板通常要求提交设计和实施计划，但本任务明确禁止任何 Git 写操作，因此不会提交、暂存、建分支或修改 Git 元数据。
