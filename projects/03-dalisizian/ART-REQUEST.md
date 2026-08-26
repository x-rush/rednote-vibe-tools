# 大理寺字案录 · 美术资源申请与生产清单

状态：`GOLDEN SLICE ASSETS GENERATED / PRODUCTION UI QA PASSED`  
范围：`case-home-roof-pig / 家字失踪案` 黄金切片与八案共用场景／角色基线  
美术基线：`活案牍 · 手作推理台`  
叙事时代：盛唐视觉锚点下的虚构字案机构；不宣称真实大理寺复原

## 1. 生产规则

1. 先通过 UI 中的真实槽位验证，再生成位图。
2. 每类先做 1 张基准图；基准装回 375 / 390 / 430 px 通过后再做差分。
3. 人物、场景和证物分开生成、分开审核，避免服饰、手部和空间问题互相遮蔽。
4. 位图内禁止可读汉字、伪篆书、官署匾额、楹联、印章文字和来源编号；这些由 HTML／人工 SVG 叠加。
5. 古文字永久禁用图像模型，只允许权威来源人工描摹 SVG 或合法原图。
6. 不生成普通按钮、线绳、批注、卷边、放大镜、印章和图标；这些使用 CSS／人工 SVG。
7. 所有资源必须有文字 fallback；缺图不能阻断结案。
8. 生成文件不覆盖现有资源，使用语义文件名和版本号。

## 2. 共用风格基线

`projectStyle`：盛唐壁画与俑的克制色彩抽象成当代编辑插画；轮廓清楚，材质温润，非写实影视剧照，非二次元手游立绘。  
`pageRole`：让人物、空间和证物帮助玩家判断当前任务，不抢标题、正文、选项与证据标签。  
`interactionMoment`：接案、对话、验物、归档。  
`emotionalGoal`：聪明、可信、好奇、轻微幽默，避免压迫和刑狱恐惧。  
`seriesBaseline`：官署青、暖纸、赭朱、灰白、少量石青；柔和侧光；轻微纸本颗粒；边缘干净。  
`avoid`：清宫朝珠／马蹄袖、明代补子／飞鱼服、日式狩衣／阴阳师帽、武侠护腕、铠甲、刀剑主视觉、龙纹、夸张金饰、现代办公物、明清高家具、日式障子、灯笼海、血迹、刑具、伪文字、水印。

## 3. 第一批生产顺序

| 序号 | 资源 ID | 文件建议 | 类型 | 状态 | 原因 |
|---:|---|---|---|---|---|
| 01 | `asset-scene-home-archive` | `public/assets/scenes/official-records-room/records-room-v2.webp` | 场景 | `APPROVED` | 已生成无人物基准并通过三档页面二检 |
| 02 | `asset-character-temple-official` / 沈砚复用位 | `public/assets/characters/shenyan/shenyan-master-v3.webp` | 角色 | `APPROVED` | 真实 Alpha 母版已通过独立检查与页面二检 |
| 03 | 沈砚头像 | `public/assets/characters/shenyan/shenyan-avatar-v3.webp` | 派生 | `APPROVED` | 已从通过审核的母版裁切，不单独生成 |
| 04 | 沈砚小占位 | `public/assets/characters/shenyan/shenyan-placeholder-v3.webp` | 派生 | `APPROVED` | 已从通过审核的母版派生 |
| 05 | `asset-character-home-witness` | `public/assets/characters/home-witness/home-witness-base-v1.webp` | 角色 | `APPROVED` | 参考档案、透明母版、派生与三档页面二检均已完成 |
| 06 | `asset-character-record-clerk` | `public/assets/characters/record-clerk/record-clerk-base-v1.webp` | 角色 | `APPROVED` | 八案共用书吏已完成参考、生成、派生与状态 07 二检 |
| 07 | `asset-scene-home-court` | `public/assets/scenes/home-court/home-court-v1.webp` | 场景 | `APPROVED` | 虚构日间受理空间已生成，通过独立检查、三宽二检与生产 UI 回退测试 |
| 08 | `asset-scene-home-street` | `public/assets/scenes/home-street/home-street-v1.webp` | 场景 | `APPROVED` | 白天里坊街角已生成，通过独立检查、三宽二检与生产 UI 回退测试 |
| 09 | 家案封面 | 无独立位图 | HTML/CSS 合成 | `NO-GENERATION` | 使用案房裁片、现代“家”字、证据签组成 |
| 10 | 4 张家案证据 | 见第 6 节 | 资料／图形 | `NO-AI` | 字形与字书事实资源必须人工核验 |

