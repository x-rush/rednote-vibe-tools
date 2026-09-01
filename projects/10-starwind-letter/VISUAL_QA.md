# 星风来信视觉 QA

验证日期：2026-09-01
验证入口：本地 production preview（Vite 构建产物）
参考：`references/01-curtain-closed.jpg`、`02-wind-opening.jpg`、`03-stars-entering.jpg`

## 视口矩阵

| CSS 视口 | 首屏 | 选中 | 风压峰值 | 星星穿窗 | 落地消散 | 结果 |
|---|---|---|---|---|---|---|
| 375×812 | [截图](./release-assets/375-initial.png) | [截图](./release-assets/375-selected.png) | [截图](./release-assets/375-wind.png) | [截图](./release-assets/375-crossing.png) | [截图](./release-assets/375-landing.png) | [截图](./release-assets/375-result.png) |
| 390×844 | [截图](./release-assets/390-initial.png) | [截图](./release-assets/390-selected.png) | [截图](./release-assets/390-wind.png) | [截图](./release-assets/390-crossing.png) | [截图](./release-assets/390-landing.png) | [截图](./release-assets/390-result.png) |
| 430×932 | [截图](./release-assets/430-initial.png) | [截图](./release-assets/430-selected.png) | [截图](./release-assets/430-wind.png) | [截图](./release-assets/430-crossing.png) | [截图](./release-assets/430-landing.png) | [截图](./release-assets/430-result.png) |

## 构图核对

- 通过：窗户位于上半屏偏右，帘杆、窗框上沿和横梁保持同向透视。
- 通过：关闭态只有玻璃后的微弱月影，墙面和地面没有室内光束；明暗变化由开窗动作触发。
- 通过：风压峰值中 64 根帘线向左下室内前景形成长弧面；开窗完成前帘环全部滑到窗洞左外侧，结果态尾线不再横穿窗口。
- 通过：窗扇固定右侧铰链边，玻璃面随开启角度持续压窄；结果态接近 90°、只保留窄侧边和反光，窗洞完整敞开，月光与地面亮区同步扩大。
- 通过：窗框在风压峰值仍可辨认，没有被发光粒子覆盖成白团。
- 通过：星语使用无卡片“逐字光尘凝聚”，旧句上浮虚化，新句由弱光扫过后成形；系统楷宋字体位于下方留白。

## 粒子方向证据

- 窗外 Canvas 仅在窗口四边形内绘制 `outside` / `crossing` 粒子。
- 窗扇开启进度低于 0.55 时，主星不会转移到室内层。
- 主星上一位置与下一位置必须形成向左下移动并经过窗口四边形的连续线段，才能进入 `inside`。
- [390 穿窗截图](./release-assets/390-crossing.png) 可见主星和星尘从月亮附近、窗框开口到室内风道的连续分布。
- [390 落地截图](./release-assets/390-landing.png) 可见早到主星在透视地面停驻闪烁，触地光环与碎尘向外散开。
- [390 结果截图](./release-assets/390-result.png) 只保留晚到星的微弱余光，主星没有从文字内部爆出。
- 完整演出在 7.5 秒仍处于错峰落地与消散余韵，8.8 秒进入结果态，避免星群在刚触地时冻结。

## 选句与重置

- 首屏实测约每 72ms 更换候选；候选原文在 `spinning/slowing` 阶段不挂载，只渲染宽度随候选变化的银蓝抽象光痕，因此视觉、DOM 与辅助技术均无法提前读出文案。
- 点击后 1.2 秒内候选停留间隔逐步拉长，但始终维持不可辨认的柔光痕迹；真正停住后，只有最终句在 660ms 内由模糊光尘逐字凝聚，并在风起前完成。
- 重播使用独立 `resetting` 采样：帘束由窗侧连续铺回整扇窗口，窗扇、月光和星粒同步收拢；结束前帘线几何已接近首帧，没有末帧跳变。

## 安全区与响应式

- [32px 安全区截图](./release-assets/390-safe-area-32.png)：音效按钮 `y = 42.015625px`，尺寸为 44×44 CSS px。
- 390 宽度实测 `documentElement.scrollWidth === clientWidth === 390`，无横向滚动。
- 375、390、430 的最终句均不超过两行，首屏模糊轮盘、全开窗扇、帘束、星轨与结果控件均未裁切或出屏。
- 横屏规则保持居中 390:844 竖版舞台，不拉伸场景透视。

## 降低动态

- [降低动态结果截图](./release-assets/390-reduced-result.png)。
- 简化时间线保留选句、风、自动开窗、星星进入、落地和结果阶段。
- QA 首次发现粒子仍按原 7.5 秒时间表生成，导致 4.3 秒简化演出结束时没有主星；当前映射直接取完整与简化时间线的时长比，不再保留硬编码旧时长。
- 修复后结果态可见主星已进入室内并落在星语附近。

## 稳定性与控制台

- 本次重做后连续完成 3 次降低动态模式的“触发 → 结果 → 重播 → 首屏”，每次结果态和重置后的唯一按钮计数均为 1。
- 三档完整时间线及 3 次重播循环后 Playwright 控制台为 0 errors、0 warnings。
- 重置后窗户关闭、帘线垂落、粒子清空、轮播重新启动。

## 已知限制

- 声音使用用户首次点击后即时合成的短音色，不包含录制风声；不同设备的扬声器表现会略有差异。
- Canvas 会把有效 DPR 限制为 2，并在降低动态时使用较少粒子；低端设备的光晕精细度可能低于截图，但空间方向保持不变。
- QA 使用 Chromium production preview；仍建议发布前在一台真实 iOS Safari 和一台 Android Chrome 上复核音频解锁和持续帧率。
