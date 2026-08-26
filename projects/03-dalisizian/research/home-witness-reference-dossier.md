# 坊间说书人视觉参考证据包

状态：`REFERENCE GATE OPEN FOR ONE CHARACTER BASELINE`

## 1. 决策

`character-home-witness` 冻结为盛唐视觉锚点下的虚构“坊间传言陈述者”。他借用隋唐“说话”伎艺与街衢讲说的历史边界，但不宣称复原某位真实唐代职业说书人。角色只负责把复杂材料说成易记故事，接受玩家追问后愿意承认证据边界；不是反派，也不是故意造谣者。

## 2. 权威参考

### R03-HOME-WITNESS-01 · 唐开元二年陶画彩男立俑

- 来源：故宫博物院
- 页面：https://www.dpm.org.cn/collection/sculpture/230950.html
- 馆方信息：唐开元二年（714），洛阳戴令言墓出土；男俑头戴幞头，穿圆领右衽衣，腰中系带，足穿高筒靴。
- 可证范围：盛唐男性幞头、圆领右衽衣、束带与简洁外观；馆方同时说明幞头在唐代各阶层流行。
- 不可推出：说书人的固定制服、袍色、身份等级、个体年龄与讲说手势。

### R03-HOME-WITNESS-02 · 唐陶戏弄俑

- 来源：故宫博物院“中国古代体育文化”相关页面
- 页面：https://www.dpm.org.cn/Uploads/wenhua/E5/part1-14.htm
- 馆方信息：俑头戴幞头，身穿圆领衣，腰系带，足登靴，以拱拳姿势作滑稽表演。
- 可证范围：唐代男性表演者可以使用幞头、圆领衣与身体化讲演姿态。
- 不可推出：该俑就是“说书人”；不能照搬夸张滑稽表情或把“拱拳”冻结成说话伎艺的唯一姿势。

### R03-HOME-WITNESS-03 · 中国古代“说话”流变研究

- 来源：全国哲学社会科学工作办公室转载《中国社会科学报·国家社科基金专刊》，作者张莉
- 页面：http://www.nopss.gov.cn/n1/2020/0818/c432610-31826439.html
- 研究边界：隋唐时期“说话”发展为以口头讲说故事为主要特征的独立表演形式；表演场所逐渐包含寺院附近戏场、私人宴会和街衢闹市。
- 可证范围：游戏可以设置一位在坊间讲故事、面对普通听众的传言陈述者。
- 不可推出：固定舞台、折扇、醒木、评书长衫或宋代瓦舍勾栏；这些后世视觉符号不进入本角色。

## 3. 角色冻结

- 年龄感：约 35–45 岁，成熟但不苍老；面容有生活感，眼神灵活。
- 性格：自信、健谈、记忆力好；被追问时略尴尬但不敌对。
- 服饰：软质黑褐幞头；朴素赭黄或暖褐圆领右衽长衣，窄至中等袖；低对比青灰内层；简单布带。
- 姿态：移动端膝上半身，正面略三分之二；恰好两只手，一只手自然摊开讲述，另一只手轻拢袖口或停在身前。
- 道具：母版不持物。折扇、醒木、写字条幅、书册、拂尘、武器全部禁用。
- 表情：母版为“笃定讲述”，带一点亲和笑意；避免奸笑、指责玩家或戏剧化惊恐。
- 色彩区分：沈砚使用官署青交领宽袖袍与高冠；说书人使用暖赭圆领袍与软幞头，轮廓、衣领和色温必须明显不同。

## 4. 生成规格

- 文件：`public/assets/characters/home-witness/home-witness-base-v1.webp`
- 主母版：透明背景，建议 900×1350 WebP，目标 ≤ 180KB。
- 派生头像：`home-witness-avatar-v1.webp`，160×160，暖赭纯色或暖纸背景，目标 ≤ 20KB。
- 派生占位：`home-witness-placeholder-v1.webp`，72×96，保持 Alpha，目标 ≤ 10KB。
- 页面角色：状态 06 的证词区使用头像／小半身，不与沈砚方法提示混淆。
- fallback：姓名签“坊间说书人”＋“传言陈述者”，证词和追问选项始终可用。

## 5. 初始基准提示词

