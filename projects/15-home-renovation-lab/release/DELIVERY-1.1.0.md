# ROOMISH 1.1.0 交付说明

交付日期：2026-09-18。

## 上传文件

使用本目录 `roomish-1.1.0-minitool.zip`。不要使用旧的 1.0.0 或 20260917 发布包，也不要压缩项目根目录上传。

- 大小：1,220,710 字节，约 1.22 MB。
- 文件数：32。`index.html` 位于 ZIP 根目录。
- SHA256：`681D46AFEEF2627EEC70DD688A0972A9DBF7E8BEF346C1A9562E319124D30601`。
- ZIP 内 32 个文件逐一与已测 `minitool-dist` 校验一致。
- 纯前端离线包，资源随包提供，无必需后端、外部 API、运行时 CDN。

## 本版改进

- 门先选中再移动，沿当前墙面调整；视角拖动不再直接修改未选中的门。切换风格、重建及撤销后保持选中高亮一致。
- 家具和门的手势冲突处理、拖动与点击区分、多指取消及失焦清理。
- 体验中转头不再中断行走，行走中可主动停止。
- 属性草稿与正式方案分离。关闭面板、导航和切换视角不隐式提交；应用或完成后保存。
- 显示未应用提示，支持放弃未应用修改。草稿只保留在当前页面会话，刷新可能丢失；已提交方案保存在本机。
- X、收起和 Escape 行为统一；无效草稿不再阻止打开其他菜单。
- 恢复浮动撤销/重做。模拟横屏单独处理宿主物理坐标避让，快捷按钮不再进入本次模拟返回区域。
- 离线渲染合并跳过门洞透明命中模型；平面降级支持门洞显示与编辑辅助。

## 验收

- `pnpm lint` 通过。
- `pnpm test`：28/28 通过。
- `pnpm build` 与离线打包通过。
- `verify-fixes.mjs`：375/390/430 竖屏、模拟横屏、844×390 自然横屏、1280×900 桌面通过。覆盖宿主区域、门高亮与撤销、Escape、草稿及显式保存。
- `check-gestures.mjs`：3 种宽度 × 3 种方向布局通过。部分命中与指针捕获使用模拟，不等于全量真机触摸验收。
- `check-release.mjs`：file/CSP/Canvas 2D fallback 三种环境 × 375/390/430，共 9 组全部通过。覆盖离线启动、Logo、旧 API 回退、草稿提示与放弃、模拟键盘、快捷撤销重做、横屏导出、模拟相册拒绝与重试、保存后刷新恢复。未记录页面 JS 异常或外部网络请求。
- Skill 产物目录审计：32 个文件，零警告。最终 ZIP 体积审计：通过，零警告。
- 前一轮同版功能检查：12 次风格切换保持渲染预算，模拟 WebGL context lost 后进入 Canvas 2D。此次最后修改仅是模拟横屏快捷按钮的 CSS 偏移。

## 当前验收入口

从本项目目录执行，使用支持 ES Modules 的现代 Node，避免 PATH 优先调用微信开发者工具自带的旧 Node：

```powershell
pnpm lint
pnpm test
pnpm build
node artifacts/full-review-20260917/verify-fixes.mjs
node scripts/check-gestures.mjs
node scripts/package-minitool.mjs
node scripts/check-release.mjs
```

`scripts/check-minitool.mjs` 与旧 artifacts 中部分交互脚本对应旧桥接或旧门移动规则，仅作历史资料，不作为 1.1.0 的验收入口。当前离线报告是 `acceptance-1.1.0.json`。

## 明确的设备边界

这是通过上述本机验收的交付包，不代表所有设备零缺陷。Chrome 61 / Android 8.1 真机兼容性、宿主实际返回按钮区域、系统软键盘、真实相册权限以及长期帧率和内存尚未实机验证。JS 已转译至 ES2017；API 回退、CSP 与低性能兜底已在现代浏览器模拟验证，不能替代旧内核实测。

相册调用遵循 Skill：完整 JPEG data URI → writeTempFile → saveImageToPhotosAlbum，仅在用户操作后调用，不保存图片数据至 localStorage。
