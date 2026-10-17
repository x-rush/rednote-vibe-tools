# 1.3.3 保留 banner、按正文锚点阅读

日期：2026-10-17。用户说明每章顶部都应存在完整 banner，仅自动将滚动位置定位在正文。

## 产物

小猫的生活指南-1.3.3-小红书小工具.zip
1225347 bytes（1.17 MiB）
SHA256：a07379a9db8082af870f6840131d0d08b491259b99be8828b83e8201d3a800a1
10 个白名单文件，index.html 位于 ZIP 根。构建对最终 ZIP 逐文件检查路径、扩展名、长度、解压及 CRC。

## 修复

删除 reading-view 对 hero/search-wrap 的 display:none 规则；每章保留完整 banner 和小猫，翻章/目录/回到章首只按安全区及吸顶工具栏高度计算正文锚点。向上滑可自然回到 banner，首页入口只改变滚动位置。SVG 箭头、筛选和单章替换继续保留。

布局签名新增 cover 标识。旧版曾隐藏 banner 时保存的 scrollY 不直接用于新布局，改用文字锚点迁移；旧章首记录定位章标题。新记录继续精确保存滚动位置，避免 banner 高度改变导致旧进度偏移。

## 实际验证

- pnpm --ignore-workspace lint / test / build：通过，21 项测试，无新增依赖。
- pnpm --ignore-workspace qa：77 个状态通过，控制台错误 0，外部请求 0。375/390/430 CSS px、844×390 与 932×430 横屏；顶部24px/底部20px安全区，左右宿主按钮覆盖模拟。
- 新增：切到第二章后正文标题在吸顶工具栏下方12px，banner 仍有实际尺寸且位于视口上方；刷新保持正文位置；滚动到页面顶部看到完整大 banner。三种竖屏宽度均验证。
- node qa/cover-migration-check.mjs：6 个场景通过。覆盖三种手机宽度的旧紧凑布局章首与正文中间记录迁移、关闭页面后重入恢复、上滑完整 banner。
- 顺序遍历34章765条，始终仅一章正文 DOM，滚到底不追加其他章节。SVG 箭头与标题间距6px、垂直居中、长标题与筛选单行检查继续通过。
- node qa/offline-check.mjs：file 协议检查通过，9篇附文、许可、筛选、章切换与章内位置恢复；0外部请求、0控制台错误。
- 官方本地目录审计：10文件、0错误，content.js 2.47 MiB 警告保留；正文按用户全量要求保留，内容元数据仅新增名称、简介和图标路径，765条正文的上游逐字段对照继续通过，只渲染当前章。真实低端机解析和内存待实测。
- 官方本地 ZIP 大小审计通过；ZIP 内容另由本项目构建脚本解压及 CRC 校验。

## 证据与待验范围

qa/output/browser-report.json、qa/output/cover-migration-report.json、qa/output/offline-report.json；chapter-reading-scroll-up-cover-*.png 展示第二章顶部完整 banner，preview-chapter-next.png 展示切章后直接定位正文。

当前预览已刷新。开发浏览器检查不等于宿主验收；创服平台模拟器、Android真机扫码、iOS真机扫码待使用同一ZIP完成。Chrome61/Android8.1实际兼容性及低端机性能未实测。无CSS模拟旋转功能。没有登录平台、上传或发布。


## 命名、图标与清理

本次应用名“小猫的生活指南”，简介“陪你把日子过得更好”（9字）。图标由内置imagegen依据现有原创小猫生成，经缩放压缩为512×512 PNG，160890 bytes，随包交付并作为favicon。品牌字段统一记录在src/content/content.json的meta中，导入脚本同步保留；原作者与内容许可不变。

本地旧版ZIP/审计/归档验证文件17个和多余QA截图已删除，具体计数见cleanup-report.json。当前保留10个代表性截图/报告文件；历史QA脚本与测试保留，未删除测试。
