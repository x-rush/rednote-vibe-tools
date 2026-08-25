# 物华录 · 美术生成与复检台账

## 统一规则

- 每件实物先建立权威馆藏页、实际参考图、器形检查点和图片许可记录；
- 每次生成必须同时引用对应 `reference dossier`、本项目 `DESIGN.md` 和当前页面状态；提示词必须明确 `projectStyle`、`pageRole`、`interactionMoment`、`emotionalGoal`、`seriesBaseline` 与 `avoid`。无法回答“它帮助用户完成什么”的资源不进入生成。
- 本项目统一为“闭馆后的现代博物档案室”：深炭灰暗柜、克制暖聚光、象牙色藏品签、低饱和铜编号。禁止套用泛古风卷轴、考古遗址背景、手游抽卡光效或其他项目的视觉模板。
- AI 输出一律标「创意重构」，不冒充馆藏原图；
- 不得凭文字想象纹饰、缺损、铭文和比例；
- 古文字不由 AI 书写；局部谜面不能改变事实细节；
- 每件先完成单资源一检，再装入谜面、揭晓、图鉴和详情页完成二检。

## W1 史前四件共用画面基准

- Use case：`historical-scene`；资产用途是移动端博物馆谜题的 4:5 揭晓主图，不是独立海报。
- 场景：无可识别机构标志、无文字的深炭灰现代展柜，中性低矮支撑，单一克制暖聚光；背景装饰不得与文物竞争。
- 构图：完整器物全部落在 10% 安全区内，便于 375／390／430px 以 `contain` 展示；主物居中略偏上，底部给性质标签和结果文字留空间。
- 质感：尊重馆方参考的材料、年代痕迹、缺损和修复状态；只整理背景和反光，不“翻新”文物。
- 禁止：文字、铭文、馆号、Logo、水印、金色爆光、卡牌边框、漂浮粒子、烟雾、人物、考古坑、未经参考支持的花纹或构件。

## artifact-eagle-tripod / 基准生成提示词

- 参考：`research/artifact-eagle-tripod-reference-dossier.md` 与其中两张馆方内部参考。
- 主体：仰韶文化深红褐陶鹰形鼎；站立雄鹰与器皿合一；两腿和下垂尾部构成三个支点；圆眼、下钩喙、贴附两翼；器口位于背部双翼之间。
- 页面任务：揭晓时让用户一眼回看“三点支撑”和“背部器口”两条谜面证据。
- 构图：三分之四视角，完整两腿、尾支点、双翼和背口，不以俯视遮掉鹰脸，不以正面遮掉背口。
- 材质：低光泽、深红褐旧陶，保留轻微磨蚀和烧制色差；不得拟真羽毛、金属、釉面或塑料手办。
- 项目适配：安静、克制、具有博物馆聚光下的雕塑重量；不是神鹰、吉祥物或抽卡角色。
- V1 / 2026-08-25：内置 ImageGen，馆方主图作形态参考。单资源条件通过；远侧翼为自然视角遮挡，三支点与背口仍清楚。公开候选 `public/assets/artifacts/artifact-eagle-tripod/reveal-creative-reconstruction-v1.webp`，900×1125，105,342 bytes。实际揭晓页 375／390／430px 二检通过；知识区独立滚动，52px 主操作常驻底部。

## artifact-face-fish-basin / 待鹰鼎基准批准后生成

- 参考：`research/artifact-face-fish-basin-reference-dossier.md`。
- 必须从斜俯视完整显示红陶盆、间断黑色口沿带纹和官方照片中清楚可见的一组人面鱼纹；保留修复裂纹与缺口，不对纹样做 AI 补全，也不得镜像制造照片中不可见的第二组。
- 结果页任务是证明“图案位于内部”；“两组对称关系”由馆方事实文案与无细节结构 SVG 说明，不能用生成图伪造完整全景，更不能只做纹样平面海报。
- V1 / 2026-08-25：内置 ImageGen，国博主图作可见范围参考。单资源条件通过：只保留一组可见纹样、裂缝和缺口，未镜像第二组；暗柜系列适配通过。导出 `public/assets/artifacts/artifact-face-fish-basin/reveal-creative-reconstruction-v1.webp`，900×1125，95,046 bytes；实际揭晓页 375／390／430px 二检通过。

## artifact-jiahu-flute / 待鹰鼎基准批准后生成

