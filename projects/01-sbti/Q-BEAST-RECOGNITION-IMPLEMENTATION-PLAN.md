# SHBTI Q版异兽认兽小札 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为 SHBTI 16 种结果各增加一张原典特征准确、Q版水墨统一、文案俏皮且可降级的“山海司认兽小札”。

**Architecture:** 认兽文案作为每个 `PersonalityType` 的必填内容留在 `src/content/content.json`；16 张本地 WebP 通过现有 `beastAssets` 映射提供；新组件 `BeastRecognitionCard` 负责展示、图片失败降级和一次性进入视口状态，由 `ResultPage` 在闻山帮助入口之后、卷一之前统一渲染。动效由 `IntersectionObserver` 触发一次并立即解除观察；不支持该 API 或开启减少动态时静态显示，不增加运行时依赖。

**Tech Stack:** React 19、TypeScript 6、Vite 8、Vitest 4、CSS、Canvas 无改动、本地 WebP、Codex imagegen、Playwright CLI、ffmpeg。

**Spec:** `projects/01-sbti/Q-BEAST-RECOGNITION-DESIGN.md`

## Global Constraints

- 只允许修改 `projects/01-sbti`；不得修改其他项目、根 `package.json`、`pnpm-workspace.yaml`、`pnpm-lock.yaml`、根 `docs/` 或 `prep/`。
- 不新增依赖；纯前端静态构建；无后端、运行时 CDN、必需外部 API、Service Worker 或设备 API。
- 业务文案只放 `src/content/content.json`；组件和资源映射不得硬编码 16 份文案。
- 不保存用户图片、Base64、音视频或 Blob；生成资源只作为项目静态文件交付。
- 保留当前未提交的分享卡逐兽焦点修改；不得覆盖、回退或重写它们。
- `research/ODL.jpg` 是用户提供的风格参考，只作研究材料；不得临摹其具体线稿、姿势、挂饰和构图。
- 现有正式异兽画像与正式 Canvas 分享卡不得改变。
- 不自动格式化，不自动提交，不推送；Git 提交等待用户单独授权。
- 最终必须执行 `pnpm lint && pnpm test && pnpm build`，并验证 375/390/430 CSS px。
- 顶部安全区使用 32px 非零模拟值复检；本功能不得引入未叠加安全区的 `sticky` / `fixed` 控件或锚点。
- 不更新发布 ZIP；资源和功能经用户验收后再单独执行项目打包流程。

## File Map

**Create**

- `src/components/BeastRecognitionCard.tsx`：认兽小札展示、图片失败降级和可访问结构。
- `src/components/BeastRecognitionCard.test.tsx`：正式图片、缺失映射降级和文字完整性测试。
- `public/assets/shbti/beasts/{luwu,ershu,dangkang,xingxing,yingzhao,dijiang,huan,fenghuang,xuangui,bifang,jingwei,lushu,kaimingshou,zhuyin,feifei,jiuweihu}/chibi-v1.webp`：16 张Q版发布资源。

**Modify**

- `src/content/types.ts`：增加 `RecognitionCardCopy`，并挂到 `PersonalityType.recognitionCard`。
- `src/content/validate.ts`：校验五个文案字段、单字中文印和完整对象。
- `src/content/content.json`：写入 16 份已冻结认兽文案、祝福、印和 alt。
- `src/content/content.test.ts`：锁定 16/16 内容完整性、唯一印记和验证失败场景。
- `src/ui/beastAssets.ts`：为每只异兽增加唯一 `chibiSrc`。
- `src/ui/beastAssets.test.ts`：保留全部既有映射与焦点测试，新增 16 张Q版资源映射断言。
- `src/components/ResultPage.tsx`：在闻山帮助入口与卷一之间插入小札。
- `src/components/ResultGuide.test.tsx`：验证小札内容、顺序和不泄露内部代码。
- `src/App.css`：卡片布局、Q版图形、朱砂印、失败态和视口入场动效。
- `PROMPTS.md`：记录最终生成提示词、输入参考、输出资源和逐兽验收结论。
- `VISUAL-QA.md`：记录 16 图、三宽、安全区、降级与正式结果页复检。

---

### Task 1: 冻结内容契约与 16 份认兽文案

**Files:**

- Modify: `src/content/types.ts`
- Modify: `src/content/validate.ts`
- Modify: `src/content/content.json`
- Modify: `src/content/content.test.ts`

**Interfaces:**

- Produces:

```ts
export type RecognitionCardCopy = {
  kicker: string
  hook: string
  blessing: string
  seal: string
  alt: string
}

export type PersonalityType = {
  // existing fields remain unchanged
  recognitionCard: RecognitionCardCopy
}
```

- [ ] **Step 1: 写内容完整性失败测试**

在 `src/content/content.test.ts` 的结果类型测试附近加入：

```ts
it('gives every beast one complete recognition card with a unique Chinese seal', () => {
  const seals: string[] = []
  for (const result of rawContent.content.resultTypes as unknown as Array<Record<string, unknown>>) {
    const creature = rawContent.content.creatures.find((item) => item.id === result.creatureId)!
    const card = result.recognitionCard as Record<string, unknown> | undefined
    expect(card).toMatchObject({
      kicker: expect.stringMatching(/^闻山认兽 · /u),
      hook: expect.stringMatching(/.{10,}/u),
      blessing: expect.stringMatching(/.{8,}/u),
      seal: expect.stringMatching(/^\p{Script=Han}$/u),
      alt: expect.stringContaining(creature.name),
    })
    seals.push(card!.seal as string)
  }
  expect(seals).toHaveLength(16)
  expect(new Set(seals).size).toBe(16)
})

it('rejects a result type without its recognition card', () => {
  const broken = structuredClone(rawContent) as unknown as {
    content: { resultTypes: Array<Record<string, unknown>> }
  }
  delete broken.content.resultTypes[0]!.recognitionCard

  expect(() => validateContent(broken)).toThrow(/resultTypes\[0\]\.recognitionCard/)
})
```

- [ ] **Step 2: 运行测试并确认 RED**

Run:

```bash
pnpm exec vitest run src/content/content.test.ts
```

Expected: FAIL；每个结果均缺少 `recognitionCard`，验证器尚未报告该路径。

