# 关系说明书 MVP Implementation Plan

> **执行方式：** 当前 Codex 会话按测试驱动逐项实现。用户明确禁止 Git 写操作，因此本计划不包含提交步骤。

**Goal:** 构建一个纯前端、本地保存、无诊断结论的关系说明书生成与编辑工具。

**Architecture:** `content.json` 是唯一业务内容源；类型与运行时校验建立可信内容索引；答案、归纳、卡片、状态和存储均由独立纯函数处理；React 组件只消费类型化 ViewModel。单一 localStorage envelope 保存一份草稿和最近结果，损坏或未知版本安全回退。

**Tech Stack:** React 19、TypeScript 6、Vite 8、Vitest 4、浏览器 localStorage。

**Spec:** 用户任务说明及仓库冻结文档 `docs/00-总控与共用/{10,11,12,14,16,17,18,19,20,31,32}-*.md`、`docs/05-关系说明书/{05,21}-*.md`。

## Global Constraints

- 只能修改 `projects/05-relationship-manual/**`；不修改锁文件或共享配置。
- 不安装、删除或升级依赖，不做任何 Git 写操作。
- 纯静态前端，无后端、外部 API、CDN、Service Worker 或设备 API。
- 业务内容只存在于 `src/content/content.json`；不保存图片、Base64、音视频或 Blob。
- 结果只使用第一人称偏好、请求和边界语言，不诊断、不评分、不判断对错。
- 最终验证只运行 `pnpm lint`、`pnpm test`、`pnpm build`。

---

### Task 1: 内容契约与生产 JSON

**Files:**
- Create: `src/content/schema.ts`
- Create: `src/content/validate.ts`
- Replace: `src/content/content.json`
- Replace: `src/content/content.test.ts`

**Interfaces:**
- Produces: `RelationshipContentPackage` 及题目、选项、维度、分值、边界、结果片段、卡片规则类型。
- Produces: `validateContent(input: unknown): ContentValidationResult` 和 `getValidatedContent()`。

- [ ] 写内容计数、ID、引用、选择限制、fallback、卡片字段和安全语言的失败测试。
- [ ] 运行 `pnpm test src/content/content.test.ts`，确认旧骨架因缺字段失败。
- [ ] 定义类型、校验器并机械封装 16 题、42 条正式文案及辅助元数据。
- [ ] 重跑内容测试，确认通过。

### Task 2: 答案、偏好归纳与卡片 ViewModel

**Files:**
- Create: `src/domain/answers.ts`
- Create: `src/domain/profile.ts`
- Create: `src/domain/card.ts`
- Create: `src/domain/relationship.test.ts`

**Interfaces:**
- Produces: `applyAnswer(answers, question, optionIds)`、`validateSelection(question, optionIds)`。
- Produces: `buildRelationshipProfile(content, answers)`。
- Produces: `buildCardViewModel(content, profile, options?)` 和 `buildShareSummary(...)`。

- [ ] 写单选、多选、互斥、空选择、中性、强边界、并列和冲突合并失败测试。
- [ ] 运行关系逻辑测试，确认因模块缺失失败。
- [ ] 实现答案规范化、分值聚合、优先偏好、并列和场景化冲突合并。
- [ ] 写五组黄金输入及卡片完整性、第一人称、段落长度测试。
- [ ] 实现稳定、非空、长度受控的七段卡片和分享摘要，重跑测试。

### Task 3: 状态模型与本地存储

**Files:**
- Create: `src/state/state.ts`
- Create: `src/storage/storage.ts`
- Create: `src/state/state.test.ts`
- Create: `src/storage/storage.test.ts`

**Interfaces:**
- Produces: `createInitialState()` 和 `relationshipReducer(state, action)`。
- Produces: `saveDraft(storage, payload)`、`loadDraft(storage)`、`clearDraft(storage)`。

- [ ] 写页面转换、上一题、修改、跳过、必答阻止、重算和清空失败测试。
- [ ] 写 schema/content 版本、损坏 JSON、未来版本、非法引用和容量错误失败测试。
- [ ] 实现 reducer 与单 envelope 存储，重跑测试。

### Task 4: 语义页面纵向切片

**Files:**
- Replace: `src/App.tsx`
- Replace: `src/App.css`
- Replace: `src/index.css`
- Modify: `index.html`

**Interfaces:**
- Consumes: 已校验内容、reducer、卡片 ViewModel、存储 API。
- Produces: landing、intro、questionnaire、review、result、editCard、savedResult、error 页面。

- [ ] 写可由纯状态测试覆盖的 UI 流程行为。
- [ ] 实现关系情境、进度、选项、回顾、生成、编辑/隐藏/排序、简版/完整版及恢复界面。
- [ ] 添加无外部资源的基础响应式样式，确保 375/390/430px 无固定宽度溢出且主要控件至少 44px。
- [ ] 运行完整测试与类型构建，修正集成问题。

### Task 5: 报告与最终门禁

**Files:**
- Create: `PREP_REPORT.md`

- [ ] 记录内容统计、维度、冲突规则、安全规则、ViewModel、存储 schema 和待设计资源。
- [ ] 运行 `pnpm lint`、`pnpm test`、`pnpm build`，把真实结果写入报告。
- [ ] 运行 `git diff --name-only -- projects/05-relationship-manual` 和限定 diff 检查。
- [ ] 逐项复核用户的内容、逻辑、状态、存储、页面和 15 类测试要求。
