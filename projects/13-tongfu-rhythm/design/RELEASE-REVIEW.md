# 发布前审查 · 2026-09-09

结论：浏览器游戏核心回归通过；小红书小工具上架包未通过。未发布、未交付冒充合规的 ZIP。

## 已修复

1. 草稿练习残留旧版 0–19.7 秒筛选：改为与正式练习一致的 16–36 秒范围，避免开场立即漏判。
2. 异常 localStorage 音量字符串导致 NaN 写入 AudioParam：恢复默认音量。
3. 暂停长按时丢失最后一帧持续分：引擎按暂停时刻结算，且不在音符头之前计分。
4. 导入三/四指同起点长按时，理论满分重复计入组合奖励：与实际单次奖励保持一致。
5. 调校台损坏的 timingPoints/review 草稿：校验后恢复默认值，避免错误数据破坏绘制和标记。
6. 重复构建遗留旧文件：构建前只清理本项目经路径检查的 dist，拒绝符号链接目标。
7. 底部安全区补全容器自定义变量回退，兼容模拟器注入。

## 验证

- pnpm lint、pnpm test、pnpm build 全部通过；22 项单元测试。
- 对 dist 启动 4314 端口独立预览，测试实际构建内容。
- 完整 98.104 秒自动演奏：模拟 120ms 输出队列，206 绝妙、0 落空、100.0%、12 次人物定身。不是人工听感终审或物理扬声器回录。
- 首页四人物 luminance 抠图、1:2 比例、375/390/430 CSS px 均通过；已查看截图。
- 375/390/430 游戏布局，上安全区 32px；另测下安全区 20px；375×667 短屏按键可见。
- 暂停/返回、音频加载失败重试、禁用存储仍可使用、调校慢放、草稿导入导出与设置持久化通过。
- 新增 qa-release-regressions.mjs 覆盖错误音量、草稿练习、损坏调校草稿与上下安全区。
- qa-final.mjs 将旧版写死的人物结算数量改为由现有乐句推导。
- 未新增依赖，未修改其他项目或根锁文件。

证据：test-results/rhythm-sync-report.json、final-report.json、release-regressions.json、optimization-ui-report.json、cutout-report.json、package-audit.json。

## 小红书小工具阻塞

按根目录 .codex/SKILL.md 及 references 审查：

- 当前 index.html 是模块入口，脚本是 .mjs；项目 skill 要求经典 .js 脚本，无 import/export。
- app.mjs/studio.mjs 通过 fetch 加载 JSON/音频；能力清单禁止 fetch，需要独立容器适配。
- 当前 dist ZIP 试压约 15.46 MB，超过项目 skill 10 MB 上限。测量使用内存 ZIP，未输出可误上传的包。图片资源和开发用分轨是主要体积来源。
- 调校台 JSON/.osu 文件选择及下载不能直接放入容器：文件选择仅图片/视频，a[download]/Blob 下载禁止。发布版本应与制谱工作台分别构建，保留工作台在开发网页。
- 音频文件类型与 Web Audio 能力待平台确认：不能用改扩展名、在线音源或 data/blob 媒体绕过限制。

## 公开资料核查

1. 小红书 CDN 上《小工具容器能力清单》，页面标注更新 2026-07-02：支持 audio/video 内联与包内媒体，禁止联网、外部/data/blob 媒体；未明确列出 AudioContext、decodeAudioData、getOutputTimestamp 的支持契约。
   https://fe-video-qc.xhscdn.com/fe-platform-file/104101b8322broatpnk06f48k3g274000000001489hs7u
2. 公开官方 Skill 下载包 1.2.0 已下载并阅读两个 reference。文件白名单未列 mp3/m4a，媒体章节又允许包内媒体。它是公开链接版本，不宣称是最新；本项目 Skill 标注 1.4.0，保留本项目规则，未覆盖根文件。
   https://fe-static.xhscdn.com/mini-tool/1.2.0/minitool-zip-builder.zip
3. 开源作者自述：gulab-calculator-xhs 因平台白名单没有 MP3 移除角色语音。这是该项目开发者的记录，不是平台正式声明，也不是本项目实机测试。
   https://github.com/piovium/gulab-calculator-xhs/blob/master/README.md
4. 另一个作者项目 theTenScenesOfWestLake 使用 Web Audio 程序合成音效并提供小工具打包流程。其代码存在不等于本地歌曲文件获准上传，亦不证明本项目在 iOS/Android 上可精确同步。
   https://github.com/sanqiushili/theTenScenesOfWestLake

未找到公开的官方 MP3/M4A 文件白名单放行说明或完整音游同步保证。文档的能力声明与上传格式限制是两个不同检查点，当前不能认定已解决。

建议下一步先在小红书测试容器核实音频文件是否接受、AudioContext 与输出时钟是否可用；如媒体标签可用，则原型验证 media.currentTime 在暂停/恢复/跳转及整曲中的精度，再决定是否更换播放链路。不要直接改掉已校准的播放链路并宣称体验等效。

## 发布材料

仓库只有音乐来源与哈希，未见音频和角色公开使用授权证明；发布前需由项目方确认。此次审查不是平台审核通过或授权确认。
