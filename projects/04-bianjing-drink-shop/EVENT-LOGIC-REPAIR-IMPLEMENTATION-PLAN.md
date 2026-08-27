# 完整剧情逻辑修复实施计划

> 仅修改 `projects/04-bianjing-drink-shop`，不新增依赖，不提交或推送。

**目标：** 修复 21 个普通事件和五条假分支连锁，并建立可阻止同类错误回归的自动质量门。

**架构：** 在固定三节点连锁上增加条件变体。选中事件时冻结 `variantId`，展示、结算、结果回放和存档校验共同使用同一解析函数。普通事件继续由 `content.json` 驱动。

**技术栈：** React、TypeScript、Vitest、Testing Library、Vite、Playwright CLI。

## 任务 1：用失败测试定义质量底线

**文件：**

- 修改：`src/content/event-quality.test.ts`
- 修改：`src/content/event-quality.ts`

1. 为零效果选择、虚假未来提示和严格劣势选择添加行为测试。
2. 运行定向测试并确认新用例因缺少验证而失败。
3. 实现最小验证逻辑并确认转绿。

## 任务 2：定义并解析连锁变体

**文件：**

- 修改：`src/domain/types.ts`
- 修改：`src/content/schema.ts`
- 修改：`src/engine/events.ts`
- 修改：`src/engine/events.test.ts`

1. 先写解析唯一变体、无匹配回退、歧义拒绝的失败测试。
2. 增加 `EventChainNodeVariant` 和纯函数变体解析器。
3. 扩展内容结构校验，覆盖变体条件、效果与引用。
4. 运行定向测试确认通过。

## 任务 3：冻结分支并贯通展示、结算和存档

**文件：**

- 修改：`src/domain/types.ts`
- 修改：`src/engine/simulator.ts`
- 修改：`src/state/view-model.ts`
- 修改：`src/storage/save-codec.ts`
- 修改：对应的 `*.test.ts`

1. 先写事件选中后保存 `variantId`、读档保持分支、结算应用同一选择、结果展示同一文本的失败测试。
2. 贯通可选 `variantId`，旧存档缺失时安全解析。
3. 运行引擎、视图模型与存档定向测试。

## 任务 4：修复 21 个普通事件

**文件：**

- 修改：`src/content/content.json`
- 修改：`src/content/event-quality.test.ts`
- 修改：`src/engine/story-integration.test.ts`

1. 为高风险事件添加手工契约表，明确每个选择的关键收益、代价与长期承诺。
2. 运行测试，确认旧内容触发失败。
3. 重写选择、结果、提示与效果，修正反转、严格支配和空后果。
4. 运行内容与剧情集成测试。

## 任务 5：重写五条连锁的真实分支

**文件：**

- 修改：`src/content/content.json`
- 修改：`src/content/event-quality.test.ts`
- 修改：`src/engine/story-integration.test.ts`

1. 为每条连锁写出第一幕 1 个、第二幕 2 个、第三幕 4 个内容路径。
2. 每条路径保留清晰的当前取舍，并让前序旗标影响后续正文、选择和效果。
3. 添加 20 条终局路径的集成测试，检查无死链、无串线、效果不同。
4. 运行内容、事件和剧情测试。

## 任务 6：平衡、回归与移动端验收

**文件：**

- 修改：`src/engine/balance-audit.test.ts`（仅在需要补充回归时）
- 修改：`VISUAL-QA.md`

1. 运行全部内容与经济模拟，检查异常支配、财富膨胀和体力陷阱。
2. 运行 `pnpm lint && pnpm test && pnpm build`。
3. 启动生产预览，使用真实浏览器验证 375 / 390 / 430 CSS px 的顶部安全区、事件分支、选择和结算。
4. 记录最终证据和仍属设计取舍的边界。
