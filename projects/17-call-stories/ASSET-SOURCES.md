# 内置头像素材来源

24 张头像统一使用 DiceBear 的 **Notionists** 系列，原作者 **Zoish**。官方标注为 **CC0 1.0**。于 2026-09-18 从官方生成接口获取 SVG，替换此前混用的两套头像；保留头像 ID，以保持已存草稿的人物引用。

- 系列与许可：https://www.dicebear.com/styles/notionists/
- 许可说明：https://www.dicebear.com/licenses/
- CC0：https://creativecommons.org/publicdomain/zero/1.0/

所有文件本地打包；运行时无需联网，不请求头像 API。原作者和许可元数据保留在 SVG 中。

| 本地文件 | Seed | 背景色 |
|---|---|---|
| sun.svg | phone-story-01 | e8eee7 |
| leaf.svg | phone-story-02 | f5e9df |
| moon.svg | phone-story-03 | e5ebf1 |
| peach.svg | phone-story-04 | eee7f1 |
| cloud.svg | phone-story-05 | f4eedc |
| star.svg | phone-story-06 | e6efec |
| guest-01.svg | phone-story-07 | e8eee7 |
| guest-02.svg | phone-story-08 | f5e9df |
| guest-03.svg | phone-story-09 | e5ebf1 |
| guest-04.svg | phone-story-10 | eee7f1 |
| guest-05.svg | phone-story-11 | f4eedc |
| guest-06.svg | phone-story-12 | e6efec |
| guest-07.svg | phone-story-13 | e8eee7 |
| guest-08.svg | phone-story-14 | f5e9df |
| guest-09.svg | phone-story-15 | e5ebf1 |
| guest-10.svg | phone-story-16 | eee7f1 |
| guest-11.svg | phone-story-17 | f4eedc |
| guest-12.svg | phone-story-18 | e6efec |
| guest-13.svg | phone-story-19 | e8eee7 |
| guest-14.svg | phone-story-20 | f5e9df |
| guest-15.svg | phone-story-21 | e5ebf1 |
| guest-16.svg | phone-story-22 | eee7f1 |
| guest-17.svg | phone-story-23 | f4eedc |
| guest-18.svg | phone-story-24 | e6efec |

获取格式：`https://api.dicebear.com/10.x/notionists/svg?seed=<seed>&backgroundColor=<hex>`。

## 昵称

32 个昵称位于 `src/content/content.json` 的 `nicknames`。参考常见网络昵称的简短称呼、食物、生活状态等构成方式后自行整理，并非采集真实账号，也不与头像素材中的人物身份对应。人物已有自定义昵称不被更新覆盖；编辑页可主动换名。

## 来电铃声

`assets/audio/incoming-ring.mp3`：用户于 2026-09-18 提供的“光厂音效_52315_微信语音来电铃声.mp3”，来源 https://www.vjshi.com/sound-effects/detail/52315 。保留原文件内容，仅重命名。本地开发预览使用；来源页面标明个人非商业学习、研究、交流用途，公开发布前需取得相应授权。未使用腾讯 TUICallKit 铃声。

上传包音频适配：原始 MP3 只在开发源码目录保留。构建时按 projects/14-tongfu-rhythm 方式转成 Base64 编入 JS，运行时还原字节并通过 Web Audio 解码，音频字节未转码，声音内容不变。发布 ZIP 不含音频扩展名。
