# 小红书小工具合集 · Rednote Vibe Tools

把日常的小想法做成可以点开体验的小工具：古风探案、文物观察、生活清单、专注种植，以及轻松把玩的互动小游戏。

**GitHub：[x-rush/rednote-vibe-tools](https://github.com/x-rush/rednote-vibe-tools)**

这里收录项目源码，也保留了产品规划、内容设计、交互方案和部分验证记录。可以从感兴趣的工具开始，了解一个点子如何拆成内容、界面和交互。

## 项目导航

当前包含 **14 个独立项目目录**。完成度、发布状态和验证范围不同，请以各项目最新说明为准；下表是源码导航，不代表全部已上线。历史资料中的“八项目”指最初的一批项目。

| 项目 | 体验内容 | 源码与说明 |
|---|---|---|
| SBTI · 山海兽格测试 | 山海异兽主题的趣味测试 | [01-sbti](projects/01-sbti/) |
| 器华录：文物寻踪 | 观察文物、阅读线索、收集图鉴 | [02-wuhualu](projects/02-wuhualu/) |
| 大理寺字案录 | 调查汉字证据，完成案卷推理 | [03-dalisizian](projects/03-dalisizian/) |
| 汴京饮子铺：开店一百天 | 古风饮子铺经营体验 | [04-bianjing-drink-shop](projects/04-bianjing-drink-shop/) |
| 我希望被这样对待 · 关系说明书 | 整理相处偏好与表达方式 | [05-relationship-manual](projects/05-relationship-manual/) |
| 出门检查官 | 按出门情境整理随身物品清单 | [06-departure-checker](projects/06-departure-checker/) |
| 当时这样说就好了 | 在预设情境中练习对话表达 | [07-conversation-replay](projects/07-conversation-replay/) |
| 地球 Online：冒险者公会大厅 | 把日常行动变成冒险任务 | [08-earth-online](projects/08-earth-online/) |
| 原生：一滴水的战争 | 微观生态幻想与吞噬进化 | [09-proto-cell](projects/09-proto-cell/) |
| 鱼戏莲叶间 | 用指尖涟漪引导鱼群的互动水景 | [10-fish-among-lotus](projects/10-fish-among-lotus/) |
| 星风来信 | 风、月光与星流组成一句随机星语 | [11-starwind-letter](projects/11-starwind-letter/) |
| 番茄小院 | 用专注时间培养植物、收集小院 | [12-tomato-garden](projects/12-tomato-garden/) |
| 果冻慢慢 | 制作、装饰、把玩和收藏三维果冻 | [13-jelly-atelier](projects/13-jelly-atelier/) |
| 武林外传：同福客栈风波再起 | 四键节奏挑战与分段练习 | [14-tongfu-rhythm](projects/14-tongfu-rhythm/) |

工程与项目文档目录统一按 01–14 编号。部分旧资料使用历史名称，例如“物华录”；当前名称优先参考项目 README 和内容文件。

## 从哪里开始看

- **了解玩法**：打开上表对应目录，先读项目 README；没有 README 的项目可从设计说明和 `src/content/content.json` 开始。
- **研究实现**：阅读项目 `src/`、`package.json` 和测试文件。部分项目采用 React + TypeScript + Vite，部分采用原生 JavaScript 与自定义构建脚本。
- **了解制作过程**：查看 [产品文档索引](docs/README.md) 和各项目的设计、实现规划及验证记录。历史规划不等同于当前功能清单。

## 本地运行

准备 Node.js 和 pnpm；根 `package.json` 声明的包管理器为 `pnpm@11.19.0`。Node.js 版本需满足所选项目的构建工具要求。

首次获取并安装工作区依赖：

```bash
git clone https://github.com/x-rush/rednote-vibe-tools.git
cd rednote-vibe-tools
pnpm install
```

选择一个项目启动，例如山海兽格测试：

```bash
cd projects/01-sbti
pnpm dev
```

打开终端输出的本地地址。不同项目的端口与脚本可能不同，以项目 `package.json` 和 README 为准。

## 检查与构建

在所选项目目录依次执行：

```bash
pnpm lint
pnpm test
pnpm build
```

在根目录运行 `pnpm check` 可依次执行工作区的 lint、测试与构建，用于检查整个合集。

项目以纯前端静态构建为目标。产物通常位于项目 `dist/`，预览、部署和小工具上传包要求请看各项目说明；普通静态产物与平台专用 ZIP 可能不同。

## 目录结构

| 路径 | 用途 |
|---|---|
| `projects/` | 独立项目源码、说明与部分交付记录 |
| `projects/<project>/src/content/content.json` | 项目业务内容与文案 |
| `docs/` | 产品规划、共用规范与历史验收资料 |
| `prep/` | 机器可读准备清单 |
| `design/` | 共用设计资料 |
| `AGENTS.md` | 协作范围与开发约束 |

## 开发约定

- 运行目标为纯前端静态页面，无后端、运行时 CDN 或必需外部 API；Node.js 用于开发和构建。
- 业务内容集中在本项目 `src/content/content.json`。
- 可使用 localStorage / IndexedDB 保存结构化状态，不持久化用户图片、Base64、音视频或 Blob；具体保存范围见项目说明。
- 不依赖 Service Worker 或未经确认的设备 API。
- 界面修改需验证 375 / 390 / 430 CSS px；顶部固定、吸附控件及锚点需叠加 `var(--safe-area-inset-top, env(safe-area-inset-top, 0px))`，并用非零安全区验证。
- 开始修改前阅读根目录及项目内的 `AGENTS.md`。并行开发遵守项目目录分工，新增依赖由总控统一处理共享锁文件。

## 反馈与参与

欢迎通过 [Issues](https://github.com/x-rush/rednote-vibe-tools/issues) 提交问题或建议。报告问题时写明项目名称、设备与浏览器、复现步骤、预期和实际表现，必要时附截图。

提交改动时说明解决的问题、涉及的项目和检查结果；涉及界面时补充手机尺寸及安全区验证记录。建议一次聚焦一个项目，便于审阅。

## 许可与素材说明

当前仓库根目录尚未提供统一的 `LICENSE` 文件，本文不声明具体开源许可证或商业使用授权。第三方库、图片、音乐与角色等素材需分别查看项目内的来源和许可说明。
