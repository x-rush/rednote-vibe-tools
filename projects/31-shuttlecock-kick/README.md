# 毽子连击（31 号）

复刻自 eazo.ai 的 `Shuttlecock Kick`，改造成纯前端静态小红书小工具。

- **一句话**：毽子掉下来之前点一下，落点踩准就能一直连着踢。
- **平台简介**：一脚接一脚，踢到天黑
- **来源**：[eazo.ai Shuttlecock Kick](https://eazo.ai/apps/shuttlecock-kick)
- **批次方案**：见同目录 `PLAN.md`（31–35 号批量复刻方案）

## 玩法

1. 点一下画面，毽子被踢起，走一条纯净弹道。
2. 毽子下落穿过**接球线**之后、落到地面之前，再点一下就是一次有效接住，连击 +1。
3. 在毽子还在上升、或没到接球线就点，会被判成「踢早了」，连击清零。
4. 毽子落地扣一格机会，机会用尽本关失败，可以原地重试。
5. 每关接住指定次数即过关；连击到 5 / 10 / 16 / 25 会解锁素羽→双羽→夜羽→星羽→极光羽五档外观，天色也跟着变。
6. 结算生成 720×960 纪录卡，可保存到相册（宿主不支持时提示长按图片手动保存）。

## 手感设计

- 虚拟画布固定 380 高，宽度随屏宽变化，**只做等比缩放**，所以 375 / 390 / 430 三档以及真机的操作窗口完全一致。
- 物理是纯净弹道（无空气阻力），落点可预测，玩家能记住节奏再挑战更高关。
- 接球线放在抛物线顶点稍下方：越靠近顶点，毽子下落越慢，操作窗口越长。
- 8 关窗口从 **458ms 逐关收窄到 283ms**，`qa-balance-check.cjs` 把这条曲线固化成回归。

## 工程约束

- 纯前端静态：经典脚本加载链，禁 `type="module"` / `import` / `eval` / 内联脚本 / 行内事件。
- Chrome 61 / Android 8.1 WebView 61 基线：ES2017，CSS 不使用 flex `gap`、`clamp()`、`aspect-ratio`、逻辑属性、`:has()`、`inset`、`dvh`。
- 无后端、无运行时 CDN、无必需外部 API、无音频文件：音效全部由 Web Audio 实时合成。
- 业务内容集中在 `src/content/content.json`（含 `brand` / `xiaohongshuDraft` / 8 关配置 / 文案）。
- 只在 localStorage 保存结构化状态（最高连击、总分、静音偏好），不保存任何用户媒体。
- 宿主按钮避让：顶部左右各留 `--host-side: 76px`，标题与 HUD 在 `--host-top: 56px` 之下。
- 上架素材不复用任何历史条目素材，logo 为本项目原创。

## 目录

```
index.html            页面骨架
src/content/content.json  业务内容（关卡、文案、配色档位）
src/game.js           玩法状态机与物理
src/render.js         Canvas 2D 渲染
src/audio.js          Web Audio 合成音效
src/storage.js        本地结构化状态
src/app.js            主循环、流程、纪录卡
src/style.css         样式（宿主避让、安全区）
assets/logo.svg       原创 logo 源文件
assets/logo-512.png   平台上架位图（不进 zip）
tools.mjs             build / preview
verify-artifact.cjs   产物校验（白名单 / ES2017 / 禁用能力）
qa-mobile-check.cjs   375/390/430 + 安全区 + 宿主覆盖层 + 横屏
qa-flow.cjs           全流程 + 结算面板不自行推进断言
qa-balance-check.cjs  操作窗口难度曲线回归
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
node tools/logo-png.cjs        # 由 assets/logo.svg 重渲染 512 PNG
node tools.mjs preview 4331   # http://127.0.0.1:4331
pwsh -NoProfile -ExecutionPolicy Bypass -File pack.ps1
```

## 验收状态

| 项目 | 状态 |
|---|---|
| lint / test（13 项）/ build | 通过 |
| verify-artifact（白名单 / ES2017 / 禁用能力 / 内联脚本） | 通过，产物 10 文件 75.3 KiB（含 `mini_tool.json`） |
| qa-mobile-check（375 / 390 / 430 + 安全区 + 宿主按钮覆盖层 + 横屏） | 通过，`errors: []`，无横向溢出 |
| qa-flow（通关 → 结算不自行推进 → 下一关 → 落地失败 → 重试 → 纪录卡 → 保存兜底） | 通过，`errors: []` |
| qa-balance-check（8 关窗口 458ms → 283ms） | 通过 |
| 打包 ZIP | `release/shuttlecock-kick-v1.zip` 25,292 bytes，10 条目，`index.html` 在根目录，SHA256 `8FD0EC9E18E98EEC5A8FB4CAF6432D9FAF059224CA0CC727A384B8BE887E6B47`；解压后独立复验 PASS |
| 高消耗标记 | `mini_tool.json` = `{"is_high_consumption_scene": false}`（只用 Canvas 2D / Web Audio / localStorage，未使用 Worker、离屏渲染、WebAssembly 或游戏引擎） |
| 创服平台模拟器 | **未验收** |
| Android 真机扫码 | **未验收** |
| iOS 真机扫码 | **未验收** |
| Chrome 61 / Android 8.1 WebView 61 实机 | **未验收** |
| 宿主左上返回键、右上操作键的真实遮挡 | 仅用注入覆盖层模拟，真机仍需校准 |