- [ ] **Step 3: 增加类型与验证函数**

在 `src/content/types.ts` 增加上方 `RecognitionCardCopy`，并在 `PersonalityType` 中加入必填字段。

在 `src/content/validate.ts` 增加：

```ts
function recognitionCardAt(value: unknown, path: string, issues: string[]) {
  if (!isRecord(value)) {
    issues.push(`${path}: expected an object`)
    return
  }
  requiredStrings(value, ['kicker', 'hook', 'blessing', 'seal', 'alt'], path, issues)
  if (typeof value.seal === 'string' && !/^\p{Script=Han}$/u.test(value.seal)) {
    issues.push(`${path}.seal: expected exactly one Chinese character`)
  }
}
```

并在 `validateType` 的必填字符串检查之后调用：

```ts
recognitionCardAt(value.recognitionCard, `${path}.recognitionCard`, issues)
```

- [ ] **Step 4: 写入 16 份内容**

每个结果使用相同结构；当康示例：

```json
"recognitionCard": {
  "kicker": "闻山认兽 · 当康",
  "hook": "这可不是野猪，是报丰年的瑞兽当康。",
  "blessing": "古书说它“见则天下大穰”——你不是在等好运，你走到哪里，哪里就有好日子开张。",
  "seal": "丰",
  "alt": "Q版当康，豕形有牙，抬起前蹄，身旁有谷穗"
}
```

`kicker` 由固定前缀 `闻山认兽 · ` 与对应 `creature.name` 拼接。`hook`、`blessing`、`seal` 使用以下冻结文本：

| 代码 | hook | blessing | seal |
|---|---|---|---|
| RTLS | 九条尾巴却不是狐，这是巡守昆仑的陆吾。 | 你最让人安心的，不是事事有答案，而是再乱的局面，到你手里也会慢慢有章法。 | 守 |
| RTLM | 兔首、麋身、鼠形，还能借长尾飞——这位是耳鼠。 | 你的机灵从不只会救场——别人还在找路时，你已经把新办法带回来了。 | 捷 |
| RTES | 这可不是野猪，是报丰年的瑞兽当康。 | 古书说它“见则天下大穰”——你不是在等好运，你走到哪里，哪里就有好日子开张。 | 丰 |
| RTEM | 白耳善走的狌狌，最懂得边走边看。 | 你走到哪里都不冷场，连平常日子跟着你，也会自己长出新鲜感。 | 游 |
| RVLS | 人面、马身、虎纹、鸟翼，这位巡境者叫英招。 | 你眼里装得下全局，心里也放得下同行的人；被你照看过的路，总会更稳一点。 | 巡 |
| RVLM | 黄囊、六足、四翼，古书里的帝江本就无面目，却最懂歌舞。 | 你自带让人放松的节奏；有你在，连拘谨的人也会卸下包袱，跟着快乐起来。 | 舞 |
| RVES | 一只眼、三条尾，还能拟出百种声音——这位是讙。 | 再乱的声音到了你这里，也能被听懂、被说清；你开口时，别人愿意认真听。 | 声 |
| RVEM | 它不是普通彩鸟，一开口能歌、一振羽会舞——这才是凤凰。 | 你不用追着光走——你认真做自己时，光和同路的人都会循声而来。 | 和 |
| HTLS | 龟身、鸟首、虺尾，像山海拼图？它叫旋龟。 | 你看着稳，其实最会转弯；再难走的水路，到你这里也总能找到靠岸的办法。 | 稳 |
| HTLM | 别数了，毕方天生一足；它一出现，连火光都像提前递来的消息。 | 你总能比别人早看见那点火苗；有你在，许多麻烦还没烧起来，就已经有了转机。 | 明 |
| HTES | 嘴里叼的不是树枝收藏，是它的填海工程。 | 你最了不起的不是从不累，而是认准的事再小也肯继续；久而久之，海也会记住你的名字。 | 恒 |
| HTEM | 白首、虎纹、赤尾，像马又自带歌谣——这是鹿蜀。 | 你一出现，气氛就会变好；不是你刻意讨人喜欢，是你的真诚本来就让人想靠近。 | 谣 |
| HVLS | 九张面孔不是九个分身，是守在昆仑的开明兽。 | 你不是想得太多，是看得到别人没看见的那一面；门再多，你也认得出值得守的那扇。 | 门 |
| HVLM | 人面蛇身，一呼一息都是昼夜寒暑的传说。 | 你不是慢半拍，是看得比一时得失更远；别人慌着赶路时，你心里一直有灯。 | 晦 |
| HVES | 白尾有鬣，看着像猫？它是古书里的忘忧兽朏朏。 | 你很懂得把世界调成舒服的音量；和你待在一起，连紧绷的心都会悄悄松开。 | 安 |
| HVEM | 九条尾巴不是仙气特效，这是古书里聪慧又有锋芒的九尾狐。 | 你看得懂人心，也守得住自己；聪明有边界，温柔有锋芒，越了解越让人着迷。 | 界 |

`alt` 使用以下冻结文本：

| 代码 | alt |
|---|---|
| RTLS | Q版陆吾，人面虎身，九尾展开，一爪按住卷册 |
| RTLM | Q版耳鼠，兔首麋身，长尾卷起，腾空飞行 |
| RTES | Q版当康，豕形有牙，抬起前蹄，身旁有谷穗 |
| RTEM | Q版狌狌，白耳伏身，准备向前跃起 |
| RVLS | Q版英招，人面马身，虎纹清楚，双翼半展 |
| RVLM | Q版帝江，无面囊形身体，六足四翼正在起舞 |
| RVES | Q版讙，一只眼、三条尾，张口发出声纹 |
| RVEM | Q版凤凰，五彩羽翼舒展，昂首轻鸣 |
| HTLS | Q版旋龟，龟身鸟首，蛇尾卷起，伏在水纹石上 |
| HTLM | Q版毕方，单足站立，青羽赤纹，白喙旁有火星 |
| HTES | Q版精卫，振翅衔着细枝，下方散落小石 |
| HTEM | Q版鹿蜀，白首虎纹，赤色长尾扬起 |
| HVLS | Q版开明兽，虎身稳立，九张人面扇形排布 |
| HVLM | Q版烛阴，人面赤色蛇身，盘成昼夜弧线 |
| HVES | Q版朏朏，白尾有鬣，蓬松尾巴环抱身体 |
| HVEM | Q版九尾狐，九尾展开，回首露出一点犬齿 |

