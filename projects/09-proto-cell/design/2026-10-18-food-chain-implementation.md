# 尺度进化与食物链反杀实施记录

授权：2026-10-18 用户要求直接实施此前审查方案，先完成第一生态圈并通过测试，再推进后两层；视觉、视野、生态支配力、强敌变食物是核心验收条件。

## 设计与约束

保留单指移动、自动器官、暂停三选一、完整包裹、离线静态运行。只修改本项目，不加依赖，只在 main 工作，不发布或推送。

第一层从求生到反猎；第二层通过多胞体、视野扩张和对旧猎手的尺寸优势实现控场；第三层以纤毛长轴体、高速追猎和多个器官协同形成主宰体验。每层都有真实捕食、两次变异和可寻找、可解决的生态考验；时间只增加压力，不自动赠送胜利。前一层敌人保留物种外观与绝对尺寸，在下一层成为较小且会逃跑的猎物。

### 共享内容接口

`ContentPack.ecosystems: EcosystemDefinition[]` 与三个 scaleTiers 按 tierIndex 对齐。包含目标/考验文案、考验物种与半径、进化压阈值、主动捕食收益门槛、两次变异进度、开场食物数与距离、感知范围、旧物种回流和敌人行为说明。所有业务参数与文案来自 content.json。

### 分工和接口

| 工作域 | 文件归属 | 交付 |
| --- | --- | --- |
| 引擎 | game/engine、evolution/lifecycle、world/run-director、interactions、食物链状态及相关测试/流程测试 | 三层门槛、正常状态测试、考验、旧敌回流、snapshot.ecosystem |
| 绘制 | rendering/*、新 ui/SpecimenCanvas 及对应测试 | 统一三形态骨架、材质、视野反馈、进化标本共享绘制 |
| 界面 | App、App.css、index.css、现有 ui/*、app/view-model 及对应测试 | 真实HUD与雷达、目标、跃迁、手机/宿主避让、清楚选择代价 |
| 总控 | content/schema/validate/content.json、entities/ai、generator（与引擎确认）、设计与浏览器验证 | 内容、敌人反应、系统集成和发布构建验收 |

引擎发布 `EcosystemProgressSnapshot`（从 engine 导出），至少含 tierIndex、name、objective、pressure、activeBiomass、activeBiomassTarget、encounterName、encounterHint、encounterResolved、encounterPosition?、readyToEvolve、reversalCount；HudSnapshot 与 WorldRenderSnapshot 增加可选 ecosystem，旧独立环境单元测试仍可构造旧最小快照。渲染方与界面方复用 SpecimenCanvas({build,formId,size?})。

## 任务与验收

- [x] S1 第一层：首屏真实食物、两次构筑选择、正常捕食与考验、无输入不通关。
- [x] S2 视觉：三种可辨认骨架、局内与预览同一绘制、背景层级、可读吞噬关系、成长视野差异。
- [x] S3 手机：375/390/430、44px安全区与左右宿主覆盖，所有卡片代价完整，安全暂停/返回/跃迁。
- [x] 第一层检查点：定向单元测试 + lint/build + 发布构建浏览器，失败先修复，再推进后两层调校。
- [x] S4 后两层：旧敌真实回流且变成猎物、不同尺度/节奏/考验、完整三层正常状态路径。
- [x] 最终：全部 lint/test/build、产物/白名单审计与浏览器证据；真机状态单列（待验收，不表示已通过）。

## 进度与决策

初始基线为 main 1c2d8c40；已有审查与截图保留。各工作域不重写其他域文件，不删除测试，不用保活或移除敌人证明游戏难度。与旧六段旅程断言冲突的集成测试应改为验证新三层门槛，旧纯函数兼容测试可保留。

第一层检查点：2026-10-18 生产构建，种子727、全新存档可用器官池、实际 App 回调与实际选择按钮，方向控制策略按固定步加速推进，在94.5秒完成两次变异、吞噬 encounter-0 并打开形态跃迁。未修改血量、体型或敌人。独立真实指针拖动路径已运行。375/390/430与844×390的实际进化界面已截图，代价行能滚入可见轨道；另修复了标本标签沿用旧绝对定位导致外溢的问题。48项第一层相关定向测试、lint、build通过后才开始后两层调校。证据位于 implementation-2026-10-18/。

最终检查点：71 个测试文件、418 项测试通过，lint、TypeScript 和生产构建通过。实际 App 三层流程完成六次变异、两次跃迁，最终稳定新种与3/3结算、八次反猎、三层首次奖励及最终纤毛形态存档均已检查。完整证据、测试边界与待真机项见 [实施验收记录](2026-10-18-implementation-verification.md)。
