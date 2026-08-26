# 八项目并行开发总规则

每个 Codex CLI 只允许修改它被分配的 projects/<project> 目录。不要修改其他项目、根 package.json、pnpm-workspace.yaml、pnpm-lock.yaml、docs/ 或 prep/。新增依赖先报告，由总控统一修改锁文件。

运行约束：纯前端静态构建；无后端、运行时 CDN 或必需外部 API；业务内容只放本项目 src/content/content.json；可用 localStorage / IndexedDB 保存结构化状态；禁止保存用户图片、Base64、音视频或 Blob；不依赖 Service Worker、Node API 或未经确认的设备 API。

提交前在项目目录执行 pnpm lint && pnpm test && pnpm build。至少验证 375 / 390 / 430 CSS px。不得删除测试来通过检查。所有 `sticky` / `fixed` 顶部控件及锚点跳转必须叠加 `var(--safe-area-inset-top, env(safe-area-inset-top, 0px))`，并以非零模拟安全区验证控件与目标内容均不被真机状态栏遮挡。