不得改变 `contentVersion`：本次为展示内容扩充，不应使用户已有答题存档失效。

- [ ] **Step 5: 运行测试并确认 GREEN**

Run:

```bash
pnpm exec vitest run src/content/content.test.ts
```

Expected: PASS；原有内容测试不减少，新增两项通过。

- [ ] **Step 6: 检查本任务差异**

Run:

```bash
git diff --check -- projects/01-sbti/src/content
git diff --stat -- projects/01-sbti/src/content
```

Expected: 无空白错误；只出现四个计划内文件。

---

### Task 2: 生成第一组Q版资源——陆吾、耳鼠、当康、狌狌

**Files:**

- Create: `public/assets/shbti/beasts/luwu/chibi-v1.webp`
- Create: `public/assets/shbti/beasts/ershu/chibi-v1.webp`
- Create: `public/assets/shbti/beasts/dangkang/chibi-v1.webp`
- Create: `public/assets/shbti/beasts/xingxing/chibi-v1.webp`
- Modify: `PROMPTS.md`

**Interfaces:**

- Produces: four square local WebP assets with transparent background and at least 12% visual safe margin.

- [ ] **Step 1: 按 imagegen 规范读取并检查参考图**

执行时先完整读取 imagegen skill。用 `view_image(detail="original")` 分别检查 `luwu/profile-v2-reference-verified.webp`、`ershu/profile-v2-reference-verified.webp`、`dangkang/profile-v1-reference-verified.webp`、`xingxing/profile-v2-reference-verified.webp` 四张正式画像（均位于 `public/assets/shbti/beasts` 对应目录），并检查 `research/ODL.jpg`。正式画像约束对应异兽的形貌与主色；ODL 只约束Q版比例与松弛水墨感。

- [ ] **Step 2: 使用统一骨架分别生成四张图**

每只单独调用 imagegen，不生成四宫格。统一提示词骨架：

```text
创作一幅原创Q版中国水墨设色异兽插画，用于 SHBTI「山海司认兽小札」。
参考图1只用于约束该异兽的原典解剖、数量和主色；参考图2只用于约束紧凑可爱的比例、松弛手绘墨线和亲切神态。不得临摹参考图2的姿势、挂饰、线稿或构图。

主体单独完整出现，1:1 正方形透明背景，四周至少12%安全边距，朝向右侧文字区。米白、墨灰、暖金为基底，小面积朱砂点睛。可爱但不幼儿化，不使用夸张大眼、腮红贴纸、三维玩具感或现代扁平矢量风。

在上述公共段落末尾，分别追加以下唯一一条形貌与动作约束：

- 陆吾：`关键形貌与动作：虎身九尾、人面虎爪；人面虎身端坐，九尾在身后展开如山司仪仗，一爪按住卷册。`
- 耳鼠：`关键形貌与动作：鼠形、兔首、麋身，以尾飞；腾空小跃，长尾在身后卷成飞行弧线，兔首朝前探路。`
- 当康：`关键形貌与动作：豕形有牙，自呼其名，与丰穰相联；圆润豕形，小獠牙清晰，抬起一只前蹄，身旁点缀谷穗。`
- 狌狌：`关键形貌与动作：形近禺、白耳，伏行人走；白耳醒目，伏身准备跃起，一手向前、长尾随动作扬起。`

不要文字、字母、数字、印章、水印、边框、卡片背景、现代物件；不要多余或缺失的头、腿、翼、尾；不要把异兽改成普通宠物。
```

输出临时 PNG：

- `/tmp/shbti-chibi-luwu-v1.png`
- `/tmp/shbti-chibi-ershu-v1.png`
- `/tmp/shbti-chibi-dangkang-v1.png`
- `/tmp/shbti-chibi-xingxing-v1.png`

- [ ] **Step 3: 逐只做形貌门禁**

使用 `view_image(detail="original")` 检查：

- 陆吾：人面、虎身、九尾均清楚，不能变成九尾狐；
- 耳鼠：兔首、麋身、鼠形和用于飞行的长尾均清楚；
- 当康：豕形与小獠牙清楚，不使用 ODL 的钱币挂饰；
- 狌狌：白耳和伏身跃起动作清楚，不能变成普通猴子。

任一关键数量或物种结构错误即重新生成该只，不用图像编辑强行修补解剖。

- [ ] **Step 4: 转换为发布 WebP**

逐只执行以下四条命令：

```bash
ffmpeg -y -i /tmp/shbti-chibi-luwu-v1.png \
  -vf "scale=768:768:force_original_aspect_ratio=decrease:flags=lanczos,pad=768:768:(ow-iw)/2:(oh-ih)/2:color=0x00000000" \
  -c:v libwebp -q:v 82 \
  public/assets/shbti/beasts/luwu/chibi-v1.webp

ffmpeg -y -i /tmp/shbti-chibi-ershu-v1.png \
  -vf "scale=768:768:force_original_aspect_ratio=decrease:flags=lanczos,pad=768:768:(ow-iw)/2:(oh-ih)/2:color=0x00000000" \
  -c:v libwebp -q:v 82 \
  public/assets/shbti/beasts/ershu/chibi-v1.webp

ffmpeg -y -i /tmp/shbti-chibi-dangkang-v1.png \
  -vf "scale=768:768:force_original_aspect_ratio=decrease:flags=lanczos,pad=768:768:(ow-iw)/2:(oh-ih)/2:color=0x00000000" \
  -c:v libwebp -q:v 82 \
  public/assets/shbti/beasts/dangkang/chibi-v1.webp

ffmpeg -y -i /tmp/shbti-chibi-xingxing-v1.png \
  -vf "scale=768:768:force_original_aspect_ratio=decrease:flags=lanczos,pad=768:768:(ow-iw)/2:(oh-ih)/2:color=0x00000000" \
  -c:v libwebp -q:v 82 \
  public/assets/shbti/beasts/xingxing/chibi-v1.webp
```

