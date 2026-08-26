# “采”案 AI 证物生成档案

## 事实边界

- “采”与“釆”必须分开：前者参考爪／木相关形体，后者只采用独立小篆参考，不能因显示相近而混形。
- “彩叶造字”只作为传闻层，不能由生成图暗示为史实。
- 热点区为 `(30%,40%)` 与 `(70%,62%)`，关键字形不置于按钮中心。

## 参考来源

| 字头／阶段 | 直接来源 | 著录号 | 许可 |
|---|---|---|---|
| 采·甲骨 | https://commons.wikimedia.org/wiki/File:采-oracle.svg | J14195 | Public domain |
| 采·金文 | https://commons.wikimedia.org/wiki/File:采-bronze.svg | B08735 | Public domain |
| 采·小篆 | https://commons.wikimedia.org/wiki/File:采-seal.svg | S04357 | Public domain |
| 釆·小篆 | https://commons.wikimedia.org/wiki/File:釆-seal.svg | S00801 | Public domain |
| 字头区分 | https://ctext.org/shuo-wen-jie-zi/bian-bu/ens | 《说文·釆部》 | 只作事实核对 |
| 异体与释形 | https://dict.variants.moe.edu.tw/dictView.jsp?ID=46886&q=1 | 教育部字条 46886 | 只作事实核对 |

## 本地输入哈希

- `pick-cai-form-reference.png`：`5fafb30c8b6c51024b8bd93268cfe82e801440509247dd2a58964884f952ec51`，左至右为采甲骨、金文、小篆。
- `pick-bian-form-reference.png`：`b5a576f319e5d61be3fced5b10202cd6b6f42ca9f014d9abc256f4eca511b405`，为釆小篆。

## 四图提示词

1. `form`：简牍、石拓和叶片标本并置；采的三阶段参考轮廓保真，叶片只是物证材质。
2. `bian-distinction`：釆、采两张独立册页与中间压条；两字形分别取自各自参考，禁止互相补笔。
3. `extensions`：颜料碟、矿物色样、旧织物、无字木签与封绳呈现义项延展，不写句子。
4. `leaf-story`：彩叶传闻纸与真实材料册并列，传闻纸被朱批封住，文字不可辨。

## 轮廓核验

- 逐图比较釆／采的顶部、下部和交接线；任何混形、增笔或模型自造变体都拒收。
- 不允许以漂亮彩叶构图暗示传闻成立；不允许随机汉字、水印或现代文具。

## 生成记录

正式生成后逐图记录输出路径、最终提示词、WebP 哈希、大小与釆／采分形结论。
