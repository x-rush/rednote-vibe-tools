# “休”案 AI 证物生成档案

## 事实边界

- 只说明“人、木”构件关系及传统“人依木”解释，不把直观会意法扩张成全部汉字的通用规则。
- 可辨古文字只采用 Commons 的休字甲骨、金文、小篆参考；页面未给甲骨与小篆著录号，档案明确记录此限制。
- 热点区为 `(30%,40%)` 与 `(70%,62%)`；关键人木轮廓避开按钮正下方。

## 参考来源

| 阶段 | 直接来源 | 著录号 | 许可 |
|---|---|---|---|
| 甲骨 | https://commons.wikimedia.org/wiki/File:休-oracle.svg | 来源页未列具体著录号 | Public domain |
| 金文 | https://commons.wikimedia.org/wiki/File:休-bronze.svg | B08758 | Public domain |
| 《说文》小篆 | https://commons.wikimedia.org/wiki/File:休-seal.svg | 来源页未列具体著录号 | Public domain |
| 传统释形与异体 | https://dict.variants.moe.edu.tw/dictView.jsp?ID=936&la=0 | 教育部字条 936 | 只作事实核对 |

## 本地输入哈希

`rest-xiu-form-reference.png`：`804e01c0819792f5516d53e02b0925c39747aa6404a1e93454b0b9249ad7d8f5`。输入左至右为甲骨、金文、小篆。

## 四图提示词

1. `components`：木简摹片、树皮纸旧拓与铜镇纸三层证物，参考中的人木关系保真材质化。
2. `gloss`：卷起树皮纸、旧帛条与压条，只有现代楷体单字“休”可辨，释文不写入画面。
3. `method-limit`：人、木、依凭三枚无字木签与中途断开的红绳，用实物关系表达方法边界。
4. `modern-shape`：现代楷形描纸覆盖旧拓后被掀起，朱砂圈点遮蔽位置但不写句子。

## 轮廓核验

- 参考形的人旁、木旁相对位置、线段交接不可变；三个阶段不得被模型合并成一个新字。
- 不允许树下人物插画代替字形，也不允许随机古文、现代办公用品或水印。

## 生成记录

| 资源 | image_gen 原图 | WebP SHA-256 | 字节 | 核验结论 |
|---|---|---|---:|---|
| `components` | `exec-8691673e-4403-45e1-9357-be583a2be1e6.png` | `cc10fc2a3b3d99e4294030bec0d9c698e8db952b652ebeeed0cbdffb39c266ca` | 154506 | 三期人木轮廓分置于竹、纸、帛，未合并改笔。 |
| `gloss` | `exec-bac4f887-e642-47ff-8718-3394b65d8a27.png` | `d57cbeebf1d092ca269687bfe1d429ca0afe5e11a59fffbf41cc7a9bdddda0f9` | 64076 | 树皮卷、帛卷与压条均无可读正文。 |
| `method-limit` | `exec-90cedd7e-c9ef-4bcc-a4f4-5eae9d8cf739.png` | `87bf9f4e92293f05ac52771565615bfbd0fd14736422887d05a758f8d8ce87ef` | 142966 | 实物签筹关系在空白结论签前断开；无文字流程图。 |
| `modern-shape` | `exec-f76f6192-d1ff-4048-b287-bf229e727da9.png` | `0bd62fe5a9cd46aa4d754b9ed7ed2e61f194b4fa2c13be6afc613e468ac95857` | 94724 | 描纸掀起与朱圈遮蔽关系明确，底拓内容不可辨。 |

四图均由内置 `image_gen` 独立生成，离线转为 1080×720 WebP（quality 78）。
