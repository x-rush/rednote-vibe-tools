# 视觉素材来源

生成方式：内置 image_gen，2026-09-19。使用 imagegen 技能。无外部下载素材、运行期 AI 或 API。原始 PNG 保留在 assets；交付仅包含 WebP 编码版本。转换仅作格式压缩，未另行改图；盘体透明通道保留。

## creek-light

Prompt: Use case photorealistic-natural. Create a premium photorealistic vertical 2:3 background asset for an immersive first-person creek gold-panning web game. Camera looking down at a 45 degree angle from a crouching person's eyes towards a crystal-clear shallow woodland creek. Beautiful warm late afternoon sun from upper left, natural cinematic photographic realism, highly detailed diverse smooth river cobbles visible UNDER clear pale emerald water, fine warm sandy gravel deposit across the central lower half reachable by hand, damp textured larger stones and delicate moss and a few ferns frame only the lateral edges asymmetrically. Top fifth shows creek receding softly with beautiful warm sun glints, bottom foreground damp sandy pebbles. Central 65 percent is open shallow creek and gravel, reserved for a separately rendered interactive pan, NO pan or tools or hands or humans present. Convincing water refraction and restrained caustics, tactile wet rock mineral veins, gorgeous tranquil outdoors nature photography, realistic tonal variation, soft fine film grain, no uniform repeated stones, no graphic illustration, no cartoon, no text, no UI, no border. High resolution.

## worn-pan

Prompt: Use case product-mockup. Photorealistic game prop asset: one EMPTY old gold prospector's shallow steel gold-panning pan, isolated on genuine transparent background. Perfect straight overhead orthographic view, circular outline centered, pan fills 94% of square image leaving thin transparent margins. Weathered dark charcoal gunmetal with subtle bronze patina, rolled steel rim, 3 broad concentric riffles on inner sloping wall, flat circular inner floor occupies 65% of diameter. Authentic fine radial scuff scratches, dark mottled oxidation, tiny damp patches and realistic metallic satin reflections, warm natural sunlight from upper left and soft cool sky fill. The empty floor is visible with NO sand NO gravel NO gold NO tools NO hands NO scene. Highly convincing photographic material, not a 3D plastic rendering, no perfectly smooth gradients, no text. Asset will be scaled into an ellipse by the game renderer so strictly top-down circular symmetrical silhouette is required.

## wet-sand

Prompt: Photorealistic material texture for a gold panning game. Straight overhead macro photograph of dense wet river sand and tiny mixed gravel, frame covers 25 cm square of material. Fine dark mineral grains dominate with sparse small 3 to 8 mm smooth grey brown ochre translucent quartz pebbles, varied realistic grain sizes, saturated wet natural brown charcoal sand, thin damp sheen without standing water. Extremely tactile photographic detail, warm light from upper left, soft natural shadows. Seamless edge-to-edge material, no pan, no container, no large rocks, no plants, no coins, no gold, no text, no border, not illustration. Square.

## 六处溪岸与标本扩展（2026-09-19）

内置 image_gen 生成，ImageGen 技能；未使用 CLI/API fallback。生成后复制到本项目 assets。PNG 是源素材，WebP 是发布素材。仅做 WebP 编码与为移动显示缩小钢盘/湿砂至 768px、地点缩略图至 600px；未通过程序重绘图片内容。

### 独立场景

共用完整提示模板：

Use case photorealistic-natural. Production background for a beautiful realistic mobile gold panning game. Single portrait photograph, 1024x1536 portrait composition, full frame one scene, absolutely no grid, no collage, no panels, no text, no watermark, no hands, no tools, no people. [SCENE] First person low camera looking downward about 55 degrees, foreground water and sediment within reach, close and tactile detailed stone textures, naturally lit late afternoon soft gold with restrained greens and dark wet stone tones. Upper 15 percent distant bank, central 65 percent creek shallows, lower 20 percent subtle wet gravel edge. Natural photography, clear focus throughout, believable water caustics, reflections and refracted submerged stones, lush serene cinematic atmosphere, no illustration or cartoon or plastic 3d.

