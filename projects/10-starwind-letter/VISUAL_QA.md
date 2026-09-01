# 星风来信视觉 QA

验证日期：2026-09-01
验证入口：本地 production preview（Vite 构建产物）
参考：`references/01-curtain-closed.jpg`、`02-wind-opening.jpg`、`03-stars-entering.jpg`

## 视口矩阵

| CSS 视口 | 首屏 | 选中 | 风压峰值 | 星星穿窗 | 结果 |
|---|---|---|---|---|---|
| 375×812 | [截图](./release-assets/375-initial.png) | [截图](./release-assets/375-selected.png) | [截图](./release-assets/375-wind.png) | [截图](./release-assets/375-crossing.png) | [截图](./release-assets/375-result.png) |
| 390×844 | [截图](./release-assets/390-initial.png) | [截图](./release-assets/390-selected.png) | [截图](./release-assets/390-wind.png) | [截图](./release-assets/390-crossing.png) | [截图](./release-assets/390-result.png) |
| 430×932 | [截图](./release-assets/430-initial.png) | [截图](./release-assets/430-selected.png) | [截图](./release-assets/430-wind.png) | [截图](./release-assets/430-crossing.png) | [截图](./release-assets/430-result.png) |

## 构图核对

- 通过：窗户位于上半屏偏右，帘杆、窗框上沿和横梁保持同向透视。
- 通过：关闭态可透过独立帘线看见月亮、星点、窗框和窗扇。
- 通过：风压峰值中 64 根帘线从右上固定点向左下室内前景形成长扇面，而非整体平移。
- 通过：窗扇固定右侧铰链边，朝观看者和左下方向旋开；月光随开启扩大。
- 通过：窗框在风压峰值仍可辨认，没有被发光粒子覆盖成白团。
- 通过：星语使用无卡片“光尘显字”，位于下方留白，风压时降亮，结果时重新点亮。

## 粒子方向证据

- 窗外 Canvas 仅在窗口四边形内绘制 `outside` / `crossing` 粒子。
- 窗扇开启进度低于 0.55 时，主星不会转移到室内层。
- 主星上一位置与下一位置必须形成向左下移动并经过窗口四边形的连续线段，才能进入 `inside`。
- [390 穿窗截图](./release-assets/390-crossing.png) 可见主星和星尘从月亮附近、窗框开口到室内风道的连续分布。
- [390 结果截图](./release-assets/390-result.png) 可见主星在进入室内后落到星语附近，没有从文字内部爆出。

## 安全区与响应式

- [32px 安全区截图](./release-assets/390-safe-area-32.png)：音效按钮 `y = 42.015625px`，尺寸为 44×44 CSS px。
- 390 宽度实测 `documentElement.scrollWidth === clientWidth === 390`，无横向滚动。
- 375、390、430 的全部候选句和结果句均不超过两行，未发现裁字或关键主体出屏。
- 横屏规则保持居中 390:844 竖版舞台，不拉伸场景透视。

## 降低动态

- [降低动态结果截图](./release-assets/390-reduced-result.png)。
- 简化时间线保留选句、风、自动开窗、星星进入和结果阶段。
- QA 首次发现粒子仍按 7.5 秒完整时间表生成，导致 4.3 秒简化演出结束时没有主星；已用回归测试复现并将粒子叙事时间映射至缩短时间线。
- 修复后结果态可见主星已进入室内并落在星语附近。

## 稳定性与控制台

- 在同一页面连续完成 10 次“触发 → 结果 → 重播 → 首屏”，每次结果态和重置后的唯一按钮计数均为 1。
- 10 次循环后 Playwright 控制台为 0 errors、0 warnings。
- 重置后窗户关闭、帘线垂落、粒子清空、轮播重新启动。

## 已知限制

- 声音使用用户首次点击后即时合成的短音色，不包含录制风声；不同设备的扬声器表现会略有差异。
- Canvas 会把有效 DPR 限制为 2，并在降低动态时使用较少粒子；低端设备的光晕精细度可能低于截图，但空间方向保持不变。
- QA 使用 Chromium production preview；仍建议发布前在一台真实 iOS Safari 和一台 Android Chrome 上复核音频解锁和持续帧率。
