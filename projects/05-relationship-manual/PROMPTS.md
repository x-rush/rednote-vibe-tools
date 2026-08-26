# 关系说明书 · 资源制作台账

状态：V2 资源已生成、装回并通过浏览器验收；以下保留历史批次与最终生成记录。

早期版本不调用 AI 人物位图；用户确认陪伴型 NPC 方案后，V2 仅为小满生成三张项目内透明立绘。情侣或具体关系场景仍不生成。

- 七个章节符号必须共享 24×24 viewBox、2px 圆角线宽和相同视觉重心；
- 符号表达章节语义，不使用爱心、性别、戒指或家庭成员剪影；
- 隐私符号表达“仅本机”，不使用云上传误导；
- 敏感标记必须与文字共同出现，不能只靠红色；
- 纸纹优先 CSS，若使用纹理，单张压缩后目标小于 8 KB；
- 完整版和简洁版分享模板均使用真实用户文本测试，不把隐藏敏感项带入简洁版。

每项完成后在此追加：日期、制作者、源文件、导出文件、检查结论、在 UI 中的截图证据。

## 2026-08-24 基准批次

- `chapter-companionship.svg`：初稿因 16px 像链环被拒绝；改为无性别并肩人物后通过基准板。
- `chapter-boundary.svg`：双边界和中间连接，在 16–32px 通过。
- `edit-conflict.svg`：初稿因像羽毛被拒绝；增加文档轮廓与折角后通过。
- 自动检查：3/3 XML、viewBox、2px stroke、title 通过。

## 2026-08-24 完整核心图标批次

- 七章符号与本机保存、敏感内容、编辑冲突共 10 个 SVG 已完成；
- `chapter-comfort.svg` 初稿因爱心造成恋爱化暗示被拒绝，改为“承接的手势与稳定顶线”；
- 10/10 XML、viewBox、2px stroke、title 通过；浏览器 16/20/24/32px 共 40 个引用，0 损坏；
- 独立图标板通过不等于应用验收，仍必须在章节导航、编辑态、分享预览中复检。

## 2026-08-26 正式 UI V2 批次

- 重新按当前仓库事实生成 10 个正式 SVG 至 `src/assets/art/`；此前台账描述的旧 SVG 与小满 WebP 均未实际存在于本目录，正式 UI 不再依赖这些缺失路径。
- 七个主题符号已进入问答进度、回顾、编辑和结果卡；本机、敏感、编辑冲突符号均与 DOM 文字共同表达状态。
- 两套纸纹、页角、折痕、批注线和完整／简洁分享模板使用 CSS/DOM 生成，无外部图片请求。
- 375／390／430px 正式应用实测：无横向溢出、0 断图、最小按钮 44px；缩减动效模式取消位移。

## 2026-08-26 小满三态 V2 最终批次

共同提示基线：

> Original high-quality Japanese visual-novel character illustration of Xiaoman, an adult Chinese editorial assistant in a late-night letter workshop. Consistent identity: warm intelligent face, brown eyes, long dark-brown low ponytail, warm-gray knit cardigan, muted sage-green shirt, ivory high-waist trousers, blue pencil. Calm supportive colleague, not therapist and not romantic heroine. Three-quarter body, clean elegant linework, restrained warm paper/sage/brick palette, soft warm key light, transparent background and clean alpha edges. No text, watermark, logo, hearts, medical symbols, diagnosis charts, couple imagery or extra limbs.

三态增量：

- `daily`：自然站姿，温和欢迎表情；一手持蓝铅笔，一手整理恰好两张完全空白的暖白卡片，双手与纸张透视清楚。
- `listening`：同一角色、服装与光线；身体微微前倾，一手轻托脸颊，另一手持蓝铅笔，专注倾听；不出现卡片、文字或额外道具。
- `reminder`：同一角色、服装与光线；温和但坚定的提醒表情，一手持蓝铅笔，另一手拿恰好一张完全空白便签；不指责、不训诫。

生成模式与结果：使用内置 ImageGen；先生成 daily，验收身份与透明通道后，将其作为 listening／reminder 的身份和风格基线。最终源结果与 WebP 文件逐项记录在 `ART-REQUEST.md`。

返工记录：两张出现烘焙棋盘格的候选图被拒绝；一次去背景尝试意外补入房间背景，也被拒绝。正式三图均为真实透明通道，不含伪透明棋盘格。
# 我希望被这样对待 · 资源生成台账

## 2026-08-24 引导角色小满 V1

- 角色定位：关系卡片整理员；提供编辑帮助，不诊断、不裁判、不替用户发送，也不把说明书包装成要求他人服从的清单。
- 实际参考与生成约束：见 `research/xiaoman-reference-dossier.md`。两张 Pexels 现实照片分别只锚定针织材质、书写手势和共同整理纸面内容的工作关系；不复制真人脸、身份或构图。
- 生成结果：原创中性年轻编辑形象，暖灰针织开衫、鼠尾草绿衬衣；蓝铅笔与恰好两张完全空白卡片清楚可信；无爱心、心理诊所、诊断图、聊天气泡、电脑、咖啡杯和伪文字。
- 单资源通过：脸部与两名参考真人不相似；双手和卡片透视可信；自然大腿裁切不影响角色与工具辨识。
- 导出：主图 900×1200、120,156 bytes；头像 160×160、3,390 bytes；占位图 72×96、1,166 bytes。
- 首次装回返工：初版对话层压住第二张卡片，只能明确看到一张；扩展展示区并固定主图高度后，两张卡片、铅笔和双手均在对话卡上方完整可见。
- 三宽二检：375／390／430px 无横向溢出和破图；对话卡在手机框内；按钮均为 48px；核心隐私与使用边界为 DOM 文本，图片失败仍可完成引导。
