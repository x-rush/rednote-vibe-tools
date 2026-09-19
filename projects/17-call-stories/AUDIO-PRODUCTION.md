# 配音制作方法与验收记录

更新：2026-09-18

## 最新交付：陪你待会儿已替换

用户下载 tts-record-1077425.mp3（48,444 字节，6.024 秒），已作为 company.mp3 新源文件。语音识别核对两句确认稿，句间静音 3.386542–3.932 秒，在 3.6 秒裁切并保留 AIGC 元数据。两段实际解码时长为 3.6 秒、2.424 秒。

已更新场景名称“陪你待会儿 · 男声”、两句台词、语气指令，第一段后等待 3 秒，第二段结束保持通话。约打球、约饭、楼下等你的“待会儿见”没有修改。

lint、21 项测试、build 通过；真实浏览器验证新版两段播放间隔 6.6 秒（首段 3.6 秒＋等待 3 秒），说完保持通话。375/390/430、安全区与宿主覆盖层、横屏回归通过。真机仍未验收。

最终 ZIP 688,151 字节，28 文件。目录与 ZIP 审计通过、零警告，根 index.html 和扩展名白名单通过，无原始 MP3。16 段配音合计 503,792 字节。


## 历史记录：陪你待会儿确认与下载过程

用户确认保留约打球、约饭、楼下等你的“待会儿见”收尾，只重做安静陪伴。

- 音色：豆包 TTS 2.0，温暖阿虎 2.0。
- 第一段：喂，也没什么事，就想给你打个电话。
- 第一段结束后等待 3 秒。
- 第二段：电话先这么放着吧，我陪你待会儿。
- 第二段结束保持通话，由用户挂断；不用麦克风识别或回应分支。
- 建议名称：陪你待会儿 · 男声。
- 语气指令：成年男性给熟悉亲近的人随手打电话，像平常聊天，轻松自然。正常音量，短语连读。也没什么事轻快带过；电话先这么放着吧是随口提议；我陪你待会儿平常地收尾。不用安抚口吻，不刻意压低声音，不深情朗诵，不逐字重读，不拖长语气词，不添加笑声。

执行状态：用户已成功生成并试听新版。豆包页面确认两句台词、温暖阿虎 2.0、约 6 秒播放器；剩余额度 19,547 字。自动点击下载后本地尚未出现新文件，已请用户手动下载。当前 content.json、音频和发布 ZIP 仍为旧版，避免台词与录音错配。文件到位后核对两句切点，替换 company-01/02，等待改为 3 秒，同步内容与制作单并重新测试打包。


## 本次交付状态：六套豆包配音已接入

- 用户完成下载，6 个源文件已经保存到 `assets/audio/doubao-source/`。依据生成记录顺序、时长及本地语音识别核对场景。
- 音色：约打球、楼下等你、安静陪伴为温暖阿虎 2.0；约饭为小何 2.0；想你了为魅力女友 2.0；公司临时有事为 Vivi 2.0。
- 新版想你了仅两句：喂，有点想你了，就给你打个电话。／也没什么事，你忙你的。电话先别挂嘛。没有使用旧版抱抱或重复陪伴台词。
- 按语音识别词时间与 ffmpeg 静音区交叉核对切点，共 16 段；裁切记录在 `qa/output/audio-cuts.json`，源文件识别结果在 `qa/output/audio-alignment.json`。识别含少量同音字误差，不代表人工听感验收。
- 不变速、不移调、不添加混响。使用原有 24 kHz、单声道、64 kbps；仅新版想你了两句之间多余的原始空白缩短，再交给程序等待 4 秒。保留来源 AIGC 元数据。
- 16 段合计 542,384 字节，单段最大 54,203 字节；加铃声共 17 个资源。发布包内为 Base64 静态 JS 数据，无 MP3、无运行时网络依赖。
- 浏览器实测全部真实字节解码及开始/停止；约打球完整 3 段及实际 5/4 秒停顿、想你了只播开场、缺失音频异常、播放失败提示通过。静音、循环、延迟及解码期间取消由已有浏览器和单元测试覆盖。
- 48 kHz 浏览器解码全部资源约 13.22 MiB；运行时按需解码，挂断、拒接或离开后清理缓存，不一次解码整套。
- lint、21 项测试、build 通过；375/390/430、24px 安全区、模拟宿主按钮、844×390 横屏检查通过。小红书真机和 Chrome 61 实机未验收。
- 按 minitool-zip-builder 1.6 审计目录和 ZIP 均通过，28 个文件，零警告，ZIP 726,377 字节；index.html 位于根目录，扩展名白名单检查通过。
- 发布包：`release/捡手机文学局.zip`。音频播放技术验证已完成，主观情绪自然度仍以用户试听为准。


