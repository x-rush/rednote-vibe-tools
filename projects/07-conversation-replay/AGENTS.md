# 当时这样说就好了 开发约束

本 Agent 只修改当前项目目录。根工作区、其他七个项目、../../docs、../../prep 和根锁文件均为只读。新增依赖先报告，不要自行安装造成 pnpm-lock.yaml 冲突。

唯一业务内容文件为 src/content/content.json。当前只是合法外壳；根据 PROJECT_BRIEF.md 列出的权威文档机械转写。页面只消费类型化 view model，不在 JSX 硬编码业务内容。核心算法优先纯函数；随机流程支持固定 seed。错误必须有可恢复界面。

存储只保存稳定 ID、数值、时间和有限文本；禁止用户图片、Base64、音视频和 Blob。

完成标准：pnpm lint && pnpm test && pnpm build 全通过；375/390/430 宽度通过；离线首次启动通过；内容计数、唯一 ID、引用与安全校验通过。
