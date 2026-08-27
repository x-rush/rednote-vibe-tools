# 32 件全 AI 史料感证物 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把 32 件证物全部升级为有来源参考、逐图核验的独立 AI 生成 WebP，同时保留旧 SVG 离线回退与既有玩法状态。

**Architecture:** 资源层从单一路径扩展为“正式 WebP + 回退 SVG”二级解析，渲染层通过独立 `EvidencePlateImage` 处理加载失败。八案各自产出四张 AI 图与一份来源／生成档案；所有案件完成后统一收紧资源测试、浏览器回归和离线包门禁。

**Tech Stack:** React 19、TypeScript、Vitest、Vite、内置 `image_gen`、ffmpeg／ffprobe、Playwright／CDP、WebP、纯前端 IndexedDB/localStorage。

**Spec:** `projects/03-dalisizian/AI-EVIDENCE-V3-SPEC.md`

## Global Constraints

- 只修改 `projects/03-dalisizian`；不得新增依赖或修改根锁文件。
- 32 张正式图全部通过内置 `image_gen` 逐张生成或参考图编辑，不使用 CLI 批处理。
- 可辨认古文字必须有授权明确的参考输入，并通过轮廓核验；禁止模型自由生成乱码、假古文或补笔。
- 业务文案与来源只放 `src/content/content.json`；代码只保存资源路径与通用逻辑。
- 正式图统一 1080×720 WebP，单图不超过 200KB，32 张总计不超过 5.5MB，最终 ZIP 小于 8MB。
- 旧 SVG 保留为加载失败回退；不改变存档结构、观察点 ID、推理、评分或案件图结构。
- 顶部控件继续叠加 `var(--safe-area-inset-top, env(safe-area-inset-top, 0px))`，并验证 375／390／430 CSS px 与非零安全区。
- 每个实现任务结束前运行对应测试并形成独立提交；不得删除或弱化既有测试。

---

## File Structure

- `src/evidence/assets.ts`：32 个稳定资源 ID 的正式图与回退图解析。
- `src/evidence/EvidencePlateImage.tsx`：正式图失败后只切换一次到本地回退图。
- `src/evidence/EvidenceArtifact.tsx`：消费双路径模型并保持热点层不变。
- `src/evidence/model.ts`：向组件提供 `assetPath` 与 `fallbackAssetPath`。
- `src/evidence/assets.test.ts`：资源映射、文件头、大小、唯一性与最终 32/32 V3 门禁。
- `src/evidence/components.test.tsx`：正式图与回退组件结构测试。
- `src/evidence/evidence.css`：证物侧光、纸张微浮、朱砂显影和减少动态模式。
- `public/assets/evidence/{home,rest,take,pick,watch,martial,law,autumn}/asset-evidence-*-v3.webp`：32 张正式 AI 资源。
- `research/{home,rest,take,pick,watch,martial,law,autumn}-ai-evidence-dossier.md`：8 份来源、提示词、哈希和轮廓审核记录。
- `research/reference-inputs/`：本地生成参考输入，加入项目 `.gitignore`，不进入 Git 或发布包。
- `qa/evidence-browser.mjs`：32 图加载、三宽、回退和减少动态回归。
- `VISUAL-QA.md`、`research/evidence-source-register.md`：最终验收与来源台账。

---

### Task 1: 正式图与回退图双路径契约

**Files:**
- Create: `src/evidence/EvidencePlateImage.tsx`
- Create: `src/evidence/EvidencePlateImage.test.tsx`
- Modify: `src/evidence/assets.ts`
- Modify: `src/evidence/assets.test.ts`
- Modify: `src/evidence/model.ts`
- Modify: `src/evidence/model.test.ts`
- Modify: `src/evidence/EvidenceArtifact.tsx`
- Modify: `src/evidence/components.test.tsx`

**Interfaces:**
- Produces: `EvidenceAssetSet = { primary: string; fallback: string }`
- Produces: `resolveEvidenceAssetSet(assetId: string): EvidenceAssetSet | undefined`
- Produces: `<EvidencePlateImage primarySrc fallbackSrc fallbackAlt />`
- Preserves: `resolveEvidenceAsset(assetId)` 返回正式主路径，供现有缩略图和模型调用。

- [ ] **Step 1: 写失败测试，定义双路径解析**

