# 原创插画素材

2026-10-14，通过内置 image_gen 生成三张透明 PNG，已复制到本项目 src/assets，作为应用实际资源。没有将界面概念图切片用作页面，未使用用户参考截图作为生成输入。

共同设定：原创奶白陶瓷 Q 版工程小机器人，深蓝屏幕脸、青蓝眼睛、黄色球形天线、湖蓝工具腰包；柔和哑光 3D 玩具质感。无文字、商标、现有角色或界面元素；真实透明背景。

## 提示词与用途

- `study.png`：Original cute chibi engineer robot at a little desk using a laptop, code notebook, single small plant and stacked engineering notebooks. Cream ceramic round head, dark navy screen face, friendly cyan eyes, yellow antenna, teal tool belt. Polished matte 3D toy illustration, mist-blue soft shadows, lake-teal and butter-yellow accents. Horizontal composition, complete subject with margin, no text/logos/famous characters/UI, genuine transparent background. 用于学习桌首页。
- `detective.png`：Original cream ceramic chibi engineer robot, cyan oval eyes, yellow antenna and teal tool belt, holding a magnifying glass inspecting a small teal gear. Polished matte 3D toy rendering, full body, clean silhouette, no text/logos/famous characters/UI, genuine transparent background. 用于故障实验、技术图鉴或空状态。
- `celebrate.png`：Original cream ceramic chibi engineer robot with happy cyan crescent eyes, yellow antenna and teal tool belt, proudly holding a butter-yellow star trophy, raised hand and three small teal/yellow stars. Polished matte 3D toy, full silhouette with margin, no text/logos/famous characters/UI, genuine transparent background. 用于学习档案与练习完成状态。

原始输出位于 C:/Users/77958/.codex/generated_images/01a1387a-b53d-75b3-9d05-b3bcde32fca9。项目实际消费本目录内资源，不依赖该外部生成目录。未经图片尺寸加工，保留生成透明通道。合计约 4.39 MB；应用构建需递归包含并审核三项资源。

## 概念图对齐修正

2026-10-14 新增 `src/assets/study-scene.png`，通过内置 image_gen，以本会话已批准的原创三屏概念图 `exec-45dd5e6f-6775-4a3d-9562-592b84e2e0c2.png` 为视觉参照生成，未将概念图页面切片当作应用界面。新的首页场景包含窗边背景、近景机器人、笔记本、植物、书籍和杯子，没有界面按钮或文字，非透明背景。原 `study.png` 继续用于章节等小型角色贴图。

提示词：Create a standalone production illustration asset matching the HOME scene in the provided UI concept board. Reference is visual style/character/scenery only. Recreate the cream round engineer robot with teal ears, navy screen face and cyan oval eyes working at laptop in a bright blue window-side study nook. Include notebook, plant, teal/blue/yellow books and mug. Soft polished 3D scene, horizontal close-medium composition, robot head/workspace fill center, softly fade edges to mist blue #EAF3FA. NO UI, title, button, letters, frame, logos or watermark.

新素材 1,632,203 bytes；四项原始素材合计约 6.02 MB，最终构建按实际产物重新计算。
