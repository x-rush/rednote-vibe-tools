# 彩沙瓶（33 号）

复刻自 eazo.ai 的 `Sand Bottle`，改造成纯前端静态小红书小工具。

- **一句话**：沙会自己塌，想堆成目标形状就得用小棒一粒一粒推过去。
- **平台简介**：一层一层，堆出你的瓶子
- **来源**：[eazo.ai Sand Bottle](https://eazo.ai/apps/sand-bottle)
- **批次方案**：见 `projects/31-shuttlecock-kick/PLAN.md`（31–35 号批量复刻方案）

## 玩法

1. 瓶子里是 24 列 × 34 层的离散沙堆。先选一种颜色，点瓶内任意一列倒沙。
2. **倒沙遵守安息角**：相邻两列高度差超过 2 层时，高处的沙会自己滑到低处。所以随手倒出来的沙面一定是有台阶的。
3. **塑形不受安息角约束**：切到「塑形」用小棒把沙从一列搬到另一列，一层一粒，可以堆出比安息角陡得多的坡——山就是这么堆出来的。
4. **挖沙**可以拿走顶层一粒沙并退还额度，但挖完会重新触发安息角，尖峰会被抹平。
5. 右上角是目标图。沙量、颜色、沙面高度都对得上就能「封口收藏」，八瓶全封后生成 720×960 纪录卡与收藏架。

## 手感设计

- **「倒沙会塌、塑形不塌」是全作的核心**。两种运动规则不同，玩家必须学会区分：想让沙自己摊平就用倒沙，想让沙站住就用小棒。
- **目标图案必须是沙自己堆不出来的**。山峰的坡度（3–4）严格大于安息角（2），所以有山的关卡只倒沙一定过不了——`qa-balance-check.cjs` 把这条当成硬断言守着。
- **判定不看总分，看四条独立的线**：吻合度（颜色位置对不对）、沙量（覆盖率 ±18%）、山高（山的列误差 ≤ 容差）、沙面（其余列的高度误差 ≤ 容差）。任何一条不达标都封不了口。
- **失败时按钮上直接写差在哪**：「沙还不够铺满」「颜色还没对」「沙量不对」「山还不够高」「沙面还不够平」。玩家不需要猜。
- **容差按「随手玩家」实测标定**，不是拍脑袋：`qa-balance-check.cjs` 里有一个模拟真人打法的模型（随机挑最矮的列倒、倒完用棒抹平、堆山随手倒再用棒修），它在八关上稳定拿到 98%–100% 吻合度、逐列高度差 1 层，关卡容差就定在这条曲线下方 6–9 个百分点。
- 早期版本只用「总格数比」，出现过**数学上可行、真人过不去**的假绿：一关随机倒沙堆到 113 粒、离目标 120 粒差 7 粒，吻合度 94.17% 刚好压过 94% 的线——过关与否取决于台阶歪在哪边。现在改成逐列比高度，台阶压过容差就一定不过。

## 工程约束

- 纯前端静态：经典脚本加载链，禁 `type="module"` / `import` / `eval` / 内联脚本 / 行内事件。
- Chrome 61 / Android 8.1 WebView 61 基线：ES2017，CSS 不使用 flex `gap`、`clamp()`、`aspect-ratio`、逻辑属性、`:has()`、`inset`、`dvh`；Canvas `roundRect` 手写路径。
- 无后端、无运行时 CDN、无必需外部 API、无音频文件：音效全部由 Web Audio 实时合成。
- 业务内容集中在 `src/content/content.json`（含 `brand` / `xiaohongshuDraft` / 8 关配置 / 文案）。
- 只在 localStorage 保存结构化状态（最高分、收藏瓶的层色清单、静音偏好），不保存任何用户媒体。
- 宿主按钮避让：顶部左右各留 `--host-side: 76px`，标题与 HUD 在 `--host-top: 56px` 之下；横屏改成三栏，左栏让开左上返回键、右栏让开右上操作键。
- 上架素材不复用任何历史条目素材，logo 为本项目原创。

## 目录

```
index.html            页面骨架
src/content/content.json  业务内容（关卡、文案、配色）
src/game.js           沙堆物理、塑形、目标展开、判定
src/render.js         Canvas 2D 渲染（木桌、玻璃瓶、沙粒、目标缩略图）
src/audio.js          Web Audio 合成音效
src/storage.js        本地结构化状态
src/app.js            调色板、工具栏、流程、纪录卡
src/style.css         样式（宿主避让、安全区、横屏三栏）
assets/logo.svg       原创 logo 源文件
assets/logo-512.png   平台上架位图（不进 zip）
tools.mjs             build / preview
tools/logo-png.cjs    由 logo.svg 重渲染 512 PNG
verify-artifact.cjs   产物校验（白名单 / ES2017 / 禁用能力）
qa-mobile-check.cjs   375/390/430 + 安全区 + 宿主覆盖层 + 横屏宿主避让
qa-flow.cjs           全流程 + 结算面板不自行推进断言
qa-balance-check.cjs  关卡可达性 / 塑形必要性 / 随手玩家回归
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
node tools.mjs preview 4333   # http://127.0.0.1:4333
pwsh -NoProfile -ExecutionPolicy Bypass -File pack.ps1
```

## 验收状态

| 项目 | 状态 |
|---|---|
| lint / test（15 项）/ build | 通过 |
| verify-artifact（白名单 / ES2017 / 禁用能力 / 内联脚本） | 通过，产物 9 文件 71.7 KiB |
| qa-mobile-check（375 / 390 / 430 + 安全区 + 宿主按钮覆盖层 + 横屏宿主避让） | 通过，四档 `errors: []`，无横向溢出 |
| qa-flow（真实倒沙 → 换色 → 塑形拖拽 → 挖沙 → 封口 → 结算不自行推进 → 八瓶 → 纪录卡 → 保存兜底） | 通过，`errors: []` |
| qa-balance-check（八关可达、塑形确实起作用、随手玩家 98%–100% 过关） | 通过 |
| 创服平台模拟器 | **未验收** |
| Android 真机扫码 | **未验收** |
| iOS 真机扫码 | **未验收** |
| Chrome 61 / Android 8.1 WebView 61 实机 | **未验收** |
| 宿主左上返回键、右上操作键的真实遮挡 | 仅用注入覆盖层模拟，真机仍需校准 |