```ts
const set = resolveEvidenceAssetSet('asset-evidence-home-early-form')
expect(set).toEqual({
  primary: './assets/evidence/home/asset-evidence-home-early-form-v2.webp',
  fallback: './assets/evidence/home/asset-evidence-home-early-form-v1.svg',
})
expect(resolveEvidenceAssetSet('asset-evidence-unknown')).toBeUndefined()
```

- [ ] **Step 2: 写失败测试，定义图片失败回退结构**

```tsx
const html = renderToStaticMarkup(
  <EvidencePlateImage primarySrc="./main.webp" fallbackSrc="./fallback.svg" fallbackAlt="证物图版回退" />,
)
expect(html).toContain('src="./main.webp"')
expect(html).toContain('data-fallback-src="./fallback.svg"')
```

- [ ] **Step 3: 运行测试确认 RED**

Run: `pnpm test`

Expected: FAIL，提示 `resolveEvidenceAssetSet`／`EvidencePlateImage` 尚不存在。

- [ ] **Step 4: 实现最小双路径模型**

`assets.ts` 将映射值改为冻结的 `EvidenceAssetSet`；尚未升级的证物令 `primary` 与 `fallback` 都指向当前 SVG。`EvidencePlateImage` 用 `useState(false)` 记录首次失败，`onError` 后将 `src` 切到 `fallbackSrc`，回退再次失败时呈现 `fallbackAlt` 文字卡，避免无限切换。

- [ ] **Step 5: 模型和组件接入**

`createEvidenceArtifactModel()` 新增 `fallbackAssetPath`；`EvidenceArtifact` 只替换底图 `<img>`，热点、字形层、模板和观察状态保持原逻辑。

- [ ] **Step 6: 运行测试确认 GREEN**

Run: `pnpm test`

Expected: 15 个测试文件全部通过。

- [ ] **Step 7: 提交**

```bash
git add src/evidence
git commit -m "feat(dalisizian): add evidence image fallback contract"
```

---

### Task 2: 八案参考档案与本地输入门禁

**Files:**
- Modify: `.gitignore`
- Create: `research/home-ai-evidence-dossier.md`
- Create: `research/rest-ai-evidence-dossier.md`
- Create: `research/take-ai-evidence-dossier.md`
- Create: `research/pick-ai-evidence-dossier.md`
- Create: `research/watch-ai-evidence-dossier.md`
- Create: `research/martial-ai-evidence-dossier.md`
- Create: `research/law-ai-evidence-dossier.md`
- Create: `research/autumn-ai-evidence-dossier.md`

**Interfaces:**
- Produces ignored local inputs under `research/reference-inputs/{home,rest,take,pick,watch,martial,law,autumn}/`。
- Produces one dossier per case with sections: `事实边界`、`参考来源`、`本地输入哈希`、`四图提示词`、`轮廓核验`、`生成记录`。

- [ ] **Step 1: 加入本地研究输入忽略规则**

在项目 `.gitignore` 添加：

```gitignore
research/reference-inputs/
```

- [ ] **Step 2: 查证八字参考图**

对“家、休、取、采、監、武、灋／法、秋”分别使用 byted-web-search 与原站页面交叉核对。优先 Wikimedia Ancient Chinese Characters 项目的 CC0/Public Domain SVG，并核对教育部《异体字字典》、中国哲学书电子化计划、小学堂或现有学术机构来源。每个最终采用的图形记录直接 URL、脚本阶段、著录号和许可。

- [ ] **Step 3: 标准化本地参考输入**

将采用的 SVG／公开预览转为 1200×1200 高对比 PNG。固定文件名为：`home-jia-oracle-reference.png`、`home-jia-bronze-reference.png`、`home-jia-seal-reference.png`、`rest-xiu-form-reference.png`、`take-qu-form-reference.png`、`pick-cai-form-reference.png`、`pick-bian-form-reference.png`、`watch-jian-form-reference.png`、`martial-wu-form-reference.png`、`law-fa-archaic-reference.png`、`law-fa-seal-reference.png`、`autumn-qiu-form-reference.png`；分别放入对应案件目录。运行 `sha256sum` 并把哈希写入对应 dossier。参考输入不 `git add`。

- [ ] **Step 4: 完成八份档案的生成前部分**

每份档案明确四张图的可见物件、允许出现的短文字、不得改变的构件、热点安全区和来源 ID。任何没有合格参考图的可辨认古文字从画面要求中删除，不用模型猜测补齐。

- [ ] **Step 5: 自检与提交**