- 参考：`research/artifact-jiahu-flute-reference-dossier.md` 与 `official-primary-clean.jpg`。
- 单支浅棕旧骨质七孔骨笛，细长略弯、两端开放；不得出现竹节、笛膜孔、金属按键、系穗或发光音符。
- 结果页任务是同时证明“原料不是竹”和“音孔经过设计”，构图必须让首尾与七孔完整可辨。
- V1 / 2026-08-25：七个主孔成立，但最高孔旁有一个可能误读为第八孔的孔状黑点，拒绝。
- V2 / 2026-08-25：内置 ImageGen 定点移除该孔状黑点，其余七孔、首尾、骨面、支撑和暗柜保持；单资源条件通过。导出 `public/assets/artifacts/artifact-jiahu-flute/reveal-creative-reconstruction-v2.webp`，900×1125，33,276 bytes；实际揭晓页 375／390／430px 二检通过。

## artifact-jade-dragon / 待鹰鼎基准批准后生成

- 参考：`research/artifact-jade-dragon-reference-dossier.md`。
- 墨绿色玉质反 C 形长身，短小上翘吻、细眼、后卷长鬣、尾部内屈、背部穿孔；无角、无肢、无爪、无鳞、无龙珠。
- 结果页任务是区分红山玉龙、玉猪龙与玉玦；不能画成活体神龙或仙侠吊坠广告。
- V1 / 2026-08-25：器形通过，但多枚透明卡扣破坏克制展陈与移动端轮廓，拒绝。
- V2 / 2026-08-25：内置 ImageGen 只移除可见卡扣，改用隐藏背部承托；反 C 形、单孔、无肢无爪和旧玉材质保持。单资源条件通过，导出 `public/assets/artifacts/artifact-jade-dragon/reveal-creative-reconstruction-v2.webp`，900×1125，54,694 bytes；实际揭晓页 375／390／430px 二检通过。

## W1 派生资源规则与二检 / 2026-08-25

- 线索图不是新的生成任务：全部由已经通过事实检查的揭晓母图确定性裁切，避免同一器物在不同图片中产生孔数、纹样、缺损或器形漂移。
- 鹰形陶鼎裁切只证明“三支点”和“背部器口”；人面鱼纹盆只裁官方照片可支持的一组可见纹样，另以无纹样细节的 SVG 解释“两组对称”；骨笛裁切保留恰好七个主孔与中空骨管端部；玉龙裁切只强调长鬣和单一悬孔。
- 四件剪影均为人工约束的 SVG fallback，不从模型重新想象细节；图片失败时维持识别和继续作答，不新增谜面没有提供的纹样信息。
- `projectStyle`：闭馆后的现代博物档案室；`pageRole`：观察线索／图片失败识别；`interactionMoment`：提交前核对或图片请求失败；`emotionalGoal`：安静、可信、鼓励继续观察；`seriesBaseline`：W1 四件暗柜揭晓图与象牙色藏品签；`avoid`：抽卡光效、泛古风卷轴、重新生成局部、镜像补纹、额外孔洞和夸张器形。
- 装回 `case-w1-clue-crops-a`、`case-w1-clue-crops-b`、`case-w1-silhouette-fallback` 后，375／390／430px 共 9 次定向渲染通过：全部资源加载、位于手机框内、0 横向溢出、0 控制台／请求错误；人工复核确认七孔、单孔和可见纹样边界未被裁切改变。

## artifact-goujian-sword / 2026-08-24

- 参考：湖北省博物馆官方藏品页与页面实物图；详见 `research/artifact-goujian-sword-reference-dossier.md`。
- 目标：4:5 深色现代博物馆暗柜揭晓图，完整器形，黑色菱形纹，克制蓝绿剑格，非抽卡特效。
- V1 拒绝：剑格卷草化、剑身伪文字、剑首同心圆不足。
- V2 条件通过：明显伪文字已清除、轮廓与纹饰连续；因剑格仍艺术化，只能作为明确标签的创意重构。
- 导出：`public/assets/artifacts/artifact-goujian-sword/reveal-creative-reconstruction.webp`。
- 待办：核验轮廓 SVG、局部裁切、装回四类页面、三宽度和图片失败降级复检。

## artifact-changxin-lamp / 2026-08-24