- [ ] **Step 5: 验证四张发布图**

Run:

```bash
ffprobe -v error -show_entries stream=width,height,pix_fmt -of default=noprint_wrappers=1 public/assets/shbti/beasts/luwu/chibi-v1.webp
ffprobe -v error -show_entries stream=width,height,pix_fmt -of default=noprint_wrappers=1 public/assets/shbti/beasts/ershu/chibi-v1.webp
ffprobe -v error -show_entries stream=width,height,pix_fmt -of default=noprint_wrappers=1 public/assets/shbti/beasts/dangkang/chibi-v1.webp
ffprobe -v error -show_entries stream=width,height,pix_fmt -of default=noprint_wrappers=1 public/assets/shbti/beasts/xingxing/chibi-v1.webp
```

Expected: 每张 768×768；透明通道存在或背景为干净一致的浅宣纸色；无损坏。

- [ ] **Step 6: 记录提示词与验收**

在 `PROMPTS.md` 追加第一组四只的：输入参考、最终提示词、输出路径、关键形貌检查和重试原因。不得写“同上”；每只单独记录。

---

### Task 3: 生成第二组Q版资源——英招、帝江、讙、凤凰

**Files:**

- Create: `public/assets/shbti/beasts/yingzhao/chibi-v1.webp`
- Create: `public/assets/shbti/beasts/dijiang/chibi-v1.webp`
- Create: `public/assets/shbti/beasts/huan/chibi-v1.webp`
- Create: `public/assets/shbti/beasts/fenghuang/chibi-v1.webp`
- Modify: `PROMPTS.md`

**Interfaces:** Produces four 768×768 local WebP assets with transparent background or a clean uniform light xuan-paper background, with at least 12% visual safe margin.

- [ ] **Step 1: 检查本批五张参考图**

用 `view_image(detail="original")` 分别查看：

- `public/assets/shbti/beasts/yingzhao/profile-v1-reference-verified.webp`
- `public/assets/shbti/beasts/dijiang/profile-v2-reference-verified.webp`
- `public/assets/shbti/beasts/huan/profile-v1-reference-verified.webp`
- `public/assets/shbti/beasts/fenghuang/profile-v1-reference-verified.webp`
- `research/ODL.jpg`

四张正式画像分别约束其对应异兽的形貌和主色；ODL 只约束Q版比例与松弛水墨感。

- [ ] **Step 2: 使用完整提示词分别生成四张图**

每只单独调用 imagegen，不生成四宫格。每条提示词都完整包含以下公共段落：

```text
创作一幅原创Q版中国水墨设色异兽插画，用于 SHBTI「山海司认兽小札」。参考图1只用于约束该异兽的原典解剖、数量和主色；参考图2只用于约束紧凑可爱的比例、松弛手绘墨线和亲切神态。不得临摹参考图2的姿势、挂饰、线稿或构图。

主体单独完整出现，1:1 正方形透明背景，四周至少12%安全边距，朝向右侧文字区。米白、墨灰、暖金为基底，小面积朱砂点睛。可爱但不幼儿化，不使用夸张大眼、腮红贴纸、三维玩具感或现代扁平矢量风。

不要文字、字母、数字、印章、水印、边框、卡片背景、现代物件；不要多余或缺失的头、腿、翼、尾；不要把异兽改成普通宠物。
```

每条公共段落后分别追加一条唯一约束：

- 英招：`关键形貌与动作：人面马身、虎文鸟翼；人面马身侧立，一蹄抬起，双翼半展，像正从高处巡视。`
- 帝江：`关键形貌与动作：黄囊、六足四翼、无面目、识歌舞；保持无脸，圆囊形身体旋转起舞，六足错落、四翼扇动。绝对不要添加头、脸、眼睛或嘴。`
- 讙：`关键形貌与动作：形如狸、一目三尾、声拟百声；单眼直视，三尾像声波散开，张口发出三圈墨色音纹。`
- 凤凰：`关键形貌与动作：五采之文、自歌自舞、见则安宁；五彩羽翼舒展，昂首轻鸣，长尾形成圆润彩带构图。`

输出：

- `/tmp/shbti-chibi-yingzhao-v1.png`
- `/tmp/shbti-chibi-dijiang-v1.png`
- `/tmp/shbti-chibi-huan-v1.png`
- `/tmp/shbti-chibi-fenghuang-v1.png`

- [ ] **Step 3: 逐只做形貌门禁**

- 英招：人面、马身、虎纹、双翼齐全；
- 帝江：必须无脸、六足、四翼，圆囊形身体；不得补头；
- 讙：必须一目三尾，不能画成三眼或九尾；
- 凤凰：五彩羽纹、双翼和长尾完整，不画成普通孔雀或鸡。

- [ ] **Step 4: 转换为四张发布 WebP**

Run:

```bash
for beast in yingzhao dijiang huan fenghuang; do
  ffmpeg -y -i "/tmp/shbti-chibi-${beast}-v1.png" \
    -vf "scale=768:768:force_original_aspect_ratio=decrease:flags=lanczos,pad=768:768:(ow-iw)/2:(oh-ih)/2:color=0x00000000" \
    -c:v libwebp -q:v 82 \
    "public/assets/shbti/beasts/${beast}/chibi-v1.webp"
done
```

- [ ] **Step 5: 使用 ffprobe 与 view_image 验证四张发布图**

Expected: 768×768、无损坏、关键结构正确、四图风格与第一组一致。

- [ ] **Step 6: 在 `PROMPTS.md` 单独记录四只提示词与验收结论**

---

### Task 4: 生成第三组Q版资源——旋龟、毕方、精卫、鹿蜀

**Files:**

- Create: `public/assets/shbti/beasts/xuangui/chibi-v1.webp`
- Create: `public/assets/shbti/beasts/bifang/chibi-v1.webp`
- Create: `public/assets/shbti/beasts/jingwei/chibi-v1.webp`
- Create: `public/assets/shbti/beasts/lushu/chibi-v1.webp`
- Modify: `PROMPTS.md`

**Interfaces:** Produces four 768×768 local WebP assets with transparent background or a clean uniform light xuan-paper background, with at least 12% visual safe margin.