Run: `rg -n "TBD|TODO|待定|来源待核" research/*-ai-evidence-dossier.md`

Expected: 无输出。

```bash
git add .gitignore research/*-ai-evidence-dossier.md
git commit -m "docs(dalisizian): establish AI evidence reference dossiers"
```

---

### Task 3: “家”案四张 AI 证物

**Files:**
- Create: `public/assets/evidence/home/asset-evidence-home-early-form-v3.webp`
- Create: `public/assets/evidence/home/asset-evidence-home-shuowen-v3.webp`
- Create: `public/assets/evidence/home/asset-evidence-home-phonetic-v3.webp`
- Create: `public/assets/evidence/home/asset-evidence-home-social-leap-v3.webp`
- Modify: `src/evidence/assets.ts`
- Modify: `research/home-ai-evidence-dossier.md`

**Interfaces:** Updates four `asset-evidence-home-*` records so `primary` is V3 WebP and `fallback` remains V1 SVG.

- [ ] **Step 1: 为四张图分别调用内置 image_gen**

共同约束：historical-scene、top-down museum-quality evidence photograph、1080×720 安全构图、唐代虚构案房装帧、无水印、无随机文字。四个独立 Primary request：

1. `early-form`：依据家字甲骨／金文／小篆参考输入，将三个轮廓保持不变地复原为三片年代不同的旧拓，置于木案和靛青衬布上。
2. `shuowen`：依据“家，居也。从宀，豭省声”的核验材料，生成宀部残卷、压条和单字短题，长文被折叠遮挡。
3. `phonetic`：生成宀、内部构件、声符三枚实物木签与红线勘校关系；只有参考输入中允许的单字可辨认。
4. `social-leap`：生成传闻札、史料卷袋和被朱线截断的越界推断，不出现完整现代句子。

- [ ] **Step 2: 逐图查看并拒绝错误结构**

用 `view_image` 检查每张原图；`early-form` 中任一关键字形轮廓改变、其余图出现随机可读汉字、现代文具或人物时，针对单一问题重新生成。

- [ ] **Step 3: 转换并压缩**

每次 image_gen 返回后立即设置 `evidence_source_image` 为该次工具返回的绝对 PNG 路径，并为四张审核通过的输出分别运行下列命令；`evidence_target_webp` 依次使用本任务 Files 中列出的四个明确目标路径：

```bash
ffmpeg -i "$evidence_source_image" -vf "scale=1080:720:force_original_aspect_ratio=increase,crop=1080:720" -c:v libwebp -quality 78 -compression_level 6 "$evidence_target_webp"
```

用 `ffprobe` 验证 1080×720；若单图超过 200KB，逐级将 quality 调至 74、70，不能通过缩小尺寸逃避。

- [ ] **Step 4: 更新映射、提示词、哈希和轮廓结论**

将最终提示词、原始生成路径、WebP SHA-256、文件大小、参考输入和逐构件结论写入 `home-ai-evidence-dossier.md`。

- [ ] **Step 5: 运行测试与提交**

Run: `pnpm test`

```bash
git add -f public/assets/evidence/home/*-v3.webp
git add src/evidence/assets.ts research/home-ai-evidence-dossier.md
git commit -m "feat(dalisizian): upgrade home evidence art"
```

---

### Task 4: “休”案四张 AI 证物

**Files:**
- Create: `public/assets/evidence/rest/asset-evidence-rest-components-v3.webp`
- Create: `public/assets/evidence/rest/asset-evidence-rest-gloss-v3.webp`
- Create: `public/assets/evidence/rest/asset-evidence-rest-method-limit-v3.webp`
- Create: `public/assets/evidence/rest/asset-evidence-rest-modern-shape-v3.webp`
- Modify: `src/evidence/assets.ts`
- Modify: `research/rest-ai-evidence-dossier.md`

**Interfaces:** Updates four `asset-evidence-rest-*` records; fallback remains matching V1 SVG.

- [ ] **Step 1: 四次独立 image_gen 调用**

1. `components`：参考休字早形，把人木轮廓保真复原为木简摹片、树皮纸旧拓与一枚铜镇纸。
2. `gloss`：传统会意短条置于卷起树皮纸，只有核验短字可辨，其余折叠焦外。
3. `method-limit`：人、木、依凭三枚木签与断开的推断红线，不使用现代流程图。
4. `modern-shape`：现代楷形描纸覆盖旧拓后被掀起，朱批指出遮蔽但不写完整句子。