- 参考：故宫博物院“何以中国”展品记录、河北文物官方资料与中国灯具博物馆实拍；实拍只作内部器形核验，不进入发布包。详见 `research/artifact-changxin-lamp-reference-dossier.md`。
- 硬约束：跪坐宫女、右侧抬臂与宽袖连接灯罩／烟道、左臂托持灯盘、人物与灯体一体、鎏金铜旧化质感；不得生成铭文、现代灯泡或脱离器物的幻想构件。
- V1 单资源条件通过：完整保留跪坐基座和灯体关系，无文字、硬币背景与现代零件；只可作为常驻标注的「创意重构」，不能冒充馆藏摄影。
- 导出：`public/assets/artifacts/artifact-changxin-lamp/reveal-creative-reconstruction.webp`，900×1125，76,748 bytes。
- 装回：本轮总结、图鉴目录、文物详情；375／390／430px 均无横向溢出、断图或器物裁切，主图使用 `contain`。
- 二检修正：图鉴与详情原先末段不可达，已改为档案层纵向滚动；图鉴占位名称已清除；事实边界不使用绝对化环保史宣传。
- 待办：实物核验轮廓 SVG、谜面局部裁切、烟道解释 SVG、图片失败降级与 WSL 真实应用动态复验。

## artifact-cloud-bronze-jin / W2 基准与拒绝记录 / 2026-08-25

- 参考：`research/artifact-cloud-bronze-jin-reference-dossier.md`；四张河南博物院研究图分别承担修复后全貌、出土碎裂、结构近照和线描角色，均不进入发布包。
- `projectStyle`：闭馆后的现代博物暗柜；`pageRole`：工艺与结构型谜题揭晓主图；`interactionMoment`：提交后确认“承尊器、两组兽与多层镂空”；`emotionalGoal`：精密、可信、克制；`seriesBaseline`：W1 暗柜、AI 性质标签和完整器形安全区；`avoid`：奇幻祭坛、宝箱、家具、机械蜘蛛、平面花边、兽数漂移、修复史消失。
- V1 使用内置 ImageGen 与四张馆方参考。构图、横向比例、暗柜留白和旧青铜气质通过，但拒绝：器身被规整成带矩形面板的宝箱／祭坛，附兽像装饰柱，朝向禁面与卷舌关系不清，底部座兽过度家具化。未复制到项目资源目录。
- V2 对 V1 做单点结构修订，保留背景和构图，要求连续镂空铜梗与两组各十二兽。拒绝：模型将云纹和兽组放大为密集奇幻龙群，附兽、座兽与纹样层级混合，数量和修复后馆藏形态不可核销。未复制到项目资源目录。
- 结论：不得继续只用文字强化数量。下一版生成前先制作一张人工结构标注图，明确禁体、侧附兽分布、底部座兽分布、可见／遮挡关系和不允许改变的外轮廓；再以馆方全貌为主要构图锚点进行低自由度重构。
- 结构板 V1 自检拒绝：把馆方只明确为“总计 12”的底部座兽擅自画成“前 6＋后 6”。V2 已撤销该推断：上半部只图示有文字依据的前 4＋后 4＋左 2＋右 2；下半部仅列 12 个总数核销点，并明确不是空间排布图。正式文件为 `research/references/artifact-cloud-bronze-jin/structure-annotation.svg`。
- V3 / 2026-08-25：内置 ImageGen，以馆方修复后全貌为强制几何锚点、结构近照约束镂空深度、结构板只作数量检查。条件通过：低矮横向轮廓、正面四只和远侧四只附兽、两端兽组、独立底部承托组、连续镂空与修复后旧青铜成立；无宝箱抽屉、附兽柱化、龙群自由增殖或奇幻祭坛。
- 母版 `research/generated/artifact-cloud-bronze-jin/reveal-v3-reference-constrained.png`；4:5 档案／分享版 900×1125、92,852 bytes；因器物约 2.24:1，另从同一批准母版确定性裁出 1200×675、135,464 bytes 的 `reveal-wide-creative-reconstruction-v3.webp` 专供揭晓展柜，避免移动端主体过小，不重新生成器物。
- 揭晓页 `case-reveal-cloud-bronze-jin` 在 375／390／430px 二检通过：图片加载、`contain`、0 横向溢出、52px 主按钮常驻；1141px 知识区可滚到底，数量、四年修复、工艺争议和 AI 性质标签门禁全部存在。首轮发现标签左边缘被负边距轻微裁切，已将标签内缩至 20px；首轮 4:5 图主体过小，已改用同母版横向 UI 裁切。
- 派生资源不再调用 ImageGen：两张 720×480 线索图从横向 V3 分别确定性裁出“攀附兽跨越禁面／侧壁”和“多层镂空＋独立底部承托”；320×320 缩略以 `contain` 保留完整两端；结构 SVG 只保留低矮禁体、攀附层、承托层和“透空”网格。
- 剪影 V1 拒绝：顶部负空间像门洞、整体偏建筑栅栏。V2 去掉门洞并增加结构化兽体轮廓；它只用于图片失败 fallback，页面明确“不是具体纹样或历史复原”。
- 新增 `case-cloud-bronze-jin-clues`、`case-cloud-bronze-jin-fallback`、`case-cloud-bronze-jin-catalog`、`case-cloud-bronze-jin-detail`。375／390／430px 共 12 次定向渲染通过：5 个图片引用全部加载、0 溢出、0 控制台／请求错误，两个滚动状态可达底部，fallback 与目录按钮 52px。

