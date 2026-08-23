# 汴京饮子铺：今日开张——基础实现设计

状态：待用户最终审阅  
日期：2026-08-23

## 目标

在现有 React、TypeScript、Vite 静态项目中完成一个可离线运行、可确定性复现的 100 日文字经营游戏基础版本。交付范围包括正式内容 JSON、经营模拟器、事件与连锁引擎、状态机、存档恢复、语义页面骨架、自动测试和准备报告；不包含最终视觉、美术、音效、部署或最终平衡重做。

## 硬约束

- 只修改 `projects/04-bianjing-drink-shop/**`。
- 不新增依赖，不修改工作区配置或锁文件，不执行 Git 写操作。
- 运行时无后端、CDN、外部 API、Service Worker 或 Node API。
- 所有业务内容只存在于 `src/content/content.json`；TypeScript 仅定义类型、校验、规则和 view model。
- 存档只包含稳定 ID、数值、时间和有限摘要；不保存图片、Base64、音视频或 Blob。
- 事件条件与效果采用有限的强类型结构，不执行表达式字符串，不使用 `eval`。

## 方案选择

采用分层纯函数内核，不采用单体 React reducer，也不建立跨项目通用规则平台。

1. 内容层负责冻结数据、页面文案和显式 fallback。
2. 领域层负责类型、内容校验、RNG 和数值边界。
3. 引擎层负责事件筛选、日结、连锁和结局。
4. 存储层负责序列化、校验、快照与浏览器适配。
5. 应用层负责状态转换和类型化 view model。
6. React 页面只消费 view model 并派发动作。

这样可让经济与事件逻辑脱离浏览器独立模拟，也能让 IndexedDB 失败时不影响规则测试或静态首屏。

## 文件边界

计划创建或调整以下职责单一的模块：

```text
src/
  content/
    content.json       唯一业务内容包
    schema.ts          内容类型与运行时校验
    index.ts           校验后的内容索引
  domain/
    types.ts           游戏状态、决策、结果和存档类型
    rng.ts             可序列化的确定性 RNG
    numbers.ts         统一取整与 clamp
  engine/
    conditions.ts      有限事件/结局条件判断
    effects.ts         多属性效果和延期效果应用
    events.ts          权重、冷却、冲突、一次性和连锁候选池
    economy.ts         客流、需求、销量、收入、成本和库存
    endings.ts         破产与第 100 日结局优先级
    simulator.ts       开门、事件选择、日结和批量模拟编排
  state/
    game-machine.ts    页面状态与合法转换
    view-model.ts      页面所需类型化展示数据
  storage/
    save-codec.ts      存档白名单、迁移、损坏恢复
    repository.ts      存档仓库接口与内存实现
    indexed-db.ts      原生 IndexedDB 实现
    launcher.ts        localStorage 当前存档指针与设置
  tests/
    fixtures.ts        测试状态、决策与策略代理
  App.tsx              语义页面骨架与交互编排
  App.css              移动端基础布局，不做最终视觉
PREP_REPORT.md         转录、算法、模拟和验证记录
```

## 内容包

`content.json` 保留统一 envelope，并使用根字段：

```text
drinks, ingredients, recipes, customers, weather, seasons,
events, chains, endings, balance, ui
```

### 商品、原料与配方

- 十种饮子使用文档 27 的正式 ID、成本、基准价、复杂度和偏好。
- 文档没有提供逐项历史原料或用量。为满足可计算配方而不虚构史实，每种饮子使用一个“该饮子预制原料包”fallback ingredient；单份数量为 1，成本严格等于文档的单杯成本。
- `drink-signature` 初始锁定，由招牌饮子连锁解锁。
- 保存率、基础客流、租金等缺失参数集中放在 `balance.fallbacks`，带 `provisional: true` 和说明，不散落为代码魔数。

### 80 个事件

