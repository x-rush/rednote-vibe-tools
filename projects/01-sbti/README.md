# SHBTI｜山海兽格测试

`SHBTI` 的英文释义为 `Shanhai Beast Temperament Indicator`，中文解释为“山海异兽性格倾向指标”。这是纯前端、移动端优先的山海文化人格倾向测试。每局从 48 道题库中按四维均衡规则抽取 24 道四选一情境题，计算四组偏好，并映射为 16 种山海异兽人格结果。

## 产品边界

- 这是娱乐性文化创作，不用于心理诊断、能力评估或重要人生决策。
- 结果页将古籍记载、历史图像和 SHBTI 产品演绎分层展示，不把现代人格映射冒充传统文化结论。
- 16 种异兽形象均基于独立参考 dossier 制作；正式图是艺术化创意重构，不是馆藏实物或古本原图。

## 首发内容

- 48 道冻结题库，每局抽取 24 道，四个维度各 6 题。
- 16 种冻结兽格、确定性平分规则与接近型结果说明。
- 最近一份结果、未完成进度和设置均只保存在 `localStorage`；存储被阻止时可降级为本次内存运行。
- 引导角色“闻山”参与首页续卷、首次三句说明、四章递卷／收卷、答题与结果帮助、显形和异常恢复。
- 章节卷页使用递卷姿态，“问闻山 / 三问闻山”使用阅卷姿态；两张增强图均有 placeholder 与 CSS 墨影降级。
- 答题界面使用四枚卷印与纵向行动签；选择后需主动“落印”，不会自动跳题。
- 16 张参考核验正式图与 16 张同源轻量占位图；图片失败时继续降级为 CSS 墨影和文字。

## 运行约束

- React + TypeScript + Vite，构建产物为纯静态 HTML/CSS/JS。
- 无后端、运行时 CDN、必需外部 API 或 Service Worker。
- 业务内容只来自 `src/content/content.json`。
- 不保存用户图片、Base64、音视频或 Blob。
- Vite 使用相对资源基址，`dist/` 可作为小红书小工具 Web 静态包上传。

## 开发与门禁

在仓库根目录安装依赖后：

```bash
cd projects/01-sbti
pnpm dev
```

提交前必须执行：

```bash
pnpm lint
pnpm test
pnpm build
```

响应式与交互门禁覆盖 375、390、430 CSS px，以及首次引导、24 题作答、平分、接近型、结果、历史、图片失败和存储异常路径。

设计、证据与验收材料：

- `DESIGN.md`
- `UX-SPEC.md`
- `UI-HANDOFF.md`
- `PROMPTS.md`
- `VISUAL-QA.md`
- `design/preview.html`
- `UI-REDESIGN-V2.md`
- `INTERACTION-MOTION-SPEC.md`
- `design/preview-v2.html`
- `ART-REQUEST.md`
- `research/*-reference-dossier.md`
- `public/assets/sbti/asset-manifest.json`