SCENE 与保存路径：

- assets/creek-crevice.png / .webp：Dark heavy mineral sand deposited between two large rounded wet boulders beside a transparent shallow creek pool, water occupying center and lower foreground, no gold visible.
- assets/creek-bend.png / .webp：A sweeping curved pale fine sandbank on the inside of a mountain creek bend, fine sediment ripples visible through clear shallow water, delicate reflections and a few warm pebbles, water center foreground.
- assets/creek-pool.png / .webp：A sheltered clear shallow creek pool in a hollow between many coarse rounded wet pebbles and several larger boulders, sandy patches beneath transparent water, water center foreground.
- assets/creek-moss.png / .webp：Velvety vivid natural moss on a low creek bank, visible fine roots and a few brown fallen leaves at the edges, crystal clear shallow mountain creek with golden sand and small wet stones in center foreground.
- assets/creek-rain.png / .webp：Fresh rain-wet gravel in a shallow mountain creek, natural winding streaks of fresh pale silt between glossy small rounded stones, transparent running water center foreground, soft warm sunlight emerging after rain.

浅滩继续使用原 creek-light 素材。手记缩略图使用 assets/creek-atlas.png 生成的 assets/creek-thumbnails.webp：2 列×3 行的六种溪岸摄影图集，顺序浅滩、石缝、河弯、石窝、苔岸、雨后；无文字、边框、工具和人物，温暖自然光，中央为浅水与可触及沉积物。该图集不再用作全屏背景，避免放大变软。

### 标本

保存：assets/specimens.png、assets/specimens.webp，1536×1024，6 列×3 行，18 格。透明通道实际范围 0–254；背景角落 alpha=0，非绘制棋盘格。

生成提示：Create a single production game sprite sheet with a genuinely transparent alpha background. EXACTLY 18 separate photorealistic macro mineral specimens, arranged evenly in 6 columns and 3 rows, no labels, no text, no borders or divider lines, no hands, no objects touching each other. Each specimen occupies center 70 percent of its equally sized square cell, photographed from directly above with soft warm light upper left, sharp microscopic texture, natural irregularity, subtle contact shadow only. The sheet should be 1536x1024 landscape. Order left to right top to bottom: row1 six native gold specimens: 1 a tiny irregular cluster of fine gold sand grains, 2 rounded weathered metallic gold nugget, 3 very thin flat irregular gold flake, 4 elongated narrow gold nugget, 5 branched twig-shaped gold nugget, 6 porous pitted honeycomb gold nugget. Row2: 7 curved crescent-edge gold flake, 8 chunky rough gold nugget, 9 clear translucent quartz grain, 10 milky white quartz grain, 11 smoky gray translucent quartz grain, 12 pale pink quartz grain. Row3: 13 pale amethyst violet crystalline grain, 14 red-brown natural iron-rich pebble, 15 rounded green veined pebble, 16 small glossy nearly black mineral grain, 17 thin pale silvery golden translucent mica flake clearly distinct from opaque gold, 18 rounded gray pebble with pale horizontal stripes. Gold truly looks metallic and tactile with rich warm yellow highlights and darker brown crevices, no flat polygon shapes, no illustration, no cartoons, no plastic toy style. True transparent background, individual specimens separated with generous transparent margin.

最终编辑提示：Background extraction edit only. Remove EVERY pixel of the brown/gray gradient background and all background glow and shadow. Make the background actually transparent alpha, not a checkerboard painted into the image and not a solid or gradient background. Keep all 18 photorealistic mineral/gold specimens exactly as they are, keeping identical six columns / three rows layout, order, framing, colors, natural textures, size, and exact positions. Preserve clear quartz translucency appropriately. No text, no new objects. Output true transparent PNG sprite sheet.
