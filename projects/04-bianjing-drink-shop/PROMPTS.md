# 汴京饮子铺 · 美术与声音生成台账

状态：运行时场景、饮子与七类剧情角色已完成；声音仍受来源／许可门禁约束。

## 生成顺序

1. 北宋店铺、招幌、桌椅、饮食器皿、市井身份服饰实际参考包；
2. 一张可分层白日主店铺场景，先验证 390px 完整日循环；
3. 两种有配方与盛装依据的饮子、三类身份顾客；
4. 晴／雨／夜覆盖层，不为每个时段重画整店；
5. 扩展至 6–8 饮子、12–16 顾客；
6. 8 个结局先用场景＋角色＋排版合成，只有构图确实不足才新增独立结局图。

## 严谨性要求

- 不混入现代奶茶杯、吸管、玻璃高脚杯、清代旗装或明清酒楼门面；
- 食物可以美化，但器皿、原料与盛装方式必须能回到参考证据；
- 背景不承载经营数字，人物立绘不能遮挡选项和底部主动作；
- 80 个事件复用角色、场景和类别符号，不制造 80 张风格漂移插画；
- 音效必须记录来源、许可证、剪辑与署名要求；没有合适授权时静音仍是完整体验。

## 2026-08-24 白日店铺与两款饮子基准

- 参考档案：`research/northern-song-shop-and-drink-dossier.md`；街铺依据故宫《清明上河图》，器皿依据国博北宋耀州窑碗，植物分别依据 iPlant／许可实图。
- 店铺 V1 因“水乡桥景、无依据悬灯、屋檐过度起翘、过度写实”被拒绝；V2 改为低矮敞棚式临街小铺，无灯笼、无桥河、无伪文字。
- 店铺 V2 导出 `1280×800` WebP，121,058 bytes；已装回封面、晨间、营业、事件和结局 5 个页面槽位。
- 紫苏熟水 V1 因模型自行添加无依据莲瓣式外壁纹样被拒绝；V2 使用素面青釉碗、两片核验叶形的紫苏叶和淡琥珀液体，不把“紫苏”画成葡萄紫。
- 姜蜜水使用同构素面碗、三片姜片与一小段真实姜根结构；不画蜂蜜罐、蜂巢、柠檬或现代玻璃杯。
- 两款缩略 WebP 分别约 4.4KB／3.1KB，已装入 43×48px 商品行；当前截图辨识清楚，文字、库存、售价和步进器未被遮挡。
- 旧预览商品名已纠正为经营契约的 `紫苏熟水／姜蜜水／青梅饮`；青梅饮目前标为游戏创意名，不声称固定北宋品名复原。

## 2026-08-24 首批顾客身份基准

- 参考：故宫博物院北宋张择端《清明上河图》官方总览、故宫博物院院刊 2012 年第 5 期刊页 136 的职业服饰图与说明，以及国立故宫博物院宋人《无款人物》士人实图；详见 `research/northern-song-shop-and-drink-dossier.md`。
- 商铺掌事 V1 拒绝：整体气质合格，但模型生成交领，与锁定的服务行业盘领长衫约束冲突。
- 商铺掌事 V2 通过：深色包巾、清楚圆形盘领、腰间收束、两只完整手和一枚无字木签；无伪字和跨朝代官帽。
- 士人 V1 拒绝：衣冠合格，但只露出一只手，结构不可完整核验。
- 士人 V2 通过：两手共同托住无字卷轴，宋画锚点下的头服、领缘与克制配色清楚；没有方巾、折扇和仙侠配饰。
- 市井劳动者 V1 拒绝：白色背搭与短打合格，但右手被画框切断，篮筐过度抢占移动端下方空间。
- 市井劳动者 V2 通过：两只完整手共同握住缩小后的竹篮柄，白色背搭、短打和头巾可辨；不做贫困猎奇化。
- 导出：三张均为 800×1000 RGB WebP，分别为 49,676／47,540／68,786 bytes；连续低对比背景避免伪透明棋盘格。
- 页面二检：已装入营业、事件和百日结局页面；375／390／430px 下五个实例全部在手机边界内、自然尺寸 800×1000、0 断图，document 宽度与视口一致。首次装回发现营业简讯按钮纵向溢出，调整简讯层高度、段落节奏和人物锚点后已修复，三宽复测按钮均完整位于手机框内。
- 发布口径：三张均标记为“依据宋画和服饰研究的创意重构”，不称历史人物复原；扩展到 12–16 名顾客前仍需逐身份检查，不允许换脸批量。

