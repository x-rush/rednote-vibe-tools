# 珍珠消消乐（Boba Pop）

复刻自 [eazo.ai](https://eazo.ai/) 的热门小游戏 **Boba Pop**：点掉三颗以上相连的同色珍珠，
上方珍珠砸落并自动接续连锁，连锁越深分数越高。共 8 杯（关卡），颜色从 4 种逐步增加到 6 种。

纯前端、离线、零运行时依赖：无后端、无 CDN、无外部 API、无音频文件（音效由 Web Audio 实时合成）。

## 玩法

- 轻点任意一颗相连的同色珍珠（≥3 颗）即可消除整片。
- 上方珍珠会砸落，落位后新成的同色组合自动接续连锁，连锁倍率最高 ×5。
- 右侧「接下来」预告将要补充的颜色，可以提前规划。
- 每关有目标消除数与步数上限，步数用尽未达标即结算失败。

## 目录

```
index.html            入口（zip 根目录）
src/style.css         样式：Chrome 61 基线、安全区、宿主按钮避让、横竖屏适配
src/game.js           玩法核心：匹配 / 重力 / 补充 / 连锁 / 关卡 / 计分（纯逻辑，可单测）
src/render.js         Canvas 2D 渲染：珍珠球体质感、粒子、涟漪、震屏、糖浆光晕
src/audio.js          Web Audio 实时合成音效（无音频文件）
src/storage.js        存储：优先 xhs.miniTool.setStorage，降级 localStorage
src/app.js            主程序：动画状态机、连锁编排、输入、结算与成绩卡
src/content/content.json  业务内容：口味配色、8 关配置、全部文案
tools.mjs             build（产物到 dist/）| preview（本地预览）
verify-artifact.cjs   产物合规校验：白名单 / ES2017 / 禁用能力 / 无内联脚本 / 体积
pack.ps1              打包 zip 并生成 release/manifest.json
```

## 命令

```bash
npm run lint     # node --check 全部脚本
npm run test     # 单元测试 + 关卡可通关性回归
npm run build    # 产出 dist/（index.html 在根目录）
npm run preview  # http://127.0.0.1:4330
npm run pack     # 产出 release/boba-pop-v1.zip + manifest.json
```

## 自检脚本

复用仓库既有 Playwright 运行时，不新增依赖。

| 脚本 | 覆盖内容 |
| --- | --- |
| `qa-mobile-check.cjs` | 375 / 390 / 430 CSS px、非零安全区、宿主左右按钮覆盖层、横屏几何；可传入待检目录以校验解压后的 zip |
| `qa-flow.cjs` | 真实点击通关 → 关卡结算面板 → 下一关 → 最终成绩卡 → 保存按钮兜底 |
| `qa-balance-check.cjs` | 贪心 / 专家双策略复核 8 关可通关性 |
| `qa-curve.cjs` | 每关「分数-步数」曲线，用于配平目标与步数 |
| `qa-density.cjs` | 各颜色数下的可点目标密度与连锁深度分布 |
| `qa-chain-lab.cjs` | 连锁规则实验台 |

## 数值口径

- 计分：单颗 10 分 × 连锁倍率（上限 ×5），连锁深度上限 6 层。
- 连锁判定以「珍珠身份集合」为准：整组下滑不算新生，只有真正新成的组合才接续连锁；
  每轮连锁最多推进一组，避免一次点击清空半个盘面。
- 盘面生成：先播 4~6 个独立小簇，其余位置约三成概率主动拼出 L 形三连，
  保证每关始终有多个可点目标，玩家有选择、连锁也有土壤。
- 关卡目标与步数按「贪心策略（每次点最大的那一组）也能过、且至少余 3 步」配平，
  回归脚本 `tests/balance.test.mjs` 固化了这条约束。

## 尚未验证

以下需要在创服平台 / 真机上完成，浏览器直跑不能作为验收依据：

- 创服平台模拟器
- Android 真机扫码
- iOS 真机扫码
- Chrome 61 / Android 8.1 WebView 61 实机运行