01、02、05、06、07、08 已按“参考档案 → 单张基准 → 独立检查 → 页面二检”完成生产；03、04 及人物头像／占位均由已通过母版机械派生。09、10 继续禁用图像模型，并保留语义 fallback。

## 4. 场景资源规格

### 4.1 虚构字案房基准

- 资源 ID：`asset-scene-home-archive`
- 用途：开场对话、调查台弱背景、证物页场景条。
- 输出：主母版 16:10；建议最终 1600×1000 WebP。
- 构图：无人物；中间与左右人物站位为低对比安全区；底部 32% 不放关键物件。
- 空间：灰白抹墙、克制深木与赭朱结构、自然侧窗光；明亮可查案。
- 家具：一张低矮、结构简单的红褐案几；少量浅木卷轴龛。
- 卷轴：束状卷轴、青／朱／黄褐色带、空白签形；没有可读文字。
- 可艺术化：提高窗光与案几轮廓以适应移动端；不宣称复原。
- fallback：官署青到深墨绿的 CSS 渐变＋“字书档案库”场景牌。
- 预算：WebP ≤ 180KB；首屏使用时优先 ≤ 120KB。

#### 图像生成提示词 01

```text
Use case: stylized-concept
Asset type: mobile narrative game environment background
Primary request: a bright fictional records room for a Chinese character-investigation office, using a High Tang visual anchor without claiming historical reconstruction
Scene/backdrop: gray-white plaster walls, restrained dark timber with small cinnabar accents, soft natural side-window light, shallow wooden scroll niches
Subject: one low, simple reddish-brown writing table and a few bundled scrolls with muted teal, cinnabar and ochre ties; all labels blank
Style/medium: polished contemporary editorial game illustration informed by Tang mural color and low furniture proportions; clean silhouettes; subtle paper texture; not photorealistic cinema
Composition/framing: 16:10 landscape; straight-on eye-level view; low-contrast safe zones at center, left and right for character overlays; bottom 32 percent free of important details for dialogue UI
Lighting/mood: bright, calm, intelligent, trustworthy; soft side daylight
Color palette: gray-white, official teal green, warm paper, reddish brown, restrained mineral blue
Constraints: empty room; no people; no readable text; no Chinese characters; no plaques; no couplets; no seals; no weapons; no torture devices; no prominent religious symbols; no logos; no watermark
Avoid: Ming/Qing tall desks, armchairs, round-backed chairs, display cabinets, rosewood luxury furniture, Japanese shoji, lantern sea, palace throne room, dark dungeon, fantasy magic, modern office objects
```

### 4.2 问案堂（已生产）

- dossier：`research/home-court-reference-dossier.md`；只抽取官署院落、堂屋、壁画色彩与家具过渡关系，不宣称大理寺室内复原。
- 预期输出：16:10，1600×1000 WebP，人物安全区与底部 UI 安全区同上。
- fallback：复用字案房的更空裁切＋“问案堂”文字场景牌，不生成错误时代场景凑数。

### 4.3 坊间传言处（已生产）

- dossier：`research/home-street-reference-dossier.md`；只抽取里坊道路、夯墙院落、排水与作业区关系，明确不把影视长安夜市当史料。
- 预期输出：16:10，1600×1000 WebP，白天或薄暮但保持文字可读。
- fallback：纸面证词页＋说书人姓名签。

## 5. 角色资源规格

### 5.1 沈砚母版

- 资源 ID：首案先复用 `asset-character-temple-official` 的引导位；正式数据接入时应单独映射沈砚 asset ID。
- 身份：虚构大理寺录事；年轻、可靠、略带干幽默；不对应真实人物、品级或法定服色。
- 输出：透明背景主母版，建议 1200×1600 PNG；审核后导出 900–1200px 高透明 WebP。
- 构图：膝上半身，正面略三分之二；底部允许被对话框裁切；左右保留约 8% 空间。
- 姿态：恰好两只手，自然持一卷素色无字案牍；不执兵器。
- 服饰：依据唐俑抽象的简化进贤冠式、青绿色交领宽袖袍、暖纸色内层；不标官阶。
- 表情：母版中性专注。只有母版通过页面二检后，才考虑“轻微质疑”和“落判释然”两种面部差分；服装、姿势和案卷保持一致。
- fallback：姓名签＋身份＋纯场景；不使用 emoji 或错误服装占位。
- 预算：主透明 WebP ≤ 180KB；头像 ≤ 20KB；小占位 ≤ 10KB。

