# 星风来信开发约束

本 Agent 只允许修改 `projects/10-starwind-letter`。根工作区、其他 `projects/*`、根 `package.json`、`pnpm-workspace.yaml`、`pnpm-lock.yaml`、`docs/` 与 `prep/` 均为只读。不得新增依赖；如确需依赖，先报告理由，等待总控统一处理。

项目必须是纯前端静态构建：无后端、无运行时 CDN、无必需外部 API。业务内容只允许放在 `src/content/content.json`。可使用 `localStorage` 保存音效开关、是否看过引导等结构化偏好；禁止保存用户图片、Base64、音视频或 Blob。不依赖 Service Worker、Node API 或未经确认的设备 API（包括麦克风、陀螺仪、摄像头和振动）。

必须忠实实现本目录内的产品文档。需求优先级为：`PROJECT_BRIEF.md` → `UX_SPEC.md` → `MOTION_SPEC.md` → `CONTENT_SPEC.md` → `IMPLEMENTATION_PLAN.md`。如文档有冲突，停止并报告，不得自行扩张产品范围。

开始视觉实现前必须查看 `references/01-curtain-closed.jpg`、`references/02-wind-opening.jpg`、`references/03-stars-entering.jpg` 并阅读 `VISUAL_REFERENCE.md`。参考图是社交平台视频截图：只参考中央蓝色艺术画面的构图、透视、线帘、窗户、月光、风和星星，不实现截图中的状态栏、作者信息、点赞评论、进度条等平台 UI，也不得把整张截图直接嵌入成品。

核心不可变要求：用户不输入文字、不手动控制窗帘；用户点击暂停句子后，窗帘与窗户由风自动吹开；所有主星粒子必须从窗框后方的窗外空间穿过窗口进入室内。

提交前必须在本项目目录执行 `pnpm lint && pnpm test && pnpm build`。至少验证 375、390、430 CSS px 宽度；以非零 `--safe-area-inset-top` 验证所有顶部 `sticky`/`fixed` 控件和锚点目标不被状态栏遮挡。不得删除或削弱测试来通过检查。