- [ ] **Step 1: 检查本批五张参考图**

用 `view_image(detail="original")` 分别查看 `xuangui/profile-v3-reference-verified.webp`、`bifang/profile-v1-reference-verified.webp`、`jingwei/profile-v1-reference-verified.webp`、`lushu/profile-v2-reference-verified.webp` 四张正式画像（均位于 `public/assets/shbti/beasts` 对应目录），以及 `research/ODL.jpg`。

- [ ] **Step 2: 使用完整提示词分别生成四张临时 PNG**

每只单独调用 imagegen。每条提示词完整写入：原创Q版中国水墨设色；正式画像只约束原典解剖、数量和主色；ODL 只约束紧凑可爱比例、松弛墨线与亲切神态且不临摹姿势、挂饰、线稿和构图；1:1 透明背景；主体完整；四周至少12%安全边距；朝向右侧文字区；米白、墨灰、暖金基底与少量朱砂；禁止文字、水印、边框、卡片背景、现代物件、夸张大眼、腮红贴纸、三维玩具感、现代扁平矢量风和错误肢体数量。再分别写入：

- 旋龟：`关键形貌与动作：龟身、鸟首、虺尾；鸟首从龟甲前探出，蛇尾卷成问号，伏在一块水纹石上。`
- 毕方：`关键形貌与动作：鹤形、一足、赤文青质白喙，与怪火相联；单足稳立，另一侧明确不画腿，白喙、青羽、赤纹，身旁一点火星。绝对不要补第二条腿。`
- 精卫：`关键形貌与动作：女娃所化，衔木石填海；小鸟奋力振翅，喙中衔一根细枝，下方两三颗小石形成路线。不要画人形躯干。`
- 鹿蜀：`关键形貌与动作：马形、白首、虎文、赤尾、声如歌谣；白首微侧，虎纹清楚，赤尾像乐句扬起，前蹄轻点节拍。`

输出：

- `/tmp/shbti-chibi-xuangui-v1.png`
- `/tmp/shbti-chibi-bifang-v1.png`
- `/tmp/shbti-chibi-jingwei-v1.png`
- `/tmp/shbti-chibi-lushu-v1.png`

- [ ] **Step 3: 逐只做形貌门禁**

- 旋龟：龟身、鸟首、虺尾同时可辨；
- 毕方：只能有一足，青羽赤纹白喙，不得补第二条腿；
- 精卫：鸟形、衔枝动作清楚，不增加人形躯干；
- 鹿蜀：马形、白首、虎纹、赤尾同时可辨。

- [ ] **Step 4: 转换为四张发布 WebP**

Run:

```bash
for beast in xuangui bifang jingwei lushu; do
  ffmpeg -y -i "/tmp/shbti-chibi-${beast}-v1.png" \
    -vf "scale=768:768:force_original_aspect_ratio=decrease:flags=lanczos,pad=768:768:(ow-iw)/2:(oh-ih)/2:color=0x00000000" \
    -c:v libwebp -q:v 82 \
    "public/assets/shbti/beasts/${beast}/chibi-v1.webp"
done
```

- [ ] **Step 5: 使用 ffprobe 与 view_image 验证四张发布图**

- [ ] **Step 6: 在 `PROMPTS.md` 单独记录四只提示词与验收结论**

---

### Task 5: 生成第四组Q版资源——开明兽、烛阴、朏朏、九尾狐

**Files:**

- Create: `public/assets/shbti/beasts/kaimingshou/chibi-v1.webp`
- Create: `public/assets/shbti/beasts/zhuyin/chibi-v1.webp`
- Create: `public/assets/shbti/beasts/feifei/chibi-v1.webp`
- Create: `public/assets/shbti/beasts/jiuweihu/chibi-v1.webp`
- Modify: `PROMPTS.md`

**Interfaces:** Produces four 768×768 local WebP assets with transparent background or a clean uniform light xuan-paper background, with at least 12% visual safe margin.

- [ ] **Step 1: 检查本批五张参考图**

用 `view_image(detail="original")` 分别查看 `kaimingshou/profile-v1-reference-verified.webp`、`zhuyin/profile-v1-reference-verified.webp`、`feifei/profile-v2-reference-verified.webp`、`jiuweihu/profile-v3-reference-verified.webp` 四张正式画像（均位于 `public/assets/shbti/beasts` 对应目录），以及 `research/ODL.jpg`。

- [ ] **Step 2: 使用完整提示词分别生成四张临时 PNG**

每只单独调用 imagegen。每条提示词完整写入：原创Q版中国水墨设色；正式画像只约束原典解剖、数量和主色；ODL 只约束紧凑可爱比例、松弛墨线与亲切神态且不临摹姿势、挂饰、线稿和构图；1:1 透明背景；主体完整；四周至少12%安全边距；朝向右侧文字区；米白、墨灰、暖金基底与少量朱砂；禁止文字、水印、边框、卡片背景、现代物件、夸张大眼、腮红贴纸、三维玩具感、现代扁平矢量风和错误肢体数量。再分别写入：

- 开明兽：`关键形貌与动作：虎身九首、皆人面、立于昆仑；虎身稳立，九张人面在颈部扇形排布，神态各异但不恐怖化。必须恰好九张人面，不画九个兽头。`
- 烛阴：`关键形貌与动作：人面蛇身、赤色，与昼夜冬夏风雨叙述相关；赤色蛇身盘成昼夜阴阳弧，人面抬头，左右一暗一明。不要添加手脚。`
- 朏朏：`关键形貌与动作：形如狸、白尾有鬣，神话中可已忧；白尾蓬松环抱身体，鬣毛清晰，安静蜷坐但保持警觉。不要画成普通白猫。`
- 九尾狐：`关键形貌与动作：狐形九尾、声如婴儿、会食人；狐身回望，九尾张开，神态机敏略带锋芒，露出一点犬齿。必须恰好九尾，不要粉饰成纯粹仙宠。`

输出：

- `/tmp/shbti-chibi-kaimingshou-v1.png`
- `/tmp/shbti-chibi-zhuyin-v1.png`
- `/tmp/shbti-chibi-feifei-v1.png`
- `/tmp/shbti-chibi-jiuweihu-v1.png`

