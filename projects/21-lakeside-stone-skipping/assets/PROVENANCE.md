# 写实素材来源与生成记录

2026-09-19，使用内置 image_gen，通过 imagegen 技能生成。本地静态素材，无运行时图像请求。PNG 开发原稿不打包，WebP 保留透明 alpha，几何轮廓从 alpha 读取生成，不把原稿的背景 RGB 当成可见像素。

## 石头图集

最终文件：stone-atlas.webp；开发原稿：stone-atlas-source.png。1536×1024，十二种材质。十二帧的裁切矩形与 48 点透明轮廓保存在 src/content/content.json，供绘制与拾取共用。

生成提示：

Create a production photorealistic game sprite atlas, landscape 1536x1024, exactly 4 columns by 3 rows, twelve separate natural lake shore skipping stones, one centered in each equal cell with generous transparent padding and no overlap. TRUE TRANSPARENT BACKGROUND alpha, no backdrop, no text, no grid lines, no cast shadows outside stones. All stones viewed from directly overhead, broad flat face visible and slight thickness on lower edge, long axis horizontal, each stone fills about 85 percent of cell width and 64 percent of cell height. These are real weathered lake pebbles, not jewels or illustrations: dark slate with fine lamination, warm sandstone, charcoal basalt, blue-grey slate, grey granite speckles, pale quartz-veined grey stone, dark brown smooth flat pebble, layered shale, pale limestone, iron stained brown pebble, green-grey fine grain, black wet basalt. Irregular naturally rounded asymmetrical outlines, worn chips, subtle fine mineral grain, realistic pores and small fissures, occasional thin white quartz veins. Damp satin surface, NO plastic gloss. Soft warm sunset illumination from upper left, cool ambient fill. High resolution macro photography PBR material realism. Keep stone size and overall elongated oval proportions consistent across cells, no circular balls, no stacked stones. Asset only.

透明处理提示：

Edit this exact atlas only by removing ALL background and all ground shadows. Keep exactly these twelve photographed stones and their pixel positions, shapes, colors, dimensions, lighting and detail unchanged. Replace entire brown blurred backdrop between stones with genuine transparent alpha channel, not checkerboard, not grey, not black. Precisely cut out the stone edges. Keep 1536x1024 canvas and 4 columns x 3 rows arrangement unchanged. Output transparent PNG sprite atlas.

最终生成路径后缀：exec-84cf3745-36c3-40c9-8207-75e6b9affe11.png。实际核验：RGBA，角落 alpha=0，alpha 范围 0–254。原稿转 WebP，质量 88。

## 落日环境

最终文件：lake-environment.webp；开发原稿：lake-environment-source.png。用于视线采样和反射，实时水面仍由 WebGL 计算；视线超出环境素材范围时渐变回程序天空，属于有限视野环境贴图，不是完整三维湖区。

生成提示：

Photorealistic natural landscape environment plate for a realistic stone skipping game, landscape 1536x1024. Wide view across a tranquil large freshwater lake at sunset, distant organically irregular layered forested hills with fine tree silhouettes, atmospheric mist between receding blue ridges. Low warm sun slightly right of center at x 62%, y 36%, softly glowing pale gold, subtle wispy peach clouds above and muted lavender blue upper sky. Distant waterline at exactly 52% of image height, lake water occupies bottom 48%, shimmering narrow reflected sunlight with small fine natural wind ripples, blue teal water outside reflection. No foreground shore, no foreground rocks, no people, no boats, no buildings, no text. Beautiful restrained nature photography, realistic optical atmosphere and dynamic range, not illustration, not polygonal mountains, not saturated orange fantasy sky. Wide composition with horizon nearly level. This is environment texture, preserve detailed hills and clouds.

最终生成路径后缀：exec-43c27039-c806-48c1-9679-2cf55680a5b4.png。原稿转 WebP，质量 87。