## 历史记录：下载接入前的制作状态

用户决定改用豆包 TTS 2.0；ElevenLabs Generation 2 独立试听仍不满意，只保留为历史候选，不再作为定稿。

| 场景 | 豆包音色 | 网站生成 | 本地文件 |
| --- | --- | --- | --- |
| 约打球 | 温暖阿虎 2.0 | 已生成，用户认可语气 | assets/audio/doubao-source/basketball.mp3，51,708 字节，6.432 秒 |
| 楼下等你 | 温暖阿虎 2.0 | 20:12，约12秒 | 未取得 |
| 安静陪伴 | 温暖阿虎 2.0 | 20:16，约11秒 | 未取得 |
| 朋友约饭 | 小何 2.0 | 已生成，约8秒 | 未取得 |
| 只是想你了 | 魅力女友 2.0 | 新版两句12.288秒，用户同意 | 未取得 |
| 公司临时有事 | Vivi 2.0 | 已生成，约17秒 | 未取得 |

想你了旧版含抱抱、没人黏等文字全部淘汰。新版为：
1. 喂，有点想你了，就给你打个电话。
2. 也没什么事，你忙你的。电话先别挂嘛。
第一句后等待4秒，第二句后保持通话。任何台词须在用户沉默时也能接续，不依赖识别回应，不引入双人配音。

下载协议已由用户明确确认。自动点击下载及媒体下载仍未让后续文件落盘，已请求用户手动下载；取得文件之前不报告运行时接入或打包完成。豆包网站显示剩余19,580字试听额度。新版 content.json 与 AUDIO-PROMPTS.md 已同步，lint/test（19项）/build通过。

## 用户确认的目标

真实熟人通话感：松弛、自然、短句直接。朋友邀约不用关系解释与客套语；恋人场景使用成年女声，亲昵撒娇、略带小委屈。当前台词以 src/content/content.json 为准。

## 当前状态

- 原版打球 3 段 128 kbps 文件在 assets/audio/previous-script/，不进入构建。
- 网站已生成新版打球 3 段、楼下等你 3 段、陪伴 2 段、约饭 3 段的候选。用户仍认为机器人感强，全部属于未验收候选，不能当作正式完成。
- 第一轮 Voice Design 三个候选均未达标。第二轮用户选择 Voice 3（1、2 刻板、抑扬顿挫过重），已保存为「阿川｜自然来电」，voice_id：NaAjSi35NVYl7e8Yvh9H。
- 使用该声线、Eleven v3、稳定性 0.5、MP3 128 kbps，生成三句打球台词。用户确认 Generation 2 比 Generation 1 自然，采用 Generation 2；Generation 1 淘汰。下载成功，93,970 字节，保存至 assets/audio/approved-source/basketball-achuan-generation-2.mp3。此目录为定稿源素材，不直接进入构建；尚待剪辑与运行时接入。
- 本次采用台词：喂，干嘛呢？下午打球去啊。／六点老地方，我带球你带水。／那待会儿见啊。后续取得文件后按三句剪辑、同步 content.json，接话等待由程序插入。
- 全程只生成来电方单人声音，不使用双人对话，不设计回应分支。验收重点为短语连读、寒暄轻读、句尾不拖腔，不能以情绪夸张替代口语自然。
- 工作与撒娇场景尚未完成新版生成。
- 浏览器自动下载曾未落盘；用户手动下载成功。未取得实际文件不得报告已接入。