- [ ] **Step 3: 逐只做形貌门禁**

- 开明兽：虎身和九张人面完整；不能少头，也不能画成九个兽头；
- 烛阴：人面、赤色蛇身清楚，不补手脚；
- 朏朏：狸形、白尾和鬣毛清楚，不画成普通白猫；
- 九尾狐：狐形九尾准确，神态有锋芒，保留一点犬齿，不粉饰成纯粹仙宠。

- [ ] **Step 4: 转换为四张发布 WebP**

Run:

```bash
for beast in kaimingshou zhuyin feifei jiuweihu; do
  ffmpeg -y -i "/tmp/shbti-chibi-${beast}-v1.png" \
    -vf "scale=768:768:force_original_aspect_ratio=decrease:flags=lanczos,pad=768:768:(ow-iw)/2:(oh-ih)/2:color=0x00000000" \
    -c:v libwebp -q:v 82 \
    "public/assets/shbti/beasts/${beast}/chibi-v1.webp"
done
```

- [ ] **Step 5: 使用 ffprobe 与 view_image 验证四张发布图**

- [ ] **Step 6: 在 `PROMPTS.md` 单独记录四只提示词与验收结论**

---

### Task 6: 接入 16 张Q版资源映射

**Files:**

- Modify: `src/ui/beastAssets.ts`
- Modify: `src/ui/beastAssets.test.ts`

**Interfaces:**

- Produces:

```ts
export type BeastAsset = {
  beastId: string
  src: string
  placeholder?: string
  chibiSrc: string
  shareFocusY: number
}
```

- [ ] **Step 1: 在既有测试上追加失败断言**

不得替换、删除或缩减当前分享焦点测试。在 `covers all 16...` 测试中追加：

```ts
expect(new Set(assets.map((asset) => asset!.chibiSrc)).size).toBe(16)
expect(assets.every((asset) => asset!.chibiSrc.endsWith('/chibi-v1.webp'))).toBe(true)
```

并在陆吾完整对象断言中加入：

```ts
chibiSrc: './assets/shbti/beasts/luwu/chibi-v1.webp',
```

- [ ] **Step 2: 运行测试并确认 RED**

Run:

```bash
pnpm exec vitest run src/ui/beastAssets.test.ts
```

Expected: FAIL；`chibiSrc` 尚未定义。

- [ ] **Step 3: 最小实现 16 个映射**

为 `BeastAsset` 增加必填 `chibiSrc`，按下表逐项加入，不从结果名运行时拼路径：

| 代码 | `chibiSrc` |
|---|---|
| RTLS | `./assets/shbti/beasts/luwu/chibi-v1.webp` |
| RTLM | `./assets/shbti/beasts/ershu/chibi-v1.webp` |
| RTES | `./assets/shbti/beasts/dangkang/chibi-v1.webp` |
| RTEM | `./assets/shbti/beasts/xingxing/chibi-v1.webp` |
| RVLS | `./assets/shbti/beasts/yingzhao/chibi-v1.webp` |
| RVLM | `./assets/shbti/beasts/dijiang/chibi-v1.webp` |
| RVES | `./assets/shbti/beasts/huan/chibi-v1.webp` |
| RVEM | `./assets/shbti/beasts/fenghuang/chibi-v1.webp` |
| HTLS | `./assets/shbti/beasts/xuangui/chibi-v1.webp` |
| HTLM | `./assets/shbti/beasts/bifang/chibi-v1.webp` |
| HTES | `./assets/shbti/beasts/jingwei/chibi-v1.webp` |
| HTEM | `./assets/shbti/beasts/lushu/chibi-v1.webp` |
| HVLS | `./assets/shbti/beasts/kaimingshou/chibi-v1.webp` |
| HVLM | `./assets/shbti/beasts/zhuyin/chibi-v1.webp` |
| HVES | `./assets/shbti/beasts/feifei/chibi-v1.webp` |
| HVEM | `./assets/shbti/beasts/jiuweihu/chibi-v1.webp` |

不得改动任何既有 `src`、`placeholder` 和 `shareFocusY` 数值。

- [ ] **Step 4: 运行测试并确认 GREEN**

Run:

```bash
pnpm exec vitest run src/ui/beastAssets.test.ts
```

Expected: PASS；全部既有测试和新增Q版映射断言通过。

- [ ] **Step 5: 检查 16 个文件路径确实存在**

Run:

```bash
find public/assets/shbti/beasts -mindepth 2 -maxdepth 2 -name 'chibi-v1.webp' -type f | sort
```

Expected: 恰好 16 行，每个 beast 目录一行。

---

### Task 7: 实现 `BeastRecognitionCard`、失败降级与一次性入场状态

**Files:**

- Create: `src/components/BeastRecognitionCard.tsx`
- Create: `src/components/BeastRecognitionCard.test.tsx`

**Interfaces:**

- Consumes: `getBeastAsset(code)?.chibiSrc` 和 `RecognitionCardCopy`。
- Produces:

```ts
type BeastRecognitionCardProps = {
  code: string
  copy: RecognitionCardCopy
}

export function BeastRecognitionCard(props: BeastRecognitionCardProps): React.JSX.Element
```

- [ ] **Step 1: 写正式资源与缺失映射失败测试**

使用 `renderToStaticMarkup`，不新增 DOM 测试依赖：

```tsx
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import type { RecognitionCardCopy } from '../content/types'
import { BeastRecognitionCard } from './BeastRecognitionCard'

const copy: RecognitionCardCopy = {
  kicker: '闻山认兽 · 当康',
  hook: '这可不是野猪，是报丰年的瑞兽当康。',
  blessing: '古书说它“见则天下大穰”——你不是在等好运，你走到哪里，哪里就有好日子开张。',
  seal: '丰',
  alt: 'Q版当康，豕形有牙，抬起前蹄，身旁有谷穗',
}

describe('beast recognition card', () => {
  it('renders local chibi artwork and all recognition copy', () => {
    const html = renderToStaticMarkup(<BeastRecognitionCard code="RTES" copy={copy} />)
    expect(html).toContain('/dangkang/chibi-v1.webp')
    for (const text of Object.values(copy)) expect(html).toContain(text)
  })

  it('keeps all copy and a labelled seal when no beast mapping exists', () => {
    const html = renderToStaticMarkup(<BeastRecognitionCard code="XXXX" copy={copy} />)
    expect(html).not.toContain('<img')
    expect(html).toContain('beast-recognition-card--fallback')
    expect(html).toContain('aria-label="Q版当康，豕形有牙，抬起前蹄，身旁有谷穗"')
    expect(html).toContain(copy.hook)
    expect(html).toContain(copy.blessing)
  })
})
```

