# 星风来信｜视觉验收

## 检查点

- `initial`：房间昏暗，无句子和地面光束；声音按钮避开安全区。
- `curtain-top`：上段先明显偏移，尾端仍滞后；不存在窗扇动作。
- `moonlight`：月牙明亮但不过曝，中栏清晰，两块投影之间有暗缝。
- `letters-entering`：星流贯穿窗口和室内，字符只是模糊光迹，尚不能读成完整句子。
- `result`：句子完整、字体轻盈，重播控件不遮字；仍能看到新星进入和帘尾摆动。
- `result-long`：长时间运行后粒子不超上限，构图、句子和控件不漂移。

## 移动端矩阵

| 视口 | 顶部安全区 | 必查内容 |
| --- | --- | --- |
| 375 × 812 | 32px | 窗框不裁切、长句不超两行、控件可点 |
| 390 × 844 | 32px | 全部叙事检查点与持续结果态 |
| 430 × 932 | 32px | 场景居中、留白均衡、无横向滚动 |

## 2026-09-02 实测记录

- 375 × 812：[首帧](./release-assets/375-initial.png)、[帘顶受风](./release-assets/375-curtain-top.png)、[分栏月光](./release-assets/375-moonlight.png)、[字随星入室](./release-assets/375-letters-entering.png)、[结果](./release-assets/375-result.png)。
- 390 × 844：[首帧](./release-assets/390-initial.png)、[帘顶受风](./release-assets/390-curtain-top.png)、[分栏月光](./release-assets/390-moonlight.png)、[字随星入室](./release-assets/390-letters-entering.png)、[结果](./release-assets/390-result.png)。
- 430 × 932：[首帧](./release-assets/430-initial.png)、[帘顶受风](./release-assets/430-curtain-top.png)、[分栏月光](./release-assets/430-moonlight.png)、[字随星入室](./release-assets/430-letters-entering.png)、[结果](./release-assets/430-result.png)。
- 390px 宽度、32px 顶部安全区：[安全区截图](./release-assets/390-safe-area-32.png)。声音按钮边界为 `x=333.98, y=42.02, width=44, height=44` CSS px；文档 `scrollWidth=390`、`clientWidth=390`。
- 390 × 844 长运行：[约 67 秒结果](./release-assets/390-result-60s.png)。状态仍为 `result`，有新进入的星点，完整句和重播控件稳定。
- 减少动态：[390px 结果](./release-assets/390-reduced-result.png)。完整帘开、月光、低密度星流与成句均保留。
- 重播实测：结果态点击后等待 1.65 秒，飞行句节点数量为 0，首屏触发按钮恢复为 1；场景样本回到首帧 `wind`/0ms。
- 重播后台暂停实测：复位 300ms 后模拟隐藏 2 秒，状态保持 `resetting`；恢复 1.3 秒后才回到首帧，后台时间未计入复位进度。
- 浏览器控制台：Errors 0，Warnings 0。
- 粒子硬上限：满画质 132，降级模式 68；60 秒系统模拟测试逐帧验证未超限。

## 自动化约束

- 状态机和时间线覆盖正常、降级、重播和不封顶结果时间。
- 窗帘测试验证顶部先动、尾端滞后，以及结果时间变化时路径继续变化。
- 粒子测试模拟 60 秒，满画质不超过 132、降级模式不超过 68，并验证末段仍有新粒子。
- 字符测试验证窗口来源、顺序、错峰、中段模糊和最终零变换。
- 提交前执行 `pnpm --ignore-workspace lint && pnpm --ignore-workspace test && pnpm --ignore-workspace build`。
