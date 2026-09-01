# 星风来信

一个面向手机竖屏的纯前端唯美动画：用户点击一次，风从上到下揭开线帘，月亮和被窗框中栏分开的月光照进室内；闪烁星星持续随风进入，模糊的单字与星流同行，最终在镜头前组成一句随机星语。

## 体验特点

- 首屏不展示候选文案，点击时才随机锁定结果。
- 固定斜视窗框与中栏，没有活动窗扇或额外开窗动作。
- 窗帘由顶部向下受风，结果态持续摆动。
- 星流贯穿成句阶段，并在结果态以有上限的方式持续补充。
- 主星落到地面后闪烁成星点消散。
- 单字随星进入，中段保持不可辨认，最后组成完整句子。
- 支持静音、减少动态、页面隐藏暂停和完整重播复位。

## 本地运行

```bash
pnpm --ignore-workspace install
pnpm --ignore-workspace dev
```

生产检查：

```bash
pnpm --ignore-workspace lint
pnpm --ignore-workspace test
pnpm --ignore-workspace build
```

## 内容与约束

业务文案只存放在 [`src/content/content.json`](./src/content/content.json)。项目不依赖后端、运行时 CDN、外部 API、Service Worker 或 Node 运行时能力，也不保存用户图片、Base64、音视频或 Blob。

详细规范见 [`DESIGN.md`](./DESIGN.md)、[`UX_SPEC.md`](./UX_SPEC.md)、[`MOTION_SPEC.md`](./MOTION_SPEC.md) 与 [`VISUAL_REFERENCE.md`](./VISUAL_REFERENCE.md)。
