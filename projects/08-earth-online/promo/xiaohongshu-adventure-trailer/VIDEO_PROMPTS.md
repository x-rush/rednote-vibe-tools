# H3 首尾帧图生视频提示词

## 输出策略

- 生成 5 条独立母片，不让模型在一条视频里跨地点、跨昼夜或硬切。
- 画幅：9:16；建议 1080 × 1920；24 fps。
- 模式：优先使用 H3 首尾帧模式。若平台支持额外主体参考，再附加主角三视图；若首尾帧模式不支持参考图，不必重复上传三视图，身份已经写入首尾帧。
- 每段首尾各保留约 12 帧稳定状态，剪辑时从遮挡最深处或后期 HUD 中切换。
- 所有中文、XP、徽章、按钮和扫描框后期添加。不要要求模型生成可读文字。
- 原生音频若可用，只生成环境底噪和动作拟音；对白、系统音与音乐后期统一制作。

## 通用角色与负面约束

主角锁定为参考图中的 18 岁中国男高中生：短黑发小呆毛、藏青白校服、灰色运动鞋；校园段背黑色双肩包，右肩橙色登山扣、左肩黄铜徽章。保持冷面、克制，不做夸张表情。

```text
Preserve the exact protagonist identity, age, face, short black cowlick hair, navy-and-white tracksuit and fixed accessories from the supplied frames. One continuous real-time shot with no internal cuts, no time lapse, no teleportation and no sudden camera acceleration. Maintain stable facial geometry, hands, clothing, props, lighting and background architecture. Use restrained deadpan acting. Do not generate readable text, logos, school emblems, watermarks or subtitles. No extra fingers, duplicate people, face swaps, morphing props, flicker, breathing walls, changing windows, floating objects or fantasy physics.
```

## 01 空气按钮与镜中秘密接头

输入：

- 首帧：`frames/h3-masters/01-hook-contact-start.png`
- 尾帧：`frames/h3-masters/01-hook-contact-end.png`
- 时长：8.5 秒

```text
Photorealistic vertical Chinese high-school deadpan comedy, one continuous 8.5-second shot. Begin exactly on the supplied first frame and keep the same behind-left camera axis throughout. The boy is already facing the full-length mirror. He presses one invisible point in the empty air once with his raised index finger, then lowers that hand. The distinct female student on the real floor at far left glances at the empty-air gesture with mild confusion. The camera performs one very slow lateral glide to the right. The boy solemnly straightens his collar and brass badge, makes one simple compact code gesture with the same hand, then opens that hand and holds his palm just before the mirror without touching it. His one ordinary physical reflection remains exactly synchronized at all times. The female student gives one restrained side glance and calmly exits left during the second half; she never becomes a reflection or resembles the boy. The protagonist holds still. The camera continues in the same direction until the thick matte-black mirror frame passes close to the lens and occludes the right side of the picture as shown in the supplied endpoint. End exactly on the supplied last frame and hold steady. Natural daylight, realistic mirror physics, continuous identity and restrained acting. No visible HUD, glow or generated text.
```

后期：00.8 秒后叠加状态读取；掌心停稳时显示 `身份确认：你确实是你`，不对镜像做任何延迟或变形；最后 6 帧用同色遮罩把右侧黑色镜框扩展至全屏，再从黑场揭开母片 02 的左侧立柱。

## 02 现实 Bug 调查

输入：

- 首帧：`frames/h3-masters/02-reality-bugs-start.png`
- 尾帧：`frames/h3-masters/02-reality-bugs-end.png`
- 时长：8 秒

```text
Photorealistic vertical school-corridor deadpan comedy, one continuous 8-second shot. Begin exactly on the supplied first frame with the near-lens dark pillar covering the left side. The camera glides slowly right in the same direction as the previous master shot, revealing the exact protagonist holding one transparent ruler and one small white spiral notebook. He notices three ordinary similar potted plants and a normal wall clock, then safely crouches beside one clear tile seam without blocking the corridor. The camera performs a gentle controlled tilt down. He aligns the ruler along the seam, writes one short illegible line in the notebook, and looks up when the clock second hand moves exactly one ordinary tick. He gives one tiny satisfied nod. A distinct female student passes only in the deep background and briefly slows; she never resembles the protagonist. The boy closes the notebook and raises its completely blank white back cover toward the lens until it fills about 80 percent of the picture. End exactly on the supplied last frame and hold. Stable daylight and architecture, no generated HUD or readable writing.
```

后期：扫描框逐一锁定盆栽、砖缝和钟；尾部将白色封面放大到 105%，用 4 帧柔和白场连接母片 03 的白橡皮。

## 03 民用遗物鉴定

输入：

