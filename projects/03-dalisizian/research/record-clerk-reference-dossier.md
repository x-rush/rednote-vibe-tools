# 八案共用书吏视觉参考证据包

状态：`REFERENCE GATE OPEN FOR ONE CHARACTER BASELINE`

## 1. 决策

`character-record-clerk` 冻结为虚构字案机构中的低阶文书主典，游戏称“书吏”，职责是呈示字书和分期材料、标注事实边界。他不是沈砚的换色版本：沈砚负责引导调查次序，书吏只负责把材料校清、呈卷并说明著录状态。

角色采用盛唐视觉锚点下的创意重构，不宣称复原某个真实唐代官署、品级或法定服色。“档案校勘者”是游戏功能名，不与唐代“校书郎”这一具体官职等同。

## 2. 权威参考

### R03-RECORD-CLERK-01 · 唐代彩绘文吏俑

- 来源：新疆博物馆展品；青河县人民政府转载新疆日报报道
- 页面：https://www.xjqh.gov.cn/ztzl/011001/011001012/20250403/8ca9bea0-e0bf-4932-a6d1-3fe1b9b3487b.html
- 文物信息：吐鲁番阿斯塔那206号墓出土；文吏俑头戴幞头，穿青色圆领长袍、腰系带、足登靴；右手握毛笔，左腋夹文书类纸卷。
- 可证范围：文吏形象可以使用软幞头、圆领长袍、笔和纸质文书来表达日常政务职责。
- 不可推出：字案机构真实存在；青色就是本角色确定品级服色；该俑等同于唐代所有书令史。

### R03-RECORD-CLERK-02 · 唐开元二年陶文吏俑

- 来源：故宫博物院
- 页面：https://www.dpm.org.cn/collection/sculpture/234219.html
- 馆方信息：唐开元二年（714），洛阳戴令言墓出土；文吏俑头戴冠、身穿右衽宽袖衣，双手相交，姿态恭谨。
- 可证范围：文吏可采用收敛、恭谨的站姿和成熟面貌。
- 不可推出：本角色必须戴进贤冠或穿高等级宽袖礼服；游戏书吏采用低软幞头与常服化圆领袍，避免与沈砚重叠。

### R03-RECORD-CLERK-03 · 唐代令史、书令史研究

- 来源：陕西师范大学学报（哲学社会科学版）
- 页面：http://www.xuebao.snnu.edu.cn/info/1072/7342.htm
- 研究摘要：唐代令史、书令史属于中央文官机构中的低阶流外官，是“主典”之一，具体负责公文办理；书令史品秩低于令史，职掌繁重。
- 可证范围：游戏书吏可以被设计成长期处理公文、熟悉档案流程的低阶文书人员。
- 不可推出：其冠服、年龄、容貌或具体工作动作；这些由文物参考和移动端功能共同约束。

### R03-RECORD-CLERK-04 · 唐开元二年纸质公文档案

- 来源：国家文物局转载《光明日报》
- 页面：http://www.ncha.gov.cn/art/2014/5/20/art_1027_62433.html
- 可证范围：唐开元二年的吐鲁番纸质公文案卷实物可以支持“纸页／卷文书”作为角色职责提示。
- 不可推出：页面上的档案夹、装订结构或任何可读内容；角色手持物保持无字、低细节和非复原标注。

## 3. 角色冻结

- 年龄感：45–55 岁，清瘦、眼神专注，有长期校阅形成的克制神态。
- 性格：严谨、少言、可信；指出材料边界时不卖弄，也不替玩家下结论。
- 服饰：低软黑褐幞头；灰蓝或石青灰圆领右衽常服，窄至中等袖；暖褐内层和布带。
- 姿态：膝上半身，正面略三分之二；恰好两只手，左手托一叠无字纸页，右手食指轻点纸页边缘。
- 持物：一叠低细节、无字、无印、无编号的暖纸色纸页；不画现代硬壳文件夹、活页夹、线圈本或木制办公板。
- 表情：中性专注，眉间略有思考感；不阴沉、不谄媚、不做夸张学究表情。
- 色彩区分：沈砚为年轻、官署青交领宽袖和高冠；书吏为年长、灰蓝圆领窄袖和低软幞头；说书人为暖赭圆领袍与外向笑容。

## 4. 生成规格

- 母版：`public/assets/characters/record-clerk/record-clerk-base-v1.webp`，透明背景，900×1350，目标 ≤ 180KB。
- 头像：`record-clerk-avatar-v1.webp`，160×160，灰蓝纯色或暖纸背景，目标 ≤ 20KB。
- 小占位：`record-clerk-placeholder-v1.webp`，72×96，保持 Alpha，目标 ≤ 10KB。
- 页面角色：状态 07“证物正面”增加书吏呈卷资料条，不进入古文字图形区域。
- fallback：姓名签“书吏”＋身份“档案校勘者”；证物说明与收档按钮始终可用。

## 5. 最终基准提示词

```text
Use case: stylized-concept
Asset type: transparent mobile narrative-game character master
Primary request: a fictional senior records clerk for a Chinese character-investigation office with a High Tang visual anchor, responsible for presenting documents and marking evidence boundaries; meticulous, restrained and trustworthy, clearly distinct from the young teal-robed guide Shen Yan
Subject: one adult Chinese man around 45 to 55 years old, lean mature face, knee-up half-body, front-facing three-quarter pose, exactly two visible hands; left hand supports one small stack of plain blank warm-paper folio sheets, right index finger gently points to the outer blank edge; no writing instrument
Wardrobe: low dark-brown soft futou; unmistakable closed round-collared right-overlap everyday robe in muted slate blue and blue-gray, narrow-to-medium sleeves, warm brown inner edge and simple cloth belt; no official teal dominance
Style/medium: polished contemporary editorial game illustration informed by Tang clerk and male figurines; clean ink-like contour accents, restrained painterly color, readable mobile silhouette; same production polish as Shen Yan and the street storyteller but a different age, role and silhouette
Composition/framing: transparent portrait cutout; head and soft futou fully visible; the complete blank folio and both hands visible; generous clean padding; suitable for a Galgame overlay and evidence-page profile
Lighting/mood: soft neutral side light; calm, precise, observant, quietly helpful
Materials/textures: modest everyday fabric and plain paper; low-detail blank sheet edges; no rank badge
Constraints: genuinely transparent background with clean alpha; exactly one person; exactly two visible hands; exactly one small stack of blank paper sheets; no readable text; no Chinese characters; no seal; no number; no insignia; no jewelry; no weapon; no logos; no watermark
Avoid: crossed-collar outer robe, high official crown, Song winged hat, modern clipboard, binder, ring binder, notebook spiral, hardcover book, scroll, brush, pen, calligraphy, rank badge, Ming or Qing clothing, Japanese clothing, armor, sword, anime gacha styling, photorealistic film still, extra fingers, fused hands, duplicated paper, baked checkerboard
```

## 6. 双重验收

独立资源：真实 Alpha；单人、两手、一叠无字纸页；圆领、低软幞头、灰蓝窄袖与成熟面貌成立；不出现现代文件夹、伪文字、印章、官阶徽记或沈砚同款轮廓。

页面二检：375／390／430 px 下资料条、来源性质、证物卡和两个底部操作均可读；点击“收入证据簿”时书吏资料条只做一次短促呈卷反馈；断图时显示姓名签；`prefers-reduced-motion` 下动画压至 1ms。
