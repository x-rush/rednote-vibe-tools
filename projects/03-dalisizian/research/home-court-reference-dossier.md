# 《家字失踪案》问案堂参考档案

状态：`REFERENCE GATE PASSED / FICTIONAL RECONSTRUCTION ONLY`  
日期：2026-08-26  
用途：约束 `asset-scene-home-court`，不用于宣称真实大理寺室内复原。

## 1. 可采用的参考

1. 中国社会科学院古代史研究所《唐宋州縣公廨及營修諸問題》指出，唐代官廨的建筑细节与格局材料非常有限，后世保存衙署不能直接上推为唐代样式。该结论构成本场景最重要的非断言边界。  
   https://lishisuo.cass.cn/xsyj/stwdsgs/202008/t20200828_5175946.shtml
2. 唐大明宫中央官署遗址考古报道显示，官署区可见围合院落、门房、砖铺中路、北房与厢房等关系；本项目只抽取“围合、中轴、堂屋”这些大尺度组织，不复制宫城规格。  
   http://www.chinanews.com.cn/cul/2014/11-01/6739902.shtml
3. 陕西历史博物馆《客使图》提供初唐官员接待场景的人物气质与赭、青、灰白色彩参考，但画面并非大理寺堂内实景。  
   https://www.sxhm.com/collections/detail/468.html
4. 陕西历史博物馆《唐阙楼图壁画》提供唐墓壁画建筑色彩与简明轮廓参考；其等级属于宫门图像，禁止把三出阙、城楼或皇家礼制直接移入本场景。  
   https://www.sxhm.com/collections/detail/9972.html
5. 故宫博物院家具研究材料显示唐代处于低坐向高坐逐渐过渡的阶段；因此采用一张低矮案几，不设置成套明清官厅桌椅。  
   https://www.dpm.org.cn/Uploads/File/2024/01/29/u65b7126c4807d.pdf

## 2. 可证与不可证

可证：唐代官署存在院落与堂屋组织；壁画可提供时代色彩和木构轮廓；家具形态并非简单等同于明清官厅。  
不可证：大理寺具体问案堂室内布置、主审座位高度、固定审讯家具、匾额文字和本案人物的真实站位。

因此成品必须称为“盛唐视觉锚点下的虚构问案堂”。画面不出现高台主审桌、太师椅、刑具、兵器、官署匾额、楹联或伪文字。

## 3. 构图冻结

- 16:10 空场景，正面略带纵深；中后景一张低矮红褐案几。
- 灰白抹墙、深色木构、少量赭朱与石青，右侧或左侧自然日光。
- 中央、左右三处人物叠加安全区保持低对比；底部 32% 不放关键物件。
- 可见一处开敞门廊或庭院光，不画宫殿高台和夸张斗拱。
- 卷宗和签牌一律空白，不生成任何汉字或仿古文字。

## 4. 最终生成提示词

```text
Use case: stylized-concept
Asset type: mobile narrative game environment background
Primary request: a bright fictional reception and inquiry hall for a Chinese character-investigation office, using a High Tang visual anchor without claiming historical reconstruction
Scene/backdrop: a restrained timber hall opening toward a quiet enclosed courtyard, gray-white plaster walls, dark wood posts, small cinnabar structural accents, soft natural daylight
Subject: one low simple reddish-brown receiving table placed in the middle distance, a few blank paper bundles and plain rolled documents, broad uncluttered floor area
Style/medium: polished contemporary editorial game illustration informed by Tang mural color and archaeological courtyard scale; clean silhouettes; subtle paper texture; not photorealistic cinema
Composition/framing: 16:10 landscape, near-straight-on eye-level view with shallow depth; low-contrast safe zones at left, center and right for three character overlays; bottom 32 percent free of important details for verdict UI
Lighting/mood: bright, measured, fair, intelligent, welcoming rather than punitive
Color palette: gray-white plaster, official teal green, warm paper, dark timber, restrained cinnabar and mineral blue
Constraints: empty hall; no people; no readable text; no Chinese characters; no plaques; no couplets; no seals; no throne; no elevated magistrate dais; no weapons; no torture devices; no logos; no watermark
Avoid: Ming or Qing courtroom, tall magistrate desk, armchairs, round-backed chairs, luxury rosewood furniture, palace throne room, Japanese architecture, lantern sea, dark dungeon, fantasy magic, modern office objects
```