## artifact-houmuwu-ding / W2 巨制基准 / 2026-08-25

- 参考：中国国家博物馆馆藏页主图、云端国博后侧三分之四图；铭文拓片只作名称证据，刻意不作为 ImageGen 输入。
- `projectStyle`：闭馆后的现代博物暗柜；`pageRole`：巨型方鼎揭晓主视觉；`interactionMoment`：提交后回看双立耳、长方腹和四柱足；`emotionalGoal`：庄严、沉稳、尺度感；`seriesBaseline`：W2 青铜暗柜与常驻 AI 性质标签；`avoid`：三足、圆腹、盖、火烟、祭坛、金光、伪铭文、活体饕餮。
- V1 拒绝：总体构图与四足成立，但每只立耳出现多个不规则小孔，柱足有无依据穿孔破损，部分耳面／扉棱纹饰像伪字。
- V2 只修三项：每耳一个连续大开口、四柱足去除穿孔、文字状痕迹改为非语言几何／兽面纹。条件通过；纹饰只作位置与气质受控的创意重构，不宣称逐纹复制。
- 研究母版 `research/generated/artifact-houmuwu-ding/reveal-v2-reference-verified.png`；公开 WebP `public/assets/artifacts/artifact-houmuwu-ding/reveal-creative-reconstruction-v2.webp`，900×1125，161,690 bytes。
- `case-reveal-houmuwu-ding` 在 375／390／430px 二检通过：`contain`、0 溢出、52px 主操作常驻、知识区滚动到底；四足、832.84 千克、“目前已知中国古代最重”、铭文不生成和逐纹边界文本均存在。
- 国博馆藏页称柱足下部“两周凸弦纹”，云端国博文字称“三周凹弦纹”；项目记录差异，不把圈数作为谜面或确定事实，也不以生成图裁决馆方字段矛盾。
- 派生资源不再调用 ImageGen：`clue-crop-handles-rim.webp` 与 `clue-crop-four-legs-flanges.webp` 均从批准的 V2 母版确定性裁切；`thumb.webp` 以 `contain` 缩为 320×320，完整保留双耳、方腹和四足。
- 结构剪影 V1 拒绝：后排两足被表现成两块过宽黑块，虽然不构成史实断言，但在猜谜页上空间关系不自然。V2 将前后足分层、缩窄后足并保持四足可辨；剪影只表达结构，棕色线条不代表具体纹饰。
- 新增 `case-houmuwu-ding-clues`、`case-houmuwu-ding-fallback`、`case-houmuwu-ding-catalog`、`case-houmuwu-ding-detail`。375／390／430px 共 12 次定向渲染通过：5 个图片引用全部加载并处于手机框内，0 控制台／请求错误，两个滚动页可达底部，两个按钮均为 52px。
- 首轮装回发现 fallback 固定底栏遮住“不扣星”说明，已拒绝该布局并改为正常文档流；复验三宽无覆盖。至此后母戊鼎的揭晓、两级线索、失败降级、图鉴缩略与详情五类静态角色均通过，剩余真实应用动态状态验收。

## artifact-four-ram-zun / W2 视角受限基准 / 2026-08-25