- [ ] **Step 2: 运行测试并确认 RED**

Run:

```bash
pnpm exec vitest run src/components/BeastRecognitionCard.test.tsx
```

Expected: FAIL；组件不存在。

- [ ] **Step 3: 写组件、图片降级和一次性观察实现**

```tsx
import { useEffect, useRef, useState } from 'react'
import type { RecognitionCardCopy } from '../content/types'
import { getBeastAsset } from '../ui/beastAssets'

type Props = { code: string; copy: RecognitionCardCopy }

export function BeastRecognitionCard({ code, copy }: Props) {
  const asset = getBeastAsset(code)
  const rootRef = useRef<HTMLElement>(null)
  const [failed, setFailed] = useState(false)
  const [entered, setEntered] = useState(false)
  const showImage = Boolean(asset?.chibiSrc) && !failed

  useEffect(() => {
    const root = rootRef.current
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
      || document.documentElement.dataset.reducedMotion === 'true'
    if (!root || reduceMotion || !('IntersectionObserver' in window)) return

    const observer = new IntersectionObserver(([entry]) => {
      if (!entry?.isIntersecting) return
      setEntered(true)
      observer.disconnect()
    }, { threshold: 0.2 })
    observer.observe(root)
    return () => observer.disconnect()
  }, [])

  return (
    <section ref={rootRef} className={`beast-recognition-card${showImage ? '' : ' beast-recognition-card--fallback'}${entered ? ' is-entered' : ''}`} aria-label={copy.kicker}>
      <div className="beast-recognition-card__figure">
        {showImage
          ? <img src={asset!.chibiSrc} alt={copy.alt} width="768" height="768" loading="lazy" decoding="async" onError={() => setFailed(true)} />
          : <span className="beast-recognition-card__fallback" role="img" aria-label={copy.alt}>兽</span>}
      </div>
      <div className="beast-recognition-card__copy">
        <p className="eyebrow">{copy.kicker}</p>
        <strong>{copy.hook}</strong>
        <p>{copy.blessing}</p>
      </div>
      <span className="beast-recognition-card__seal" aria-hidden="true">{copy.seal}</span>
    </section>
  )
}
```

- [ ] **Step 4: 运行测试并确认 GREEN**

Run:

```bash
pnpm exec vitest run src/components/BeastRecognitionCard.test.tsx
```

Expected: 2 tests PASS。SSR 输出没有依赖浏览器 API，未进入或不支持观察器时内容本身仍保持可见。

---

### Task 8: 将认兽小札接入结果页

**Files:**

- Modify: `src/components/ResultPage.tsx`
- Modify: `src/components/ResultGuide.test.tsx`

**Interfaces:** Consumes `profile.recognitionCard` from Task 1 and `BeastRecognitionCard` from Task 7。

- [ ] **Step 1: 写结果页顺序失败测试**

在现有 `ResultGuide.test.tsx` 测试末尾增加：

```ts
expect(html).toContain(profile.recognitionCard.kicker)
expect(html).toContain(profile.recognitionCard.hook)
expect(html).toContain(profile.recognitionCard.blessing)
expect(html.indexOf('guide-presence--compact')).toBeLessThan(html.indexOf(profile.recognitionCard.kicker))
expect(html.indexOf(profile.recognitionCard.kicker)).toBeLessThan(html.indexOf('卷一 · 本相'))
```

- [ ] **Step 2: 运行测试并确认 RED**

Run:

```bash
pnpm exec vitest run src/components/ResultGuide.test.tsx
```

Expected: FAIL；结果页尚无认兽小札。

- [ ] **Step 3: 插入组件**

在 `ResultPage.tsx` 导入组件，并紧接现有 `<GuidePresence ... />` 之后插入：

```tsx
<BeastRecognitionCard code={result.code} copy={profile.recognitionCard} />
```

不得把它放入 `.share-card` 或 `ShareCardSheet`。

- [ ] **Step 4: 运行相关测试并确认 GREEN**

Run:

```bash
pnpm exec vitest run src/components/ResultGuide.test.tsx src/components/BeastRecognitionCard.test.tsx
```

Expected: 全部 PASS；HTML 中不出现内部结果代码。

---

### Task 9: 实现响应式视觉、视口动效与减少动态降级

**Files:**

- Modify: `src/App.css`

**Interfaces:** Consumes Task 7 的六个元素类名和 `.is-entered` 一次性状态；不新增运行时依赖。

- [ ] **Step 1: 增加基础卡片布局**

在结果页样式区加入：

```css
.beast-recognition-card {
  position: relative;
  display: grid;
  grid-template-columns: clamp(96px, 28vw, 116px) minmax(0, 1fr);
  align-items: center;
  gap: var(--space-3);
  overflow: hidden;
  margin: var(--space-5) 0 var(--space-6);
  border: 1px solid rgb(183 154 98 / 42%);
  border-left: 3px solid var(--cinnabar);
  padding: var(--space-3) var(--space-5) var(--space-3) var(--space-2);
  background: linear-gradient(135deg, rgb(248 241 223 / 96%), rgb(232 220 193 / 78%));
  box-shadow: 0 12px 26px rgb(24 35 33 / 10%);
}

.beast-recognition-card__figure { position: relative; z-index: 1; aspect-ratio: 1; }
.beast-recognition-card__figure img { width: 100%; height: 100%; object-fit: contain; }
.beast-recognition-card__copy { position: relative; z-index: 2; min-width: 0; }
.beast-recognition-card__copy p, .beast-recognition-card__copy strong { margin: 0; }
.beast-recognition-card__copy .eyebrow { color: var(--malachite); }
.beast-recognition-card__copy strong { display: block; margin-top: var(--space-1); font-family: "Noto Serif SC", "Source Han Serif SC", "Songti SC", serif; line-height: 1.65; }
.beast-recognition-card__copy > p:last-child { margin-top: var(--space-2); padding-right: 30px; padding-bottom: var(--space-2); color: var(--ink-soft); font-size: var(--text-sm); line-height: 1.7; }
.beast-recognition-card__seal { position: absolute; right: 8px; bottom: 8px; display: grid; width: 34px; height: 34px; place-items: center; color: var(--paper-light); background: var(--cinnabar); font: 700 var(--text-sm)/1 "KaiTi", "STKaiti", serif; transform: rotate(-6deg); }
.beast-recognition-card__fallback { display: grid; width: 100%; height: 100%; place-items: center; border: 1px dashed rgb(70 83 78 / 30%); color: var(--ink-muted); font: 700 2.4rem/1 "KaiTi", "STKaiti", serif; }
```

