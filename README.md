# 小红书小工具合集 · Rednote Vibe Tools

把日常的小想法做成可以点开体验的小工具：古风探案、文物观察、生活清单、专注种植、互动叙事与轻松把玩的小游戏。

**仓库：[x-rush/rednote-vibe-tools](https://github.com/x-rush/rednote-vibe-tools)** · 文档核对日期：2026-10-18

这里收录源码、产品设计和交付验证记录。目前有 **30 个项目目录、29 个 pnpm 工作区包**：28 个 H5 应用工程、1 个面试 Skill 包、1 个静态原型目录。目录存在、构建完成、平台上传和正式上线是不同状态；本清单不代表全部已发布。

## 项目导航

| 项目 | 类型 | 内容 | 源码 |
|---|---|---|---|
| SHBTI｜山海兽格测试 | H5 工程 | 山海异兽趣味测试 | [01-sbti](projects/01-sbti/) |
| 器华录：文物寻踪 | H5 工程 | 文物观察与图鉴收集 | [02-wuhualu](projects/02-wuhualu/) |
| 大理寺字案录 | H5 工程 | 汉字证据与案卷推理 | [03-dalisizian](projects/03-dalisizian/) |
| 汴京饮子铺：开店一百天 | H5 工程 | 古风饮子铺经营 | [04-bianjing-drink-shop](projects/04-bianjing-drink-shop/) |
| 我希望被这样对待 · 关系说明书 | H5 工程 | 相处偏好与关系表达 | [05-relationship-manual](projects/05-relationship-manual/) |
| 出门检查官 | H5 工程 | 按情境整理出门清单 | [06-departure-checker](projects/06-departure-checker/) |
| 当时这样说就好了 · 对话复盘 | H5 工程 | 预设情境中的表达练习 | [07-conversation-replay](projects/07-conversation-replay/) |
| 地球 Online：冒险者公会大厅 | H5 工程 | 把日常行动变成冒险任务 | [08-earth-online](projects/08-earth-online/) |
| 原生：一滴水的战争 | H5 工程 | 微观生态与吞噬进化 | [09-proto-cell](projects/09-proto-cell/) |
| 鱼戏莲叶间 | H5 工程 | 指尖涟漪与鱼群水景 | [10-fish-among-lotus](projects/10-fish-among-lotus/) |
| 星风来信 | H5 工程 | 粒子风景与随机星语 | [11-starwind-letter](projects/11-starwind-letter/) |
| 番茄小院 | H5 工程 | 专注计时与植物小院 | [12-tomato-garden](projects/12-tomato-garden/) |
| 果冻慢慢 | H5 工程 | 三维果冻制作、装饰与把玩 | [13-jelly-atelier](projects/13-jelly-atelier/) |
| 武林外传：同福客栈风波再起 | H5 工程 | 客栈主题节奏挑战 | [14-tongfu-rhythm](projects/14-tongfu-rhythm/) |
| 住进想象 / ROOMISH | H5 工程 | 三维房间布置与装修 | [15-home-renovation-lab](projects/15-home-renovation-lab/) |
| 花少有狼 | H5 工程 | 旅行主题单人狼人推理 | [16-flower-werewolf](projects/16-flower-werewolf/) |
| 捡手机文学局 | H5 工程 | 聊天叙事、人物资料与创作 | [17-call-stories](projects/17-call-stories/) |
| 溪边淘金 | H5 工程 | 溪流淘金与收集 | [18-creek-gold-panning](projects/18-creek-gold-panning/) |
| 雨后找菌子 | H5 工程 | 雨后探索与菌菇收集 | [19-rainy-mushroom-hunt](projects/19-rainy-mushroom-hunt/) |
| 退潮赶海 | H5 工程 | 潮间带探索与收集 | [20-tidal-beachcombing](projects/20-tidal-beachcombing/) |
| 湖边打水漂 | H5 工程 | 投掷角度与水面反馈 | [21-lakeside-stone-skipping](projects/21-lakeside-stone-skipping/) |
| 野塘钓鱼 | H5 工程 | 池塘垂钓与收集 | [22-wild-pond-fishing](projects/22-wild-pond-fishing/) |
| 一枝春信 | H5 工程 | 原创国风分支叙事 | [23-lanxiang-choices](projects/23-lanxiang-choices/) |
| 一庭春慢 | H5 工程 | 园林布置、成长与来客事件 | [24-ming-garden](projects/24-ming-garden/) |
| 月流 | H5 工程 | 本地 p5 视觉互动 | [25-moonfall](projects/25-moonfall/) |
| Agent 工程师训练营 | H5 工程 | Agent 工程学习与练习 | [26-agent-engineer-bootcamp](projects/26-agent-engineer-bootcamp/) |
| Agent 工程师面试官 | Skill | 工程能力面试 Skill | [27-agent-engineer-interviewer](projects/27-agent-engineer-interviewer/) |
| 3D 解压静态原型 | 静态原型 | index / jelly3d / peach 三个 HTML 原型 | [27-squish-jelly-demo](projects/27-squish-jelly-demo/) |
| 高性价比人生指南 | H5 工程 | 完整内容导入、筛选与分章阅读 | [28-life-guide](projects/28-life-guide/) |
| 小草，别服！ | H5 工程 | 三维节奏闪避游戏 | [29-dandelion-beat](projects/29-dandelion-beat/) |

两个目录使用 27 前缀，分别是面试 Skill 与静态原型；引用时使用完整目录名。01–14 另有集中项目设计文档，后续项目的当前说明主要保存在项目目录。旧目录名不一定等于当前产品名称。

## 从哪里开始

- [文档总索引](docs/README.md)：全部项目与设计资料入口。
- [Code Wiki](docs/Code-Wiki/README.md)：架构、工程约束、运行构建和复用地图。
- [仓库现状与文档维护记录](docs/00-总控与共用/57-仓库现状与文档维护记录.md)：当前清单口径、交付状态和历史文档边界。
- [协作规则](AGENTS.md)：main 工作方式、目录分工、安全区、宿主按钮、音频与本地存储规则。

先查看项目 README、PROJECT、DELIVERY 或 release/LATEST；没有专门说明时从项目内容文件、设计文档与 package.json 开始。部分早期 README 仍保留脚手架说明，不能据此判断当前玩法。

## 本地运行

准备满足项目工具要求的 Node.js，并使用根 package.json 声明的 pnpm@11.19.0。在完整仓库根目录安装依赖；部分自定义构建脚本依赖工作区内的构建工具，单独复制一个源码目录不保证可构建。

~~~bash
git clone https://github.com/x-rush/rednote-vibe-tools.git
cd rednote-vibe-tools
pnpm install
cd projects/01-sbti
pnpm dev
~~~

01–17 及 21 提供 dev 脚本。18–20、22–26、28、29 通常先 pnpm build，再 pnpm preview；以项目 package.json 为准。27 面试官输出 Skill ZIP，没有 H5 预览；27 静态原型没有 package.json，通过本地静态服务器查看 HTML。根目录没有 dev 脚本。完整命令表见 [运行构建与打包指南](docs/Code-Wiki/08-运行构建与打包指南.md)。

## 检查与交付

修改应用后在项目目录执行：

~~~bash
pnpm lint
pnpm test
pnpm build
~~~

根目录 pnpm check 依次递归运行各工作区已有的 lint、test、build 脚本，使用 --if-present。它覆盖工作区包，不包含无 package.json 的静态原型，也不自动执行各项目额外的 check、qa、pack 或平台专用打包步骤。

H5 项目以纯前端静态离线交付为目标，普通 dist 产物不一定等于平台上传 ZIP。最终 ZIP 应检查根 index.html、包内相对资源、白名单扩展名、体积与脚本兼容性。Skill 交付采用自身的打包与审核流程。测试记录、浏览器模拟、平台模拟器和 Android / iOS 真机验证分别记录，不能互相替代。

## 目录与开发约定

| 路径 | 用途 |
|---|---|
| projects/ | 应用工程、Skill、静态原型及各自交付说明 |
| projects/应用目录/src/content/content.json | H5 应用业务内容与文案 |
| docs/ | 当前导航、Code Wiki、产品规划与历史记录 |
| prep/、design/、work/ | 准备清单、设计素材与历史 QA；部分本地产物不纳入 Git |
| .codex/ | 小工具构建规范、参考资料与产物审计工具 |
| AGENTS.md | 仓库协作与交付规则 |

- **只保留 main；开发、提交和推送直接在 main 完成，不创建功能分支或 PR。** 遗留分支先确认提交已进入 main 再删除。
- 按授权目录修改和提交，保留其他项目未提交的工作；新增依赖由总控统一处理共享锁文件。本次仓库文档维护属于用户明确授权的仓库级范围。
- H5 运行时无后端、CDN 或必需外部 API；不依赖 Service Worker、Node API 或未经确认的设备 API。Node.js 只用于开发与构建。
- localStorage / IndexedDB 用于结构化状态。用户媒体默认不持久化；项目 17 人物头像有经确认的压缩尺寸、长度与校验例外，详见 AGENTS.md，不能推广到其他图片和媒体。
- 包内音频采用构建期静态 JS 数据与 Web Audio；原始 MP3 / M4A / WAV 不直接进入上传 ZIP。
- UI 验证覆盖 375 / 390 / 430 CSS px、非零系统安全区和左右宿主按钮覆盖层；横屏与 CSS 模拟横屏按实际功能验证。固定、吸附顶部控件和锚点叠加安全区变量；系统安全区不能代替宿主按钮避让。

## 反馈与许可

通过 [Issues](https://github.com/x-rush/rednote-vibe-tools/issues) 提交反馈时，请写明完整项目目录、版本、设备与宿主、复现步骤、预期和实际结果。提交说明应列出修改范围与实际完成的检查。

仓库根目录尚无统一 LICENSE，本文不声明统一开源许可证或商业使用授权。第三方源码、图片、音乐、角色和上游内容分别遵循各自许可与来源说明；高性价比人生指南的上游资料与归属见项目内文档。