#### 图像生成提示词 02

```text
Use case: stylized-concept
Asset type: transparent mobile Galgame character master
Primary request: Shen Yan, a fictional young records clerk in a Chinese character-investigation office with a High Tang visual anchor; reliable, observant, subtly dry-humored
Subject: one adult Chinese man, knee-up half-body, front-facing three-quarter pose, exactly two visible hands naturally holding one plain blank document scroll
Style/medium: polished contemporary editorial character illustration informed by Tang official figurines; clean ink-like contour accents, restrained painterly color, readable mobile silhouette; not anime gacha art and not photorealistic film still
Composition/framing: portrait character cutout; head and crown fully visible; bottom may be cropped by a dialogue box; generous clean padding; centered balance suitable for left or right placement
Lighting/mood: soft neutral side light; intelligent, calm, approachable
Color palette: official teal-green outer robe, warm-paper inner layer, muted reddish-brown details, restrained mineral color
Materials/textures: coherent crossed collar and broad sleeves; simplified jinxian-crown-inspired silhouette; plain cloth and paper; no rank badges
Constraints: genuinely transparent background with clean alpha; exactly one person; exactly two hands; one blank scroll; no readable text; no insignia; no weapon; no logos; no watermark
Avoid: Qing court beads, horse-hoof sleeves, Ming rank badges, flying-fish robe, Japanese kariginu or onmyoji hat, samurai elements, wuxia bracers, armor, sword, dragon motif, gold jewelry, modern buttons, police styling, extra fingers, fused fingers, duplicated objects, checkerboard baked into pixels
```

### 5.2 沈砚派生

| 文件 | 输出 | 裁切 |
|---|---:|---|
| `shenyan-avatar-v3.webp` | 160×160 | 头肩，背景使用官署青纯色；不重新生成 |
| `shenyan-placeholder-v3.webp` | 72×96 | 头肩与上胸，保持轮廓；不重新生成 |

派生前检查 PNG 是否真实含 Alpha；棋盘格烘焙图直接拒绝。

### 5.3 坊间说书人（门禁已开放）

- 叙事职责：自信陈述流行故事，被追问后补充来源而非充当反派。
- dossier：`research/home-witness-reference-dossier.md`；以故宫博物院唐男俑／戏弄俑和国家社科基金“说话”流变研究冻结身份边界。
- 不得复用沈砚换色；不得给折扇题字或伪书法。
- fallback：姓名签“坊间说书人”＋证词纸页。

已输出：透明母版、160×160 头像与 72×96 小占位。状态 06 使用头像，母版保留给正式 Galgame 叙事层。

### 5.4 书吏（门禁已开放）

- 叙事职责：呈示分期字形和字书材料，标注事实边界。
- dossier：`research/record-clerk-reference-dossier.md`；以唐代彩绘文吏俑、故宫陶文吏俑和书令史研究冻结职责与视觉边界。
- fallback：档案库场景＋身份名牌。

已输出：透明母版、160×160 头像与 72×96 小占位。状态 07 使用头像和“书吏呈卷”资料条；母版保留给八案共用对话层。

## 6. 证物与字形

| 资源 ID | 表现 | 生成方式 | 状态 |
|---|---|---|---|
| `asset-evidence-home-early-form` | 甲207／合20268 等分期字形 | 权威来源人工 SVG | `NO-AI / SECOND REVIEW PENDING` |
| `asset-evidence-home-shuowen` | 《说文》条目定位与人工排版 | HTML＋人工校对文字 | `NO-AI` |
| `asset-evidence-home-phonetic` | 构件功能对照 | HTML／人工 SVG 图解 | `NO-AI` |
| `asset-evidence-home-social-leap` | “材料能证／不能证”边界卡 | HTML/CSS | `NO-GENERATION` |

### 古文字固定门禁

