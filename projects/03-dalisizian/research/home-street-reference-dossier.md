# 《家字失踪案》坊间传言处参考档案

状态：`REFERENCE GATE PASSED / FICTIONAL RECONSTRUCTION ONLY`  
日期：2026-08-26  
用途：约束 `asset-scene-home-street`，不用于宣称唐长安街巷复原。

## 1. 可采用的参考

1. 中国社会科学院考古研究所 2015 年度田野考古成果综述记录唐长安城东市遗址发现市场道路、排水沟、后坊加工区、水井及具有丝路特色的遗物；本项目只据此采用道路、排水与低密度作业角落，不虚构具体店铺立面。  
   https://kaogu.cssn.cn/xwzx/kgdt/201601/t20160105_5943689.shtml
2. 中国社会科学院考古研究所 2023 年汇报记录布政坊遗址的坊内十字街、窄曲巷、夯墙围合院落与路沟，为“坊墙、巷道、院门”的大关系提供依据。  
   https://kaogu.cssn.cn/xwzx/bszx/bsdt/202402/t20240221_5948865.shtml
3. 新华网《长安寻“坊”十四载》整理唐长安里坊研究，强调诗文定位仍需与考古和文献互证；本项目不把诗意描写直接当作建筑复原图。  
   http://www.xinhuanet.com/20240524/f65314c9c5354fcfb48b34547ecba99f/c.html
4. 陕西历史博物馆唐墓壁画资料用于盛唐色彩、普通人物服饰和简洁环境轮廓参考，不将贵族墓室生活图像等同于坊市街景。  
   https://www.sxhm.com/info/announcement/detail/3139.html

## 2. 可证与不可证

可证：唐长安采用里坊与市场分区；坊内存在道路、曲巷、夯墙院落、排水与作业区。  
不可证：本案发生地的具体街面、招牌、摊位形制、连续临街商铺或影视式通宵灯火夜市。

因此场景冻结为“白天的虚构里坊街角”，不是繁华商业街。只保留可供证词发生的低密度遮棚、素墙与院门；无店招、无文字、无人群。

## 3. 构图冻结

- 16:10 空场景，日间或午后；土黄色夯墙、灰白院墙、深木院门与浅路沟。
- 一侧可有简单木遮棚和两三个无字陶/竹容器，但不画满街摊位。
- 中央与右侧预留说书人叠加安全区，左侧预留沈砚/证词卡安全区；底部 32% 留给对话 UI。
- 无灯笼海、牌楼、酒肆招牌、现代商品、宋明清街市符号。

## 4. 最终生成提示词

```text
Use case: stylized-concept
Asset type: mobile narrative game environment background
Primary request: a calm fictional daytime neighborhood street corner in High Tang Chang'an for hearing a popular rumor, grounded in walled ward and market archaeology without claiming reconstruction
Scene/backdrop: sunlit packed-earth lane beside muted ochre rammed-earth walls and a gray-white courtyard wall, one plain dark-timber courtyard gate, a shallow roadside drainage channel, restrained greenery
Subject: one small simple wooden shade canopy at the side with two or three blank pottery or bamboo containers; broad uncluttered space for character dialogue
Style/medium: polished contemporary editorial game illustration informed by Tang mural mineral colors and archaeological street relationships; clean silhouettes; subtle paper texture; not photorealistic cinema
Composition/framing: 16:10 landscape, eye-level view, gentle diagonal lane depth; low-contrast character safe zones at center-right and left; bottom 32 percent free of important details for dialogue UI
Lighting/mood: warm daylight, curious, sociable, lightly humorous, never crowded or theatrical
Color palette: warm ochre earth, gray-white plaster, dark timber, official teal accents, muted mineral green and restrained cinnabar
Constraints: empty street; no people; no readable text; no Chinese characters; no shop signs; no banners; no plaques; no weapons; no vehicles; no logos; no watermark
Avoid: cinematic Chang'an night market, lantern sea, continuous storefronts, Song or Ming commercial street, Japanese machiya, fantasy bazaar, palace avenue, modern objects, crowded festival
```
