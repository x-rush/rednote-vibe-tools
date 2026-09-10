# 素材记录

## 首页抠图修正

首页吕秀才、郭芙蓉使用内置 image_gen 生成独立亮度蒙版，叠加在原始彩色立绘上，保留原图像素与 1:2 单姿势比例。仅首页应用，正常游戏及结算不更换人物图。

- `public/art/xiucai-home-mask.png`
- `public/art/furong-home-mask.png`

蒙版提示词：Precise background-extraction MASK ONLY for the attached two-pose character sheet. Same square canvas, exact positions and proportions. Both complete character silhouettes pure white, all navy background pure black including gaps between limbs and fingers. Preserve hair, clothing, props and shoes; no interior details, no checkerboard, no transparency. Slight anti-aliasing at exact edges. This luminance matte is overlaid on the original image without redrawing characters.

已在浅色棋盘背景放大目检，及 375/390/430px 首页确认。证据 `test-results/cutout-edge-check.png`、`cutout-home-*.png`。

## 音频

- 曲目：《好久不见》，李小龙，《武林外传》TV 片头。
- 页面：https://www.bilibili.com/video/BV1e1421q7dw/
- 视频公开元数据标注 99 秒；音轨实际解码 98.104 秒，完整保留，没有截取。
- 文件：`public/audio/hao-jiu-bu-jian.m4a`，AAC，约 1.28 MB。
- SHA256：`174E3F8828DABE527C1ED96990D2C3F955871533848CB71B6DDBBBA361A67AD2`。
- 2026-09-09 使用公开视频普通播放音轨下载、FFmpeg 无损重封装；未登录、未绕过付费或 DRM。
- 来源非授权证明，本地开发交付，未进行公开发布。

## 人物单独参考

- 吕秀才：https://finance.sina.com.cn/wm/2025-11-20/doc-infxzrca2254262.shtml （`design/xiucai-reference.jpg`）
- 郭芙蓉：https://m-2.duitang.com/blog/?id=514512925 （`design/furong-reference.jpg`）
- 佟湘玉：https://ecywang.com/pic/武林外传剧照图片高清/ （`design/xiangyu-reference.jpg`）
- 李大嘴：https://www.sohu.com/a/437859226_100042272 （`design/dazui-reference.jpg`）
- 客栈参考：https://zjnews.zjol.com.cn/zjxc/202601/t20260110_31448112.shtml ，及 https://www.sohu.com/a/488858343_121111412

剧照只作开发参考，未包含在构建站点。运行时人物图由内置 image_gen 生成，未使用 CLI/API fallback。采用各角色独立单人参考生成双姿势图，左正常、右定身。玩家白展堂不在对手素材中。

## 美术约束

用户指出群像初版缺乏还原度，第二版角色错配。因此最终以单人参考分别生成，保留脸型、发型、服装、道具对应。生成的棋盘格并非真实 alpha，随后用 image_gen 只替换背景为深蓝，保留人物，再采用网页舞台叠层。

背景包含旧木桌、长凳、茶壶茶杯、朴素墙面、左楼梯、蓝布门帘。没有使用豪华客栈初稿。

用户后续修改：小郭使用紫色交领上衣、绿色长袖的日常装（服装参考 https://k.sina.cn/article_6984515041_p1a04f3de100100nm46.html），佟湘玉鞋改为无刺绣黑色平底布鞋。使用 image_gen 局部编辑，身份、发型、两姿势及构图不变。

## 最终人物生成提示词

### promptDazui

Use case: identity-preserve. Attached single-character still is the ONLY identity and costume reference: 李大嘴 / 姜超, Li Dazui portrayed by Jiang Chao. New 1024x1024 game sprite sheet exactly TWO equal-width columns of THIS SAME MAN full body. LEFT standing ready with friendly broad grin, holding steamed bun at waist. RIGHT magically immobilized in comic startled pose, bun halfway to mouth, raised brows. Face matches reference stocky round adult face, small narrow eyes, full cheeks, broad smile. Short black hair with broad TAN CLOTH HEADBAND tied at side with tails, gray rough scarf draped round neck, worn brown patched tunic with distinctive black patches and black/cream cuff wraps, plain woven apron, dark loose trousers, cloth shoes, white kitchen towel over shoulder. NO cleaver in game. Light caricature adult four-head-tall proportions, recognizable adult face, same polished hand-painted 2.5D game animation aesthetic as other cast, no baby anime eyes. Two complete full-body figures centered separately at 25% and 75%, equal scale and floor baseline, front view, feet visible, no overlap. Truly transparent background, clean alpha, no text, no watermark, no floor.

