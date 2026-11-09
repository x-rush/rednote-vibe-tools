# 沙丘速降（35 号）

复刻自 eazo.ai 的 `Dune Surfer`，改造成纯前端静态小红书小工具。

- **一句话**：左右拖动刻沙转向，穿过旗门把身后的雪崩压回去，别被它追上。
- **平台简介**：穿过旗门，把雪崩压回去
- **来源**：[eazo.ai Dune Surfer](https://eazo.ai/apps/dune-surfer-arcade-game-hx4egj0p)
  （原版运行地址 `https://dune-surfer-21a385cd.eazo.dev`）
- **批次方案**：见 `projects/31-shuttlecock-kick/PLAN.md` 第 8 章（三期：严格 1:1 复刻）

## 玩法（2026-11-09 三期严格复刻版）

> 二期「玩法重建」混入了自创机制，用户拍板三期**严格 1:1 复刻 eazo 原版（含原版缺陷）**。
> 逆向参数表：`reference/eazo-spec.txt`（施工第一依据）。

1. 竖屏单指操作：**按住屏幕左右拖动**，玩家跟手横移
   （原版橡皮筋手感：拖动中 `vx += (dragX − x) × 55e-5 × dt(ms)`，
   松手每帧 `vx × 0.93` 阻尼滑停；无拖动同样施加阻尼）。
2. 前进速度只随米数增长：`p = 0.4 + min(0.28, 16e-5 × dist)`，
   米数 `dist += dt × p × 0.11`；玩家不控制速度，只控制横切。
3. **旗门是滑道上唯一的交互物**：生成游标 `gen += 300 + 160×rand` 世界单位一面
   （开局 `gen = 400`），横向 `x = W×(0.22 + 0.56×rand)`；
   到线时 `|门.x − 人.x| < 52px` 算穿过；门落后 `wy−400` 被回收。
4. **雪崩压力 ava 是唯一的生存资源**（原版数值）：开局 `0.42`，
   每毫秒 `+42e-6`（约 13.3 秒追平）；穿门 `max(0.12, ava − 0.10)` + 18 粒粒子；
   错门 `min(1, ava + 0.07)`；`ava > 0.98` 被追上，`dead` 计时 700ms 后结算。
5. 边界：`x` 限制在 `[30, W−30]`，越界反弹 `vx = ∓0.4×|vx|`，不判死。
6. 非游玩状态（封面/结算）走原版自动巡航：
   `x = W/2 + sin(0.0011t)×W×0.2`、`vx = 0.3×cos(0.0011t)`、`ava = 0.5 + 0.08×sin(5e-4t)`。
7. **原版缺陷一并照抄，不做修正**：
   - 巡航状态也会把到线的旗门标记成已判定（passed=1/2，旗面变色），但不计分；
   - 雪崩渐变位置公式 `j = d + 26 + (u−d−40)×(1−ava)` 中 ava 越大雪崩前沿反而
     越远离玩家行（视觉与数值方向相反）；
   - 错过的门不会恢复，死亡瞬间人物消失（`dead > 1` 不再绘制）。

## 三期删除的自创（对照二期）

- ❌「赛道内外视觉分区」（赛道内亮雪道 / 外侧深色岩体）——原版无此概念；
- ❌ 雪崩实体翻卷演出（翻卷雪流 + 墙脚亮雪雾 + 三层雪雾）——退回原版单层渐变；
- ❌ 甩尾慢镜 + 冲击波 + 屏震 + 穿门大连锁——退回原版「ava 减少 + 18 粒粒子」；
- ❌ HUD「雪崩距离条」/危险徽章/阶段名——原版 HUD 只有 `{米数}m · 🚩{旗门数}`；
- ❌ 五段海拔色带（黄昏起势→极光终程）——原版只有一套固定配色。

## 保留（不属于复刻范围）

- 二期视觉升级中**不表达玩法规则**的部分：远景沙丘层、滑雪者剪影
  （姿态只由原版 `vx` 决定：`rotate(0.36×clamp(2.4×vx))`，缩放对齐原版 1.15/1.5）、
  压雪纹（纯装饰滚动纹理）、玻璃 HUD 卡基础样式、暗角；
- 纯渲染性能优化（HUD 100ms 节流等，不改变玩法结果）；
- Web Audio 合成音（风声跟速度系数、轰鸣跟 ava，穿门/错门/被追上提示音）；
- 结构化最佳纪录（米数+旗门数）与静音偏好，保存在 localStorage。

## 工程约束

- 纯前端静态：经典脚本加载链，禁 `type="module"` / `import` / `eval` / 内联脚本 / 行内事件。
- Chrome 61 / Android 8.1 WebView 61 基线：ES2017，CSS 不使用 flex `gap`、`clamp()`、`aspect-ratio`、逻辑属性、`:has()`、`inset`、`dvh`；Canvas `roundRect` 手写路径。
- 无后端、无运行时 CDN、无必需外部 API、无音频文件：音效全部由 Web Audio 实时合成。
- 业务内容集中在 `src/content/content.json`（原版文案 dict + 原版渲染色板）。
- 宿主按钮避让：顶部左右各留 `--host-side: 76px`，标题与 HUD 在 `--host-top: 56px` 之下；横屏改成左栏 + 场地两栏，左栏让开左上返回键。
- 上架素材不复用任何历史条目素材，logo 为本项目原创。

## 目录

```
index.html                页面骨架
src/content/content.json  业务内容（原版文案、渲染色板、剪影视觉）
src/game.js               ava 经济、旗门生成/判定、转向手感、速度模型（原版逐常量）
src/render.js             Canvas 2D 渲染（天空/太阳/沙丘/沙面/旗门/雪崩/遮罩，原版画法）
src/audio.js              Web Audio 合成音效（风、轰鸣、穿门、错门、结束）
src/storage.js            本地结构化状态
src/app.js                状态机（封面/游玩/结算）、橡皮筋输入、HUD 胶囊、结算卡
src/style.css             样式（宿主避让、安全区、横屏两栏）
reference/eazo-spec.txt   原版逆向参数表（施工第一依据）
tools.mjs                 build / preview
tools/probe.cjs           手感探针：扫掠够门率/反应/手抖看存活曲线
verify-artifact.cjs       产物校验（白名单 / ES2017 / 禁用能力）
qa-mobile-check.cjs       375/390/430 + 安全区 + 宿主覆盖层 + 横屏宿主避让 + 真实拖拽转向
qa-flow.cjs               全流程：开场 → 转向 → ava 越线 → 结算 → 纪录卡 → 再玩一次
qa-balance-check.cjs      真人模型平衡标定 + 原版常量铁律 + 原版缺陷断言
tests/game.test.mjs       玩法单测（原版数值）
pack.ps1                  打包 ZIP + 白名单 + SHA256
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
node tools/probe.cjs            # 手感探针：改真人模型参数后先跑它看曲线
node tools/logo-png.cjs         # 由 assets/logo.svg 重渲染 512 PNG
node tools.mjs preview 4335     # http://127.0.0.1:4335
pwsh -NoProfile -ExecutionPolicy Bypass -File pack.ps1
```

## 验收状态

| 项目 | 状态 |
|---|---|
| lint / test（18 项）/ build | 通过 |
| verify-artifact（白名单 / ES2017 / 禁用能力 / 内联脚本） | 通过 |
| qa-mobile-check（375 / 390 / 430 + 安全区 + 宿主按钮覆盖层 + 横屏宿主避让 + 真实拖拽转向） | 通过，四档 `errors: []` |
| qa-flow（开场 → 教程 → 转向 → ava 越线 → 结算 → 720×960 结算卡 → 保存兜底 → 再玩一次） | 通过，`errors: []` |
| qa-balance-check（真人模型曲线、原版常量铁律、原版缺陷断言） | 通过（三期严格复刻基线：躺平 23.2 秒死 / 随手平均 77.8 秒·5277 米 / 熟练 8/8 顶满 120 秒上限，拉开 1.61×） |
| 打包 ZIP | 见 `release/manifest.json`（pack.ps1 自动生成） |
| 高消耗标记 | `mini_tool.json` = `{"is_high_consumption_scene": false}`（只用 Canvas 2D / Web Audio / localStorage，未使用 Worker、离屏渲染、WebAssembly 或游戏引擎） |
| 创服平台模拟器 | **未验收** |
| Android 真机扫码 | **未验收** |
| iOS 真机扫码 | **未验收** |
| Chrome 61 / Android 8.1 WebView 61 实机 | **未验收** |
| 宿主左上返回键、右上操作键的真实遮挡 | 仅用注入覆盖层模拟，真机仍需校准 |
| 与 eazo 原版逐帧对照 | 仅按逆向参数表逐常量核对，未做像素级对照 |
