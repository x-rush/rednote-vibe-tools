# “监”案 AI 证物生成档案

## 事实边界

- 采用繁体旧形“監”的甲骨、金文、小篆参考说明多阶段材料；现代简体“监”只由界面业务文本呈现。
- 监／鉴关系不能被压成“只是照镜”；镜面与水盆不出现人物倒影。
- 热点区为 `(30%,40%)` 与 `(70%,62%)`。

## 参考来源

| 阶段 | 直接来源 | 著录号 | 许可 |
|---|---|---|---|
| 甲骨 | https://commons.wikimedia.org/wiki/File:監-oracle.svg | J19737 | Public domain |
| 金文 | https://commons.wikimedia.org/wiki/File:監-bronze.svg | B12690 | Public domain |
| 《说文》小篆 | https://commons.wikimedia.org/wiki/File:監-seal.svg | S05970 | Public domain |
| 传统释义 | https://ctext.org/shuo-wen-jie-zi/wo-bu | 《说文·卧部》監字条 | 只作事实核对 |
| 异体与字族 | https://dict.variants.moe.edu.tw/dictView.jsp?ID=29503&q=1 | 教育部字条 29503 | 只作事实核对 |

## 本地输入哈希

`watch-jian-form-reference.png`：`141e465369bcebdcfdab5a433d2fa1a46d68547a4de6e5808aa9f21160b9c854`。输入左至右为甲骨、金文、小篆。

## 四图提示词

1. `form`：青铜器铭拓、浅水盆、铜锈与旧布衬垫；人目与器皿轮廓按参考保真。
2. `gloss`：旧帛卷、铜镇纸与折起释条；只允许现代楷体单字“監”可辨，不写长文。
3. `mirror-relation`：铜鉴、水盆、观察签与红绳组成实物关系；签面无字，镜面为空。
4. `modern-story`：传闻札被多份观察材料压住；不呈现人物或可读结论。

## 轮廓核验

- 皿部、目形与人物构件的相对关系不得合并或缺失；镜面不得生成脸、摄影机或现代房间反射。
- 不允许随机文字、水印和现代玻璃镜框。

## 生成记录

正式生成后逐图记录输出路径、最终提示词、WebP 哈希、大小与皿部轮廓结论。
