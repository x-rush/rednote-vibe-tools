# v7 新增素材

- assets/lake-v7.png：image_gen 参考 v6 湖汀风格生成新湖湾。原始生成文件 exec-5f080d61-77a1-4d54-865d-3be80a7f66d5.png，项目内保留源图；运行 WebP 质量 64。
- assets/harbor-v7.png：image_gen 生成四格图集：破损渡口、修复渡口、篷船、绣荷灯。原始生成文件 exec-f210cc5b-67da-4391-93f3-660ff0a19f06.png，项目内保留源图；运行 WebP 质量 64，CSS 四格定位。
- lake-v6.webp 重编码质量 64，mountain-v6.webp 质量 70，仅优化文件编码，原始源图保留。没有运行时外链，源 PNG 不入 ZIP。
- 新图经视觉检查后把岸线和固定地标范围写入 content.json；代码不根据图片自动识别碰撞。

---
# v6 当前素材

内置 image_gen 生成/编辑，原始 PNG 保留在本项目 assets，使用 FFmpeg 编码 WebP（质量 83）。三张地图留出大片开放地面，主宅已从底图拆成独立可移动景物。

- estate-v6.png / estate-v6.webp：初晴庭院，替换旧固定主宅底图。
- lake-v6.png / lake-v6.webp：荷风湖汀，湖岸与远景。
- mountain-v6.png / mountain-v6.webp：云岫山居，山林与远峰。
- scenery-v6.png / scenery-v6.webp：3×3 九景物图集，主宅、粉墙、月门、画舫、荷丛、湖亭、桂树、书舍、叠泉。
- 继续使用 plants.webp 与 scenery.webp。图集白底 multiply 融合；无运行时抠图。
- 原 PNG 和旧 courts.webp 不进入当前上传包。当前包共六张 WebP：三张地图、两张景物图集、一张植物图集。

以下为历史素材记录。

---
# v4 当前素材

- assets/estate-v4-original.png：内置 image_gen 原创新的大园林底图；运行 assets/courts.webp，WebP 质量 85。
- assets/plants-v4-original.png：内置 image_gen 生成并编辑的 18 植物图集，1024×1536；运行 assets/plants.webp，WebP 质量 88。六行依次兰、竹、芭蕉、梅、松、柳；三列分别疏植、成丛/盛冠、组植。
- 初次植物生成出现灰绿背景，未进入运行包；再次编辑为白底后才采用。图集实际行列位置略偏离等分，用 content.json 的 plantAtlas 明确逐行逐列裁切框，CSS 精灵定位，不进行运行时抠图。背景为白色，非透明，使用 multiply 融合。
- 图集根部锚点逐类标定，竹子 97%、柳树 92% 等，避免统一方框造成脚底漂浮。每个景物另有独立宽高。
- 植物提示：细线工笔、同向俯视、白底十八格；每种植物三个不同轮廓，竹子要求成熟高杆与清楚竹节，禁止盆景化。编辑提示要求白色无光晕、各植物完整隔离、不得跨行。
- 园林提示：连续大园林、主宅集中上部约 15%–18%、细边界草木与右侧窄水岸，大部分地面为可布置的浅色开放庭园，无文字网格。
- 其他景物沿用 assets/scenery.webp。所有原始 PNG 仅用于开发，不入 ZIP，无运行时外链。

以下为历史素材记录。

---

# 景物素材

使用内置 `image_gen` 生成与编辑，没有使用 CLI / 外部 API。最终素材已复制到本项目，不依赖生成工具默认目录。

- `assets/scenery-original.png`：最终白底 1024×1536 图集，4 列 6 行；行列与 content.json 的 sprite 字段一致。
- `assets/scenery.webp`：ffmpeg 将原图编码为 WebP，quality 85，不改变构图和像素尺寸。运行时约 317 KiB。
- 图集是白底插画，不是透明 PNG；界面使用 CSS multiply 与庭园地面融合。没有运行时抠图、外部图片加载或持久化用户图片。

## 初次生成提示词

