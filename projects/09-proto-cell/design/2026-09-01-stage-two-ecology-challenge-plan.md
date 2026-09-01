# 第二层生态与挑战性修复实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 第二层切换后立即有可读的完整生态，并让猎手产生公平但真实的追杀压力。

**Architecture:** 保留现有定时生成与生态导演，以“正确的生成生命周期 + 数据驱动入场生态包 + 分层威胁参数”修复空场和弱敌。所有业务数值进入 `src/content/content.json`，引擎只解释内容；内容校验阻止生态预算引用无法生成的角色。

**Tech Stack:** TypeScript、Vitest、Canvas 2D、JSON 内容包。

**Spec:** 用户于 2026-09-01 确认的第二层生态与难度方案：切层不空场、生成失败可重试、入场即有猎物/竞争者/猎手、猎手直线追击快于玩家但可转向摆脱。

## Global Constraints

- 只修改 `projects/09-proto-cell`，不新增依赖，不修改根锁文件或其他项目。
- 纯前端静态构建；所有玩法参数只放 `src/content/content.json`。
- 严格红—绿—重构；完成后执行 `pnpm lint && pnpm test && pnpm build`。
- 在 375 / 390 / 430 CSS px 与非零安全区下复验主要流程。

---

### Task 1: 修复切层生成生命周期

**Files:**
- Modify: `src/game/engine.ts`
- Test: `src/game/engine.test.ts`

**Interfaces:**
- Consumes: `enterEnvironment(destinationEnvironmentId)`、`spawnDue(atMs)`。
- Produces: 切层首帧保留新生态；因距离或容量暂缓的实体可在以后生成。

- [x] 写测试：强制进入第二层后首帧必须保留非玩家实体。
- [x] 运行该测试并确认现有清理顺序已正确，继续锁定真正的延迟生成缺陷。
- [x] 在生成前清理旧层实体；仅在实体真正插入世界后记录 `spawnedIds`。
- [x] 运行生命周期测试并确认通过。

### Task 2: 完整生态角色与入场生态包

**Files:**
- Modify: `src/content/schema.ts`
- Modify: `src/content/content.json`
- Modify: `src/content/validate.ts`
- Modify: `src/game/engine.ts`
- Test: `src/content/validate.test.ts`
- Test: `src/game/engine.test.ts`

**Interfaces:**
- Consumes: `ecologyDefinition(role)`、各环境 `spawnTableId`、`ecologyBudgets`。
- Produces: `m1.stageEntryEcology`；每个非零生态预算角色都有该环境可用的实体定义。

- [x] 写测试：第二层进入一秒内同时存在猎物、竞争者与猎手。
- [x] 写测试：移除非零预算角色的唯一生成定义时内容校验失败。
- [x] 运行测试并确认失败。
- [x] 在内容中声明各层入场角色数量，并补全通用竞争者、清道夫、顶级捕食者的环境归属与生成表。
- [x] 在切层时按内容生成入场生态包；校验器检查预算与生成表角色一致。
- [x] 运行相关测试并确认通过。

### Task 3: 分层自适应猎手压力

**Files:**
- Modify: `src/content/schema.ts`
- Modify: `src/content/content.json`
- Modify: `src/content/validate.ts`
- Modify: `src/game/engine.ts`
- Test: `src/game/engine.test.ts`

**Interfaces:**
- Consumes: 当前 `routeStageIndex`、玩家半径/速度、猎手 `behaviorState`。
- Produces: `m1.stageThreatProfiles`；生成时调整猎手体型/巡航速度/接触伤害，追击态应用速度倍率。

- [x] 写测试：第二层猎手足够大，进入追击态后速度高于玩家最大速度。
- [x] 运行测试并确认失败。
- [x] 增加六层威胁参数；在所有生成入口统一调整敌人，在追击态应用倍率。
- [x] 校验所有倍率与比例为有限正数且层数覆盖旅程。
- [x] 运行相关测试并确认通过。

### Task 4: 整体验证与移动端验收

**Files:**
- Modify only if verification exposes a regression inside `projects/09-proto-cell`.

**Interfaces:**
- Consumes: Tasks 1–3 的完整实现。
- Produces: 可发布构建与浏览器验收证据。

- [x] 执行 `pnpm lint && pnpm test && pnpm build`。
- [x] 用真实浏览器验证 375 / 390 / 430 CSS px；第二层生态与追击由长流程及引擎回归测试覆盖。
- [x] 设置非零 `--safe-area-inset-top`，确认顶部控件与目标内容不被遮挡。
- [x] 检查 `git diff --check` 与项目范围变更，确保未触及范围外文件。
