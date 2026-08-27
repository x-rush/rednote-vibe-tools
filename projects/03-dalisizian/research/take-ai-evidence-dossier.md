# “取”案 AI 证物生成档案

## 事实边界

- 早期手形、耳形构件与相关礼制材料只作历史层说明；不把早期语境扩张为现代词义的道德属性。
- 表现必须非血腥，不展示人体伤口或写实残肢；用铭拓、礼仪记号、封绳与筹码代替。
- 三份参考页均为 Public domain，但 Commons 模板未列具体著录号；不另行猜测编号。
- 热点区为 `(30%,40%)` 与 `(70%,62%)`。

## 参考来源

| 阶段 | 直接来源 | 著录号 | 许可 |
|---|---|---|---|
| 甲骨 | https://commons.wikimedia.org/wiki/File:取-oracle.svg | 来源页未列具体著录号 | Public domain |
| 金文 | https://commons.wikimedia.org/wiki/File:取-bronze.svg | 来源页未列具体著录号 | Public domain |
| 《说文》小篆 | https://commons.wikimedia.org/wiki/File:取-seal.svg | 来源页未列具体著录号 | Public domain |
| 字书与古籍定位 | https://ctext.org/dictionary.pl?char=取&if=en | 中国哲学书电子化计划字条 | 只作事实核对 |
| 历代释义 | https://dict.variants.moe.edu.tw/dictView.jsp?ID=5237 | 教育部字条 5237 | 只作事实核对 |

## 本地输入哈希

`take-qu-form-reference.png`：`503e06047432058e4665cce19a05eae7a10c52d3114c674b4455e7e7826714dc`。输入左至右为甲骨、金文、小篆。

## 四图提示词

1. `form`：青铜铭拓、简牍片与礼仪标记并置，保留参考手耳结构，不出现写实耳朵。
2. `rite`：竹简册、封绳、旧布袋与无字计数筹，正文卷起或焦外。
3. `semantic-change`：不同年代案签、取得筹码、选择签筹与采用封签按材质分层，不写现代句子。
4. `moral-fallacy`：字源材料卷与现代评判札分置，朱线在二者间断开；札文不可辨。

## 轮廓核验

- 手形、耳形的相对关系只按参考材质化；禁止血腥、人体特写、随机古文和现代流程图。
- 语义变化通过物件年代与分区表达，不让画内文字承担事实说明。

## 生成记录

| 资源 | image_gen 原图 | WebP SHA-256 | 字节 | 核验结论 |
|---|---|---|---:|---|
| `form` | `exec-57e48127-d44c-418b-8e9e-57bb46c9a39c.png` | `a084690ae54abb07e5c2281a2edc9062ccfabf777a3a80a4f3e313aff2fe4742` | 127402 | 三期轮廓独立清楚；全图无人体、血迹或伪长文。 |
| `rite` | `exec-1b2b19fc-5a4e-4176-9ea0-ed228e80461f.png` | `39426103440296edd49e73529f3cd38d02d3b8c376e2efe8eb7eae657dfbe363` | 112676 | 闭合简册、封袋和计数筹均为非血腥制度物证。 |
| `semantic-change` | `exec-a7681301-a21c-4d42-91e1-aebe5f91e479.png` | `af5603e03b595cfc35cdbaf7eacf8f383693e4be789bbec8af031c2c648bc9eb` | 141078 | 三站材料年代和用途分层，标签为空。 |
| `moral-fallacy` | `exec-b9ab09ff-6e4a-42e4-a540-7fefcffa76d7.png` | `a2df5ba99fc8efdbdbe006753ff672edab2597dbbc5c8bba5a8c8fc7243ecfa4` | 73698 | 旧材料卷与新评判札被铜钉断线分隔，无可读评语。 |

四图均由内置 `image_gen` 独立生成，离线转为 1080×720 WebP（quality 78）。
