# 高性价比人生指南 · 小红书小工具

文档复核：2026-10-18（北京时间）。当前版本 **1.3.5**，本次仅更新文档，应用和交付包不变。

应用名：**高性价比人生指南**。简介：**陪你把日子过得更好**（9字）。采用蓝白界面和读书小猫插画，完整导入 eternity4719 / HowToLiveBetter 的 **34章、765条、9篇附文、43个术语及385条更新记录**。

## 文档与交付入口

| 入口 | 用途 |
| --- | --- |
| [PLAN.md](PLAN.md) | 当前验收约定、维护流程、已被替代的历史方案 |
| [ASSET-SOURCES.md](ASSET-SOURCES.md) | 正文归属、素材、生成提示词与许可 |
| [release/LATEST.md](release/LATEST.md) | 当前ZIP、图标、简介、大小和SHA256 |
| [release/VERIFY.md](release/VERIFY.md) | 验证证据、复现命令与真机待验收项 |
| [当前ZIP](release/高性价比人生指南-1.3.5-小红书小工具.zip) | 1,225,504 bytes，约1.17MiB，入口index.html在ZIP根 |
| [平台图标](assets/app-icon.png) | 512×512 PNG，已作为包内favicon |

只保留当前ZIP。完整清单和文件哈希见 [package-manifest.json](release/package-manifest.json)。运行时是纯前端静态页面，无后端、CDN、必需外部API、module、Worker或Service Worker；Node.js仅用于开发和构建。

## 当前阅读方式

| 操作或状态 | 页面表现 |
| --- | --- |
| 首次进入、仅有偏好设置、旧版第一条零偏移占位 | 从页面顶部完整banner开始，不自动跳到正文 |
| 有实际阅读记录后重新进入 | 恢复原章节和章内位置 |
| 上一章、下一章、目录选章 | 替换当前章并定位到章标题，不追加其他章节 |
| 章内上下滑动 | 原生纵向滚动，滚到底停在章末，不无限加载 |
| 上滑到页面顶部 | 每一章都能看到完整banner、小猫和搜索框 |
| 回到章首 | 只定位当前章标题 |
| 首页 | 回到当前页面顶部，不清空筛选，也不强制切到第一章 |

页面最多挂载一个完整章节。章节/筛选工具栏吸顶；底部提供本章百分比、上一章、目录、设置、说明和下一章，首末章对应方向禁用。长标题省略显示，SVG箭头距标题6px并居中，筛选保持单行。触摸/鼠标点击无焦点描边，键盘Tab保留焦点提示。

导读、来源、附文和术语在独立面板内阅读。交叉引用支持预览、跳转和回原位。支持16/18/20字号，以及浅色、深色、跟随系统主题。

## 搜索与筛选

全文搜索包含来源文本，多关键词全部匹配。默认检索全书，结果按章阅读，翻章跳过空结果章。保留人群组合与年龄继承、作者性价比计算、收益口径、证据等级、花钱、耗时、毅力、更新类型、时间范围、争议及待核实等条件；不同收益口径不互相换算。

目录选章与筛选中的“查找范围”独立。目录目标没有匹配项时，会提示并清空条件后打开完整章；限制检索章节需显式选择筛选范围。

筛选草稿按“查看结果”才应用，关闭取消草稿修改。“重置”清空草稿筛选并保留已应用搜索词；正文“清空筛选”同时清空搜索词。来源外链显示可选地址，不在容器中打开外部网页。9篇附文、原README、术语与许可均可离线阅读。

## 数据与进度

