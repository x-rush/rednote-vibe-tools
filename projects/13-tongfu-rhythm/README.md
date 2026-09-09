# 武林外传：同福客栈风波再起

纯前端四键音游。玩家是白展堂，对手为李大嘴、吕秀才、郭芙蓉、佟湘玉。电脑 D/F/J/K，手机双拇指；完整音频 98.104 秒。

## 当前版本：谱面 v11

本版修复人物切换造成的演奏空窗：人物计分区间连续覆盖歌曲，结算等待本段音符判定完成，约 0.24 秒的定身展示只影响人物，不阻止下一段输入。

完整游戏 256 个落点，其中 Verse 为 131 点、28 个手工定义乐句。保留上一版节奏骨架，补入 11 个连接短点；来吧、说吧各增加 0.32 秒持续段，保持起点不变；64.7877 秒和 68.7787 秒各增加一侧短点，形成两组双指齐击。合计 15 个长按头，其中包含原有的 4 组双指持续；另有 2 组双指短击。双指短击各自计分，两边命中后显示合击反馈。

短点承担 Verse 的推进与快读，长按只用于局部延续，双指用于段落强调；不把普通歌词任意拉成长按。两个新增持续段根据现有字音区间与人声活动选定，尚未完成人耳复核，不能将其视作尾音时长已确认。

本版代码和自动验收已完成，**音乐听感未完成验收**。120 BPM 是时间参照；资料中的制谱原则不能证明每个新落点都贴合这首歌。相比 v10，补点、两处长按时长、两组齐击以及人物切换逻辑已改变。

首页增加 Verse 逐句练习，含 8 段；练习结束后可重练当前段，不进入完整挑战，不保存正式纪录。成绩按谱面版本隔离。保留完整挑战、20 秒基础练习和 32 秒 Rap 练习。

## 点穴动作更新

命中使用 Canvas 双指手势，肩腰标记跟随人物矩形定位；点击当帧接触后收手，长按保持接触并显示进度。每轨仅显示最新动作，去除舞台扩散光圈和跨肩发光连线。支持减少动态效果偏好。谱面与计分规则未改变。

## 开发与构建

所有业务内容位于 src/content/content.json，无新增依赖，不修改共享工作区锁文件。

- `pnpm dev`：本地开发，http://127.0.0.1:4313
- `node scripts/build-verse-chart.mjs`：修改 verseFlow 后编译正式谱与短段对照谱。
- `pnpm lint`、`pnpm test`、`pnpm build`：语法、测试与普通静态构建。
- `node scripts/build-minitool.mjs`：生成 release/package；使用当前工作站已有的 TypeScript、sharp、ffmpeg。
- `python scripts/pack-full-web-audio.py`：打包 release/tongfu-fengbo-v11-pointing.zip。

Windows 需使用支持 node --test 的 Node；当前桌面自带运行时可用。共享工作区执行 pnpm 时设置 pnpm_config_verify_deps_before_run=false，避免自动安装或改动根锁文件。

## 交付

release/tongfu-fengbo-v11-pointing.zip 是小红书上传包；dist 是普通浏览器静态产物，不能直接当上传包。音频在构建时转为 80kbps MP3，Base64 放在 JS 内，运行时以字节数组交给 decodeAudioData；ZIP 不含音频扩展名，不依赖 fetch、运行时 CDN 或外部 API。

音频仅在内存解码，不保存音频、Base64、图片或 Blob。localStorage 仅保存设置、结构化谱面草稿和分版本成绩。

## 验证与依据

- tests/continuous-play.test.mjs：跨人物长按、连续计分区间、晚判定和双指短击计分。
- src/gesture-audit.mjs、tests/gesture-audit.test.mjs：跨乐句快同手、长交替、同键连打与恢复间隔检查。
- tests/verse-flow.test.mjs：新旧谱保护、乐句编译、重复节奏、快读手势、正负 60ms 输入测试。
- scripts/qa-full-web-audio.mjs：模拟 120ms 输出队列，完整歌曲验证。
- scripts/qa-verse-flow.mjs：八段练习、重练、375/390/430 宽度、非零安全区、禁网络。
- scripts/qa-container-scroll.mjs：容器锁住根滚动后的真实触摸滑动。
- design/verse-flow-report.json：谱面结构摘要。
- design/verse-word-support.json：字音邻域检查，不能作为听音合格证明。
- release/v11-连续演奏与音符设计说明.md：本版结果和未验证项。

音乐研究与制谱参考见 verseFlow.sources。它们指导工作方法，不代表本游戏通过社区排名审核。历史 README 保存在 design/README-before-v8.md，其旧版本计数和发布状态不再代表当前产物。