- 首帧：`frames/h3-masters/03-object-rpg-start.png`
- 尾帧：`frames/h3-masters/03-object-rpg-end.png`
- 时长：8 秒

```text
Photorealistic vertical classroom deadpan comedy, one continuous 8-second shot. Begin exactly on the supplied first frame with one ordinary white rectangular eraser close to the lens. The trusted male classmate slowly pulls his own eraser away from camera, revealing the exact protagonist seated behind it with two open empty palms. The two boys remain visibly different people throughout. The classmate voluntarily places the eraser into the protagonist's palms. The protagonist receives it, rotates the same single eraser once using only his hands, and inspects it with absurd archaeological seriousness. He never takes out a phone and never picks up another prop. The classmate calmly opens one empty palm. The protagonist finishes the silent appraisal and returns the same eraser to that open palm. The classmate is not required to react or perform anything else. Hold both distinct faces and the returned object stable. End exactly on the supplied last frame. Natural daylight, correct fingers and continuous object identity. No magnifying glass, phone, generated interface, text or magical glow.
```

后期：白橡皮首帧先放大约 135% 再回到原构图；结束前叠加青色权限卡，最后 8 帧扩展至全屏，为母片 04 提供数字遮挡。

## 04 影子 Boss 谈判

输入：

- 首帧：`frames/h3-masters/04-shadow-boss-start-clean.png`
- 尾帧：`frames/h3-masters/04-shadow-boss-end-physical.png`
- 时长：8 秒

```text
Photorealistic vertical early-evening campus deadpan comedy, one continuous 8-second shot in a safe well-lit public courtyard. Begin exactly on the supplied first frame. The exact protagonist stands still on dry level pavement, well away from roads, stairs and water. He looks down at his own single ordinary shadow, assumes a restrained diplomatic posture, takes three slow comfortable breaths, then extends his left open hand. The physical shadow remains attached to both shoe soles and extends diagonally toward the lower-left, opposite the single warm lamp. Its body order must remain physically correct from near to far: shadow feet at the shoes, then two legs, hips, torso, shoulders and finally the head farthest toward the lower-left. The left-arm shadow branches from the shoulder and ends in one open hand; the right arm remains relaxed. The shadow never acts independently. After a short silent pause, the camera performs one slow controlled tilt downward from the same position. Finish exactly on the supplied last frame with shoes, pavement and the same single shadow dominating the composition. Hold the final frame steady. No other person, upright reversed silhouette, second shadow, horror transformation, generated interface or text.
```

后期：用上一段同一张青色权限卡覆盖开头 8 帧，再缩到左上角；结束时不加黑场，直接在影子最暗处匹配切到母片 05 的深色练习册。

## 05 升级后重新连接主线

输入：

- 首帧：`frames/h3-masters/05-homework-resume-start.png`
- 尾帧：`frames/h3-masters/05-homework-resume-end.png`
- 时长：8 秒

```text
Photorealistic vertical home-desk deadpan comedy, one continuous locked-off 8-second shot. Begin exactly on the supplied first frame with the same matte dark-navy exercise book covering most of the view. Exactly one simple black pen is already visible, secured naturally between the boy's right hand and the book edge. The exact protagonist slowly lowers the book onto the wooden desk while retaining that same pen, opens the book once, and reveals the earlier work. The left page already contains several faint ordinary pencil workings and crossed-out attempts from his earlier study; they remain too small and soft to read. The right page has clear space to continue. He looks down calmly, uses his left hand to steady the page, rotates the same black pen into a normal writing grip, and begins one short new handwritten line with his right hand. He never reaches outside the frame and no new prop appears. This is renewed effort, not a completed solution or a triumphant moment. End exactly on the supplied last frame with the pen tip touching the page and hold stable for at least the final 12 frames. Preserve the warm desk lamp, shelves, room layout, face, uniform, accessories, notebook and restrained expression. No generated light effects, HUD, readable equations, readable text or private information. No blank notebook, finished homework, eye contact with camera, extra pen or malformed fingers.
```

后期：封面暗部与上一段影子做 4 帧亮度匹配；先叠加学习记录，再叠加升级与 XP；主角落笔时切换为 `主线重新连接` / `已写下下一步`；末尾冻结或延长最后 12 帧进入 CTA。

## 失败重生成优先级

1. 身份、脸或服装漂移：整段重生成，不用人脸替换掩盖。
2. 手、橡皮、尺子或笔断裂：先缩小动作幅度再重生成。
3. 镜面或影子违反物理：直接重生成，不能把物理穿帮当作剧情笑点。
4. 背景轻微闪烁：可用稳定或局部遮罩修复；建筑结构变化则重生成。
5. H3 自动生成乱码：放弃该条，不能用模糊遮盖后继续发布。
