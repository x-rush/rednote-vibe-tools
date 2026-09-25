# v0.2 原创视觉资产

日期：2026-09-20。使用内置 imagegen，未使用演员照片或剧照。

识别锚点唯一维护在 src/content/content.json 的 characters 中。服饰、五官和发型由同一张角色图派生；只替换表情，不跨图重新猜测身份。林锦岐、赵星棠仅在其实际在场的对白场景出现。九皋没有冒用林锦岐立绘。

## 首张角色图：准确提示词

Create a premium Chinese historical visual novel character SPRITE ATLAS, transparent background, wide landscape image. Exactly FOUR separate waist-up characters in one horizontal row, identical 25% width columns, centered at x=12.5%,37.5%,62.5%,87.5%, ample transparent gap between bodies, all heads at same y, shoulders and hands fully contained in each column, no overlap, no props outside columns. Art style refined hand-painted gouache + fine ink outlines, realistic adult faces but illustrated not photographic, understated expressive faces, muted indigo, dusty rose, parchment, soft warm lantern light, sophisticated Chinese period romance, not anime chibi. Left to right: 1 LANXIANG: adult young Chinese woman, oval face, thoughtful almond eyes, straight brows, black hair in modest low coiled bun with tiny plain wooden hairpin, plain muted teal-blue cross-collar hanfu over ivory collar, quietly resolute expression, hands folded near waist. 2 XIAOLIAN: adult young Chinese maid woman, slightly rounder face, expressive eyes, black hair two modest small side coils and low bun, dusty mauve and cream plain hanfu, concerned vulnerable expression, hands lightly clenched near waist. 3 LIN JINQI: adult Chinese nobleman late 20s, angular long face, strong straight brows, hair neatly tied in high topknot under small dark jade crown, dark indigo formal silk hanfu with subtle woven pattern and pale inner collar, controlled suspicious expression, tall and composed. 4 ZHAO XINGTANG: adult Chinese noblewoman late 20s, sharp elegant eyes, black hair elaborate updo, small gold hairpins with burgundy stones, deep burgundy period silk robe with restrained gold edge and ivory inner collar, guarded proud expression, folded hands. Original fictional faces, do not resemble actors. All four fully opaque bodies on REAL transparent background. No setting, no ground, no text, no labels, no panels, no frame. Usable game assets with carefully separated silhouettes.

输出：exec-fa9625d2-2d82-4e52-938f-9405acfe7788.png。保留为 cast-neutral-original.png。

## 表情变体：准确提示词

以首张角色图为引用输入：

Edit this transparent four-character game sprite atlas. Keep the exact same four character identities, face shapes, hairstyles, clothes, body positions, crop and column placements. Preserve real transparent background. Change ONLY facial expressions and very subtle hand poses to create emotional variants: leftmost teal dressed Lanxiang raises chin slightly with brave firm determined brows and lips compressed, meeting opponent's eyes, intense but controlled; second mauve dressed Xiaolian gains a relieved tearful small smile, no open crying, relaxing clasped hands; third dark blue Lin Jinqi shifts from suspicion to a restrained thoughtful listening expression with relaxed brows and closed mouth, NOT smiling or seductive; fourth burgundy Zhao Xing tang becomes visibly angry and hurt, brows tightened and lips slightly parted mid-speech, proud and furious, NOT cartoon villain. Keep original muted hand-painted gouache+fine ink style, exact costumes and original fictional faces. Exactly same four separated columns, no overlap, no background, no text.

输出：exec-3febf164-0ffb-47fc-859b-b79b31d495e4.png。保留为 cast-intense-original.png。

## 场景：准确提示词

Create a professional background atlas for a serious Chinese historical visual novel, refined painted gouache and ink, cinematic muted indigo night with warm amber practical lights, same quiet painterly atmosphere as Chinese Jiangnan courtyard art. Landscape 3:2 canvas divided into THREE perfectly equal vertical full-height scene panels, no borders. NO PEOPLE ANYWHERE, no text or signage. Each panel is independent at 1/3 width, equal 512x1024 approximate proportions. LEFT PANEL: oppressive wealthy Chinese classical study interior at night, carved dark wood, paper lattice window, one warm desk lantern, brush rest, closed old books, distant writing desk, upper area quiet dark blue, space for two character portraits in foreground. CENTER PANEL: modest maid shared bedroom at dusk, plain lattice window with cool moonlight, a small sewing basket and folded dusty mauve cloth at lower side, tiny oil lamp, wooden walls, warm intimate mood, uncluttered central space for portraits. RIGHT PANEL: outside a two-story traditional Chinese private library at evening banquet, open-air covered corridor of red-brown wood, closed double doors, distant amber lantern light and blue shadow, sense of approaching footsteps, composition leaves foreground empty for two characters. Detailed tasteful painted game environment art, not photoreal, no ornamental borders, exact thirds, no character silhouettes.

输出：exec-5be49494-deb1-42d3-a1ad-64ec1cbf480d.png。保留为 interiors-original.png。

## 工程处理

原图来自 C:/Users/77958/.codex/generated_images/01a0ba12-4da8-7b73-ad6c-a408e9904732/。
只做资源编码与 atlas 帧提取：角色图等比例缩至1600×800，WebP quality84、alphaQuality95；场景图按512×1024三等分提取，WebP quality83。没有程序重绘或补造图像。
只将压缩后的 WebP 加入离线包。原始 PNG 与提示词留在开发素材目录，不进入 ZIP。

## v0.3 追加素材（2026-09-20）

使用内置imagegen。沿用原始四人atlas作为身份与服饰参照，先使用view_image检查。没有使用演员照片。以下记录生成目的与提示词要点；完整调用文本保留在任务工具记录。

- cast-support-original.png：exec-3be0a9ea-e8f6-42cd-911d-a3aa00bbd0a1.png。透明五列等宽半身角色图，依次为许父、薛氏、阿岑、原创女掌柜、九皋；真实成年面孔，细墨线与水粉风格，旧褐、灰蓝、赭黄、暗紫、灰蓝服饰。禁止文字、边框与相邻身体重叠。
- cast-vulnerable-original.png：exec-3868bcfb-53ae-4d95-a134-3a7a0a2f5174.png。引用cast-neutral-original.png，只修改表情，保持原四列身份、服饰和位置。兰香担忧低眸；小莲受伤失望；林锦岐略感意外；赵星棠骄傲之下流露脆弱。
- events-original.png：exec-616178d7-a51a-4504-ae7e-df2dd91b253f.png。引用原atlas中兰香、小莲的身份与服饰，生成等宽双幅竖向场景：左为藏书楼回廊并肩脱身，右为危机过后灯下分食。维持青蓝/藕粉衣色，细墨线与水粉风格，无文字和边框。

源文件均位于C:/Users/77958/.codex/generated_images/01a0ba12-4da8-7b73-ad6c-a408e9904732/，已复制到本项目assets。
支持角色图缩为2000×800、主角情绪图缩为1600×800，WebP质量83、alphaQuality95；事件图按半幅提取并缩至900高，WebP质量82。只做atlas帧提取、尺寸与格式处理，没有代码补画或修改图像内容。