- 8 个分类各 10 个，沿用文档 26 的 80 个稳定事件 ID。
- 标题、日期、冷却、一次性、选项和已给出的数值效果机械转录。
- 文档仅给出“风险”“波动”“库存+”“销量+”等定性结果时，不替换成虚构数值；编码为 `flag`、`modifier` 或 `schedule` 效果，并在报告逐项列出。
- 缺失的事件正文采用明确、短小、非事实性的 fallback 描述；`assetId` 采用 `event-...-illustration` 稳定接口，不要求文件存在。
- 文档没有逐事件权重和冲突标签时，使用统一基础权重 1 和可解释的分类/天气标签；这些值标为 provisional，不用于偷偷保障通关。

### 五条连锁

- 连锁节点作为 `chains[].nodes` 保存，不额外计入 80 个基础事件。
- 每条链包含启动事件、三个阶段、前置 flag、最大等待天数、中断条件和完成/失败标记。
- 第 90 天后不得启动新三段链；已启动链仍可收束。
- 节点选择效果只使用文档明确给出的数值；未给数值的链节点只改变 flag、进度或结局倾向。

### 八个结局

- 倒闭结局可在第 100 日前即时触发。
- 其余结局只在第 100 日结算后判断。
- 特色结局按显式 `priority` 选择一个主结局，所有满足项进入收藏；无特色条件时回退 `ending-hundred-days`。
- 文档没有冻结“高/中上/普通”的具体阈值。阈值集中写入 provisional ending conditions，报告中逐项声明，不回写文档语义。

## 强类型规则结构

条件仅允许以下闭合集合：

```text
day-range
stat-at-least / stat-at-most
money-at-least / money-at-most
has-flag / lacks-flag
event-seen / event-not-seen
chain-status
completed-chain-count-at-least
inventory-at-least
all / any / not
```

效果仅允许：

```text
stat-delta
money-delta
inventory-delta
add-flag / remove-flag
unlock-product
set-modifier
schedule-effect
advance-chain / interrupt-chain
```

所有引用在内容校验阶段解析为稳定 ID；未知条件、效果或引用使生产内容校验失败。

## 确定性 RNG

- 字符串 seed 先稳定散列为 32 位无符号状态，再使用小型可序列化 PRNG 逐步生成 `[0, 1)`。
- RNG 接口返回 `{ value, nextState }`，不修改全局状态。
- 事件权重、天气、顾客需求和模拟策略只消费传入 RNG；业务代码不直接调用 `Math.random()`。
- 存档保存原始 seed 和当前 `rngState`，刷新后从同一点继续。

## 日结数据流

应用流程拆成两个可单测阶段，并提供一个组合入口：

1. `openDay(state, decision, content)`：验证并锁定备货/定价，扣除备货成本，生成天气、客流、需求、销量、收入、损耗返还，并选择当天事件。
2. `resolveDay(opening, choiceId, content)`：应用事件选择、延期效果、账款/工资/固定成本、属性边界、库存更新、破产与里程碑判断，生成下一状态和账簿。
3. `simulateDay(...)`：供自动模拟使用，通过选择策略连接前两阶段。

账簿逐项保存 `kind`、`labelId`、`amount` 和关联实体 ID。现金变化必须等于所有明细之和。

统一数值规则：

- 游客数：最终乘数计算后四舍五入到最近整数，最低为 0。
- 各饮子需求：加权份额先向下取整，余数按确定性权重顺序分配。
- 销量：`min(需求, 已备库存)`，最低为 0。
- 收入和备货成本：整数乘法，无小数。
- 损耗返还：每个商品分别向下取整后求和。
- 精力消耗：先累计杯数复杂度和事件变化，日终向上取整。
- 钱不 clamp；声望、精力、人情日终 clamp 到 0–100；所有库存 clamp 到不低于 0。

## 事件选择

候选池依次执行：日期、条件、一次性、冷却、冲突标签、链状态和第 90 日限制。链的下一节点满足时优先于普通随机事件；多个链节点同时满足时按最早启动日、链 ID 排序。普通事件按权重进行确定性选择；候选池为空返回 `no-event` fallback，不写伪事件历史。

事件历史仅保留最近 120 条摘要；完整正文始终从 `content.json` 按 ID 读取。冷却以“当前日 - 上次触发日大于等于 cooldownDays”判定。

## 状态机

应用状态包含：

```text
landing, newGame, tutorial, morning, preparation, opening,
event, settlement, milestone, bankruptcy, finalEnding,
continueGame, error
```