- 不让图像模型画“家”的甲骨文、金文或小篆。
- 不用现代字体模拟古文字。
- 每个 SVG 携带 `sourceId`、著录号、数据库地址、描摹者、审核者和日期。
- 页面区分“数据库渲染”“甲骨原片／拓影”“产品人工描摹”。
- 甲207 当前仅允许标为“产品人工描摹候选，第二人审校待完成”。
- 甲2307、说文小篆在同等级来源与人工描摹完成前显示线框占位。

## 7. 案件封面

封面不单独生成重插画，使用以下层合成：

1. 字案房背景的低对比裁片；
2. HTML 渲染的现代争议字“家”；
3. 无文字纸签、案号和来源状态；
4. 一条朱批关系线；
5. 页面实时传闻文案。

这样可以复用到 8 案，避免模型在封面写错字，也能让内容更新无需重做图片。

## 8. 系统特效与 UI 图形

| 项目 | 技术 | 说明 |
|---|---|---|
| 卷页、纸张纤维 | CSS | 低对比，正文区不铺重纹理 |
| 证物翻面 | CSS | 二维替换，不做 3D 卡牌 |
| 关系线与节点 | SVG/CSS | 语义颜色＋文字标签 |
| 放大热点 | SVG/CSS | 内容定义坐标，不做图像识别 |
| 朱批短线 | SVG/CSS | 提交反馈，160ms |
| 结案印 | 人工 SVG＋CSS | 印中文字人工校验，不用生成模型 |
| 来源、回卷、收卷图标 | 人工 SVG | 1.5–2px 单色线框 |

## 9. 独立资源检查

### 场景

- 透视与家具尺度一致。
- 无人物、可读文字、匾额、武器、刑具和跨朝代陈设。
- 中央／左右人物安全区和底部 UI 安全区有效。
- 16:10 裁切后重要物件不贴边。

### 人物

- 冠式不变成日式高帽；交领与宽袖结构连贯。
- 恰好两只手；手、卷轴和袖口不融合。
- 无伪文字、徽记和现代扣件。
- Alpha 真实透明，无白边、脏边或烘焙棋盘格。

## 10. 页面二检

每个通过独立检查的资源必须装回：

- 375×812、390×844、430×932。
- 对话、调查台、证物页至少三种用途。
- 检查人物不遮选项、证物、判词与来源。
- 检查场景对比度不吞没人物和文字。
- 检查图片失败 fallback 和 `prefers-reduced-motion`。
- 检查图片解码尺寸、WebP 体积、首屏请求和懒加载策略。

## 11. 记录模板

```text
assetId:
file:
date:
tool:
mode:
finalPrompt:
referenceDossier:
independentReview:
pageReview375:
pageReview390:
pageReview430:
fallback:
status:
notes:
```

## 12. 2026-08-26 首批生产记录

生成方式：Codex 内置图像生成；每类先做一张基准。古文字、字书内容、印章和 UI 图形未调用图像模型。

### 12.1 `asset-scene-home-archive`

```text
assetId: asset-scene-home-archive
file: public/assets/scenes/official-records-room/records-room-v2.webp
date: 2026-08-26
tool: built-in image generation
mode: stylized-concept baseline + precise-object-edit revision
referenceDossier: research/official-records-room-dossier.md
independentReview: PASS；无人物、可读文字、匾额、武器或刑具；高立柜已改为浅壁龛，卷轴密度已降低
pageReview375: PASS；无横向溢出，场景不吞没人物与对话
pageReview390: PASS；无横向溢出，场景安全区有效
pageReview430: PASS；无横向溢出，调查台与证物场景条对比度合格
fallback: 官署青深色渐变与 HTML 场景信息
status: APPROVED
notes: 1600×1000 WebP，49,720 bytes；由通过审核的 3:2 生成母版做无内容补画的 16:10 中央裁切
```

最终修订提示词：