- 参考：中国国家博物馆馆藏主图与“云端国博”同视角图；两图只提供同一近正面／微三分之四视角，不虚报为第二视角，不据此补画背面。
- `projectStyle`：现代博物暗柜与旧青铜暖聚光；`pageRole`：复杂器形揭晓、羊与器身融合线索、图鉴详情；`interactionMoment`：确认“尊而非鼎、圆雕动物参与器用结构”；`emotionalGoal`：精密、雄奇、庄静；`seriesBaseline`：W2 青铜暗柜、完整器形和常驻 AI 性质标签；`avoid`：生肖摆件、卡通羊、独立羊托盆、第五只羊、四羊并排、背面臆造、黄金招财、仙侠祭坛。
- V1 使用内置 ImageGen 低自由度生成，单资源条件通过：外撇方口、高颈、宽肩、方腹和圈足成立；正中与左右角隅羊首、前胸、足部与器身融合，背侧第四羊自然遮挡；无额外羊、毛发、独立托盆、文字或铭文。复杂纹饰只按层级和非语言青铜体系通过，不宣称逐纹复制。
- 研究母版 `research/generated/artifact-four-ram-zun/reveal-v1-reference-constrained.png`，2,275,223 bytes；公开 WebP `public/assets/artifacts/artifact-four-ram-zun/reveal-creative-reconstruction-v1.webp`，900×1125，146,956 bytes。生成工具为内置 ImageGen。
- 揭晓页 `case-reveal-four-ram-zun` 在 375／390／430px 通过：主图 `contain`、完整边缘安全区、52px 主按钮在框内、长文可滚到底，视角遮挡、“现存商代青铜方尊”限定和非逐纹声明均可达。
- 派生资源不再调用 ImageGen：两张 720×480 线索裁图分别呈现卷角羊与器腹融合、方口／高颈／扉棱；300×300 缩略完整保留口、外伸羊首和圈足；SVG 只表达方尊骨架与角隅动物体量。
- 剪影 V1 的侧部动物体量过圆，像耳朵；V2 改为向外伸出的角隅兽首轮廓并压低角弧，仍不复制纹样或背面。
- 新增 `case-four-ram-zun-clues`、`case-four-ram-zun-fallback`、`case-four-ram-zun-catalog`、`case-four-ram-zun-detail`。三宽共 12 次定向渲染通过：5 个图片引用全加载、0 请求／控制台错误、两个滚动页可达底部、两个按钮为 52px。全部静态角色通过，剩余真实应用动态验收。

## artifact-lotus-crane-hu / W2 轻灵轮廓基准 / 2026-08-25

- 参考全部锁定河南博物院藏件：主图核验完整垂直轮廓，顶部近照核验仙鹤真实双足与双层莲瓣，三分之四图核验怪兽双耳、腹部攀附翼龙、圈足和两只底兽；故宫藏同墓另一件只记录“不可混用”，不进入生成输入。
- `projectStyle`：现代博物暗柜；`pageRole`：高复杂度揭晓、双足莲鹤与双兽承托线索；`interactionMoment`：由“花上有鸟”逐步确认具体器物；`emotionalGoal`：轻灵、昂扬、精巧、可信；`seriesBaseline`：同一物华录暗柜与常驻 AI 性质标签；`avoid`：单足／三足鹤、真鸟、白瓷花瓶、莲花宝座、仙侠祥云、遗漏底兽、混用故宫藏件。
- V1 使用内置 ImageGen，主体结构条件通过：一只双足鹤、双层莲瓣、椭方壶体、怪兽双耳、腹部附兽与两只底兽成立；一足与后侧底兽的自然遮挡可接受。拒绝其左后方额外模糊青铜器，因为破坏单件暗柜焦点和系列一致性。
- V2 使用内置 ImageGen 精确编辑，只移除背景干扰物并保持主体不变；单资源通过。研究母版 `research/generated/artifact-lotus-crane-hu/reveal-v2-clean-dark-cabinet.png`，2,202,996 bytes；正式 WebP `public/assets/artifacts/artifact-lotus-crane-hu/reveal-creative-reconstruction-v2.webp`，900×1125，120,150 bytes。
- 揭晓页在 375／390／430px 通过：完整 `contain`、52px 主按钮、长文可滚到底；双足纠错、河南／故宫区分、两套口部尺寸差异和“不以 AI 图裁决”门禁均可达。
- 派生资源不再调用 ImageGen：720×480 顶部裁图清楚显示两足鹤与双层莲瓣；720×480 底部裁图显示前兽与自然遮挡的后兽；300×300 缩略完整保留顶鹤和底兽。
- 结构剪影 V1 拒绝：鹤头像过大的圆球、直颈像杆状符号。V2 改为小头、细喙、弯颈、双翼与双足轮廓后通过；不复制纹样。
- 新增 `case-lotus-crane-hu-clues`、`case-lotus-crane-hu-fallback`、`case-lotus-crane-hu-catalog`、`case-lotus-crane-hu-detail`。三宽共 12 次定向渲染通过：5 图全加载、0 请求／控制台错误、滚动页到底、按钮 52px；全部静态角色通过。