- [ ] **Step 2: 增加一次性视口入场动效**

基础状态始终可见；只有组件在首次进入视口后添加 `.is-entered`，才播放一遍以下动画：

```css
@media (prefers-reduced-motion: no-preference) {
  .beast-recognition-card.is-entered .beast-recognition-card__figure {
    animation: recognition-beast-arrive 420ms var(--ease-enter) both;
  }

  .beast-recognition-card.is-entered .beast-recognition-card__copy {
    animation: recognition-copy-arrive 360ms var(--ease-enter) 80ms both;
  }

  .beast-recognition-card.is-entered .beast-recognition-card__seal {
    animation: recognition-seal-drop 300ms var(--ease-enter) both;
    animation-delay: 160ms;
  }
}

@keyframes recognition-beast-arrive {
  from { opacity: 0; transform: translateY(6px) scale(.96); }
}

@keyframes recognition-copy-arrive {
  from { opacity: 0; transform: translateY(4px); }
}

@keyframes recognition-seal-drop {
  from { opacity: 0; transform: rotate(-6deg) scale(1.28); }
}
```

`IntersectionObserver` 不存在、减少动态开启或 JavaScript 未运行时，组件不会得到 `.is-entered`，但基础样式就是静态最终状态，因此内容始终可读。观察器在第一次相交后断开，动画不循环、不因页面回滚而反向播放。

- [ ] **Step 3: 扩充减少动态选择器**

在 `@media (prefers-reduced-motion: reduce)` 和 `:root[data-reduced-motion="true"]` 的现有选择器中加入：

```css
.beast-recognition-card__figure,
.beast-recognition-card__copy,
.beast-recognition-card__seal
```

Expected: 两种减少动态来源下均为 `animation: none; transition: none;`。

- [ ] **Step 4: 运行 lint 与组件测试**

Run:

```bash
pnpm lint
pnpm exec vitest run src/components/BeastRecognitionCard.test.tsx src/components/ResultGuide.test.tsx
```

Expected: 0 warnings、0 errors、测试全通过。

---

### Task 10: 全量结果页视觉复检与文档收口

**Files:**

- Modify: `VISUAL-QA.md`

**Interfaces:** Verifies Tasks 1–9 as an integrated feature; produces no new runtime behavior.

- [ ] **Step 1: 启动本地正式页面并使用 Playwright CLI**

Run:

```bash
pnpm dev --host 127.0.0.1
```

使用 `/home/xrush/.codex/skills/playwright/scripts/playwright_cli.sh`。先 `snapshot` 再操作页面引用；需要循环 16 个结果时使用 `run-code`，不得增加 Playwright 测试依赖。

- [ ] **Step 2: 逐一打开 16 个结果并验证对应内容**

对每个代码构造合法的本地 `recentResult`，通过“最近结果 → 查看结果”进入正式结果页。每次返回以下指标：

```js
{
  code,
  imageSrc,
  imageComplete,
  naturalWidth,
  cardLeft,
  cardRight,
  scrollWidth,
  viewportWidth,
  hook,
  blessing,
}
```

Expected:

- `imageComplete === true`；
- `naturalWidth > 0`；
- `cardLeft >= 0` 且 `cardRight <= viewportWidth`；
- `scrollWidth === viewportWidth`；
- hook、blessing 与该代码的内容完全一致；
- 16 个 `imageSrc` 唯一。

- [ ] **Step 3: 三宽与安全区复检**

至少对当康、帝江、开明兽、九尾狐四种复杂形貌，在 375、390、430×844 CSS px 下重复检查。设置：

```js
document.documentElement.style.setProperty('--safe-area-inset-top', '32px')
```

Expected: 页面无横向滚动，卡片与卷一标题完整可达；未新增任何 fixed/sticky 控件；现有顶部控件未被遮挡。

- [ ] **Step 4: 图片失败降级复检**

在浏览器中仅对当康小札图片模拟加载失败，确认：

- 显示 CSS “兽”印；
- kicker、hook、blessing、朱砂印仍在；
- 正式主画像不受影响；
- 页面没有 console error 导致流程中断。

- [ ] **Step 5: 输出 16 图总览并人工检查关键结构**

生成四张四宫格总览，每组与设计稿第 9 节批次一致。逐只检查设计稿第 10 节视觉门禁，尤其：帝江无脸六足四翼、毕方一足、开明兽九首。

- [ ] **Step 6: 更新 `VISUAL-QA.md`**

记录：

- 16/16 Q版资源加载数量和 0 错配结论；
- 375/390/430 三宽指标；
- 32px 顶部安全区结果；
- 图片失败降级结果；
- 四张总览的本地 QA 路径；
- 尚未执行发布 ZIP 更新。

- [ ] **Step 7: 执行最终项目门禁**

Run:

```bash
pnpm lint && pnpm test && pnpm build
```

Expected: lint 0 warning / 0 error；所有测试文件和测试项通过；Vite build exit 0。

- [ ] **Step 8: 执行差异与范围门禁**

Run:

```bash
git diff --check -- projects/01-sbti
git status --short
```

Expected:

- `git diff --check` 无输出；
- 本计划产生的新增和修改路径全部位于 `projects/01-sbti`；
- 根目录及其他项目的既有脏文件保持原样，未被暂存；
- 不提交、不推送、不更新发布 ZIP。
