# 黄金切片基准美术生成 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为《家字失踪案》完成三类场景、三类角色及派生资源，接入生产 React UI，并完成独立资源检查、移动端页面二检与发布门禁。

**Architecture:** 位图只负责无文字场景和虚构角色，HTML/CSS 继续负责标题、证据签、关系线与落印；古文字、字书原文和印章文字不进入图像生成。每类先生成一个基准，独立检查通过后保存到稳定 asset ID 路径，再用 V2 预览完成 375 / 390 / 430 px 二检。

**Tech Stack:** built-in image generation、WebP/PNG、浏览器 Playwright 视觉检查、现有静态 HTML 预览。

**Spec:** `projects/03-dalisizian/ART-REQUEST.md`

## Global Constraints

- 只修改 `projects/03-dalisizian/**`；不修改根配置、锁文件、其他项目或 `docs/`。
- 位图生产范围为三类场景与三类角色母版；头像和占位只做机械派生。
- 古文字、字书原文、印章文字和事实性证据图禁止使用图像模型。
- 位图内禁止可读汉字、伪篆书、匾额、楹联、官阶徽记、武器、刑具、跨朝代服饰与水印。
- 场景先生成且无人物；人物使用真实透明背景并保持恰好两只手、一卷无字案牍。
- 不覆盖现有文件；使用 V2/V3 语义文件名。
- 不执行 Git commit、push 或项目外写入。

---

### Task 1: 虚构字案房背景基准

**Files:**
- Create: `public/assets/scenes/official-records-room/records-room-v2.webp`
- Modify: `ART-REQUEST.md`

**Interfaces:**
- Consumes: `research/official-records-room-dossier.md`、`ART-REQUEST.md` 的提示词 01。
- Produces: 16:10 无人物场景资源 `asset-scene-home-archive`，供对话、调查台和证物页裁切。

- [x] **Step 1: Verify the expected asset is absent**

Run:

```bash
test ! -e public/assets/scenes/official-records-room/records-room-v2.webp
```

Expected: exit 0，确认不会覆盖现有资源。

- [x] **Step 2: Generate one built-in baseline**

使用 `ART-REQUEST.md` 中“图像生成提示词 01”，保持 16:10、空房、无人物、无可读文字、中心／左右人物安全区和底部 32% UI 安全区。

- [x] **Step 3: Perform independent visual review**

检查：灰白抹墙、深木赭朱结构、低矮红褐案几、少量卷轴龛；拒绝明清高家具、日式障子、匾额、武器、刑具、人物和伪文字。

- [x] **Step 4: Save the approved output non-destructively**

把通过审核的生成结果保存为：

```text
public/assets/scenes/official-records-room/records-room-v2.webp
```

保留生成输出的原始格式母版，仅在项目内需要时导出 WebP；不得把项目引用留在默认生成目录。

- [x] **Step 5: Verify file properties**

Run:

```bash
file public/assets/scenes/official-records-room/records-room-v2.webp
identify public/assets/scenes/official-records-room/records-room-v2.webp
```

Expected: 可解码 WebP、16:10 横向比例、无 Alpha 依赖、无异常超大尺寸。

---

### Task 2: 沈砚透明角色母版

**Files:**
- Create: `public/assets/characters/shenyan/shenyan-master-v3.webp`
- Create: `public/assets/characters/shenyan/shenyan-avatar-v3.webp`
- Create: `public/assets/characters/shenyan/shenyan-placeholder-v3.webp`
- Modify: `ART-REQUEST.md`

**Interfaces:**
- Consumes: `research/tang-visual-anchor-dossier.md`、`research/shenyan-reference-dossier.md`、`ART-REQUEST.md` 的提示词 02。
- Produces: 沈砚透明母版、160×160 头像和 72×96 小占位。

- [x] **Step 1: Verify the expected assets are absent**

Run:

```bash
test ! -e public/assets/characters/shenyan/shenyan-master-v3.webp
test ! -e public/assets/characters/shenyan/shenyan-avatar-v3.webp
test ! -e public/assets/characters/shenyan/shenyan-placeholder-v3.webp
```

Expected: exit 0，确认不会覆盖已有版本。

- [x] **Step 2: Generate one transparent built-in baseline**

使用 `ART-REQUEST.md` 中“图像生成提示词 02”，要求真实透明背景、一个人物、恰好两只手、自然持一卷无字案牍、青绿交领宽袖袍和简化进贤冠式。

- [x] **Step 3: Perform independent visual review**

检查：冠式不日式化，交领与宽袖连贯；两只手、手指和案卷无融合；无可读文字、官阶徽记、武器、现代扣件、清／明／日式混搭；边缘无白边和烘焙棋盘格。

- [x] **Step 4: Save the approved master and verify alpha**

保存为：

```text
public/assets/characters/shenyan/shenyan-master-v3.webp
```

Run:

```bash
identify -format '%m %wx%h %[channels]\n' public/assets/characters/shenyan/shenyan-master-v3.webp
```

Expected: WebP、竖向半身构图、通道信息包含 Alpha。

- [x] **Step 5: Derive avatar and placeholder without regeneration**

从通过审核的母版裁切：

```text
public/assets/characters/shenyan/shenyan-avatar-v3.webp      160×160
public/assets/characters/shenyan/shenyan-placeholder-v3.webp 72×96
```

