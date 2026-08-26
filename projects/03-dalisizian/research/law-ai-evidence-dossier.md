# “法”案 AI 证物生成档案

## 事实边界

- 只采用可核验的“灋”与“法”小篆、公版“法”金文；Commons 不存在所查询的 `法-oracle.svg`，因此不生成“法甲骨”图形。
- “灋”的水、廌、去构件必须同时保留；廌只能作为字形构件，不能变成写实神兽插画。
- “法，今文省”与传统释形分层；不把“水即公平”当作完整字源定论。
- 热点区为 `(30%,40%)` 与 `(70%,62%)`。

## 参考来源

| 字形 | 直接来源 | 著录号 | 许可 |
|---|---|---|---|
| 灋·《说文》小篆 | https://commons.wikimedia.org/wiki/File:灋-seal.svg | 来源页未列具体著录号 | Public domain |
| 法·金文 | https://commons.wikimedia.org/wiki/File:法-bronze.svg | 来源页未列具体著录号 | Public domain |
| 法·《说文》小篆 | https://commons.wikimedia.org/wiki/File:法-seal.svg | 来源页未列具体著录号 | Public domain |
| 灋字书材料 | https://ctext.org/dictionary.pl?char=灋&if=en | 中国哲学书电子化计划字条 | 只作事实核对 |
| 法／灋异体 | https://dict.variants.moe.edu.tw/dictView.jsp?ID=23553&la=0 | 教育部字条 23553 | 只作事实核对 |

## 本地输入哈希

- `law-fa-archaic-reference.png`：`876c14d9c6373dd3547795db141154d2282552288c93acd1ec9c2de2ab4b08d0`，为灋小篆。
- `law-fa-seal-reference.png`：`1470104cc9b1b06547117967cba864798ad9b005b38468d6364abed16ab60451`，为法小篆。

## 四图提示词

1. `old-form`：灋、法两枚篆形拓片与印模并列；按参考保真，不生成不存在的甲骨形。
2. `shuowen`：水、廌、去三组构件册页与旧印；以物件分组，不写长篇古文。
3. `simplification`：灋到法的叠层印蜕、年代签与逐层揭页；只使用两份参考轮廓。
4. `water-fairness`：传闻札被旧形卷与缺失构件朱批压住，札文不可辨。

## 轮廓核验

- 灋的三个构件必须完整、分区清晰；任何廌动物插画、缺笔、融合或新造甲骨字都拒收。
- 不允许随机古文、法槌、现代法院徽章、水印或办公纸。

## 生成记录

| 资源 | image_gen 原图 | WebP SHA-256 | 字节 | 核验结论 |
|---|---|---|---:|---|
| `old-form` | `exec-65302f13-42a4-4047-b68c-b9609c0446b7.png` | `013ff54006c084141429bec0b8059846963c8e7f199e3d2413c5b951b65a052d` | 144654 | 灋／法各有拓片与印模；未生成甲骨形，灋三构件完整。 |
| `shuowen` | `exec-c57abfa0-34fe-4e0b-8be3-f19ea6ce5a95.png` | `de8b42cd045d3d8b4b6df2669edf9c51e54b1c0b6dacd2c60f9f686d72d15290` | 74608 | 灋形唯一可读，水器、抽象构件块与素布分区；无伪印文。 |
| `simplification` | `exec-76f74f94-4500-4bb6-8b25-275d4a7272ce.png` | `944bda7843b48b4980731587e2ad8758ae2af66b322dc9303a038c337badbd32` | 98438 | 上层法／下层灋顺序明确，仅两份参考形。 |
| `water-fairness` | `exec-98468a50-555f-434f-941e-5b7b521826ff.png` | `c96815c2abf17ef2e0a2b21c41a524f997ad3f40f0f7d904064d6f06f3cb9abf` | 42310 | 灋卷、无字传闻包、水器与三枚素玉筹分开；无伪印文。 |

四张正式图均由内置 `image_gen` 生成，离线转为 1080×720 WebP（quality 78）；`shuowen` 与 `water-fairness` 首次输出因印章表面出现伪字被拒收，表中记录的是重生成版本。
