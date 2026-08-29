# 首尾帧图生视频提示词

## 通用设置

- 输出：9:16，1080 × 1920，24 或 25 fps。
- 每段先用主观 `start-subjective.png` 到 `end-subjective.png` 生成 5–6 秒，再插入对应 `objective-reaction.png` 0.7–1.2 秒。
- 图中的空白 HUD 只用于透视定位；中文和 XP 后期添加。
- 角色锁定：18 岁中国男高中生，短黑发小呆毛，藏青白校服，灰色运动鞋，黑色背包，右肩橙色登山扣，左肩黄铜徽章。
- 通用负面约束：不要改变面孔、年龄、发型、校服颜色或配件；不要多手、多指、断肢、肢体融合；不要生成可读文字、校徽、品牌、水印；不要浮夸表情；不要镜头闪烁、背景融化或角色瞬移。

## 01 镜像分身

输入：`frames/01-mirror-clone/start-subjective.png` → `frames/01-mirror-clone/end-subjective.png`

```text
Photorealistic vertical Chinese high-school deadpan comedy. Preserve the exact protagonist, wardrobe, backpack, orange carabiner and brass brooch. Slow controlled push-in toward the full-length mirror. The boy solemnly raises one palm, tilts his head slightly, then taps one shoulder with small safe movements. His real body pauses first; the reflected version appears to finish the final gesture two beats late, as a subtle subjective RPG illusion. The cyan-and-antique-gold HUD remains spatially anchored to the mirror, softly brightens at completion, with blank clean panels and no generated text. Natural daylight, realistic cloth and reflection, restrained acting, stable camera, 5.5 seconds. End exactly on the supplied completion frame.
```

后期做法：为了避免镜像穿帮，优先生成正常同步动作，再冻结真人半边并把镜中半边延后 8–12 帧。客观反打直接使用 `objective-reaction.png` 做轻微 2.5D 推近，不让镜像异常。

## 02 现实 Bug 报告

输入：`frames/02-reality-bugs/start-subjective.png` → `frames/02-reality-bugs/end-subjective.png`

```text
Photorealistic vertical school-corridor RPG comedy. Preserve the exact protagonist and all fixed accessories. Begin with his point of view scanning three identical potted plants and a normal wall clock; make three subtle cyan targeting brackets appear one after another without text. He looks from the plants to the tile seam, crouches safely, places a transparent ruler along one ordinary floor seam, and writes one line in a small notebook. A passing student in the deep background slows down in mild confusion. The blank cyan-and-gold HUD gains three completion marks and settles into the supplied end frame. Natural daytime lighting, smooth gentle tilt down, no running, no obstruction of corridor, 5.5 seconds.
```

客观反打：`objective-reaction.png` 只做极轻微手持漂移；移除所有 HUD 和扫描音，只保留尺子碰地的轻响。

## 03 现实道具 RPG 鉴定

输入：`frames/03-object-rpg/start-subjective.png` → `frames/03-object-rpg/end-subjective.png`

```text
Photorealistic vertical classroom deadpan comedy with a private RPG interface. Preserve the exact protagonist and trusted male classmate. The classmate voluntarily hands over an ordinary white rectangular eraser. The protagonist receives it carefully with both hands, rotates it once, then raises a small magnifying glass and studies the eraser with absurd archaeological seriousness. The classmate slowly opens one palm, waiting for it back, eyebrows slightly confused. A blank cyan-and-antique-gold item-identification HUD locks onto the eraser and fills with abstract non-text lines, then softly completes. Other students remain normal in the background. Subtle push-in, natural daylight, correct fingers and object continuity, 5.5 seconds, end on supplied frame.
```

客观反打：使用 `objective-reaction.png`，面板全部消失；给同学摊手动作做 6–8 帧小幅循环即可。

## 04 影子 Boss 休战

输入：`frames/04-shadow-boss/start-subjective.png` → `frames/04-shadow-boss/end-subjective.png`

```text
Photorealistic vertical early-evening school courtyard, safe and well lit, students visible in the distance. Preserve the exact protagonist, clothing and accessories. He stands still well away from roads, stairs and water. A private blank cyan-and-antique-gold boss HUD hovers in his line of sight. He looks down at his own long ordinary shadow, takes three slow comfortable breaths, then extends one open hand toward it as if offering a diplomatic truce. The physical shadow remains plausible and follows his pose; only the subjective HUD treats it like a boss. The boss bar gently empties into a truce state with no generated words. Slow lateral camera drift, grounded night lighting, dry comedy, 5.5 seconds, end on the supplied frame.
```

客观反打：使用 `objective-reaction.png`，完全移除 HUD；确保远处同学只停顿观察，不靠近、不嘲弄，校园始终明亮且有人。

## 片尾升级镜头

可用任一主观结束帧作虚化背景，后期自行制作 XP 动画，不建议让视频模型生成数字。顺序为 `+35`、`+35`、`+35`、`+20`，总计 `+125 XP`，进度条越过升级阈值后出现 `LEVEL UP · Lv.2`。升级光效只照亮主角眼睛和脸侧，不影响旁人或现实物体。
