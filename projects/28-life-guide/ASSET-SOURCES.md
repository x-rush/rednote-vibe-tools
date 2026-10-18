# 高性价比人生指南 · 内容、素材与许可

复核日期：2026-10-18。当前名称“高性价比人生指南”，简介“陪你把日子过得更好”。插画和图标均不含产品名称文字。

## 正文与原代码

- 上游：[eternity4719 / HowToLiveBetter](https://github.com/eternity4719/HowToLiveBetter)。
- 固定提交：[5f210ca953b7b538c042ad8515d5c355b766a194](https://github.com/eternity4719/HowToLiveBetter/tree/5f210ca953b7b538c042ad8515d5c355b766a194)，源提交日期2026-10-15。
- 包含34章765条、9篇附文、43个术语、385条更新记录、原README及许可；源文件哈希见 [导入报告](release/import-report.json)。
- 正文采用CC BY 4.0，完整许可保留在 [reference/LICENSE](reference/LICENSE)。改编为移动端离线阅读、搜索/筛选和本机进度，原文及出处保留；不代表原作者认可本工具。
- 原解析代码采用MIT，声明保留在 [reference/LICENSE-CODE](reference/LICENSE-CODE)。[解析器副本](reference/upstream-parser.js)仅供开发对照，不进入上传ZIP。
- 应用名、简介和图标路径位于content.json的meta中；源标题、原作者与固定提交独立保留。包内“指南说明”可查阅完整许可。

## 当前图片

| 文件 | 用途 | 尺寸 | 大小 |
| --- | --- | --- | --- |
| [assets/cat-reading.webp](assets/cat-reading.webp) | 每章banner和面板插画 | 480×322，透明背景 | 41,210 bytes |
| [assets/app-icon.png](assets/app-icon.png) | 平台图标及包内favicon | 512×512，蓝色背景 | 160,890 bytes |

两项均于2026-10-17使用内置imagegen生成，没有网络搜图或运行时外链。最终交付源是项目assets，随构建打入ZIP，不依赖本机生成目录。文件哈希见 [package-manifest.json](release/package-manifest.json)。使用系统字体栈，无外部字体或CDN。

## 插画生成记录

提示词摘要：白色三花小猫抱着钴蓝色书本阅读，旁边薄荷绿盆栽和两本书，细墨线及柔和水彩，黄色和炭灰色斑纹，透明背景，无文字，适合小尺寸展示。

原始文件相对于本机CODEX_HOME：

`generated_images/01a14a05-64ba-7f50-8a11-99d0017a33c4/exec-55542361-6751-48d5-9efa-c8f9c793ff30.png`

仅做透明边裁切、缩放和WebP压缩，最终以项目内文件为准。

## 图标生成记录

以原小猫为角色和画风参考，生成浅蓝方形背景及抱蓝书的小猫，无文字；通过本机Sharp仅缩放/压缩为512×512 PNG，未改变构图。Sharp是开发素材处理工具，不是应用依赖。

原始文件相对于本机CODEX_HOME：

`generated_images/01a14a05-64ba-7f50-8a11-99d0017a33c4/exec-f169dfe5-8b49-40f1-8155-874f9c87806a.png`

以下保留实际使用的完整提示词。“小猫的生活指南”是生成时的临时工作名，1.3.4已改为“高性价比人生指南”；图标没有文字，无需改画。历史提示词不作为当前产品命名依据。

> Use case: logo-brand. Asset type: final square mobile mini-tool app icon for a gentle Chinese life-advice reader named 小猫的生活指南. Use the attached cat illustration as the character and illustration-style reference. Create a polished 1024x1024 square, full-bleed very pale periwinkle blue background, with ONE large centered cute cream-white calico cat, warm amber and charcoal patches, pink ears and tiny friendly face, hugging an open cobalt-blue book. Preserve the reference's warm hand-ink outlines and soft watercolor texture. Simplify for recognition at 48px: only cat head, paws and a clearly recognizable blue book; no plants, no stacks of books, no extra objects, no detailed scenery. Cat and book occupy about 78 percent of the square with balanced generous margins. Friendly, calm, warm, blue-and-cream palette matching the existing reader. Crisp silhouette, clean edges. No text, letters, numerals, watermark, border, mockup, multiple icons or drop shadow. Deliver one complete square app icon with opaque background, no rounded-corner cutouts.
