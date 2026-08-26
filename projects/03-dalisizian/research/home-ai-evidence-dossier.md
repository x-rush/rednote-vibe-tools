# “家”案 AI 证物生成档案

## 事实边界

- 正式图只复原案头物件与字形摹片，不冒充出土原件或馆藏扫描。
- 可辨早期字形只能来自下列三份公版轮廓；模型不得补笔、改写或自由生成其他古文字。
- 《说文》传统分析与社会史推断分层呈现；单一构件不能证明普遍居住制度。
- 玩家热点位于画面约 `(30%,40%)` 与 `(70%,62%)`，主体周围保留清楚、低纹理的观察区。

## 参考来源

| 阶段 | 直接来源 | 著录号 | 许可 |
|---|---|---|---|
| 商代甲骨 | https://commons.wikimedia.org/wiki/File:家-oracle.svg | J17442 | Public domain；无需署名 |
| 西周金文 | https://commons.wikimedia.org/wiki/File:家-bronze.svg | B11216 | Public domain；无需署名 |
| 《说文》小篆 | https://commons.wikimedia.org/wiki/File:家-seal.svg | S05205 | Public domain；无需署名 |
| 传统释形 | https://ctext.org/shuo-wen-jie-zi/mian-bu/ens | 《说文·宀部》家字条 | 网页仅用于事实核对，不作为生成图素材 |
| 异体与释形 | https://dict.variants.moe.edu.tw/dictView.jsp?ID=10794 | 教育部字条 10794 | 网页仅用于事实核对，不作为生成图素材 |

## 本地输入哈希

| 输入 | SHA-256 |
|---|---|
| `home-jia-oracle-reference.png` | `d18613b6c0f4521fc6315220741929cce6dddd14d47da543298be629a8fef8d7` |
| `home-jia-bronze-reference.png` | `9f3fe5fe902f4d97fcd08a5994bd00f98a5c38a46e97c671d9fcbccfe0ad3770` |
| `home-jia-seal-reference.png` | `673bee0c8098bf6febd0dfe7cf7fe6e7137326b230936516d3a390844ba4961a` |

## 四图提示词

1. `early-form`：唐代大理寺案房俯拍证物照；三片不同年代旧拓置于乌木案、靛青衬布与铜镇纸上；三份参考字形按甲骨、金文、小篆顺序逐片保真嵌入；无其他可读文字。
2. `shuowen`：宀部残卷、卷轴压条、朱砂印泥和折起的长文；仅允许现代楷体单字“家”可辨，传统释文由界面承担，画内不生成正文。
3. `phonetic`：宀形屋檐木签、内部构件木签、声符证据签与断续红绳组成实物勘校关系；不做现代流程图，不写句子。
4. `social-leap`：传闻札、史料卷袋、封签与被截断的越界朱线；所有札文字焦外或遮挡，不出现可读结论。

## 轮廓核验

- 三个参考形只允许材质化，不允许改变封闭区、相交关系、部件数量和线条端点。
- 每张输出检查随机汉字、拉丁字母、水印、现代文具和人物；命中任一项即单图重生成。
- 长文始终折叠、焦外或遮挡；可读事实由 `content.json` 与界面渲染。

## 生成记录

正式生成后逐图追加工具输出路径、最终提示词、WebP 哈希、字节数与核验结论。
