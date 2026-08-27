# “秋”案 AI 证物生成档案

## 事实边界

- 秋字存在多阶段与竞争解释；图像不得把虫、火、禾中的某一条线索表现成唯一结论。
- Commons 查询存在秋甲骨与小篆公版文件，不存在所查询的 `秋-bronze.svg`；因此不生成“秋金文”图形。
- 昆虫只用抽象标本盒或材料札，避免惊悚特写；热点区为 `(30%,40%)` 与 `(70%,62%)`。

## 参考来源

| 阶段 | 直接来源 | 著录号 | 许可 |
|---|---|---|---|
| 商代甲骨 | https://commons.wikimedia.org/wiki/File:秋-oracle.svg | 林 2.15.9；Sinica 字库定位 `43.F211` | Public domain |
| 《说文》小篆 | https://commons.wikimedia.org/wiki/File:秋-seal.svg | S05082；Sinica 字库定位 `27.79CB` | Public domain |
| 甲骨文数据库 | https://xiaoxue.iis.sinica.edu.tw/jiaguwen | 中央研究院小学堂 | 只作事实核对 |
| 异体材料 | https://dict.variants.moe.edu.tw/dictView.jsp?ID=31183&la=0 | 教育部字条 31183 | 只作事实核对 |
| 竞争解释 | https://case.ntu.edu.tw/blog/?p=41292 | 台湾大学科学教育发展中心专题 | 只作事实核对，不作排他定论 |

## 本地输入哈希

`autumn-qiu-form-reference.png`：`17b0600f98b92687d8771affecb3a4c077d607b36cd75509aceac03d0f048ede`。输入左为甲骨、右为小篆；由公版 SVG 在白底分别栅格化后并列，不进入发布包。

## 四图提示词

1. `variants`：甲骨片、残拓与小篆摹片并列；只用两份参考轮廓，不虚构缺失金文。
2. `insect-fire`：虫火材料札、焦边竹简、少量灰烬与封闭标本盒；无昆虫特写，无可读长文。
3. `modern-form`：现代禾火描纸与早期参考旧拓分层，现代描纸明显是后置校勘层。
4. `debate`：两种竞争解释封入同等大小卷袋，光照、面积与材质保持中立；两边均有支持筹与缺口签。

## 轮廓核验

- 不生成秋金文或第三种“早期字形”；甲骨、小篆只允许材质化，不改轮廓。
- 两套竞争解释必须视觉同权；不允许随机古文、水印、现代实验器材或惊悚昆虫。

## 生成记录

| 证物 | AI 原始输出 | WebP SHA-256 | 字节 | 审查结论 |
|---|---|---|---:|---|
| `variants` | `exec-8ec1c033-bb07-442c-bb1e-eb4f023e8a54.png` | `ffae6bc984c06443cae82d744b5119a14f85c6c0b6632290266084b93b1446ef` | 136684 | 仅出现核验过的甲骨、小篆两形；无虚构金文。 |
| `insect-fire` | `exec-739ef7d9-ad06-4a08-adf9-7ad82f20293c.png` | `92f731f43cc37a716656d4db1a168083fb46e687ef34485a0ec715af44655e86` | 81250 | 标本盒封闭，无虫体特写；虫、火只作为材料线索。 |
| `modern-form` | `exec-5003b5cf-d58f-4954-9dd4-9193d158474d.png` | `d373e4137c0c1d71e153fa53bfd97dbd2d580d0b3c1e22264badb0a41f0fc9cc` | 93524 | 两份旧拓轮廓准确；上层现代校勘纸为空白，不伪造今形。 |
| `debate` | `exec-5a889c0c-d653-49d7-9448-67cc7ffacc79.png` | `6cc8211022be1ba18de9abbfd7dc724fc2093dd6c9e1482d36bc704703b863de` | 68260 | 两袋等大、等光、等材质，各有支持筹与缺口筹，视觉同权。 |

四张正式资源均为 1080×720 WebP；生成画面不含可读长文、随机古文、水印或现代 UI。