## 2026-08-24 雨天覆盖层

- 决策：不重新生成一张可能改变屋顶、柜台和招幌结构的雨天店铺，而是复用已通过考据的白日主场景，叠加代码原生 SVG 雨层。
- 资源：`public/assets/weather/rain-overlay.svg`，390×844 viewBox，1,412 bytes；包含冷色空气渐变、细斜雨和檐下水滴，不包含任何历史实物或文字。
- 装回：用于“雨棚下的旧客”事件背景；人物层位于雨层前方，表达客人在檐下，雨线不穿过人物脸部。
- 交互：固定 `pointer-events:none`，不会遮挡事件选项和确认按钮；无循环动画，低性能设备没有额外主线程成本。
- 二检：375／390／430px 下 SVG 全部加载，document 无横向溢出，人物和营业按钮原有验收保持通过。

## 2026-08-24 引导角色阿沅 V1

- 角色定位：北宋汴京饮子铺的年轻店伙计，不是老板替玩家作决定；负责解释今日饮子、客源街区、开门确认和经营反馈。
- 实际参考：`research/ayuan-reference-dossier.md`，使用《清明上河图》街铺与服务业人物、故宫院刊北宋职业服饰研究作为服装和身份边界。
- 生成约束：深色包巾、灰褐窄袖交领工作服、赭色腰布；右手恰好三枚无字竹筹，左手一只空的素面青白瓷碗；两手结构清楚；无现代围裙、清代跑堂帽、文字、铜钱面文或仙侠饰物。
- 单资源自检：人物手势、三枚竹筹、空碗口沿、包巾和工作服均清楚可信；自然半身构图允许腰以下被画面裁切，不要求破坏构图以展示脚部。
- 导出：`guide-master-v1.webp` 900×1200、65,458 bytes；`guide-avatar-v1.webp` 160×160、2,586 bytes；`guide-placeholder-v1.webp` 72×96、834 bytes。
- 装回二检：首次引导态使用完整立绘和头像；375／390／430px 均无横向溢出、破图或人物越框，主按钮最小高度 46px；位图不承载文案，加载失败仍保留角色名、身份、引导语和操作按钮。

## 2026-08-26 V2 运行时美术包

生成方式：Codex 内置 `image_gen`，未使用 CLI、外部 API 或运行时下载。最终输出统一由源 PNG 转为 WebP；人物与饮子保留 Alpha，位图不承载文字。

### 最终提示词公共约束

店铺使用 `historical-scene`：北宋汴京单层敞棚临街饮子小铺，低矮灰瓦、直木柱、浅柜台、素面陶瓷与竹木器；低饱和赭木、茶青、烟墨二维游戏插画；顶部 HUD、中心人物和底部经营台安全区；空白布幌；禁止文字、人物、Logo、水印、明清酒楼、宫殿飞檐、灯笼、水乡桥河、日式町屋与现代容器。

人物使用 `illustration-story`：柔和精绘二维游戏人物，透明背景，低饱和赭木／茶青／烟墨统一色系；双手和指定道具完整；禁止文字、Logo、水印、清代帽服、辫子、现代围裙、仙侠服饰与裁手。

饮子使用 `product-mockup`：单只素面青釉／青白釉／陶碗，略俯视三分之四角度，透明背景，43px 仍有清楚轮廓；禁止器皿纹字、玻璃、塑料、吸管、现代咖啡杯、柠檬、冰块、Logo 和水印。以下“差分”与这组公共约束合并即为最终提示词。

### 人物差分与验收

| 文件 | 最终提示词差分 | 尺寸／字节 | 验收 |
|---|---|---:|---|
| `guide/ayuan-master.webp` | 二十二至二十六岁店伙计；深灰黑软巾、烟灰窄袖交领工作服、暖米内层、赭棕腰布；右手恰好三枚无字竹筹，左手托空素面青白瓷碗 | 900×1200／135,490 | 三筹、双手、空碗和服装清楚 |
| `customers/market-worker.webp` | 浅色短打、白色背搭、劳动头巾；双手握小竹篮；端正而不贫困猎奇 | 800×1000／105,014 | 双手和小篮完整，身份可读 |
| `customers/merchant.webp` | 深色包巾、清楚盘领灰袍、腰间收束；一手一枚无字木签，另一手完整 | 800×1000／93,410 | 盘领和木签通过，无伪字 |
| `customers/scholar.webp` | 素色宽袍；低、软、圆弧贴头的宋式黑巾，无高冠方形和硬片；双手托无字卷轴 | 800×1000／67,386 | V1 因头服偏方帽被拒；V2 低软巾和双手通过 |

