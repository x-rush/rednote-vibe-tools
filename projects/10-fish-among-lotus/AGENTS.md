# 鱼戏莲叶间 开发约束

本 Agent 只修改当前项目目录。根工作区、其他项目、../../docs、../../prep 和根锁文件均为只读。不得新增依赖。

纯前端静态构建；交互场景使用原生 Canvas；唯一业务内容文件为 `src/content/content.json`。只保存数值类偏好，不保存用户图片、Base64、音视频或 Blob。

完成标准：`pnpm lint && pnpm test && pnpm build` 全通过；验证 375/390/430 CSS px；非零安全区下顶部控件不被遮挡。
