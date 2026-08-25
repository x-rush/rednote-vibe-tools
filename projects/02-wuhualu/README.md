# 物华录：文物寻踪

纯前端、移动端优先的文物观察与收集小游戏。一轮随机选择五件藏品，玩家轻触完整文物图上的三枚观察签，自由拆阅“看形、辨材、问来历”三枚线索印，在四个选项中作答；揭晓后阅读五段有来源的故事，完成离柜一问，再把文物收入本地图鉴。

## 首发范围

当前完整题池包含十件已经具备静态美术资源、完整观察和故事内容的文物：

- 鹰形陶鼎
- 人面鱼纹彩陶盆
- 贾湖骨笛
- 红山玉龙
- 后母戊鼎
- 四羊方尊
- 莲鹤方壶
- 云纹铜禁
- 曾侯乙编钟
- 曾侯乙尊盘

其余十件继续保留在内容库与图鉴时间轴中，但不进入题局，也不存在旧版降级玩法。机器可读资源规则见 `public/assets/asset-manifest.json` 的 `releaseGate`。

## 运行约束

- React + TypeScript + Vite，构建产物为纯静态文件。
- 无后端、运行时 CDN、必需外部 API 或 Service Worker。
- 业务内容只来自 `src/content/content.json`。
- 图鉴、得分和当前题局保存在 `localStorage`；不保存用户图片、Base64、音视频或 Blob。
- 图片失败按“当前角色 → 已核验剪影 → CSS 轮廓与文字”降级，游戏仍可完成。

## 图像与事实边界

运行时文物图为基于证据包制作的艺术化示意，并在页面中独立标注“创意重构”，不冒充馆藏实物照片。四羊方尊保留“限定视角”说明；曾侯乙尊盘保留“非数字复原”说明。

公开仓库只包含正式运行时资源和 Markdown 参考 dossier。用于核查的博物馆参考图片、网页快照和本地证据附件不随代码发布，避免误用第三方图片授权。

## 开发

在仓库根目录安装依赖后：

```bash
cd projects/02-wuhualu
pnpm dev
```

提交前必须执行：

```bash
pnpm lint
pnpm test
pnpm build
```

响应式门禁覆盖 320、360、375、390、430 CSS px。完整设计、交互、资源和验收记录见：

- `DESIGN.md`
- `UX-SPEC.md`
- `UI-HANDOFF.md`
- `PROMPTS.md`
- `VISUAL-QA.md`
- `DESIGN-UNIFIED-TEN-ARTIFACTS.md`
- `design/preview.html`
- `research/*-reference-dossier.md`