```text
Use case: precise-object-edit
Asset type: mobile narrative game environment background
Primary request: revise only the storage furniture and object density in the current fictional High-Tang-anchored records-room illustration
Changes: remove the three tall floor-standing bookcase/display-cabinet structures and the extra side desk at the far left; replace them with two or three shallow, simple recessed wooden wall niches that read as restrained game-world scroll storage rather than modern furniture; reduce the total scroll bundles by about half
Keep unchanged: 16:10 straight-on composition, empty room, gray-white plaster walls, restrained dark timber and cinnabar accents, turquoise lower wall band, soft natural side-window light, one low simple reddish-brown central table, bright calm mood, clean editorial illustration style, center/left/right character-overlay safe zones, bottom 32 percent free for dialogue UI
Constraints: no people; no readable text; no Chinese characters; no plaques; no couplets; no seals; no weapons; no torture devices; no logos; no watermark
Avoid: tall cabinets, modern shelving, Ming/Qing luxury furniture, Japanese shoji, palace throne-room styling, fantasy elements
```

### 12.2 沈砚母版与派生

```text
assetId: asset-character-temple-official / shenyan-baseline
file: public/assets/characters/shenyan/shenyan-master-v3.webp
date: 2026-08-26
tool: built-in image generation
mode: stylized-concept, transparent character master
referenceDossier: research/tang-visual-anchor-dossier.md + research/shenyan-reference-dossier.md
independentReview: PASS；单人、两手、一卷无字案牍、交领宽袖连贯、无武器与可读文字、真实 Alpha
pageReview375: PASS；人物位于对话框后层，不遮姓名、台词与三个选项
pageReview390: PASS；人物与场景明暗分离良好
pageReview430: PASS；头像和母版均可解码，信息层级稳定
fallback: 姓名签、身份与纯场景；加载失败时隐藏 img，不显示破图图标
status: APPROVED
notes: master 900×1350 transparent WebP，155,762 bytes；avatar 160×160 opaque WebP，3,262 bytes；placeholder 72×96 transparent WebP，2,902 bytes
```

最终采用提示词：

```text
Use case: stylized-concept
Asset type: transparent mobile Galgame character master
Primary request: Shen Yan, a fictional young records clerk in a Chinese character-investigation office with a High Tang visual anchor; reliable, observant, subtly dry-humored
Subject: one adult Chinese man, knee-up half-body, front-facing three-quarter pose, exactly two visible hands naturally holding one plain blank document scroll
Style/medium: polished contemporary editorial character illustration informed by Tang official figurines; clean ink-like contour accents, restrained painterly color, readable mobile silhouette; not anime gacha art and not photorealistic film still
Composition/framing: portrait character cutout; head and crown fully visible; bottom may be cropped by a dialogue box; generous clean padding; centered balance suitable for left or right placement
Lighting/mood: soft neutral side light; intelligent, calm, approachable
Color palette: official teal-green outer robe, warm-paper inner layer, muted reddish-brown details, restrained mineral color
Materials/textures: coherent crossed collar and broad sleeves; simplified jinxian-crown-inspired silhouette; plain cloth and paper; no rank badges
Constraints: genuinely transparent background with clean alpha; exactly one person; exactly two hands; one blank scroll; no readable text; no insignia; no weapon; no logos; no watermark
Avoid: Qing court beads, horse-hoof sleeves, Ming rank badges, flying-fish robe, Japanese kariginu or onmyoji hat, samurai elements, wuxia bracers, armor, sword, dragon motif, gold jewelry, modern buttons, police styling, extra fingers, fused fingers, duplicated objects, checkerboard baked into pixels
```

两次“减少腰间配件”的修订输出被拒绝：输出把透明棋盘格烘焙进 RGB 像素，未进入项目。头像和小占位均从通过审核的真实 Alpha 母版机械裁切，没有再次生成。

### 12.3 `asset-character-home-witness`

```text
assetId: asset-character-home-witness
file: public/assets/characters/home-witness/home-witness-base-v1.webp
date: 2026-08-26
tool: built-in image generation
mode: stylized-concept, transparent character master
finalPrompt: research/home-witness-reference-dossier.md §5.1
referenceDossier: research/home-witness-reference-dossier.md
independentReview: PASS；圆领外袍、软幞头、单人、两手、无道具、无文字、真实 Alpha；与沈砚轮廓和色温有明显区分
pageReview375: PASS；人物资料、证词、三条追问和沈砚方法提示均可读
pageReview390: PASS；追问反馈不造成横向溢出
pageReview430: PASS；角色头像与信息层级稳定
fallback: 姓名签“坊间说书人”；隐藏失败 img，证词与追问保持可用
status: APPROVED
notes: master 900×1350 transparent WebP，178,176 bytes；avatar 160×160 opaque WebP，3,834 bytes；placeholder 72×96 transparent WebP，3,594 bytes
```