### 饮子差分与验收

| 文件 | 最终提示词差分 | 字节 |
|---|---|---:|
| `drinks/drink-green-plum.webp` | 淡黄绿至浅琥珀饮液、小青梅意象；明确游戏创意名 | 18,904 |
| `drinks/drink-ginger-honey.webp` | 淡琥珀液、三片姜片、一段真实姜根；无蜂蜜罐、蜂巢和柠檬 | 24,832 |
| `drinks/drink-perilla.webp` | 草褐淡琥珀液、两片粗锯齿紫苏叶；不画葡萄紫 | 38,696 |
| `drinks/drink-lychee-paste.webp` | 略稠浅蜜色、克制荔枝果肉与整果意象 | 38,710 |
| `drinks/drink-fragrant-bean.webp` | 米褐饮液、少量浅豆；无现代豆奶杯和拉花 | 17,996 |
| `drinks/drink-lotus.webp` | 淡茶青褐饮液、小莲房切面与莲子意象 | 28,428 |
| `drinks/drink-mint.webp` | 极浅茶青液、恰好两片薄荷叶；无莫吉托和气泡 | 27,338 |
| `drinks/drink-cinnamon.webp` | 暖琥珀褐液、短桂皮段、轻蒸汽；无咖啡和八角 | 41,276 |
| `drinks/drink-date.webp` | 清透红褐液、两枚枣意象、轻蒸汽 | 34,174 |
| `drinks/drink-signature.webp` | 自然琥珀茶青层次；紫苏叶、姜片、青梅三种既有原料；无奖杯金币和魔法发光 | 36,628 |

十张饮子均为 512×512 `yuva420p` WebP。主店铺 `scenes/shop-base-day.webp` 为 1280×800、140,730 bytes；15 张资源合计约 849KB。最终资源仅位于 `public/assets`，生成源仍保留在 Codex 默认生成目录，不作为项目运行依赖。

## 2026-08-26 V2 四类剧情角色补充

生成方式：Codex 内置 `image_gen` 首轮并行生成，四张首轮稿均通过，无拒绝变体；随后以本地 FFmpeg 统一转换为 800×1000、`yuva420p` 透明 WebP。源 PNG 不进入运行时包。

### 少年跑腿

```text
Use case: illustration-story
Asset type: transparent game character layer for a mobile historical shop-management UI
Primary request: a Northern Song-inspired adolescent neighborhood errand runner from Bianjing, clearly a teenager rather than a small child, approachable and alert, carrying one small tied plain paper parcel
Scene/backdrop: genuinely transparent background, isolated full character
Subject: plain short working clothes in warm gray and muted tea green, soft cloth head wrap, practical cloth shoes; both hands fully visible and anatomically clear, one supporting the parcel and one steadying its cord
Style/medium: softly refined 2D game illustration matching a low-saturation ochre wood, tea green, ink gray character set; historical creative reconstruction, not photoreal
Composition/framing: vertical 4:5 character cutout, head through feet visible with comfortable transparent margin, no cropped hands or role-defining parcel
Lighting/mood: soft warm daylight, modest, capable, never pitiable
Constraints: no text anywhere, no letters on parcel, no logo, no watermark; transparent alpha background
Avoid: modern apron, Qing garments, braid queue, fantasy robes or armor, official costume, poverty caricature, malformed fingers, extra limbs, cropped props
```

### 普通老客

```text
Use case: illustration-story
Asset type: transparent game character layer for a mobile historical shop-management UI
Primary request: an ordinary elderly regular customer of a Northern Song-inspired Bianjing drink shop, dignified and familiar rather than elite
Scene/backdrop: genuinely transparent background, isolated full character
Subject: restrained layered robe in muted warm gray and brown, low soft cloth head wrap; one hand clearly rests on a simple uncarved walking stick, the other hand visibly holds a small plain cloth coin purse with no markings; kind weathered face
Style/medium: softly refined 2D game illustration matching a low-saturation ochre wood, tea green, ink gray character set; historical creative reconstruction, not photoreal
Composition/framing: vertical 4:5 character cutout, head through feet visible with comfortable transparent margin; both hands, walking stick, and purse fully visible
Lighting/mood: soft warm daylight, calm, self-possessed, a long-time neighborhood customer
Constraints: no text, no seal, no logo, no watermark; transparent alpha background
Avoid: emperor or scholar status, luxury brocade, Qing garments, braid queue, fantasy costume, begging pose, poverty caricature, malformed hands, cropped walking stick
```

