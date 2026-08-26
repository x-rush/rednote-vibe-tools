# 出门检查官 V2 美术资源清单

状态：已完成；30 个 SVG 与 2 个 WebP 全部落盘并通过验收
日期：2026-08-26
依据：`src/content/content.json` 1.0.0

## 1. 资源结论

需要 30 个 SVG 和 2 个 WebP。资源只服务场景识别、分组定位、状态反馈与路岚引导；不为 83 个物品逐项制作图片。

落盘目录：

- SVG：`public/assets/icons/`
- 路岚：`public/assets/guide/`

## 2. 通用规范

### SVG

- `viewBox="0 0 24 24"`。
- 主轮廓 `stroke-width="2"`，`stroke-linecap="round"`，`stroke-linejoin="round"`。
- 正视视角；不混入 emoji、3D、拟物贴纸或品牌轮廓。
- 必须包含中文 `<title>`，装饰性使用时由页面设置空 `alt`。
- 主轮廓在 16、24、32px 均可辨识。
- 图形不能仅依赖颜色表达含义。
- 场景图标允许一个浅色填充面；类别和位置默认线性。
- 医疗不使用红十字或受保护组织标志；证件不复刻官方版面。

### WebP

- 原创虚构角色，不复制参考真人。
- 无文字、地图、二维码、品牌、警务、安检、军用、战术或灾难元素。
- 主图 3:4，建议 900×1200；头像 1:1，160×160。
- 两文件合计目标不超过 160KB；必须离线加载。

## 3. 逐项制作顺序

### 基准三枚

1. `icons/scenario-short-trip.svg`：小型旅行箱，提手与轮子清晰。
2. `icons/category-electronics.svg`：手机与充电线组合，避免品牌设备轮廓。
3. `icons/location-entryway.svg`：门框、门把与向外方向，区别普通房间。

基准三枚先做 16／24／32px 检查，再继续以下资源。

### 场景 SVG

4. `icons/scenario-commute.svg`：通勤包与简化路线卡。
5. `icons/scenario-exercise.svg`：运动鞋与运动轨迹。
6. `icons/scenario-date.svg`：双杯或两张座位卡，不使用爱心刻板表达。
7. `icons/scenario-with-child.svg`：成人手与积木收纳袋，避免性别和家庭结构刻板。
8. `icons/scenario-with-pet.svg`：人物手持牵引带，不能与宠物类别重复爪印。
9. `icons/scenario-appointment.svg`：办事清单与号码卡，不使用医疗十字。
10. `icons/scenario-event.svg`：入场票与舞台光束，不出现品牌或伪字。

### 类别 SVG

11. `icons/category-essentials.svg`：钥匙与卡片。
12. `icons/category-weather.svg`：外套与雨滴。
13. `icons/category-health.svg`：水滴与中性洗护瓶，不使用急救箱。
14. `icons/category-work.svg`：文件夹与笔。
15. `icons/category-sports.svg`：运动水壶与速度线。
16. `icons/category-child.svg`：积木收纳袋，不使用医疗十字或性别符号。
17. `icons/category-pet.svg`：宠物外出袋，区别场景牵引图标。
18. `icons/category-event.svg`：票根与日程点。
19. `icons/category-confirmation.svg`：三个空白检查位与折痕。
20. `icons/category-custom.svg`：加号与短标签卡。

### 位置 SVG

21. `icons/location-desk.svg`：桌面、台灯与一张卡片。
22. `icons/location-charging.svg`：插座与充电线。
23. `icons/location-bedroom.svg`：枕头与床头轮廓。
24. `icons/location-bathroom.svg`：镜面与水滴。
25. `icons/location-fridge.svg`：冰箱门与水杯。
26. `icons/location-documents.svg`：立式文件收纳盒。
27. `icons/location-pet-area.svg`：宠物碗与外出袋。
28. `icons/location-child-area.svg`：玩具收纳箱与积木。

### 状态 SVG

29. `icons/completion-stamp.svg`：圆形“已检查”抽象章；可含三个图形勾选位，但不嵌入 DOM 必需文案。
30. `icons/partial-available.svg`：半张完整清单与一条虚线，表达“部分仍可用”，不用警报三角。

### 路岚 WebP

31. `guide/guide-master-v2.webp`：路岚从头到大腿中部的 3:4 编辑插画。鼠尾草绿防风短外套、米灰内搭、深青斜挎包；手持暖白三折清单，纸面恰好三个空白圆形检查位；明亮住宅玄关，身体略朝门外，神情可靠轻松。头顶、双手、清单、肩带和包体结构完整。
32. `guide/guide-avatar-v2.webp`：从同一主图一致性裁切，保留头肩、鼠尾草绿衣领与少量深青肩带；不得重新生成不同脸部。

## 4. 不制作

- 不制作 `icon-item-*` 对应的 83 个物品图标。
- 不制作商品写实图、场景封面位图、3D 图标或分享海报。
- 不制作天气服务失败插画，因为产品不调用天气服务。
- 不把界面按钮、数字、文字烘焙进图片。

## 5. 自动验收

- 30/30 SVG 能被 XML 解析。
- 30/30 SVG 的 viewBox 为 `0 0 24 24`。
- 线性图形主轮廓线宽一致，全部含 `<title>`。
- 16／24／32px 资源板无断图，场景、类别和位置近义图标可区分。
- WebP 正常解码，无文字、地图、二维码或多余检查位。
- 375／390／430px 页面无断图；图片失败时文字流程仍完整。

## 6. 完成记录

- 30/30 SVG 已生成到 `public/assets/icons/`，统一 24×24 viewBox、2px 圆角描边并含中文 `<title>`。
- `guide-master-v2.webp` 为 900×1200、111,348 bytes；`guide-avatar-v2.webp` 为 160×160、3,940 bytes；合计 115,288 bytes。
- 资源板 `design/assets-v2.html` 已在 16／24／32px 检查，0 断图。
- 主图已核验三折清单、恰好三个空白检查位、双手、肩带和包体结构；无文字、地图、二维码、品牌或警务元素。
- V3 布局复核后无需新增美术：同一主图足以覆盖首页、问答、清单、帮助、最后一分钟和完成页的受控裁切，头像覆盖最近清单与恢复状态；继续生成新立绘反而会增加角色身份漂移风险。
