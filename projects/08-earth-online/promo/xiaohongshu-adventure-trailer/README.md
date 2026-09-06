# 地球 Online：荒诞支线短片制作包

用于制作一支约 44 秒、9:16 竖屏的小红书短片。核心笑点是：主角把现实生活当 RPG，任务面板、完成提示和 XP 只有他自己能看见；切到同学视角，一切都只是一个男高中生在非常认真地做怪事。故事明确把支线定位为“卡住时的短暂行动复位”：主角此前已经认真学习，做完支线后会回到原题写下下一步。四项任务来自同一天不同场景下的四次独立领取，每次只匹配一条。

## 主角设定

- 18 岁中国男高中生，身形偏瘦，短黑发，头顶有一小撮呆毛。
- 表情克制、略困、一本正经，荒诞事件发生时也不夸张表演。
- 通用藏青白校服、灰色运动鞋、黑色双肩包。
- 固定识别物：右肩带橙色登山扣、左肩带黄铜公会徽章。
- 三视图：[protagonist-turnaround-v1.png](character/protagonist-turnaround-v1.png)
- 可信男同学参考：[trusted-classmate-turnaround-v1.png](character/trusted-classmate-turnaround-v1.png)
- 路人女同学参考：[passerby-student-turnaround-v1.png](character/passerby-student-turnaround-v1.png)

不要把学校、校徽或服装处理成可识别的现实学校品牌。所有镜头都应保持安全、公开、有人活动的校园环境。

## H3 母片素材索引

成片使用 5 条单地点连续母片。`frames/h3-masters/` 只保留下表列出的 10 张正式 H3 首尾帧；旧任务帧、旧反打和问题对照图均已移除，避免误用。

| 母片 | 内容 | 时长 | 开始帧 | 结束帧 |
| --- | --- | ---: | --- | --- |
| 01 | 空气按钮 + 镜中秘密接头 | 8.5 秒 | `01-hook-contact-start.png` | `01-hook-contact-end.png` |
| 02 | 提交现实 Bug 报告 | 8 秒 | `02-reality-bugs-start.png` | `02-reality-bugs-end.png` |
| 03 | 现实道具 RPG 鉴定 | 8 秒 | `03-object-rpg-start.png` | `03-object-rpg-end.png` |
| 04 | 与影子 Boss 休战 | 8 秒 | `04-shadow-boss-start-clean.png` | `04-shadow-boss-end-physical.png` |
| 05 | 重新连接主线 + Lv.2 结算 | 8 秒 | `05-homework-resume-start.png` | `05-homework-resume-end.png` |

五条 H3 素材共 40.5 秒，后接 3.5 秒纯 HUD，成片约 44 秒。四项任务共计 125 XP，片尾升级到 Lv.2。

## 制作文件

- [VIDEO_SCRIPT.md](VIDEO_SCRIPT.md)：5 条连续母片的 44 秒时间线、旁白、奖励与转化结尾。
- [VIDEO_PROMPTS.md](VIDEO_PROMPTS.md)：5 组可直接复制的 H3 首尾帧提示词。
- [EDIT_GUIDE.md](EDIT_GUIDE.md)：逐帧转场、HUD 文案、声音桥与发布文案。

## 视觉规则

1. 主观镜头可出现青色与古金色的半透明公会 HUD；客观镜头绝不出现 HUD、光效或异常物理现象。
2. AI 生成的面板只作为位置和透视参考，中文任务名、XP、等级统一后期叠加，避免乱码。
3. 任务奖励只在主角视线附近短暂出现，旁人不看向面板，也不对 XP 作反应。
4. 表演采用“越认真越好笑”的冷面风格，不做大喊大叫或恶作剧式骚扰。
5. 不出现真实校名、个人信息、危险交通行为、陌生人骚扰或夜间偏僻环境。
6. 橙色挂扣与黄铜公会徽章仅属于主角；所有配角必须使用各自身份参考，不能复制主角脸。
7. 影子 Boss 只是主角自己的普通投影：唯一影子必须连接鞋底、方向背离主光源、姿态与主角一致。
8. 跨场景只在镜框、立柱、白色实物、后期权限卡或暗色平面中切换；不让 H3 在同一条视频中自动换地点。

## 素材说明

本目录图片为 AI 辅助生成的制作素材。正式发布时应按所用平台和生成工具的适用规则添加 AI 辅助创作说明。画面未使用用户照片、定位信息或现实学校标识。
