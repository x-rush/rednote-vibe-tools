# 弹珠神殿（34 号）

复刻自 eazo.ai 的 `Billiard Temple`，改造成纯前端静态小红书小工具。

- **一句话**：拖住玉球瞄准，松手就飞出去，撞墙反弹，把整殿宝石一杆收完。
- **平台简介**：一杆清空，满室生光
- **来源**：[eazo.ai Billiard Temple](https://eazo.ai/apps/billiard-temple-physics-puzzle-ogvlurbo)
- **批次方案**：见 `projects/31-shuttlecock-kick/PLAN.md`（31–35 号批量复刻方案）

## 玩法

1. 一颗翠玉弹珠停在殿堂底部。**拖住玉球拖出方向和力度，松手发射**（拖得越远越快）。
2. 球撞墙会按恢复系数反弹，撞到宝石就把宝石收走，轨迹会留下发光余晖。
3. 瞄准线会画出第一段实线与第一次反弹的虚线——但只到第一次为止，后面要自己判断。
4. 每殿的杆数有限，宝石收齐即通关。八殿走完生成 720×960 技巧卡与八颗宝石图鉴。

## 手感设计

- **反弹必须真的吃角度与摩擦**。球是匀减速运动的，撞墙按恢复系数 0.88 反弹、切向有损失、停下来就停在原地。力小就飞不到，角度差一度路线就完全不同——所以每一殿都是「算角度」的关卡，不是「连线消除」。
- **机关是固定石柱 + 沿轴往复的滑石条**。放弃旋转横杆：横杆的扫掠区是整块圆盘，会把整条路堵死；沿轴往复的滑条既能挡路，又留得出可以穿过去的缝。
- **石条按殿堂绝对时间运动**，玩家瞄准快慢不影响走位；同一殿里不同时刻出杆，石条站的位置不同。
- **可解性用「先有解、后摆宝」构造**：扫角度×力度挑出一条反弹次数、路径长度都合适的杆，把宝石摆在这条路径上（留 3–7px 横向偏移，看起来像散落而不是排成一条线）。于是「一杆清空满室宝石」是构造上成立的，不是碰运气撞出来的。

### 这里返工过一次，值得写下来

早期版本的平衡回归用「轨迹有没有压到石条扫掠区」来保证**相位无关**（石条换个相位，这一杆照样成立）。判据用的是严格不等式，结果出过一次假绿：

> 第六殿的标称轨迹**正好擦过**扫掠区的角点——球心 x 恰好等于扫掠区左边界（29.0 vs 29），被判成「没压到」。实际上这时球与石条的距离正好等于球半径，石条换个相位往前挪 4px，球就蹭上去，那一杆从 6/6 颗宝石掉到 1/6 颗。

修正分三步：

1. **物理层把「撞墙」和「蹭机关」分开计数**（`shot.wallBounces` / `shot.propHits`）。原来 `bounces` 把两者混在一起，导致生成器在找「4 次反弹」的杆时，挑中了一堆蹭机关的路径——「4 次反弹」实际是 3 次撞墙 + 1 次蹭机关。
2. **生成器改为算余量而不是判「有没有压到」**：轨迹到障碍扫掠区的最短距离必须 ≥ 6px。这一条直接把第六殿那杆相切路径否掉了。
3. **回归从「代理指标」换成「正面校验」**：不再用扫掠区这种间接判据，而是把起手时间在 0–8 秒之间密集扫一遍（覆盖石条的一个完整运动周期），要求**每一次起手，标称杆都照样一杆清空且完全不蹭机关**。这条才是玩家真正能感知的性质。

改完之后第六殿与第八殿的几何也重做了：第六殿改为 3 次撞墙（原布局下 4 次撞墙且不蹭机关的路径在几何上不存在——球的总行程上限约 900px，容不下 4 次满堂折返）；第八殿改成两块竖滑石条加右下角石柱，腾出一条 4 次撞墙、余量 14px 的路线。

## 工程约束

- 纯前端静态：经典脚本加载链，禁 `type="module"` / `import` / `eval` / 内联脚本 / 行内事件。
- Chrome 61 / Android 8.1 WebView 61 基线：ES2017，CSS 不使用 flex `gap`、`clamp()`、`aspect-ratio`、逻辑属性、`:has()`、`inset`、`dvh`；Canvas `roundRect` 手写路径。
- 无后端、无运行时 CDN、无必需外部 API、无音频文件：音效全部由 Web Audio 实时合成。
- 业务内容集中在 `src/content/content.json`（含 `brand` / `xiaohongshuDraft` / 8 关配置 / 文案 / 8 套配色 / 8 种宝石）。
- 只在 localStorage 保存结构化状态（最高分、宝石图鉴、静音偏好），不保存任何用户媒体。
- 宿主按钮避让：顶部左右各留 `--host-side: 76px`，标题与 HUD 在 `--host-top: 56px` 之下；横屏改成三栏，左栏让开左上返回键、右栏让开右上操作键。
- 上架素材不复用任何历史条目素材，logo 为本项目原创。

## 目录

```
index.html            页面骨架
src/content/content.json  业务内容（关卡、文案、配色、宝石图鉴）
src/game.js           弹珠物理（减速、撞墙反弹、机关碰撞、宝石收取、瞄准预测）
src/render.js         Canvas 2D 渲染（神殿内室、砖墙、石柱滑条、宝石、玉球、瞄准线、轨迹）
src/audio.js          Web Audio 合成音效
src/storage.js        本地结构化状态
src/app.js            瞄准交互、HUD、殿堂推进、宝石图鉴、技巧卡
src/style.css         样式（宿主避让、安全区、横屏三栏）
assets/logo.svg       原创 logo 源文件
assets/logo-512.png   平台上架位图（不进 zip）
tools.mjs             build / preview
tools/logo-png.cjs    由 logo.svg 重渲染 512 PNG
tools/design-chambers.cjs  关卡生成：先有解、后摆宝 + 余量约束 + 相位无关自检
verify-artifact.cjs   产物校验（白名单 / ES2017 / 禁用能力）
qa-mobile-check.cjs   375/390/430 + 安全区 + 宿主覆盖层 + 横屏宿主避让
qa-flow.cjs           全流程 + 八殿标称杆真实拖拽 + 结算面板不自行推进
qa-balance-check.cjs  标称杆一杆清空 / 相位无关 / 随手玩家回归
tests/game.test.mjs   玩法单测
pack.ps1              打包 ZIP + 白名单 + SHA256
```

## 本地运行

```powershell
npm run lint
npm test
npm run build
node verify-artifact.cjs dist
node qa-mobile-check.cjs
node qa-flow.cjs
node qa-balance-check.cjs
node tools/design-chambers.cjs   # 改关卡后必须重跑，并重跑平衡回归
node tools/logo-png.cjs          # 由 assets/logo.svg 重渲染 512 PNG
node tools.mjs preview 4334      # http://127.0.0.1:4334
pwsh -NoProfile -ExecutionPolicy Bypass -File pack.ps1
```

## 验收状态

| 项目 | 状态 |
|---|---|
| lint / test（12 项）/ build | 通过 |
| verify-artifact（白名单 / ES2017 / 禁用能力 / 内联脚本） | 通过，产物 9 文件 71.5 KiB |
| qa-mobile-check（375 / 390 / 430 + 安全区 + 宿主按钮覆盖层 + 横屏宿主避让 + 真实拖拽击球） | 通过，四档 `errors: []`，无横向溢出 |
| qa-flow（真实拖拽瞄准 → 发射 → 反弹收宝 → 八殿标称杆过关 → 结算不自行推进 → 图鉴 8/8 → 720×960 技巧卡 → 保存兜底） | 通过，`errors: []` |
| qa-balance-check（标称杆一杆清空 / 与机关留足余量 / 相位无关 / 随手玩家在杆数内通关） | 通过 |
| 打包 ZIP | `release/billiard-temple-v1.zip` 25,280 bytes，9 条目，`index.html` 在根目录，SHA256 `030455178564C1C7927DF2CE769023F221601D8015195B059A4ECF96A4079FF4`；解压后独立复验 PASS |
| 创服平台模拟器 | **未验收** |
| Android 真机扫码 | **未验收** |
| iOS 真机扫码 | **未验收** |
| Chrome 61 / Android 8.1 WebView 61 实机 | **未验收** |
| 宿主左上返回键、右上操作键的真实遮挡 | 仅用注入覆盖层模拟，真机仍需校准 |