头像使用官署青纯色背景；小占位保持头肩和上胸轮廓。不得再次调用图像模型。

- [x] **Step 6: Verify all derivatives**

Run:

```bash
identify public/assets/characters/shenyan/shenyan-master-v3.webp \
  public/assets/characters/shenyan/shenyan-avatar-v3.webp \
  public/assets/characters/shenyan/shenyan-placeholder-v3.webp
```

Expected: 三个文件均可解码；派生尺寸分别精确为 160×160 和 72×96。

---

### Task 3: 页面二检与生产记录

**Files:**
- Modify: `design/preview-v2.html`
- Modify: `ART-REQUEST.md`

**Interfaces:**
- Consumes: Task 1 的字案房和 Task 2 的沈砚母版。
- Produces: 使用真实资源的 V2 预览和完整生成记录。

- [x] **Step 1: Add only stable asset references to the preview**

把对话页的场景与角色槽替换为项目内相对路径；为角色、场景分别保留 CSS fallback。调查台和证物页只复用场景的低对比裁片，不把背景纹理铺在字形证据正文下。

- [x] **Step 2: Verify 375 / 390 / 430 px**

逐宽度检查：

```text
document.documentElement.scrollWidth === window.innerWidth
所有图片 naturalWidth > 0
最小主操作触控高度 >= 48px
人物不遮挡姓名、对话、选项、证物、判词和来源
```

- [x] **Step 3: Verify fallback behavior**

阻断角色和场景请求后检查：纯场景牌／官署青渐变、姓名签和完整选项仍可使用；不出现浏览器破图图标。

- [x] **Step 4: Record final production metadata**

在 `ART-REQUEST.md` 追加每项的 assetId、路径、日期、内置生成模式、最终提示词、独立审核、三宽度二检、fallback、文件尺寸和最终状态。

- [x] **Step 5: Run project gates**

Run:

```bash
pnpm lint
pnpm test
pnpm build
```

Expected: lint 退出码 0；11 个测试文件、64 项测试通过；构建退出码 0。

---

### Task 4: 共用人物资源

**Files:**
- Create: `public/assets/characters/home-witness/*-v1.webp`
- Create: `public/assets/characters/record-clerk/*-v1.webp`
- Create: `research/home-witness-reference-dossier.md`
- Create: `research/record-clerk-reference-dossier.md`

- [x] 为坊间说书人与书吏分别建立身份、服饰、姿态和负面约束档案。
- [x] 各生成一张真实 Alpha 母版，独立检查人物数量、手部、服饰、道具、文字与边缘。
- [x] 从母版机械派生 160×160 头像和 72×96 占位，不重复生成。
- [x] 装入证词和证物状态，完成 375／390／430 px 二检及图片失败回退。

### Task 5: 问案堂与坊间场景

**Files:**
- Create: `public/assets/scenes/home-court/home-court-v1.webp`
- Create: `public/assets/scenes/home-street/home-street-v1.webp`
- Create: `research/home-court-reference-dossier.md`
- Create: `research/home-street-reference-dossier.md`

- [x] 先建立史料边界明确的参考档案，不宣称真实大理寺或长安街道复原。
- [x] 分别生成空置日间问案堂与白天里坊街角，拒绝人物、牌匾、伪文字与影视夜市场景。
- [x] 输出 1600×1000 WebP，验证解码、体积和 16:10 安全区。
- [x] 接入生产 UI 和 V2 预览，完成三宽页面二检与全资源阻断回退。

### Task 6: 生产 React UI 与完整验收

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/App.css`
- Modify: `src/index.css`
- Create: `src/app/assets.ts`
- Create: `src/app/focus.ts`
- Modify: `src/content/content.json`

- [x] 将“活案牍 · 手作推理台”接入真实八案引擎，不在 JSX 写死正式案件答案。
- [x] 接入场景／人物资源映射、语义 fallback、证据详情、沈砚帮助、判词翻译和结案落印。
- [x] 实现选择锁、防双击、进度反馈、焦点陷阱、Escape 关闭与焦点归还。
- [x] 实现 `prefers-reduced-motion`，并保证动画关闭后语义完整。
- [x] 通过 375／390／430 px、错误链回卷、完整结案、坏图回退和键盘焦点浏览器回归。
- [x] 运行 `pnpm lint && pnpm test && pnpm build`；最终通过数以本次交付门禁输出为准。

### Task 7: 断案图鉴与分享卡闭环

**Files:**
- Create: `src/app/collection.ts`
- Create: `src/app/collection.test.ts`
- Create: `qa/collection-browser.mjs`
- Modify: `src/App.tsx`
- Modify: `src/App.css`

- [x] 八案固定图鉴槽位；未结案不显示分数、判词或结局信息。
- [x] 已结案读取最高分与详细判词；旧存档缺少明细时使用正式结论安全恢复。
- [x] 落印后自动收入图鉴并弹出 3:4 战绩卡，记录初判、终判、评分、线索与证物数量。
- [x] 卡片复用正式场景裁片，提供纯净截图模式和打印样式，不生成或持久化 Blob／Base64。
- [x] 通过 375／390／430、刷新恢复、完整重审结案、跨 UTC 日期和浏览器控制台回归。
