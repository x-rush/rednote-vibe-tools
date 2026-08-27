# “武”案 AI 证物生成档案

## 事实边界

- “止戈为武”是有出处的传统解释；早期“止”与足／行进相关，不能只按现代“停止”义倒推。
- 兵器只作为封存静物证物，不出现战斗、伤口或威胁动作。
- 热点区为 `(30%,40%)` 与 `(70%,62%)`。

## 参考来源

| 阶段 | 直接来源 | 著录号 | 许可 |
|---|---|---|---|
| 商代甲骨 | https://commons.wikimedia.org/wiki/File:武-oracle.svg | 来源页列 Sinica 字库定位 `43.EF5F`，未列 J 编号 | Public domain |
| 西周金文 | https://commons.wikimedia.org/wiki/File:武-bronze.svg | B17520；作册大方鼎／集成 02759 | Public domain |
| 《说文》小篆 | https://commons.wikimedia.org/wiki/File:武-seal.svg | S09412 | Public domain |
| 传统释形 | https://ctext.org/shuo-wen-jie-zi/ge-bu1/ens | 《说文·戈部》武字条 | 只作事实核对 |
| 止的早义 | https://www.csb.gov.hk/hkgcsb/ol/news/no101/html/sc/p8.html | 香港公务员事务局《文讯》 | 只作事实核对 |

## 本地输入哈希

`martial-wu-form-reference.png`：`5e6ccd1c34ed51b7e98dfc3e947b05002bed77d3bda73fbbb71c23a777c74b3c`。输入左至右为甲骨、金文、小篆。

## 四图提示词

1. `form`：兵器铭拓、陶片印痕、封存戈形器物与旧布；止、戈关系按参考轮廓保真。
2. `shuowen`：传统短条残卷、封绳与铜镇纸；只允许现代楷体单字“武”可辨。
3. `foot`：足迹印、戈形拓片与年代筹分层陈列；不写现代释义句。
4. `value-origin`：价值阐释与构形材料分装两个卷袋，朱线只标材料层级，不暗示二者等同。

## 轮廓核验

- 止、戈的交接与方向不得改成模型自造兵器符号；武器须无人物持握、无血迹。
- 不允许随机古文、现代军用品、水印或战争场景。

## 生成记录

| 资源 | image_gen 原图 | WebP SHA-256 | 字节 | 核验结论 |
|---|---|---|---:|---|
| `form` | `exec-5d22f868-f510-49c7-bab4-79456169bad4.png` | `ce6852df27848da8e8d6e79eebb8c7fdad0b48e85be7cca6af987613cb25ccbf` | 128830 | 武三期轮廓分置，止／戈未改笔；戈残件包裹封存。 |
| `shuowen` | `exec-22e5cb17-50e0-4a2b-bf4c-7324286a7105.png` | `c9f6bde1eee059c106975371a383bbf539367cdc8f48d7fd249fe87ca6f6aca7` | 69536 | 空帛卷与包裹器物构成传统解释卷，无文字。 |
| `foot` | `exec-518b8ad6-82c4-4403-9dcf-9fb28ac068a8.png` | `6a7094be9db35510d03e1e46f6c802054320b1696a86254a63accd2f736e1755` | 137790 | 足印、抽象器物拓和三枚筹分层；重生版无 UI 圆圈。 |
| `value-origin` | `exec-7f81b80d-225e-40d2-ab4b-019855383658.png` | `803eb4dbb9cbd1d06103e3e214e989db41efa67ae4b7efe618da7ee39f79c584` | 79226 | 两卷袋和两枚证据牌视觉同权，各自连线且不跨层。 |

四张正式图均由内置 `image_gen` 独立生成，离线转为 1080×720 WebP（quality 78）；`foot` 首次输出因含白色 UI 圆圈被拒收，表中记录的是重生成版本。
