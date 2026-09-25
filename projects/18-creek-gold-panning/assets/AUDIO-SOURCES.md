# 音频素材来源与处理

核验日期：2026-09-19。应用离线运行，不请求这些网站。音频原文件仅保留开发目录，交付包只含构建生成的 audio-data.js。

| 来源 | 作者与许可 | 开发原文件 | 实际用途 |
|---|---|---|---|
| https://opengameart.org/content/water-splash-and-sand-footsteps | Peludo，CC0；作者请求引用 https://rnan.itch.io/ | assets/audio-source/splash1.wav、splash2.wav、sand.mp3 | water-0/1/2 与 sand-0/1/2 |
| https://kenney.nl/assets/impact-sounds | Kenney，CC0；包内许可保存在 assets/audio-source/Kenney-LICENSE.txt | kenney-impact.zip 中 impactGlass_light_000/001/002.ogg | pick-0/1/2 |

下载地址由上述发布页直接提供。水声原始录音为桶水实验；砂声为海滩脚步/袋装材料拟音。本项目裁切用于淘洗与舀砂，不声称专为真实淘金现场录制。

处理脚本 qa/prepare-audio.py：FFmpeg 转 22050 Hz 单声道 PCM16 WAV；高通 90 Hz、适当降音量、12 ms 淡入及 60 ms 淡出。水声取 splash1 的 0.15/1.05 秒处与 splash2 的 0.2 秒处，各 0.62 秒；砂声取 0.16/4.8/1.44 秒处，各 0.42 秒；玻璃声取前 0.24 秒。原录音许可不变，剪辑不是新的独占许可素材。

九段剪辑合计 166702 字节，单段均小于 100 KiB。构建只读取这些字节并生成静态 Base64 JS，运行期 atob→Uint8Array→decodeAudioData 回调包装；不用媒体 data/blob URL、fetch 或 XHR。

归属信息同时写入 src/content/content.json 的 audio.credits，并在“手记 → 声音与动作”展示。版权与作者来源可离线阅读；应用内不添加站外跳转。