- [ ] **Step 2: 检查、单点重生成、转换 1080×720 WebP**

沿用 Task 3 的 view_image、ffmpeg、ffprobe 和 200KB 门禁；不得复用“家”案底图或只换色。

- [ ] **Step 3: 更新映射和档案**

写入四条最终提示词、参考输入、SHA-256、文件大小与人木轮廓核验结论。

- [ ] **Step 4: 测试与提交**

Run: `pnpm test`

```bash
git add -f public/assets/evidence/rest/*-v3.webp
git add src/evidence/assets.ts research/rest-ai-evidence-dossier.md
git commit -m "feat(dalisizian): upgrade rest evidence art"
```

---

### Task 5: “取”案四张 AI 证物

**Files:**
- Create: `public/assets/evidence/take/asset-evidence-take-form-v3.webp`
- Create: `public/assets/evidence/take/asset-evidence-take-rite-v3.webp`
- Create: `public/assets/evidence/take/asset-evidence-take-semantic-change-v3.webp`
- Create: `public/assets/evidence/take/asset-evidence-take-moral-fallacy-v3.webp`
- Modify: `src/evidence/assets.ts`
- Modify: `research/take-ai-evidence-dossier.md`

**Interfaces:** Updates four `asset-evidence-take-*` records; fallback remains matching V1 SVG.

- [ ] **Step 1: 四次独立 image_gen 调用**

1. `form`：手耳构件参考保真的青铜铭拓与简牍片；用礼仪记号代替人体，不出现血腥耳朵。
2. `rite`：取耳制度竹简册、封绳和旧布袋；只出现经参考输入保真的短字。
3. `semantic-change`：取得、选择、采用等阶段用不同年代案签和实物筹码串联。
4. `moral-fallacy`：字源材料卷与现代道德评判札分置，被朱线明确隔开。

- [ ] **Step 2: 检查非血腥、轮廓、随机文字和独立构图**

不符合任一项即重生成对应单图；随后按 Task 3 命令转换和压缩。

- [ ] **Step 3: 更新映射、档案、测试并提交**

Run: `pnpm test`

```bash
git add -f public/assets/evidence/take/*-v3.webp
git add src/evidence/assets.ts research/take-ai-evidence-dossier.md
git commit -m "feat(dalisizian): upgrade take evidence art"
```

---

### Task 6: “采”案四张 AI 证物

**Files:**
- Create: `public/assets/evidence/pick/asset-evidence-pick-form-v3.webp`
- Create: `public/assets/evidence/pick/asset-evidence-pick-bian-distinction-v3.webp`
- Create: `public/assets/evidence/pick/asset-evidence-pick-extensions-v3.webp`
- Create: `public/assets/evidence/pick/asset-evidence-pick-leaf-story-v3.webp`
- Modify: `src/evidence/assets.ts`
- Modify: `research/pick-ai-evidence-dossier.md`

**Interfaces:** Updates four `asset-evidence-pick-*` records; fallback remains matching V1 SVG.

- [ ] **Step 1: 四次独立 image_gen 调用**

1. `form`：手取木上物的参考字形复原为简牍、石拓和叶片标本并置。
2. `bian-distinction`：釆、采两张独立册页与分隔压条，轮廓各自保真。
3. `extensions`：采、彩、文采关系以颜料碟、矿物色样、木签和旧织物呈现。
4. `leaf-story`：彩叶故事传闻纸与真实材料册并列，传闻纸被朱批封住。

- [ ] **Step 2: 检查釆／采不混形、无随机文字，转换压缩**

按 Task 3 的 1080×720、200KB 与 view_image 门禁执行。

- [ ] **Step 3: 更新映射、档案、测试并提交**

Run: `pnpm test`

```bash
git add -f public/assets/evidence/pick/*-v3.webp
git add src/evidence/assets.ts research/pick-ai-evidence-dossier.md
git commit -m "feat(dalisizian): upgrade pick evidence art"
```

---

### Task 7: “监”案四张 AI 证物

**Files:**
- Create: `public/assets/evidence/watch/asset-evidence-watch-form-v3.webp`
- Create: `public/assets/evidence/watch/asset-evidence-watch-gloss-v3.webp`
- Create: `public/assets/evidence/watch/asset-evidence-watch-mirror-relation-v3.webp`
- Create: `public/assets/evidence/watch/asset-evidence-watch-modern-story-v3.webp`
- Modify: `src/evidence/assets.ts`
- Modify: `research/watch-ai-evidence-dossier.md`