### promptXiucai

Use case: identity-preserve. The attached single-character still is the ONLY identity and costume reference: 吕秀才 / 喻恩泰, Lv Xiucai portrayed by Yu Entai. Generate a 1024x1024 game sprite sheet with exactly TWO equal-width columns of THIS SAME MAN full body. LEFT: ready pose holding a small blue stitched book low at waist, slightly nervous earnest expression. RIGHT: immobilized by magical pressure-point tap, comically stiff shoulders and wide startled eyes, same book. Identity: match reference's narrow elongated face, high forehead, thin lips, slight worried brow, hair tightly swept into small gray-cloth-wrapped TOPKNOT, no flowing hair. Exact humble gray-green linen scholar robe, cream crossover undercollar, dark belt, cloth shoes. NOT Bai Zhantang/Sha Yi, NOT the handsome long-haired martial hero, no patterned triangle collar, NO hat. Lightly caricatured adult 4-head-tall proportions, recognizable face is critical, restrained polished hand-painted 2.5D Chinese animation style, no baby anime face. Both full bodies including feet inside own half, matched position and scale, front view, identical lighting. Truly transparent background, clean alpha, no text, no watermark, no floor.

### promptFurong

Use case: identity-preserve. The attached single-character still is the ONLY identity/costume reference: 郭芙蓉 / 姚晨, Guo Furong portrayed by Yao Chen. Generate 1024x1024 game sprite sheet exactly TWO equal-width columns of THIS SAME WOMAN full body. LEFT ready martial stance, hands open at waist. RIGHT immobilized pressure-point comic pose with one open palm halfway raised and startled eyebrows. Face MUST preserve Yao Chen reference's distinctive broad mouth/full lips, long angular oval face, straight assertive brows, youthful fierce gaze. Hair matches reference: high half ponytail, long straight black lengths falling down both shoulders, no elaborate buns/jewelry. Costume exactly reference: pale straw-yellow long sleeves, rough brown sleeveless wrap tunic, dark fabric waist belt, crisscross worn dark wrist wraps, loose brown trousers and cloth shoes. Do not turn into Tong Xiangyu/Yan Ni, no red mistress robe, no green scarf. Light caricature adult 4-head-tall proportions, accurate recognizable face, hand-painted 2.5D game animation, not baby anime. Both full-body figures centered in their own halves, feet visible, aligned consistent scale/front view, no crossing middle. Truly transparent background, clean alpha, no text, no watermark, no floor.

### promptXiangyu

Use case: identity-preserve. Attached single-character still is the ONLY face and costume reference: 佟湘玉 / 闫妮, Tong Xiangyu portrayed by Yan Ni. Generate 1024x1024 game sprite sheet with exactly TWO equal-width columns of THIS SAME ADULT WOMAN full body. LEFT ready standing pose with small abacus held at waist, knowing amused smile. RIGHT stiff pressure-point immobilized pose, startled open mouth, one hand holding abacus and the other suspended in mid-gesture. Match reference's mature softly rounded long face, arched eyebrows, almond eyes, subtle slightly asymmetric smile and actual adult nose/lips. Dark hair matches reference elegant simple UPDO with center/side parted sweeping fringe and loose side tendrils, small red hair ornament, small drop earrings. Costume matches reference red finely striped outer robe, muted green long scarf draped around neck, blue inner collar over white floral underblouse, long muted skirt and red cloth shoes. NOT Guo Furong/Yao Chen, do not swap faces, no brown martial tunic, no ponytail, no broad exaggerated mouth. Lightly caricatured adult 4-head-tall polished hand-painted 2.5D animation game aesthetic, recognizable adult face more important than cuteness. Both full body and feet visible, each centered within own half, aligned scale and lighting, no overlap. Truly transparent background, clean alpha, no text, no watermark, no floor.


