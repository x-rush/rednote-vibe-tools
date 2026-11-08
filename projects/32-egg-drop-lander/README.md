# 蛋落地（32 号）

复刻自 eazo.ai 的 `Egg Drop`，改造成纯前端静态小红书小工具。

- **一句话**：蛋在往下掉，点一下喷一股气，落地越轻蛋越完整。
- **平台简介**：轻轻放，才不会碎
- **来源**：[eazo.ai Egg Drop](https://eazo.ai/apps/egg-drop)
- **批次方案**：见 `projects/31-shuttlecock-kick/PLAN.md`（31–35 号批量复刻方案）

## 玩法

1. 一颗蛋在竖屏里不断下坠，目标是把它落到下方的叶垫上。
2. 点一下画面，蛋会**喷一股气**：竖直方向给一个向上的冲量压低下坠速度，水平方向按点击位置给一个侧向冲量，用来修正落点。
3. 落地瞬间的**下坠速度**决定结果：低于安全线算软着陆（蛋完整），超过安全线蛋就碎了。
4. 气量有限（每关 8 口），喷得太急会提前耗尽气量，后面就再也救不回来。
5. 每关 3 颗蛋（3 次机会），同关重试保留剩余机会与气量，进入下一关才重置。
6. 12 关逐步收紧：安全线下降、垫子变窄、出现横风与移动的垫子。
7. 结算生成 720×960 纪录卡，可保存到相册（宿主不支持时提示长按图片手动保存）。

## 手感设计

- **线性空气阻力是玩法成立的前提**。没有阻力时，任何上推都只会让蛋弹得更高、落得更重，「轻轻放」根本做不到；加了阻力后，上推才真的能减速。
- **小冲量 + 气量预算**，而不是大冲量。大冲量可以把蛋悬停到极软落地，「软着陆」就变成无意义的送分题。现在每次喷气只压掉终端速度的 10%–18%，需要连着判断 2–5 次。
- **一次喷气的力度各关一致**（终端速度的 10%–18%），玩家记住一次手感就能迁移到下一关。
- **关卡难度靠「需要的喷气次数」递增**：最少喷气次数从 2 次逐关涨到 5 次，气量预算统一 8 口，相对余量自然收紧。
- 平衡用**闭环玩家模型**评估：玩家每隔 150–300ms 看一次速度指示，超过安全线的 75%–95% 就点一下喷气。这比固定阈值策略更接近真人——真人会观察、会等、也会因为太急而浪费气量。
- 12 关的**真人通过率从 20/20 收窄到 10/20**，`qa-balance-check.cjs` 把这条曲线固化成回归。

## 工程约束

- 纯前端静态：经典脚本加载链，禁 `type="module"` / `import` / `eval` / 内联脚本 / 行内事件。
- Chrome 61 / Android 8.1 WebView 61 基线：ES2017，CSS 不使用 flex `gap`、`clamp()`、`aspect-ratio`、逻辑属性、`:has()`、`inset`、`dvh`。
- 无后端、无运行时 CDN、无必需外部 API、无音频文件：音效全部由 Web Audio 实时合成。
- 业务内容集中在 `src/content/content.json`（含 `brand` / `xiaohongshuDraft` / 12 关配置 / 文案）。
- 只在 localStorage 保存结构化状态（最高分、软着陆次数、静音偏好），不保存任何用户媒体。
- 宿主按钮避让：顶部左右各留 `--host-side: 76px`，标题与 HUD 在 `--host-top: 56px` 之下。
- 上架素材不复用任何历史条目素材，logo 为本项目原创。

## 目录

```
index.html            页面骨架
src/content/content.json  业务内容（关卡、文案、配色）
src/game.js           玩法状态机与物理
src/render.js         Canvas 2D 渲染
src/audio.js          Web Audio 合成音效
src/storage.js        本地结构化状态
src/app.js            主循环、流程、纪录卡
src/style.css         样式（宿主避让、安全区）
assets/logo.svg       原创 logo 源文件
assets/logo-512.png   平台上架位图（不进 zip）
tools.mjs             build / preview
tools/solve-levels.cjs  关卡参数求解器（一次性工具，不参与打包）
verify-artifact.cjs   产物校验（白名单 / ES2017 / 禁用能力）
qa-mobile-check.cjs   375/390/430 + 安全区 + 宿主覆盖层 + 横屏
qa-flow.cjs           全流程 + 结算面板不自行推进断言
qa-balance-check.cjs  真人通过率与节奏回归
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
node tools.mjs preview 4332   # http://127.0.0.1:4332
pwsh -NoProfile -ExecutionPolicy Bypass -File pack.ps1
```

## 验收状态

| 项目 | 状态 |
|---|---|
| lint / test（9 项）/ build | 通过 |
| verify-artifact（白名单 / ES2017 / 禁用能力 / 内联脚本） | 通过，产物 9 文件 70.4 KiB |
| qa-mobile-check（375 / 390 / 430 + 安全区 + 宿主按钮覆盖层 + 横屏） | 通过，`errors: []`，无横向溢出 |
| qa-flow（通关 → 结算不自行推进 → 下一关 → 落地失败 → 重试 → 纪录卡 → 保存兜底） | 通过，`errors: []` |
| qa-balance-check（12 关真人通过率 20/20 → 10/20，每关至少喷两次，乱喷无效） | 通过 |
| 打包 ZIP | `release/egg-drop-lander-v1.zip` 23,727 bytes，9 条目，`index.html` 在根目录，SHA256 `27451332689D0FA37FCD659A950851C403F6E7AB9C0D524C8DFF0302D8D00DDE`；解压后独立复验 PASS |
| 创服平台模拟器 | **未验收** |
| Android 真机扫码 | **未验收** |
| iOS 真机扫码 | **未验收** |
| Chrome 61 / Android 8.1 WebView 61 实机 | **未验收** |
| 宿主左上返回键、右上操作键的真实遮挡 | 仅用注入覆盖层模拟，真机仍需校准 |