业务内容唯一源为 `src/content/content.json`，应用名、简介和图标路径位于其meta字段。固定上游为 [5f210ca953b7b538c042ad8515d5c355b766a194](https://github.com/eternity4719/HowToLiveBetter/tree/5f210ca953b7b538c042ad8515d5c355b766a194)，源提交日期2026-10-15。构建转为经典脚本content.js，不在运行时请求JSON或自动更新上游。

全文不写入本地草稿。仅保存筛选、章节、首页/阅读状态、滚动位置、布局签名、文字锚点、时间戳和显示偏好，键为 `life-guide:v1`。可用时使用xhs.miniTool Storage，同时即时写入localStorage镜像；读取较新的检查点，全部写入失败会提示。

滚动停止约150ms后保存，页面隐藏/退出时补存。同布局恢复精确位置；字号、横竖屏或旧banner高度变化时按文字锚点迁移。内容版本改变会丢弃旧位置，保留合法偏好与筛选。进度仅保存在本机，可能受宿主存储清理影响，无跨设备同步。

## 开发、验证和内容更新

在本项目目录执行，避免pnpm改写根锁文件：

```powershell
pnpm --ignore-workspace lint
pnpm --ignore-workspace test
pnpm --ignore-workspace build
node tools.mjs preview
```

构建后可直接打开dist/index.html；预览服务默认 [127.0.0.1:4328](http://127.0.0.1:4328/)，可用PORT环境变量修改。保持服务运行，在另一终端执行：

```powershell
pnpm --ignore-workspace qa
node qa/offline-check.mjs
node qa/cover-migration-check.mjs
```

QA使用本机已有Playwright和Chrome。绝对路径在qa/chapter-reader-check.mjs、qa/offline-check.mjs、qa/cover-migration-check.mjs中，换机需调整开发脚本路径，不为应用新增依赖。qa/browser-check.mjs仅导入当前检查入口；历史1.1.0/1.2.0脚本不代表当前交互要求。

现有1.3.5证据为22项测试、83个浏览器状态、6个旧布局迁移/重入场景和file协议9篇附文检查。2026-10-18文档复核重新运行lint/test/build；本次没有重跑全部浏览器和真机场景。详见 [VERIFY.md](release/VERIFY.md)。

更新源内容时，在项目内被忽略的.upstream目录准备仓库并checkout固定提交，再运行 `node scripts/import-upstream.mjs`。脚本检查提交锁、拒绝未解析内容，更新 [导入报告](release/import-report.json)。升级提交先审阅差异、修改脚本中的固定提交，再重新导入和全套验证。不要手改dist/content.js。

reference/upstream-parser.js只用于测试。没有.upstream检出时，原始Markdown对照测试会明确跳过，标准化数据重建的解析器对照仍运行。本次复核有固定检出，22项测试全部实际执行、无跳过。

## 构建、安全区与限制

构建递归检查扩展名，并重新读取最终ZIP、解压所有文件、验证长度及CRC。当前包10文件，上限10MiB、建议不超过2MiB。全量content.js为2,590,600 bytes，约2.47MiB；单文件解析/内存警告保留，只渲染当前章，低端机性能待实测。

系统安全区与宿主按钮占位独立。CSS默认host-clearance=56px、host-side-clearance=94px，可配置；顶部控件和锚点叠加safe-area-inset-top，底部叠加对应安全区。顶部遮挡带避免正文热点进入宿主按钮区域。

开发检查覆盖375/390/430竖屏、844×390及932×430横屏，24px顶部/20px底部安全区和左右宿主按钮覆盖模拟。项目没有CSS模拟旋转功能，没有引入未经确认的设备API。模拟参数不代表所有宿主真机，需实际校准。

创服平台模拟器、Android/iOS真机扫码、Chrome61/Android8.1实际兼容性及低端机性能仍待验收。浏览器和file检查不代表小红书宿主验收通过。

## Git与维护约定

[GitHub main](https://github.com/x-rush/rednote-vibe-tools/tree/main/projects/28-life-guide)是唯一开发和提交入口。不创建开发分支或以分支隔离为由创建PR；原 [PR #1](https://github.com/x-rush/rednote-vibe-tools/pull/1)已合并，仅作为历史记录。

遵循根AGENTS.md：只修改本项目；不改其他项目、根依赖或锁文件；提交前运行lint/test/build，只暂存本次授权文件，保留其他工作区修改。交付同步更新README、PLAN、素材说明、LATEST与VERIFY；仅保留当前ZIP和代表性证据。审计TXT/JSON报告由相应脚本生成，不手工改写为“通过”；上游许可证不改写。
