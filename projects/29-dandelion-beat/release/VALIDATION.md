# 小草，别服！ v13 离线包校验

日期：2026-10-18。状态：已生成离线 ZIP；未上传、未发布。

- 名称：小草，别服！
- 介绍：踩准节拍，躲过社畜醉拳（含标点11字符，少于14字）
- ZIP：dandelion-beat-v13-local-preview.zip
- ZIP 大小：445057 字节 / 434.63 KiB，低于建议2MiB与上限10MiB。
- SHA-256：005732F3C7581463C6B22249C9EF5CB423508BC5C66F124BDDDD9D273E706E26
- 根目录文件数：12。index.html为唯一HTML，直接位于ZIP根目录。

## 规范来源

已按用户链接下载并解压 .codex/minitool-zip-builder-1.8.0/minitool-zip-builder/SKILL.md，读取全部7份references。
在线能力清单：https://miniapp-sandbox.xiaohongshu.com/minitool/doc ，2026-10-18获取，页面标注更新2026-10-13。原文副本位于 .codex/minitool-doc-2026-10-18.html。
相对本地2026-09-23 API基线，在线新增公开的AI文本生成（内测加白）；本游戏无AI需求，未接入。设置保存按客户端版本优先使用原生Storage API，旧客户端/普通浏览器才使用带异常处理的localStorage。未使用其他平台API。

## 校验结果

| 项目 | 结果 |
| --- | --- |
| pnpm lint / pnpm test / pnpm build | 通过；51项逻辑、骨架、曲面与节奏检查全部通过 |
| ES2017语法 | 最终全部JS通过Acorn ecmaVersion:2017解析；移除对象展开、空值合并、可选catch绑定、Array.at、globalThis依赖 |
| 离线与CSP | 外置经典脚本、相对资源全部存在；无module、内联脚本、行内事件属性、eval、WASM、Worker或网络请求；受限CSP浏览器流程通过。content.js的音乐来源URL仅为来源元数据，无请求/外链行为 |
| CSS基线 | 使用vh/JS视口变量、物理边距与margin间隔，替换min/max/inset/dvh/Flex gap唯一依赖；env安全区仅作检测增强，默认值与容器变量有回退 |
| ZIP结构/白名单 | 逐项扩展名检查通过；12个文件，未打入MP3/WebM、源码、截图、skill、node_modules或source map |
| ZIP内容一致性 | 每个ZIP条目的字节SHA-256与dist对应文件一致 |
| 随包自动审计 | Node对dist和ZIP审计通过，0 error / 0 warning；Python再次读取最终ZIP内部文件审计通过，0 error / 0 warning |
| 核心音乐流程 | 真实AudioContext时钟自动输入：50秒原曲、22/22回避、22完美、最高连击22、空点0；暂停稳定，结束上下文suspended |
| 输入与反馈 | 实际鼠标两处点击有效，控件隔离；成功不受伤、漏点受伤；脚本/WebGL错误0 |
| 音频链路 | 实际50秒/单声道/48kHz非静音字节解码；开始、静音、暂停恢复、停止、解码失败提示、无声试玩、解码期间取消、切后台与离开页面均通过；本曲不循环，无延迟剧情定时器 |
| WebGL预算 | 合并为每帧1次draw call；13个重点姿态默认档最多84162三角形，低档最多34022；默认DPR<=1.5/约200万像素，低档DPR<=1/约100万像素，无纹理资源 |
| WebGL降级 | 持续慢帧先降低曲面/装饰/DPR，再进入DOM轻量模式；无WebGL、真实context loss、context恢复提示、页面隐藏停止RAF/声音均已检查 |
| 375/390/430与横屏 | 375×844、390×844、430×844、844×390：30px系统安全区与左右64×42模拟宿主覆盖；首页、出场、攻击/成功/受击/倒地、结算、音频失败与图形兜底检查通过 |

无CSS旋转的模拟横屏模式；尺寸横屏只完成浏览器模拟，未宣称真机横屏已验证。浏览器检查是工程预检，不能作为容器验收结果。

## 资源和使用范围

图标通过内置image_gen生成，512×512 PNG位于assets/branding/logo.png（115892字节），包内使用256×256 WebP（10986字节）。原图和完整生成提示词保留在assets/branding，未全部放入ZIP。

音频是既有《West Ride》50秒本地试玩片段，400652字节，构建为audio-data.js后通过atob→Uint8Array→decodeAudioData→BufferSource/Gain播放。没有把MP3改后缀或作为data/blob媒体标签音源。单段解码字节小于1MiB，但超过100KiB，作为明确风险记录：Base64有约1/3额外字符串体积；解码后PCM约9600000字节（9.16MiB），只缓存当前曲目。保留50秒是为了匹配当前完整出场/舞段谱面，不通过拆串绕过门禁。

现有授权范围是本地试玩；没有取得音乐在独立游戏中的对外分发许可。此包标记local-preview-only。公开发布前应补音乐授权或换为有明确使用权的配乐；本次未登录、上传或发布。

## 待验证

1. 使用同一ZIP在创服平台模拟器完成全流程验证。
2. Android真机扫码：声音解锁、节拍输入延迟、帧率/发热、宿主按钮和真实横屏。
3. iOS真机扫码：相同功能、音频暂停恢复与安全区。
4. Chrome61/Android8.1实际JS与CSS兼容性未实测；手机性能、内存和实际耳机/外放听感未实测。

## 复现

项目目录运行 pnpm lint、pnpm test、pnpm build、pnpm run pack。注意使用pnpm run pack，避免执行包管理器内置的npm源码打包命令。
额外检查：node package-check.cjs；node --expose-internals verify-artifact.cjs dist；node safe-check.cjs；node full-check.cjs。
