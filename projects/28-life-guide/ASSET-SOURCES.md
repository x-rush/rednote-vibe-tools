# 素材与来源

- `assets/cat-reading.webp`：本任务使用内置 imagegen 生成的原创三花小猫读书插画，透明背景；只做裁去透明边、缩放及 WebP 压缩，480×322，41,210 bytes。生成日期 2026-10-17。
- 原始生成图：`C:/Users/77958/.codex/generated_images/01a14a05-64ba-7f50-8a11-99d0017a33c4/exec-55542361-6751-48d5-9efa-c8f9c793ff30.png`。
- 生成提示：白色三花小猫抱着钴蓝色书本阅读，旁边薄荷绿盆栽和两本书，细墨线及柔和水彩，黄色和炭灰色斑纹，透明背景，无文字，适合约100px展示。
- 正文来自 https://github.com/eternity4719/HowToLiveBetter ，固定 commit 见 `src/content/content.json` 与 `release/import-report.json`。内容 CC BY 4.0；移植原解析/筛选逻辑的代码遵循 MIT 并保留原声明于 `reference/LICENSE-CODE`，包内指南说明可读完整许可。
- 不使用运行时外部图片、字体或 CDN。

- `assets/app-icon.png`：内置 imagegen 根据本项目原小猫插画生成的应用图标。2026-10-17，蓝色背景，三花小猫抱蓝色书本，无文字；原始生成图 `C:/Users/77958/.codex/generated_images/01a14a05-64ba-7f50-8a11-99d0017a33c4/exec-f169dfe5-8b49-40f1-8155-874f9c87806a.png`。生成素材通过 Sharp 仅缩放/压缩为 512×512 PNG，未改变构图。
- 图标生成提示：沿用原三花小猫和细墨线水彩风格，浅蓝方形背景，中央小猫抱钴蓝书本，简化为适合小尺寸识别的单一主体，无文字、植物、书堆或水印。

图标完整生成提示词（内置 imagegen）：

> Use case: logo-brand. Asset type: final square mobile mini-tool app icon for a gentle Chinese life-advice reader named 小猫的生活指南. Use the attached cat illustration as the character and illustration-style reference. Create a polished 1024x1024 square, full-bleed very pale periwinkle blue background, with ONE large centered cute cream-white calico cat, warm amber and charcoal patches, pink ears and tiny friendly face, hugging an open cobalt-blue book. Preserve the reference's warm hand-ink outlines and soft watercolor texture. Simplify for recognition at 48px: only cat head, paws and a clearly recognizable blue book; no plants, no stacks of books, no extra objects, no detailed scenery. Cat and book occupy about 78 percent of the square with balanced generous margins. Friendly, calm, warm, blue-and-cream palette matching the existing reader. Crisp silhouette, clean edges. No text, letters, numerals, watermark, border, mockup, multiple icons or drop shadow. Deliver one complete square app icon with opaque background, no rounded-corner cutouts.
