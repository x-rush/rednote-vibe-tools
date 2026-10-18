# 高性价比人生指南1.3.5 · 验证与交付记录

文档复核：2026-10-18（北京时间）。本次只整理文档，没有改变代码、业务内容或图片，版本仍为1.3.5。

## 当前产物

| 项目 | 实际值 |
| --- | --- |
| ZIP | [高性价比人生指南-1.3.5-小红书小工具.zip](高性价比人生指南-1.3.5-小红书小工具.zip) |
| 文件大小 | 1,225,504 bytes，约1.17MiB |
| 文件数量 | 10个白名单文件，index.html在根目录 |
| 内容来源 | 上游提交5f210ca953b7b538c042ad8515d5c355b766a194 |
| 品牌 | 高性价比人生指南；简介“陪你把日子过得更好”（9字） |
| 图片 | 480×322 WebP插画、512×512 PNG图标 |
| Git | 已进入main，原PR #1已合并；只在main继续开发 |

ZIP SHA256：

`8f92f5578c5c7cf55abb549a1f9bf02528594db7aafae2ac3415e25395a143e2`

逐文件清单及哈希见 [package-manifest.json](package-manifest.json)，源内容见 [import-report.json](import-report.json)。

## 本次实际复核

2026-10-18在项目目录重新执行，全部通过：

```powershell
pnpm --ignore-workspace lint
pnpm --ignore-workspace test
pnpm --ignore-workspace build
```

22项测试通过、0失败、0跳过。本机存在固定版本.upstream检出，原始Markdown对照实际执行。重建后ZIP大小和SHA256保持不变。

本次对照代码、内容计数、清单、图片及已有报告更新文档；没有重新执行全部浏览器或真机测试。

## 已保存的1.3.5开发证据

| 检查 | 保存结果 | 证据 |
| --- | --- | --- |
| 单测 | 22项，含逐字段解析器对照、180组筛选组合、首开和存储 | tests/，本次终端结果 |
| 浏览器回归 | 83状态，0控制台错误、0外部请求 | [browser-report.json](../qa/output/browser-report.json) |
| 旧布局迁移 | 6场景，三种宽度的章首/章内位置及关页重入 | [cover-migration-report.json](../qa/output/cover-migration-report.json) |
| file协议 | 9篇附文、许可、筛选、章切换、字号、进度；0外部请求、0控制台错误 | [offline-report.json](../qa/output/offline-report.json) |
| 目录审计 | 10文件、0错误、1条content.js体积警告 | [audit-directory-1.3.5.txt](audit-directory-1.3.5.txt) |
| ZIP大小审计 | 通过；该脚本只检查压缩包大小 | [audit-zip-1.3.5.txt](audit-zip-1.3.5.txt) |
| 最终ZIP内容 | 构建逐文件检查路径、扩展名、解压、长度与CRC | tools.mjs和package-manifest.json |

JSON浏览器报告没有独立的运行时间字段；按报告版本及结果引用，不将本次文档复核日期当作全部场景执行日期。旧文档77/83并存的问题，已统一为当前报告的83状态。

### 阅读器覆盖

- 首开、仅偏好、旧第一条零偏移占位均从banner开始；刷新、宿主高度变化仍为scrollY=0。
- 有真实进度或明确进入章首阅读时恢复原位置；旧紧凑布局按文字锚点迁移。
- 原生上下滚动，最多一章DOM，滚到底不追加，切章移除旧章；遍历34章核对765个ID。
- 每章banner始终存在，切章标题位于工具栏下方约12px；上滑或首页可看完整封面。
- 来源搜索、关键词、原筛选、空结果、引用跳转/返回、附文及术语面板有覆盖。
- 字号/横屏变化保留锚点；长标题省略、筛选单行；SVG箭头间距6px、中心误差≤1px。
- 宿主Storage模拟、本机镜像、较新检查点选择、存储失败提示有覆盖；模拟不等于真实宿主接口验收。

### 布局与安全区

覆盖375/390/430竖屏，844×390及932×430横屏，以及首页宿主高度变化。注入24px顶部、20px底部系统安全区和左右82×42宿主按钮覆盖层。首页、正文、章末、目录、筛选、导读、来源、附文、术语及空结果已有开发检查。

安全区与宿主占位独立，默认host-clearance=56px、host-side-clearance=94px。没有CSS模拟旋转功能，也未引入未经确认的设备API；宿主实际参数仍待校准。

## 复现检查

先构建并启动预览：

```powershell
pnpm --ignore-workspace build
node tools.mjs preview
```

保持服务在4328端口运行，在另一终端执行：

```powershell
pnpm --ignore-workspace qa
node qa/offline-check.mjs
node qa/cover-migration-check.mjs
```

Playwright及Chrome路径在这三个QA实现文件中，换机需先调整开发路径。qa/browser-check.mjs仅导入chapter-reader-check.mjs；历史1.1.0/1.2.0检查不作为当前入口。

## 证据与清理

目前qa/output保留12文件：3份JSON报告和9张PNG。示例：[首页](../qa/output/preview-home.png)、[切章正文](../qa/output/preview-chapter-next.png)、[第二章顶部banner](../qa/output/chapter-reading-scroll-up-cover-390.png)、[旧占位首次首页](../qa/output/chapter-first-open-home-placeholder-390.png)。

[cleanup-report.json](cleanup-report.json)记录较早一次清理：17个旧交付文件、201个旧/重复截图及当时保留10个证据文件；后续补充2张，不是当前总数。当前只有1个ZIP，历史QA脚本与测试保留。

审计TXT、JSON报告及上游许可证是原始/生成证据，不为更新说明而改写结果。图片和许可见 [ASSET-SOURCES.md](../ASSET-SOURCES.md)。

## 待验收与限制

- 创服平台模拟器上传运行，以及Android/iOS真机扫码加载同一个ZIP。
- 真实宿主按钮、系统安全区、软键盘、横屏和存储接口校准。
- Chrome61/Android8.1实际兼容性，以及低端机解析、内存和滚动性能。
- 全量content.js为2,590,600 bytes，约2.47MiB，单文件体积警告保留。ZIP约1.17MiB未超10MiB门禁，压缩体积不能替代解压后的性能实测。

本地浏览器/file验证不代表小红书宿主验收通过。代码和ZIP已进入GitHub main，不据此声称已上传、发布小红书或通过真机验收。