**Interfaces:** Updates four `asset-evidence-watch-*` records; fallback remains matching V1 SVG.

- [ ] **Step 1: 四次独立 image_gen 调用**

1. `form`：人目与器皿结构参考保真的青铜器铭拓，旁置真实感水盆与铜锈。
2. `gloss`：“临下”短条置于旧帛卷和铜镇纸下，长文不可辨。
3. `mirror-relation`：铜鉴、水盆、观察签与监／鉴关系用实物红线连接。
4. `modern-story`：“只是照镜”传闻札被多份观察材料压住，镜面不出现人物倒影。

- [ ] **Step 2: 检查皿部轮廓、反射内容、随机文字，转换压缩**

按 Task 3 门禁执行。

- [ ] **Step 3: 更新映射、档案、测试并提交**

Run: `pnpm test`

```bash
git add -f public/assets/evidence/watch/*-v3.webp
git add src/evidence/assets.ts research/watch-ai-evidence-dossier.md
git commit -m "feat(dalisizian): upgrade watch evidence art"
```

---

### Task 8: “武”案四张 AI 证物

**Files:**
- Create: `public/assets/evidence/martial/asset-evidence-martial-form-v3.webp`
- Create: `public/assets/evidence/martial/asset-evidence-martial-shuowen-v3.webp`
- Create: `public/assets/evidence/martial/asset-evidence-martial-foot-v3.webp`
- Create: `public/assets/evidence/martial/asset-evidence-martial-value-origin-v3.webp`
- Modify: `src/evidence/assets.ts`
- Modify: `research/martial-ai-evidence-dossier.md`

**Interfaces:** Updates four `asset-evidence-martial-*` records; fallback remains matching V1 SVG.

- [ ] **Step 1: 四次独立 image_gen 调用**

1. `form`：止、戈参考轮廓保真的兵器铭拓与陶片印痕，兵器只作静物证物。
2. `shuowen`：“止戈为武”传统短条残卷与封绳，不扩写正文。
3. `foot`：足迹印、戈形拓片、止义签筹按年代分层陈列。
4. `value-origin`：价值阐释与最初构形分装两个卷袋，朱线只连接材料层级。

- [ ] **Step 2: 检查止／戈轮廓、武器安全表现、随机文字，转换压缩**

按 Task 3 门禁执行。

- [ ] **Step 3: 更新映射、档案、测试并提交**

Run: `pnpm test`

```bash
git add -f public/assets/evidence/martial/*-v3.webp
git add src/evidence/assets.ts research/martial-ai-evidence-dossier.md
git commit -m "feat(dalisizian): upgrade martial evidence art"
```

---

### Task 9: “法”案四张 AI 证物

**Files:**
- Create: `public/assets/evidence/law/asset-evidence-law-old-form-v3.webp`
- Create: `public/assets/evidence/law/asset-evidence-law-shuowen-v3.webp`
- Create: `public/assets/evidence/law/asset-evidence-law-simplification-v3.webp`
- Create: `public/assets/evidence/law/asset-evidence-law-water-fairness-v3.webp`
- Modify: `src/evidence/assets.ts`
- Modify: `research/law-ai-evidence-dossier.md`

**Interfaces:** Updates four `asset-evidence-law-*` records; fallback remains matching V1 SVG.

- [ ] **Step 1: 四次独立 image_gen 调用**

1. `old-form`：灋、法参考轮廓保真的篆形拓片与印模，水、廌、去结构不得缺失融合。
2. `shuowen`：传统水、廌、去短条册页与旧印，不生成额外古文。
3. `simplification`：灋到法的叠层印蜕、年代签和逐层揭页。
4. `water-fairness`：“水即公平”传闻札被缺失构件的朱批与旧形卷纠正。

- [ ] **Step 2: 重点核验廌构件和简化顺序，转换压缩**

任何廌形变成动物插画、缺笔或与去部融合即重生成。按 Task 3 门禁执行。

- [ ] **Step 3: 更新映射、档案、测试并提交**

Run: `pnpm test`

```bash
git add -f public/assets/evidence/law/*-v3.webp
git add src/evidence/assets.ts research/law-ai-evidence-dossier.md
git commit -m "feat(dalisizian): upgrade law evidence art"
```

