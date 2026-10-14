# Agent 工程师训练营

纯前端移动学习工具，内容版本 2.1.0。围绕初级 Agent 应用开发的八项工程能力组织课程、训练和学习档案。

- 知识图谱：8 个能力组、48 个独立知识点（32 必修、16 选修），具体前置关系、独立讲解、验收任务及已读记录；知识库含 132 条索引。
- 训练：8 组理解题与分步实验、10 个故障诊断案例、3 个工作流拼装任务、3 个逐步执行场景、检索和评测两个配置实验。
- 实践指引：3 个项目、8 条框架路线、经典模式与基础补齐资料；代码及实验为教学示意，不执行真实模型或 SDK。
- 我的：区分阅读、理解题、独立或提示后模拟及项目自述；生成可复制的面试学习摘要和结构化备份。
- UI：原创机器人插画、四个主页面、移动布局与操作反馈；安全区和宿主按钮分别避让。

业务资料唯一来源为 `src/content/content.json`。无后端、运行时 CDN、必需外部 API 或 Service Worker。客户端 9.46.0 及以上按能力检测使用小红书 Storage API；不满足条件时采用本地存储并处理失败，不保证永久保存。旧开发版学习数据不迁移。

## 开发与打包

需要 Node.js、pnpm，以及 Python 3 和 Pillow。Pillow 仅用于构建期将包内插画编码为 WebP；运行期无此依赖。

```sh
pnpm --config.verify-deps-before-run=false run lint
pnpm --config.verify-deps-before-run=false run test
pnpm --config.verify-deps-before-run=false run build
node tools.mjs serve
python package-preview.py
```

预览服务器默认端口 4260；通过 PORT 环境变量可改为 4261。构建产物位于 `preview/`，ZIP 位于 `dist/agent-engineer-bootcamp-2.1.0.zip`。原始插画位于 `src/assets/`，上传图标位于 `branding/`，来源说明见 ILLUSTRATIONS.md。

## 验证与交付状态

32 项单元测试通过；lint/build、独立 Storage 适配检查、入口检查、知识点学习检查及三页布局检查通过。布局检查覆盖 375 / 390 / 430 CSS px、横屏、非零系统安全区及宿主按钮覆盖模拟。平台打包静态审计通过，10 个文件，ZIP 约 573 KiB。

小红书创服模拟器、Android/iOS 真机扫码、Chrome 61 实际内核兼容性及设备性能尚未实测；普通浏览器结果不代表平台验收。详细记录见 VERIFICATION.md。