### 邻里女店主／住户

```text
Use case: illustration-story
Asset type: transparent game character layer for a mobile historical shop-management UI
Primary request: an adult neighborhood woman who runs or helps at a small street shop in Northern Song-inspired Bianjing, practical and recognizable as a capable resident
Scene/backdrop: genuinely transparent background, isolated full character
Subject: practical Song-inspired layered cross-collar clothing with narrow working sleeves, muted tea green outer layer, warm beige inner layer, rust-brown waist tie; simple neat hair wrap; both hands fully visible, holding a small unmarked folded account cloth and a plain reed basket
Style/medium: softly refined 2D game illustration matching a low-saturation ochre wood, tea green, ink gray character set; historical creative reconstruction, not photoreal
Composition/framing: vertical 4:5 character cutout, head through feet visible with comfortable transparent margin, both hands and basket fully inside frame
Lighting/mood: soft warm daylight, grounded, neighborly, competent, not idealized court beauty
Constraints: no text, no writing, no logo, no watermark; transparent alpha background
Avoid: modern apron, Qing garments, elaborate palace hair, fantasy hanfu, sexualized pose, servant stereotype, malformed fingers, extra limbs, cropped basket
```

### 公廨差遣跑腿

```text
Use case: illustration-story
Asset type: transparent game character layer for a mobile historical shop-management UI
Primary request: an adult public-office errand worker in Northern Song-inspired Bianjing, clearly a low-ranking messenger and not an imposing official
Scene/backdrop: genuinely transparent background, isolated full character
Subject: plain dark gray and muted brown duty clothing without rank insignia, simple soft cap, tied leggings and practical shoes; one hand holds a single blank unmarked wooden dispatch tally, the other hand fully visible at his side; brisk but non-threatening stance
Style/medium: softly refined 2D game illustration matching a low-saturation ochre wood, tea green, ink gray character set; historical creative reconstruction, not photoreal
Composition/framing: vertical 4:5 character cutout, head through feet visible with comfortable transparent margin; both hands and tally entirely visible
Lighting/mood: soft daylight, busy, matter-of-fact, ordinary civic labor
Constraints: no text, no pseudo-writing, no seal, no logo, no watermark; transparent alpha background
Avoid: weapons, armor, rank badge, authority spectacle, police intimidation, Qing garments, braid queue, fantasy costume, malformed hands, extra limbs, cropped tally
```

| 最终文件 | 尺寸／像素格式 | 字节 | 单资源验收 |
|---|---:|---:|---|
| `customers/youth.webp` | 800×1000／`yuva420p` | 76,366 | 少年身份、双手与无字纸包完整；无贫困猎奇 |
| `customers/elder.webp` | 800×1000／`yuva420p` | 113,734 | 手杖与无字钱袋完整；普通老客而非权贵／乞者 |
| `customers/neighbor-woman.webp` | 800×1000／`yuva420p` | 103,636 | 窄袖层衣、双手与竹篮完整；账布无可读文字 |
| `customers/runner.webp` | 800×1000／`yuva420p` | 90,888 | 木牒无字、无兵器品秩；动作利落但不具压迫感 |

四张均检查透明边缘、头脚与身份道具裁切、手指结构、时代错置、伪文字、Logo 和水印；首轮均通过，因此拒绝变体为 0。

## 品牌图标「一盏开门」（2026-08-27）

生成方式：Codex 内置 `image_gen`。以 01 正式图标作为视觉语言参考，以本项目招牌饮子作为题材参考；首轮通过，使用 FFmpeg Lanczos 缩放导出 512／128／64px PNG。

```text
Use case: logo-brand
Asset type: mobile game/app icon for “汴京饮子铺：开店一百天”
Primary request: create an original minimal emblem called “一盏开门”, unmistakably representing a Northern Song street drink shop
Subject: one low ochre-gold shop eave silhouette, one centered celadon drink bowl, one warm-ivory steam ribbon, and one muted cinnabar-red sun
Style/medium: bold vector-friendly flat shapes with subtle handmade paper texture; inherit only the restrained visual language of the reference icon, never its mountain-gate-river composition
Composition/framing: centered rounded-square dark ink-green field, generous negative space, 12% safe margin, readable at 64px
Constraints: no text, people, coins, mountains, gate, river, chopsticks, detailed tiles, watermark, photorealism or 3D
```
