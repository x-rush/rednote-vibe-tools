# 蛋落地（32 号）

复刻自 eazo.ai 的 `Egg Drop Lander`，改造成纯前端静态小红书小工具。
三期玩法重建：按原版机制骨架重做（脉冲经济 + 风 + 障碍带 + 四档评级 + 十二关 run），
保留二期的视觉升级（玻璃 HUD、三段刻度尺、完美慢镜、蛋壳碎片、体积感蛋）。

- **一句话**：蛋从高空落下，点一下 = 一发反推；反推有限，落地越轻蛋越完整。
- **平台简介**：一发一发反推，轻轻落地
- **来源**：[eazo.ai Egg Drop Lander](https://eazo.ai)
- **批次方案**：见 `projects/31-shuttlecock-kick/PLAN.md`（31–35 号批量复刻方案）

## 玩法（三期重建后）

1. 蛋从 `height`（900–2550 世界单位）高处落到地面，相机跟随下坠，地面与障碍带随之下移进入视野。
2. **点一下 = 一发反推**：竖直方向立即获得 `-冲量`（0 延迟），点在蛋侧面附带少量水平转向（STEER=110）。准备期 0.8s 内点按会立即开落。
3. **脉冲经济（核心）**：每关只有 4–6 发反推，用完即无；HUD 琥珀点就是剩余反推。
4. **风**：初始水平速度 = 0.15 × 有效风，之后风持续施加水平加速度；蛋会撞 ±260 的侧墙反弹（恢复系数 0.4）。HUD 显示风向与强度（1–3 个箭头），画面有风丝粒子。
5. **障碍带（第 6/9/12 关）**：下落到 `atY × height` 时判定蛋心是否在缺口内；缺口中心按表（0.42/0.60/0.50），缺口半宽按 72px 大蛋等比放宽到 0.50/0.45/0.40（世界半宽比例），判定留半个蛋宽的宽限。**撞带立即摔碎**。
6. **四档评级**：着陆速度 = `hypot(vx, vy)`。超过限速摔碎；≤0.4×限速完美（慢镜 + 光环 + 「完好 ×N」连击）；≤0.75×限速安全；其余有裂纹。
7. **十二关一个 run**：单落结算（评级 / 落速 / 剩余反推）可重试本关（脉冲重置）或进入下一关；末关后出「空投报告」——幸存落数 / 最佳落速 / 剩余反推合计，生成 720×960 纪录卡，最佳成绩持久化。
8. 反推是共享预算：转向（对缺口、抗风）也花反推——全程都是资源决策。

## 物理标定（等比微调，全部记录在案）

原版参数表在高关卡**数学上无解**（例：第 12 关自由落体末速 √(2×435×2550) ≈ 1490，
4 发 × 冲量 250 = 1000，纯刹车都不够，更不可能再分脉冲对缺口）。因此：

- **重力 ×0.55**（`GRAVITY_SCALE`），**风 ×0.35**（`WIND_SCALE`）——关卡表的
  重力/风数值保持原样，物理层乘系数；
- **冲量与每关重力缩放 `gScale` 由 `tools/solve-levels.cjs` 数值求解**：逐关搜索
  使「随手玩家（闭环模型，反应 180–260ms）≥17/20、熟练玩家 6/6、不动手必碎、
  乱点必碎」的最小冲量（优先 gScale=1，无解才降）；
- 缺口半宽按蛋比例放宽（见上），障碍带判定留半个蛋宽宽限；
- 点按带水平转向（原版没有）：原版撞带只是扣 1 发脉冲，简报要求「撞带即碎」，
  不加转向则缺口纯靠运气，转向让过缺口成为技术。
- `qa-balance-check.cjs` 把原版表 + 求解结果全部固化成回归
  （`qa/level-plan.json` 与 content.json 必须一致）。

## 平衡结果（闭环真人模型，qa/balance-report.json）

- 逐关随手通过率全部 ≥ 18/20（末关 20/20），熟练 6/6；
- 整轮 run 平均幸存 12/12（模型口径；模型带前瞻，真人会更难）；
- 末关平均反推用量 4.0/4 发（资源全程紧张）；
- 不动手必碎、乱点必碎、反推 0 延迟、评级边界全部回归。

## 工程约束

- 纯前端静态：经典脚本加载链，禁 `type="module"` / `import` / `eval` / 内联脚本 / 行内事件。
- Chrome 61 / Android 8.1 WebView 61 基线：ES2017，CSS 不使用 flex `gap`、`clamp()`、`aspect-ratio`、逻辑属性、`:has()`、`inset`、`dvh`；画布零文字。
- 无后端、无运行时 CDN、无必需外部 API、无音频文件：音效全部由 Web Audio 实时合成。
- 业务内容集中在 `src/content/content.json`（含 `brand` / `xiaohongshuDraft` / 12 关配置 / 文案）。
- 只保存结构化状态（`egg-best-run` 空投报告最佳纪录、`egg-muted` 静音偏好），不保存任何用户媒体。
- 宿主按钮避让：顶部左右各留 `--host-side: 76px`，标题与 HUD 在 `--host-top: 56px` 之下。
- 上架素材不复用任何历史条目素材，logo 为本项目原创。

## 目录

```
index.html            页面骨架
src/content/content.json  业务内容（关卡、文案、配色）
src/game.js           玩法状态机与物理（脉冲经济 / 风 / 障碍带 / 评级）
src/render.js         Canvas 2D 渲染（相机跟随 / 视差 / 障碍带 / 风丝）
src/audio.js          Web Audio 合成音效
src/storage.js        本地结构化状态
src/app.js            主循环、流程、单落结算、空投报告
src/style.css         样式（宿主避让、安全区、刻度尺）
assets/logo.svg       原创 logo 源文件
assets/logo-512.png   平台上架位图（不进 zip）
tools.mjs             build / preview
tools/level-sim.cjs   闭环玩家模型（与游戏本体零漂移）
tools/solve-levels.cjs 冲量/重力缩放求解器（一次性工具，不参与打包）
verify-artifact.cjs   产物校验（白名单 / ES2017 / 禁用能力）
qa-mobile-check.cjs   375/390/430 + 安全区 + 宿主覆盖层 + 横屏
qa-flow.cjs           全流程 + 结算面板不自行推进断言
qa-balance-check.cjs  原版表回归 + 平衡指标回归（新基线）
tests/game.test.mjs   玩法单测（20 项）
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
node tools/solve-levels.cjs   # 重解冲量（改关卡表后）
node qa-balance-check.cjs
node tools.mjs preview 4332   # http://127.0.0.1:4332
pwsh -NoProfile -ExecutionPolicy Bypass -File pack.ps1
```

## 验收状态

| 项目 | 状态 |
|---|---|
| lint / test（20 项）/ build | 通过 |
| verify-artifact（白名单 / ES2017 / 禁用能力 / 内联脚本） | 通过，产物 10 文件 101.8 KiB（含 `mini_tool.json`） |
| qa-mobile-check（375 / 390 / 430 + 安全区 + 宿主按钮覆盖层 + 横屏） | 通过，`errors: []`，蛋可见直径 73–90px ≥ 72px |
| qa-flow（真实点击通关 → 结算不自行推进 → 摔碎重试 → 完美连击 → 空投报告 → 保存兜底） | 通过，`errors: []` |
| qa-balance-check（原版表锁定 + 求解一致性 + 平衡指标） | 通过 |
| 打包 ZIP | `release/egg-drop-lander-v1.zip` 35,508 bytes，10 条目，`index.html` 在根目录 |
| 高消耗标记 | `mini_tool.json` = `{"is_high_consumption_scene": false}`（只用 Canvas 2D / Web Audio / localStorage，未使用 Worker、离屏渲染、WebAssembly 或游戏引擎） |
| 创服平台模拟器 | **未验收** |
| Android 真机扫码 | **未验收** |
| iOS 真机扫码 | **未验收** |
| Chrome 61 / Android 8.1 WebView 61 实机 | **未验收** |
| 宿主左上返回键、右上操作键的真实遮挡 | 仅用注入覆盖层模拟，真机仍需校准 |
| 新玩法真人手感（脉冲经济节奏 / 慢镜 / 难度曲线） | 仅闭环模型标定，真机未验收 |