### 统一背景修正

Edit ONLY background of the exact two-pose sprite sheet. Replace ALL gray-white checkerboard with uniform solid very dark navy #101925. Preserve facial identity, hair, costume, props, two poses, full feet, scale and equal left/right positions. No face retouch, no new content, same square canvas.

### 客栈背景

Generate a portrait 1024x1536 hand-painted game background based on the actual humble Tongfu Inn set. Beige plaster walls, worn timber, modest rear-left staircase, square lattice windows, blue cloth valances. Tong Xiangyu's old rectangular scratched honey-brown solid wood dining table, sturdy legs, long benches, dark teapot and cups are the focal prop. Table in middle-right, space for character center-left. Warm amber light, restrained teal shadows, lower quarter fades to dark navy. No people, no palace, no readable text.

### 首页四人统一抠图（2026-09-09）
补齐 public/art/dazui-home-mask.png、public/art/xiangyu-home-mask.png，分别来自 exec-3e32832d-c1a1-417e-b1fc-04aa4efe53e7.png 和 exec-132e6f5e-99c0-4b10-bb1e-92252764d007.png。以各自 final 原图为参考，由 imagegen 生成同位置黑白亮度蒙版，通过 CSS luminance mask 去除背景。保留原彩色立绘和放大比例。

Prompt: Precise background-extraction MASK ONLY for attached two-pose character sheet. Return black-and-white LUMINANCE MATTE, NOT colored illustration. Same square canvas and EXACT layout. Paint BOTH complete character silhouettes solid pure WHITE #ffffff including hair, headwear, all clothing, props, hands and shoes. Paint all navy background solid pure BLACK #000000 including gaps between feet and between arms and torso. Preserve EXACT outline and positions; do not move, resize, redraw or invent shapes. No interior features, no shading inside figures, no checkerboard, no transparency. Slight antialias only at precise edges. Mask will overlay original image pixel-aligned.

## 第三版分轨与字音分析资源
- 制作阶段使用 UVR_MDXNET_Main.onnx 分离人声及伴奏，来源：https://github.com/TRvlvr/model_repo/releases/download/all_public_uvr_models/UVR_MDXNET_Main.onnx 。参数由 UVR 官方模型元数据匹配，模型 SHA256 与重建检查见 separation-report.json。
- UVR 参考实现与元数据：https://github.com/Anjok07/ultimatevocalremovergui 。本项目适配器使用 NumPy STFT/ISTFT + ONNX Runtime，未执行模型仓库中的 Python 文件。
- 字音对齐使用 Systran/faster-whisper-small，来源：https://huggingface.co/Systran/faster-whisper-small 。模型与工具放在 test-results 内，不进入发布目录。ASR 文本可能识别错误，只作为字音候选时间参考，不作为歌词展示。
- public/audio/guide-vocals.m4a、guide-instrumental.m4a 是现有原音频的离线派生资源，仅用于制谱台切轨试听；游戏播放原有完整音乐。

## 简约 Logo · 2026-09-09

文件：public/art/tongfu-logo-v1.png。使用内置 imagegen 生成，第二轮简化成品；未替换现有首页美术。

最终提示词：Edit this logo into a much simpler flat app icon. Keep the clearly readable Chinese text 同福 on the inn plaque and the parallel two-finger acupressure hand silhouette, preserving this concept and correct hand anatomy. REMOVE ALL clouds, smoke, glow, distressed edges, texture, gradients, shading and extra embellishments. Fill the ENTIRE square background with perfectly uniform solid cinnabar red #9F342D, opaque edge-to-edge, no transparent or black areas. Reduce the plaque to one simple cream rectangular clipped-corner silhouette with red 同福 lettering, two tiny hanging tabs; remove multiple nested borders. Hand and cuff below/right in simple warm cream silhouette with minimal red separation lines, fingers pointing diagonally up-right; retain a single tiny gold sparkle at fingertip. TWO main colors red and cream, gold only for sparkle. Strict flat vector-like shapes, crisply cut edges, lots of negative space, geometric yet friendly, highly legible app icon. No mockup or presentation, one final square logo.
