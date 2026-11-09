# 彩沙瓶（33 号）

严格 1:1 复刻 eazo.ai 的 `Sand Bottle Layers`（原版页面 `https://eazo.ai/apps/sand-bottle-layers-monf8ezi`，
运行地址 `https://sand-bottle-layers-a33eec71.eazo.dev`），纯前端静态小红书小工具。

- **一句话**：拖动倒沙，倾斜瓶身，用推杆把沙压出贴着玻璃的尖峰——一切都无法撤销。
- **来源**：[eazo.ai Sand Bottle Layers](https://eazo.ai/apps/sand-bottle-layers-monf8ezi)
- **规范**：`projects/31-shuttlecock-kick/PLAN.md` 第 8 章（三期：严格 1:1 复刻，含原版缺陷）
- **施工依据**：`reference/eazo-spec.txt`（总控从原版源码逐段提取的精确参数表）

## 玩法（与原版逐机制对齐）

1. **开局流程**：封面教程行「拖动倾倒并倾斜瓶身。一切都无法撤销。」→「选择瓶形」五种瓶型 →
   进入制作页（先灌 420 粒三色演示沙，瓶子从来不是空的）→「举向光亮」→ 结果页 →「再做一瓶」回选瓶。
2. **五种瓶型**（原版 `BOTTLE_SHAPES`，参数一字不改）：round / cylinder / flask / teardrop / wide，
   参数体系为原版的 `{bodyHalf, neckHalf, neckSpan, shoulderSpan, roundBottom}`。
3. **十二种沙色**（原版 `SAND_COLORS`）：ochre→slate，hex 与顺序与原版一致。
4. **双工具**：只有 **Pour（倒沙）** 和 **Rod（推杆）**。按下倒 18 粒，拖动每帧倒 10 粒；
   推杆作用半径固定 `0.11 * W`，径向推力 `(1 - s/a) * 3.2` 并叠加拖动位移。
5. **倾斜倒沙**：拖动时 `tilt = clamp((x - W/2) / (W/2), -1, 1)`，沙受 `vx += .05 * tilt` 横向流动，
   松手 `tilt` 归零；**瓶身渲染同样随 tilt 旋转 `rotate(.05*tilt)`**（原版 drawBottle 第一句），
   背景房间不转、瓶体（背壁+沙 / 玻璃）绕画布中心旋转，拖动最大 ±0.05 rad，松手即回正。
6. **逐粒沙物理**（原版 SandEngine 1:1）：上限 2600 粒，重力 `.22`（速度上限 5），水平阻尼 `*.9`，
   静止粒在 `|tilt| < .04` 时整帧跳过；堆叠按列高度场（格宽 `1.7 * 粒半径`）+ 沿坡滑落。
7. **满瓶判据**（原版缺陷照抄）：`grains >= 2600 || fillLevel > .97`。实测 2600 粒只能把瓶填到
   **约 38.6%–40.1%**——粒数上限永远先触发，`.97` 填充分支实际不可达。这是原版行为，不得修正。
8. **不可撤销**：全程无 undo、无关卡、无评分——原版没有的一律不做。

## 三期改动（2026-11-09）

- 删除二期全部自创：三种瓶型的自定义参数体系、`reach` 塑形臂长、第三种工具「挖沙」、
  逐列 mounds 沙模型、关卡与评级、点选倒沙。
- `src/game.js` 是原版 SandEngine 的逐常量移植；`src/content/content.json` 承载原版 22 条文案
  （zh/en 双语，含 EN/中文切换）、5 瓶型与 12 色原值。
- 保留的二期视觉项：有厚度的玻璃瓶、木纹小推杆、窗光木桌背景、玻璃 HUD、封瓶光爆与收藏图鉴
  （按 5 瓶型扩展）、EN/中文切换。视觉不改变任何玩法判定。

## 双端对照修复（2026-11-09 第二轮，用户反馈「倒沙全是 bug」后）

用 Playwright 同时驱动原版（在线）与本端逐交互对照（脚本留存 `%TEMP%\compare-33.mjs`，
数据在 `qa/compare/`），修复的 A 类差异：

1. **瓶身倾斜没有视觉旋转**（对照实测：原版拖动时画布 rotate 0→0.04 rad，我方恒 0）——
   渲染层合成期对瓶体两层（背壁+沙 / 玻璃+暗角）施加 `rotate(.05*tilt)`，房间不转。
   瓶身背壁从背景层移入沙层随瓶旋转；堆面亮边跳过无沙列（避免层旋转时全宽横线跟着转）。
2. **结果页摆动快了约 8 倍**（原版相位按帧推进 .002/帧，60fps 周期约 17.5s；我方按秒推进）——
   `resT += .002` 改为按帧推进。
3. **缺少扫光带**（原版 drawBottle 每帧在瓶内 clip 里画一道 glare）——补 `drawGlareBand`，
   craft .0025/帧、result .002/帧推进，公式逐位同原版。
4. **选瓶页布局**：原版为 3 列网格（3+2、卡宽约 103px），我方原为竖排列表——改 3 列 wrap
   （卡宽 101px、左对齐），缩略图 40×64。
5. **底栏控件被浮层面板盖住**（原版静音/语言悬浮控件盖在所有屏幕之上）——底栏 z-index 提到
   面板层之上，封面/选瓶/结果页也能切语言、静音、开图鉴。
6. 倒沙扬尘半径 `1.5` → `0.8 * grainR()`（原版值）。

对照确认无差异的项（此前疑点排除）：按下 18 粒 / 拖动每事件 10 粒、tilt 映射与松手归零、
倒沙位置跟手、指针拖出画布不中断倾倒（双方都靠 pointer capture）、2600 满瓶判据与 ≈40% 填充、
finish 恒可用、replay 回选瓶、换色链路（`colors[5]` 本就是 cream，此前探针用错下标误报）。

## 保留的性能架构（逐粒沙 + 缓存）

- 原版每帧全量重画全部粒子；本项目把静态内容（房间/木桌/玻璃/暗角）烘焙进三张离屏画布，
  静止帧只有 3 次 drawImage。
- 沙层按**逐粒位移**失效：引擎每帧记录位移粒子的并集包围盒（`dirtyBox`），渲染层只清空并重画
  盒内相交的粒子（fillRect 直绘；同机微基准 2100 次 5px drawImage ≈ 21.8ms，fillRect ≈ 3.0ms）；
  盒面积超过瓶身内腔 55% 时退回全量重绘。
- 实测（Playwright + CDP，4x CPU 节流）：交互段 ~60fps（P95 帧耗时 ~8ms）、静止段 ~64fps、
  每帧绘制 ≤ 3 次 drawImage。逐粒物理本身每步 ~0.5ms（2600 粒，桌面未节流）。

## 工程约束

- 纯前端静态：经典脚本加载链，禁 `type="module"` / `import` / `eval` / 内联脚本 / 行内事件。
- Chrome 61 / Android 8.1 WebView 61 基线：ES2017（禁 `?.`、`??`、可选链），CSS 不使用 flex `gap`、
  `clamp()`、`aspect-ratio`、逻辑属性、`:has()`、`inset` 简写、`dvh`；Canvas `roundRect` 手写路径
  （`Path2D` 为 Chrome 36+ 特性，可用）。
- 无后端、无运行时 CDN、无必需外部 API、无音频文件：音效全部由 Web Audio 实时合成
  （三组交互音效按原版参数 1:1：倒沙噪声 / 选择点击 / 松手）。
- 业务内容集中在 `src/content/content.json`。
- 只在本机保存结构化状态（收藏图鉴的逐列颜色游程、静音偏好），不保存任何用户媒体。
- 宿主按钮避让：顶部左右各留 `--host-side: 76px`，标题在 `--host-top: 56px` 之下；
  交互控件全部放在页面中部与底部；横屏三栏让开宿主左右按钮。
- `qa-flow.cjs` 保持「点击画布 55% 高度倒沙」兼容断言（每次按下倒 18 粒，五种瓶型逐一验证）。

## 门禁

```
npm run lint
npm test
npm run build
node verify-artifact.cjs dist
node qa-balance-check.cjs   # 原版常量回归（5 瓶型剖面采样 / 2600 满瓶 / 推杆半径 / 420 开场）
node qa-mobile-check.cjs    # 375/390/430 + 五瓶型选瓶页 + 宿主覆盖层 + 横屏
node qa-flow.cjs            # 全流程：封面→选瓶→倒沙/倾斜/推杆→举向光亮→结果→图鉴→双语→无撤销
node qa-perf-check.cjs      # 4x CPU 节流帧率门禁
pwsh -NoProfile -ExecutionPolicy Bypass -File pack.ps1
```

## 目录

```
index.html                  页面骨架（cover/pick/craft/result/album 五屏）
src/content/content.json    业务内容（原版文案 zh/en、5 瓶型、12 色、场景配色）
src/game.js                 原版 SandEngine 1:1 移植（瓶型剖面、逐粒物理、pour/rod、420 开场）
src/render.js               Canvas 2D 渲染（暖光房间、木桌、玻璃瓶、逐粒沙、推杆、封瓶演出、背光结果页）
src/audio.js                Web Audio 合成音效（原版三组音效参数）
src/storage.js              本地结构化状态（容器 Storage API 优先，降级 localStorage）
src/app.js                  状态机（cover/pick/craft/result）、指针交互、HUD、图鉴、双语
src/style.css               样式（宿主避让、安全区、玻璃 chip、色条、横屏三栏）
reference/eazo-spec.txt     原版源码逐段提取的精确参数表（施工第一依据）
tools/autoplay.cjs          QA 自动倒沙助手（不进打包产物）
```

## 未验收项

小红书真机（宿主按钮、安全区、Web Audio 实机解码、触控倾倒手感）与 Chrome 61 WebView 运行时
均未实机验收；`release/manifest.json` 的 `platformSimulator` / `androidDevice` / `iosDevice` /
`chrome61Runtime` 字段如实保持 pending / not-tested。