```text
Use case: stylized-concept
Asset type: transparent mobile narrative-game character master
Primary request: a fictional male street storyteller and rumor witness for a Chinese character-investigation game, using a High Tang visual anchor without claiming historical reconstruction; confident and engaging, but kind and willing to be questioned rather than villainous
Subject: one adult Chinese man around 35 to 45 years old, knee-up half-body, front-facing three-quarter pose, exactly two visible hands; one open hand making a natural storytelling gesture, the other gently gathering his sleeve near the torso; no object in either hand
Style/medium: polished contemporary editorial game illustration informed by Tang male figurines; clean ink-like contour accents, restrained painterly color, warm human expression, readable mobile silhouette; consistent with the existing Shen Yan illustration but visibly a different social identity
Composition/framing: transparent portrait cutout; head and soft futou fully visible; generous clean padding; centered balance suitable for a testimony card or Galgame overlay
Lighting/mood: soft neutral side light; lively, conversational, trustworthy, slightly self-assured
Color palette: warm ochre and muted reddish-brown plain round-collared robe, low-contrast blue-gray inner layer, dark brown-black soft futou, warm paper accents; no official teal dominance
Materials/textures: simple round collar with right-overlap construction, narrow-to-medium sleeves, plain cloth belt, modest everyday fabric, no rank badge
Constraints: genuinely transparent background with clean alpha; exactly one person; exactly two visible hands; no handheld prop; no readable text; no insignia; no jewelry; no weapon; no logos; no watermark
Avoid: folding fan, storytelling block, gavel, banner, calligraphy, book, scroll, pipe, whisk, Qing queue, horse-hoof sleeves, Ming scholar cap, Song winged official hat, Japanese clothing, samurai elements, official crown, armor, sword, dragon motif, theatrical villain grin, anime gacha styling, photorealistic film still, extra fingers, fused hands, baked checkerboard
```

### 5.1 实际采用的圆领结构优先提示词

```text
Use case: stylized-concept
Asset type: transparent mobile narrative-game character master
Primary request: a fictional male street storyteller and rumor witness for a Chinese character-investigation game, using a High Tang visual anchor without claiming historical reconstruction; confident, engaging and kind, not villainous
Subject: one adult Chinese man around 35 to 45 years old, knee-up half-body, front-facing three-quarter pose, exactly two visible hands; one open hand making a natural storytelling gesture, the other gently gathering a sleeve near the torso; no object in either hand
Wardrobe priority: an unmistakable simple closed round-collared right-overlap everyday Tang-anchored robe, warm ochre plain fabric, narrow-to-medium sleeves, low-contrast blue-gray inner edge, simple cloth belt; the outer neckline must be ROUND, NOT crossed or V-shaped
Headwear: dark brown-black soft wrapped futou with short fabric tails, modest everyday silhouette, not an official crown and not a winged hat
Style/medium: polished contemporary editorial game illustration informed by Tang male figurines; clean ink-like contour accents, restrained painterly color, warm human expression, readable mobile silhouette; consistent in polish with the existing Shen Yan illustration but visibly a different social identity
Composition/framing: transparent portrait cutout; head and futou fully visible; generous clean padding; centered balance suitable for a testimony card or Galgame overlay
Lighting/mood: soft neutral side light; lively, conversational, trustworthy, slightly self-assured
Constraints: genuinely transparent background with clean alpha; exactly one person; exactly two visible hands; no handheld prop; no readable text; no insignia; no jewelry; no weapon; no logos; no watermark
Avoid: crossed-collar outer robe, V-shaped outer neckline, broad official sleeves, folding fan, storytelling block, gavel, banner, calligraphy, book, scroll, pipe, whisk, Qing queue, horse-hoof sleeves, Ming scholar cap, Song winged official hat, Japanese clothing, samurai elements, official crown, armor, sword, dragon motif, theatrical villain grin, anime gacha styling, photorealistic film still, extra fingers, fused hands, baked checkerboard
```

## 6. 双重验收

独立资源：确认真实 Alpha、恰好两手、无道具和伪文字；幞头不变成宋代展脚官帽，圆领袍不变成明清长衫；角色不与沈砚同服色同轮廓。

页面二检：375／390／430 px 检查证词、人物、三条追问和沈砚方法提示全部可读；人物加载失败时不出现破图图标；入场和说话呼吸动画在 `prefers-reduced-motion` 下压至 1ms。
