# 八项目内容封装、Schema 与测试样本

状态：PRE-DEVELOPMENT CONTRACT FROZEN（2026-08-23）

## 1. 封装结论

每个项目运行时只有一个业务数据入口：`src/content/content.json`。准备阶段的内容权威来源仍是各项目已冻结 Markdown 内容库；开发第一步是机械转写 JSON，不允许在转写时“顺手改文案”。总索引见 `prep/predevelopment-manifest.json`，资产计划见 `prep/asset-manifest.json`。

所有内容包顶层统一为：

```json
{
  "schemaVersion": 1,
  "contentVersion": "1.0.0",
  "projectId": "sbti",
  "meta": {"title": "...", "locale": "zh-CN", "updatedAt": "2026-08-23"},
  "sources": [],
  "content": {}
}
```

共用硬规则：ID 匹配 `^[a-z][a-z0-9-]*$`；数组 ID 唯一；所有引用必须存在；用户可见字符串去首尾空格且不能为空；内容对象拒绝未知顶层字段；禁止 HTML、远程脚本 URL、Base64 和用户图片字段。

## 2. 八项目精确根字段

| projectId | `content` 必需字段 | 必需枚举/数量断言 | 主要引用完整性 |
|---|---|---|---|
| `sbti` | `dimensions, chapters, questions, creatures, resultTypes, tieBreakers` | 4 维、4 章、48 题、16 型；每轮 24；题目每项仅 `A/B` | 题目分值只引用维度端点；16 型各引用唯一 creature |
| `wuhualu` | `artifacts, rounds, collectionRules` | 20 文物；每件 3 条递进线索；难度枚举 `easy/normal/hard` | 干扰项与答案均引用 artifact；sourceId 存在 |
| `dalisizian` | `characters, cases, nodes, evidence, endings` | 8 案；节点类型 `narration/dialogue/choice/reveal/end`；无自由输入 | choice.nextNodeId 可达；证据引用存在；每案至少一真相结局 |
| `bianjing` | `drinks, ingredients, customers, weather, seasons, events, chains, endings, balance` | 10 饮子、12 顾客、80 事件、5 链、8 结局、100 天 | 配方、事件前置、链节点、结局阈值引用存在 |
| `relationship-manual` | `dimensions, questions, sentenceFragments, cardRules` | 16 题、42 句；答案枚举固定 | 问题权重引用维度；卡片句引用合法标签 |
| `departure-checker` | `scenarios, items, modifiers, presets` | 8 场景；优先级 `must/should/optional` | 场景和修饰条件只引用已存在 item |
| `conversation-replay` | `feelings, needs, scenarios, choices, rewrites, safetyRules` | 48 感受、48 需要、32 情境；全选项交互 | rewrite 引用情境、感受、需要；高风险情境触发安全文案 |
| `earth-online` | `tasks, filters, cooldown, fallback, safetyRules` | 100 任务；强度 `tiny/light/standard/brave` | 任务标签属于过滤器；互斥/冷却引用任务 ID |

字段级定义以 docs/11、21–30 为准；本表是构建器必须执行的根级断言，不替代项目数据契约。

## 3. 最小有效/无效样本

### 共用有效包

```json
{"schemaVersion":1,"contentVersion":"1.0.0","projectId":"earth-online","meta":{"title":"地球 Online：冒险者公会大厅","locale":"zh-CN","updatedAt":"2026-08-23"},"sources":[],"content":{"tasks":[],"filters":[],"cooldown":{},"fallback":{},"safetyRules":[]}}
```

该样本只验证共用外壳；项目生产校验仍会因 `tasks.length !== 100` 失败。校验器必须区分 `envelope` 与 `production` 模式。

### 必须失败的样本

```json
{"schemaVersion":1,"contentVersion":"1.0.0","projectId":"bad id","meta":{"title":" ","locale":"zh-CN"},"sources":[],"content":{"image":"data:image/png;base64,..."}}
```

预期错误至少包含：非法 `projectId`、空标题、缺 `updatedAt`、禁止 Base64、未知业务根字段。错误必须带 JSON path。

## 4. 项目级自动测试样本表

| 项目 | 正向样本 | 必须失败样本 |
|---|---|---|
| SBTI | 48 题恰好每维 12；抽题后每维 6 | 结果兽重复；选项只给一端加分；平分偷偷随机 |
| 物华录 | 三条线索逐步收窄且答案唯一 | 干扰项包含答案本身；来源缺失；同义线索重复 |
| 大理寺 | 从开场可到真相、误判和复盘 | 孤儿节点；nextNode 缺失；出现自由文本分析入口 |
| 饮子铺 | 给定 seed 可复现 100 天；事件前置满足才入池 | 资金 NaN/负库存；连锁断裂；无任何可达结局 |
| 关系说明书 | 同答卷稳定生成同卡片 | 句子越权推断人格/诊断；引用不存在片段 |
| 出门检查官 | 下雨＋骑行正确加入对应物品 | 互斥物同时出现；必需项被修饰器删除；空清单无回退 |
| 对话复盘 | 每情境可走到观察—感受—需要—改写 | 将评判词伪装成感受；高风险内容无安全提示 |
| 地球 Online | 过滤后有候选且 cooldown 生效 | 危险任务可选；空池不回退；连续抽到同任务 |

## 5. 存储与迁移样本

- 键名统一：`xhs-tool:<projectId>:state:v1`；跨项目禁止共用状态键。
- localStorage 存偏好、最近进度、小体量结果；IndexedDB 仅存结构化历史记录。
- 数据记录只保存稳定 ID、数值和时间，不复制整份内容文案。
- 读取顺序：解析 → 版本判断 → 字段白名单 → 引用当前内容 ID → 清除失效引用 → 返回安全默认值。
- 损坏样本：截断 JSON、未来版本、旧 ID、超大数组、错误类型；均不得白屏。
- 图片、Base64、任意 Blob 在 IndexedDB 写入层一律拒绝。

## 6. 内容转写交接规则

1. 开发者先建立类型与校验器，再转写内容。
2. 每次只转一个项目，完成计数/引用快照后再转下一个。
3. 转写差异只允许结构化转义和稳定 ID，不允许内容润色。
4. 若发现原文错误，回写权威 Markdown、记录纠错，再重新生成 JSON。
5. JSON 是运行时产物，Markdown 是编辑审校记录；两者以 `contentVersion` 和内容哈希关联。

## 7. 预开发完成与实现后门禁

已在准备阶段完成：内容配额、玩法、页面/状态、字段契约、有效/无效样本、资产数量与许可策略、测试用例、提交模板和任务边界。

必须等实现后执行：正式 JSON 的校验运行、节点可达性程序、100 天数值模拟、真机 WebView、离线启动、性能预算、分享卡截图和官方上传验证。这些不是准备缺失，而是后续实现的 Definition of Done。