## artifact-zenghouyi-zunpan / W3 复杂工艺基准 / 2026-08-25

- 参考：湖北省博物馆镇馆之宝主图作为唯一直接 ImageGen 输入；2025 工业 CT 数字化项目的标题图、新华社封面和带水印分体视频帧只作人工结构理解，因含大字、标识和水印，全部禁止进入生成。
- `projectStyle`：现代博物暗柜与窄暖光；`pageRole`：复杂工艺揭晓、上尊下盘与多层镂空线索；`interactionMoment`：先辨两件组合，再读附饰层级；`emotionalGoal`：精密、繁复、可信；`seriesBaseline`：物华录 AI 性质标签与完整器形；`avoid`：单件香炉、奖杯、火锅、盘过小、平面蕾丝、奇幻龙群、数字灰模、新闻标识和伪铭文。
- V1 使用内置 ImageGen，结构条件通过：高尊置于宽盘、尊口和盘口分层、攀附兽与盘周附饰成立；但尊腹出现近似竖向文字的伪字纹，拒绝。
- V2 使用内置 ImageGen 精确编辑，只把尊腹／颈部文字状符号改为非语言蟠螭和卷曲几何纹；所有组合、动物、镂空、构图和光照锁定。单资源条件通过，仍不宣称逐构件或数字复原。
- 研究母版 `research/generated/artifact-zenghouyi-zunpan/reveal-v2-nonlinguistic-patterns.png`，2,473,563 bytes；正式 WebP `public/assets/artifacts/artifact-zenghouyi-zunpan/reveal-creative-reconstruction-v2.webp`，900×1125，174,760 bytes。
- 揭晓页三宽通过：`contain`、52px 主按钮、长文到底；两件本体、尺寸、四个抠手、四豹总数、未使用馆方三维模型和评价边界均可达。
- 两张 720×480 裁图与 320×320 缩略从 V2 确定性派生。结构剪影 V1 因宽盘被画成直角长桌而拒绝；V2 改为椭圆盘口围合、弧形盘腹和独立高尊后通过。
- 新增两级线索、fallback、图鉴与详情四类页面。375／390／430px 共 12 次定向渲染通过：5 图全加载且在手机框内、0 请求／控制台错误、滚动到底、按钮 52px。全部静态角色通过。

## 许照（阿照）引导 NPC / 2026-08-24

- 真实参考：Smithsonian Anthropology Conservation Laboratory Staff（CC0）和 National Museum of American History Collections Care 工作照，约束器物支撑、记录、无酸纸、任务灯与实验室组织。
- V1 单资源通过：靛蓝工作罩衣、空白图录夹、木杆铅笔、空无酸纸托、胸袋内丁腈手套与悬挂放大镜成立；无古装、白大褂、鉴宝价格语义、伪馆藏编号或文物误拿。
- 正式资源：`public/assets/wuhualu/guide/guide-master-v1.webp` 900×1200、56,514 bytes；头像 160×160、3,186 bytes；占位 72×96、1,422 bytes。
- 首次引导装回：375／390／430px 均 0 断图、0 横向溢出；对话卡位于手机框内，跳过/下一句均为 46px，身份和观察规则完整可见。

## 小红书平台图标 / 2026-08-25

- 任务性质：平台品牌图标，采用确定性合成，不调用 ImageGen，也不改造器物结构。
- 唯一主体来源：`public/assets/artifacts/artifact-four-ram-zun/reveal-creative-reconstruction-v1.webp`；该图已通过四羊首、方口、高颈、方腹与圈足结构核验，并在界面中明确标注为创意重构。
- 构图规则：900×900 方形安全裁切；主体置于 432×432 圆角内框；使用博物暗柜、纸签、铜色和玉色项目色板；不添加文字、铭文、第五只羊或第二件器物。
- 正式导出：`release-assets/tool-icon-v1.png`，512×512 PNG；128px 与 64px 缩略检查图仅用于 QA。
- 二次检查：512px 方口、正面及侧面羊首、方腹和圈足可见；64px 方口与四羊首仍是第一识别；安全裁切不误导为圆尊或单羊器。