事件选择提交后不可撤销；重复提交通过阶段与 `resolutionId` 双重防护。每个完整日结束写安全存档，事件选择提交后写待结算快照。损坏的当前快照优先回退上一日；两份都无效时进入可恢复错误页。

## 存档

`SavePayload` 包含：

- `schemaVersion`、`contentVersion`、save ID 和更新时间。
- 天数、现金、库存、价格、产品解锁状态与四项属性。
- 已触发事件摘要、冷却映射、flags、连锁进度和延期效果。
- 最近决策摘要、seed、RNG 状态、已达成结局。
- 当前阶段与事件提交后的待结算上下文。

原生 IndexedDB 保存存档、有限事件历史和结局收藏；localStorage 只保存当前存档 ID 与设置。存储 codec 使用字段白名单、数值范围和内容引用校验。未来 schema、非法 JSON、超大数组、错误类型或失效关键 ID 都返回结构化恢复结果，不抛到白屏。新游戏生成新 save ID，不删除或覆盖旧存档。

## 页面骨架

不追求最终国风视觉，但提供可操作的语义结构：

- 开店首页与存档恢复提示。
- 新游戏说明与教程。
- 晨间状态、备货、定价和经营策略。
- 今日天气/客流摘要。
- 事件页及选择确认。
- 日结账簿、连续亏损提示和里程碑。
- 破产页、第 100 日结局页与结局收藏摘要。
- 错误恢复和本项目数据清理入口。

页面使用 `main/header/section/form/dialog/table/dl` 等原生语义元素，主要触控目标至少 44px；375、390、430 CSS px 不出现横向溢出。没有图片时使用纯文本 asset 槽位说明，不使用 emoji 充当经营图标。

## 测试策略

按红—绿—重构完成以下行为测试：

1. 内容生产校验：80 事件、5 连锁、8 结局、10 饮子、12 顾客、ID 与引用。
2. RNG：相同 seed 同序列，不同 seed 可分离，保存状态可续接。
3. 经济：手算固定样例、明细守恒、取整边界、库存不负。
4. 事件：条件、权重、冷却、一次性、冲突、fallback。
5. 连锁：启动、推进、完成、中断、第 90 日限制。
6. 结局：提前破产、第 100 日、特色结局优先级与基础回退。
7. 存档：往返、损坏数据、未来版本、失效引用、上一日恢复、新游戏隔离。
8. 状态机：合法转换、重复提交保护和错误恢复。
9. 三个完整模拟：激进路线提前倒闭、保守路线勉强活到 100 日、优势路线获得较好结果。

三次模拟用于验证实现路径，不以测试数据反向修改冻结经济。若目标路线在现有数值与 provisional 参数下不可达，测试记录实际结果并在 `PREP_REPORT.md` 标为平衡风险，不静默调公式。

## 已知文档冲突与 fallback

实现前已确认以下非阻塞冲突：

- 启动页建议本金为 300 文，黄金 10 天参数为 120 文。实现采用更具体的黄金参数 120，报告同时记录 300 文建议。
- 黄金样例使用 `drink-plum/drink-ginger`，正式基础表使用 `drink-green-plum/drink-ginger-honey`。生产内容采用正式基础表 ID；黄金 ID 不作为别名写入存档。
- 规划文档曾要求 10,000 局，后续合同要求 1,000 个 seed，当前任务明确至少 3 次完整模拟。交付执行并报告 3 次完整模拟，不伪报未运行的大规模模拟。
- 文档指定 IndexedDB 保存完整存档，同时当前任务只要求本地可恢复。实现保留 IndexedDB 主存储和 localStorage 启动指针；测试使用相同 repository 契约的内存实现。
- 事件表和结局表含无法直接计算的定性效果/阈值；实现只使用显式 flag、modifier 和集中声明的 provisional fallback。

## 完成验证

最终仅在项目目录执行：

```text
pnpm lint
pnpm test
pnpm build
```

并执行只读检查：

```text
git diff --name-only -- projects/04-bianjing-drink-shop
git diff -- projects/04-bianjing-drink-shop
```

不执行提交、暂存或任何其他 Git 写操作。