## 研究结论与实施方式

1. 先确定适合普通话日常对话的音色，再生成正式台词。声音库的文字介绍只是选型线索，不能代替试听。
2. Eleven v3 对极短提示可能不稳定；官方建议实验更长的相关文本。不要为了凑字符给正式剧情添台词。先以完整场景生成表演，再在自然停顿处剪辑为项目分段，保留呼吸和尾音，程序插入回应间隔。
3. v3 用 Natural / Creative 对比；Creative 可能更有表现力但也可能幻觉或过度表演。核实页面实际设置，不能从旧截图推断模型。
4. 采用 Voice Design 候选作对照。专业克隆音色与 v3 的适配限制以当前官方文档和实际试听为准，不能根据文件名断言根因。
5. 提示词描述关系、意图和发声方式，标签少而明确。不要堆满 laughing / excited / whispering，普通电话不需要戏剧化投射。
6. 豆包语音合成 2.0 可作为中文对照组；官方支持 context_texts 控制撒娇、暧昧等语气，但未同文试听前不能断言其一定更自然。不能把豆包聊天语音等同于可下载的配音产品。
7. 真人示范加 Voice Changer 是可选的表演控制方法，但本轮优先纯 AI，不把录音工作强加给用户。

## 验收

每个人设先一段合格小样。检查：普通话口音；自然连读；重音；句尾不播音；无标签朗读或额外台词；无强迫笑声；无过长静音；同场景音色一致。用户否定则停止批量，不把生成数量当作质量。

下载后核对文本和时长，按自然边界剪辑。统一响度、避免削波。电话音效只在干声通过后轻量处理，不能用失真掩盖机械感。交付 MP3 128 kbps，单文件小于 1 MiB，超过 100 KiB 记录体积审查。最终走既有 Base64 -> JS -> Web Audio 构建，ZIP 无原始 MP3。

## 已使用的中文男声设计描述

第二轮（Voice 3 已保存，正式台词 Generation 2 获用户选择）：

A native Mandarin Chinese man in his twenties casually calling a close friend to arrange basketball. Everyday spontaneous speech, slightly quick, connected phrases, lightly reduced greetings and particles. Narrow pitch range, easy matter-of-fact delivery, brisk natural endings. He is grabbing his keys to head out, not performing a script. No announcer diction, dramatic emphasis, exaggerated intonation, forced laughter or sound effects.

第一轮（未通过）：

A native mainland Mandarin Chinese man aged 25, chatting privately with a close friend on the phone. Standard Putonghua, effortless connected speech, a warm mid-range voice with a little natural texture. Spontaneous everyday delivery: quick light greetings, gently varied pitch, small unforced breaths, relaxed low-energy confidence, understated amusement and soft falling sentence endings. He casually makes plans, never pitches or presents. Can shift naturally from playful teasing to patient tenderness. Clear dry recording, normal speaking volume. Avoid announcer cadence, word-by-word enunciation, theatrical projection and forced laughter.

## 官方资料

- https://elevenlabs.io/docs/overview/capabilities/text-to-speech/best-practices
- https://elevenlabs.io/docs/eleven-creative/voices/voice-design
- https://elevenlabs.io/docs/eleven-creative/playground/text-to-speech
- https://elevenlabs.io/docs/eleven-creative/playground/voice-changer
- https://docs.coze.cn/developer_guides_text_to_speech
- https://www.volcengine.com/docs/6561/2298705?lang=zh

资料不能证明特定候选的真实听感。浏览器生成记录核对与听觉验收分别记录。