---

### Task 10: “秋”案四张 AI 证物

**Files:**
- Create: `public/assets/evidence/autumn/asset-evidence-autumn-variants-v3.webp`
- Create: `public/assets/evidence/autumn/asset-evidence-autumn-insect-fire-v3.webp`
- Create: `public/assets/evidence/autumn/asset-evidence-autumn-modern-form-v3.webp`
- Create: `public/assets/evidence/autumn/asset-evidence-autumn-debate-v3.webp`
- Modify: `src/evidence/assets.ts`
- Modify: `research/autumn-ai-evidence-dossier.md`

**Interfaces:** Updates four `asset-evidence-autumn-*` records; fallback remains matching V1 SVG.

- [ ] **Step 1: 四次独立 image_gen 调用**

1. `variants`：虫、火、禾相关参考异体的甲骨片和残拓并置，不把单一形体标成唯一原形。
2. `insect-fire`：虫火材料札、焦边竹简、灰烬与完整标本盒，避免惊悚昆虫特写。
3. `modern-form`：现代禾火描纸与早期异体旧拓分层，不把现代形体倒投古代。
4. `debate`：两种竞争解释封入同等大小的并列卷袋，两边都有支持点和缺口。

- [ ] **Step 2: 核验竞争解释中立性、异体轮廓、随机文字，转换压缩**

按 Task 3 门禁执行；不得通过光照或构图暗示其中一袋是正确答案。

- [ ] **Step 3: 更新映射、档案、测试并提交**

Run: `pnpm test`

```bash
git add -f public/assets/evidence/autumn/*-v3.webp
git add src/evidence/assets.ts research/autumn-ai-evidence-dossier.md
git commit -m "feat(dalisizian): upgrade autumn evidence art"
```

---

### Task 11: 收紧 32/32 资源门禁与证物动效

**Files:**
- Modify: `src/evidence/assets.test.ts`
- Modify: `src/evidence/components.test.tsx`
- Modify: `src/evidence/EvidenceArtifact.tsx`
- Modify: `src/evidence/evidence.css`
- Modify: `src/content/content.json`
- Modify: `src/content/content.test.ts`
- Modify: `qa/evidence-browser.mjs`

**Interfaces:** Final gate requires every primary path to match `./assets/evidence/{home,rest,take,pick,watch,martial,law,autumn}/asset-evidence-*-v3.webp`; fallback remains local V1 SVG.

- [ ] **Step 1: 写最终失败测试**

```ts
for (const evidence of contentPackage.content.evidence) {
  const set = resolveEvidenceAssetSet(evidence.assetId)
  expect(set?.primary).toMatch(/-v3\.webp$/)
  expect(set?.fallback).toMatch(/-v1\.svg$/)
  const payload = readFileSync(resolve('public', set!.primary.slice(2)))
  expect(payload.subarray(0, 4).toString('ascii')).toBe('RIFF')
  expect(payload.subarray(8, 12).toString('ascii')).toBe('WEBP')
  expect(payload.byteLength).toBeLessThanOrEqual(200_000)
}
expect(new Set(primaryHashes).size).toBe(32)
```

- [ ] **Step 2: 运行测试确认 RED 或发现未完成映射**

Run: `pnpm test`

Expected: 若任一资源或映射缺失则 FAIL；全部八案完成后进入 GREEN。

- [ ] **Step 3: 移除正式画面上的非 AI 字形叠层并更新披露**

删除 `EvidenceArtifact` 对 `resolveEvidenceGlyphAsset`、`glyphStages` 和 `.glyph-facsimile-layer` 的正常流程渲染；公版 SVG 文件继续保留作研究追溯，不再叠到玩家看到的 V3 图上。组件测试新增：

```ts
expect(html).not.toContain('glyph-facsimile-layer')
expect(contentPackage.meta.evidenceUi.reconstructionDisclosure).toContain('AI 参考复原')
expect(contentPackage.meta.evidenceUi.reconstructionDisclosure).toContain('并非馆藏原件')
```

将 `content.json` 披露改为：“画面依据所列资料进行 AI 参考复原，并非馆藏原件；古文字形与事实依据均在下列来源单独标明。”

- [ ] **Step 4: 增加不扭曲图像的容器动效**