首张真实透明基准因交领宽袖与普通圆领服饰门禁不一致而未采用；随后一次精确编辑虽改正衣领，却把棋盘格烘焙进 RGB 像素，也被拒绝。最终采用重新生成的圆领结构优先透明基准，派生图均由其机械裁切。

### 12.4 `asset-character-record-clerk`

```text
assetId: asset-character-record-clerk
file: public/assets/characters/record-clerk/record-clerk-base-v1.webp
date: 2026-08-26
tool: built-in image generation
mode: stylized-concept, transparent character master
finalPrompt: research/record-clerk-reference-dossier.md §5
referenceDossier: research/record-clerk-reference-dossier.md
independentReview: PASS；圆领灰蓝常服、低软幞头、成熟面貌、单人、两手、唯一无字纸页叠、真实 Alpha；没有现代夹具或伪文字
pageReview375: PASS；资料条、证物正文和底部操作完整，无横向溢出
pageReview390: PASS；呈卷反馈不遮来源性质与证物槽
pageReview430: PASS；头像、场景条和证物层级稳定
fallback: 姓名签“书吏／校勘”；隐藏失败 img，证物说明和两个操作保持可用
status: APPROVED
notes: master 900×1350 transparent WebP，103,936 bytes；avatar 160×160 opaque WebP，2,910 bytes；placeholder 72×96 transparent WebP，2,560 bytes
```

本资产首张基准即通过独立检查，没有调用编辑模型。头像与小占位均由通过审核的真实 Alpha 母版机械裁切。

### 12.5 `asset-scene-home-court`

```text
assetId: asset-scene-home-court
file: public/assets/scenes/home-court/home-court-v1.webp
date: 2026-08-26
tool: built-in image generation
mode: stylized-concept, empty environment baseline
finalPrompt: research/home-court-reference-dossier.md §4
referenceDossier: research/home-court-reference-dossier.md
independentReview: PASS；空置日间受理空间；低案、柱网与院落关系清楚；无人物、牌匾、可读文字、高台宝座、刑具或武器
pageReview375: PASS；场景与人物 fallback 均无破图和横向溢出，主操作高度不小于 48px
pageReview390: PASS；问案背景、沈砚立绘和初判纸层层级稳定
pageReview430: PASS；安全区有效，文字和选项不受背景干扰
fallback: 官署青渐变、HTML 场景牌与人物姓名签；隐藏失败 img
status: APPROVED
notes: 1600×1000 WebP，84,306 bytes；生产 React UI 与 V2 预览均已接入
```

### 12.6 `asset-scene-home-street`

```text
assetId: asset-scene-home-street
file: public/assets/scenes/home-street/home-street-v1.webp
date: 2026-08-26
tool: built-in image generation
mode: stylized-concept, empty environment baseline
finalPrompt: research/home-street-reference-dossier.md §4
referenceDossier: research/home-street-reference-dossier.md
independentReview: PASS；白天里坊道路、夯土墙、院门、排水沟与克制作业棚成立；无人物、招牌、伪文字、夜市灯海或拥挤商街
pageReview375: PASS；证词、角色与选择签完整，0 横向溢出
pageReview390: PASS；场景安全区与说书人层级稳定
pageReview430: PASS；背景扩展不拉长正文，主操作保持可达
fallback: 纸面证词页、HTML 场景牌与姓名签；隐藏失败 img
status: APPROVED
notes: 1600×1000 WebP，149,016 bytes；以 WebP 质量 78 做无内容变化的机械压缩，生产 React UI 与 V2 预览均已接入
```

### 12.7 生产 UI 资源回归

- 稳定 asset ID 映射集中在 `src/app/assets.ts`；缺失角色不冒用其他人物，而是回退姓名签。
- 三幅场景按案卷节点语义复用；业务文案、节点和答案仍只来自 `src/content/content.json`。
- 375／390／430 CSS px 均满足 `document.scrollWidth === innerWidth`、可见破图数为 0、主操作高度不小于 48px。
- 阻断全部场景与人物请求后，案件仍能依靠文字 fallback 继续；`prefers-reduced-motion` 下不依赖动画表达状态。