Use case: stylized-concept. Create ONE production game sprite atlas, 1024x1536 pixels, EXACTLY 4 columns by 6 rows of equally sized 256x256 square cells, all on genuinely TRANSPARENT background. Each cell contains one separated miniature Ming-era Jiangnan Chinese scholar garden scenery asset in consistent charming hand-painted isometric 3/4 view, refined gouache illustration, soft celadon green and jade foliage, slate blue tiled roofs, white plaster walls, aged warm wood. Clean silhouettes legible at 80px. Each isolated object centered within its cell with generous transparent margin 20px on every side, no objects crossing cells, no grid lines, no captions, no lettering, no UI, no ground tiles. Soft tiny contact shadow only. All viewpoints same. Exact row order left to right: Row1 orchid in ceramic pot; cluster of green bamboo; Chinese stone lantern; banana plant. Row2 tall porous Taihu scholar rock; circular stone table with stools; flowering pink plum tree; white garden wall section with lattice window. Row3 oval lotus pond with stone rim; small curved stone bridge; purple wisteria pergola; ornamental pine tree. Row4 Chinese hexagonal pavilion; waterside wooden open pavilion; white moon-gate wall with dark roof; graceful willow tree. Row5 two-floor Chinese library building; winding narrow stone water channel; rockery waterfall with pool; covered zigzag corridor. Row6 grand flower conservatory courtyard with tiled roof and flowers; elaborate mountain-and-water courtyard miniature; long ornate double-roof garden gallery; monumental Taihu rock garden miniature with sculptural rocks and moss. This is a carefully aligned sprite sheet, each of 24 objects distinct, each fully within own cell, no extra objects outside cells. Coherent premium cozy garden idle game artwork. Transparent space around every sprite required.

初次生成未得到透明背景。进行过一次透明提取编辑，仍是有色背景，因此未使用该中间版本。

## 最终采用的编辑提示词

Replace ONLY the green gray blurred backdrop with completely uniform PURE WHITE #FFFFFF across this whole game atlas. Background must be white, clean product catalog on white seamless paper, no gradients, no green glow, no vignette. Keep all 24 individual Chinese garden objects at exactly their same position and same size. Preserve exact 4-column 6-row grid 1024x1536; all objects fully in own 256x256 cell. No text, no cell borders, no extra scenery. Crisp isolated illustrations on white. Preserve green foliage and blue tiled roofs of actual objects. Erase all colored background pixels outside objects to white. Do not change any architecture or row order.

庭院底图的墙、月洞轮廓和地块由 CSS 绘制，与景物插画配合。建筑与园林元素为风格化创作，未经建筑考据，不作为特定古迹复原。

## v2 当前运行素材（替代上述 v1 底图描述）

assets/courts-original.png 是 image_gen 原创四庭图集，assets/courts.webp 为 ffmpeg 缩放至 1536×1536、质量 83 的运行版。2×2 顺序为兰庭、水庭、书窗竹院、山石庭院。底图要求细线工笔、淡彩、同向俯视与左上光源、大幅开放地面、自然曲径、建筑集中边缘，无文字、网格或人物。

assets/scenery-v2-original.png 是基于 v1 图集重新统一画风的 24 景物；assets/scenery.webp 为质量 85 的运行版，已替代旧 WebP。编辑要求保持 4 列 6 行及位置顺序，降低荧光绿、硬黑边和厚重立体阴影，统一淡彩工笔，背景纯白。仍是白底混合，不宣称透明图。

源 PNG 不进入上传包。两次生成均使用内置 image_gen，无外链加载；未使用剧照、演员肖像。园林建筑为风格化创作，未经历史建筑考据。

## v3 当前底图（替代 v2 四图集）

assets/estate-original.png 为内置 image_gen 原创连续园林图；assets/courts.webp 现为此图的 WebP 质量 85 编码。文件名保留以复用已有离线构建链，内容不再是四格图集。开发源来自生成文件 exec-d843f96a-b4d6-4d6d-b40a-541f5511dc0f.png。

生成要求：一张连续正方形明代园林地图，淡彩工笔、同向俯视，上方中央大型主宅与侧翼廊道，边缘粉墙林木和右侧池岸，约七成开放象牙白地面，无网格、文字、UI 或人物。生成实际主宅约占上方四分之一，运行时把可摆放坐标映射到其下方开放地面。没有使用原剧剧照。24 景物仍使用 v2 图集。原始 PNG 不进入 ZIP。