在 `.evidence-plate::after` 添加低透明侧光扫过，在语义卷／辨伪卷使用轻微朱砂显影；不对 `<img>` 做 skew、rotate 或变形。`prefers-reduced-motion: reduce` 和 `.is-reduced-motion` 将 animation 设为 `none`。

- [ ] **Step 5: 扩展浏览器 QA**

`qa/evidence-browser.mjs` 记录每张正式图的 `currentSrc`，要求 32 个路径均含 `-v3.webp`。另一次通过 CDP 阻断 `*-v3.webp`，打开四类代表证物，要求回退 SVG 加载、`brokenImages=0`、热点和返回焦点仍正常。

- [ ] **Step 6: 验证像素与包体预算**

Run:

```bash
find public/assets/evidence -name '*-v3.webp' -print0 | xargs -0 -n1 ffprobe -v error -select_streams v:0 -show_entries stream=width,height -of csv=p=0
find public/assets/evidence -name '*-v3.webp' -printf '%s\n' | awk '{sum+=$1} END {print sum}'
```

Expected: 32 行均为 `1080,720`；总字节数不超过 `5,500,000`。

- [ ] **Step 7: 完整单元测试与提交**

Run: `pnpm test`

Expected: 15 个或更多测试文件全部通过。

```bash
git add src/evidence src/content/content.json src/content/content.test.ts qa/evidence-browser.mjs
git commit -m "test(dalisizian): enforce complete AI evidence art"
```

---

### Task 12: 真机级复检、文档和覆盖打包

**Files:**
- Modify: `VISUAL-QA.md`
- Modify: `research/evidence-source-register.md`
- Modify: `release-assets/大理寺字案录-小工具包-20260826.zip`

**Interfaces:** Produces final QA record and one overwritten offline package; no new versioned ZIP.

- [ ] **Step 1: 构建并启动本地预览**

Run: `pnpm build && pnpm preview --host 127.0.0.1 --port 4173`

- [ ] **Step 2: 跑 32 证物浏览器脚本**

Run: `DALISIZIAN_URL=http://127.0.0.1:4173/ DALISIZIAN_CDP=http://127.0.0.1:9223 node qa/evidence-browser.mjs`

Expected: 32/32 正式图、三宽无溢出、最小目标 44px、0 破图、回退测试通过、控制台 0 error／warning。

- [ ] **Step 3: 人工查看八张代表截图**

每案至少查看一张 390px 截图，确认独立构图、真实材质、无随机文字、热点不遮挡关键证物；字形卷额外与 dossier 参考图并排复核。

- [ ] **Step 4: 更新 QA 与来源登记**

`VISUAL-QA.md` 记录 32/32 路径、尺寸、总字节、三宽测量、回退和减少动态结果。`evidence-source-register.md` 将 32 件资源性质更新为 `AI reference reconstruction`，并指向八份 dossier；不把生成图描述成史料原件。

- [ ] **Step 5: 执行最终质量门**

Run: `pnpm lint && pnpm test && pnpm build`

Expected: 三条命令 exit 0。

- [ ] **Step 6: 覆盖原 ZIP 并验证**

运行以下命令生成并验证；变量名只用于本任务，不复用系统环境选项：

```bash
evidence_package_stage=$(mktemp -d /tmp/dalisizian-ai-package.XXXXXX)
evidence_verify_stage=$(mktemp -d /tmp/dalisizian-ai-verify.XXXXXX)
jar --create --no-manifest --file "$evidence_package_stage/package.zip" -C dist .
mv "$evidence_package_stage/package.zip" "release-assets/大理寺字案录-小工具包-20260826.zip"
unzip -t "release-assets/大理寺字案录-小工具包-20260826.zip"
unzip -q "release-assets/大理寺字案录-小工具包-20260826.zip" -d "$evidence_verify_stage"
diff -qr dist "$evidence_verify_stage"
test "$(stat -c %s "release-assets/大理寺字案录-小工具包-20260826.zip")" -lt 8000000
```

- [ ] **Step 7: 请求代码审查并修复 Critical／Important**

审查范围从本计划提交前的基线到最终 HEAD；重点核查来源许可、32/32 唯一资源、业务文案边界、回退闭环和移动安全区。修复后重新执行 Step 5 与 Step 6。

- [ ] **Step 8: 提交发布产物**

```bash
git add VISUAL-QA.md research/evidence-source-register.md release-assets/大理寺字案录-小工具包-20260826.zip
git commit -m "build(dalisizian): package complete AI evidence art"
```
