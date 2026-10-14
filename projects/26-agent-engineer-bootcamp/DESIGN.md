---
name: Agent 工程师训练营
description: 口袋工程学院，插画与真实任务组织的手机学习空间
colors:
  canvas: "#FAFCFF"
  surface: "#FFFFFF"
  ink: "#20354B"
  lake: "#187C83"
  lake-soft: "#EAF3FA"
  divider: "#DCE6EF"
  yellow-soft: "#FFF6D7"
typography:
  headline:
    fontFamily: "PingFang SC, Microsoft YaHei, sans-serif"
    fontSize: "23px"
    fontWeight: 700
    lineHeight: 1.5
  title:
    fontFamily: "PingFang SC, Microsoft YaHei, sans-serif"
    fontSize: "18px"
    fontWeight: 700
    lineHeight: 1.55
  body:
    fontFamily: "PingFang SC, Microsoft YaHei, sans-serif"
    fontSize: "15px"
    fontWeight: 400
    lineHeight: 1.95
  label:
    fontFamily: "PingFang SC, Microsoft YaHei, sans-serif"
    fontSize: "12px"
    fontWeight: 400
    lineHeight: 1.7
rounded:
  input: "10px"
  button: "12px"
  panel: "14px"
  ticket: "16px"
spacing:
  tight: "8px"
  panel: "19px"
  pane: "20px"
  section: "24px"
components:
  button-primary:
    backgroundColor: "{colors.lake}"
    textColor: "{colors.surface}"
    rounded: "{rounded.button}"
    padding: "11px 17px"
    height: "46px"
  task-ticket:
    backgroundColor: "{colors.yellow-soft}"
    textColor: "{colors.ink}"
    rounded: "{rounded.ticket}"
    padding: "17px 19px"
---

# 口袋工程学院 · 视觉v2

## Overview
已批准的原创学习空间，实际应用使用包内工程小机器人插画，配冷白雾蓝画布、湖蓝操作与杏黄任务。设计mock是方向参考，不能作为成品界面或切片背景。

首页去掉珊瑚hero、圆环、四统计和2×2模板，改为学习桌、今日任务ticket、真实每日任务及纵向探索。每一主screen围绕学习情境，而非把内容放入同一种仪表盘。

## Colors
画布冷白，面层纯白，信息层雾蓝；杏黄只服务任务ticket与提醒。正文深蓝，主要动作湖蓝；避免大面积黄绿纸感或泛绿分隔线。成功/待复习有语义颜色和文字，不仅靠色彩表达状态。

## Typography
设备系统中文无衬线统一UI，标题23px、分组18px、正文15px/1.95，学习辅助信息至少12px。代码示例使用Consolas，数字需要时用等宽数字。长技术名在pane标题换行，mast用短标题。

## Layout
APP壳层最大480px固定物理视口，中央pane独立滚动；低高度横屏扩至760px，不CSS旋转。顶部64px宿主占位与system safe-area分开叠加，左右78px保守区不放controls；底部四tab加底部safe-area，上方有任务操作栏。

学习桌图高约190px，有与加载完成一致的占位，390×844首屏任务CTA明确可见。课程为章节路线，节点前置与状态真实；技术为可搜索分类图鉴；练习为单题，档案承担统计与证据。

## Elevation & Depth
优先冷白/雾蓝面层和细分隔，轻柔阴影仅在任务强调处。原创透明PNG有自身柔光，不用CSS假插图或把概念图当背景。无玻璃、装饰网格和浮动顶角操作。

## Shapes
按钮12px、输入10px、面板14px、ticket16px。任务ticket有真实内容和CTA，章节线表达顺序而非纹理。SVG只承担统一线形图标与完成星星，主体插画使用真实PNG。

## Components
study用于首页学习桌，detective用于故障查线索，celebrate用于本轮练习/诊断或故障完成。src/content/content.json配置映射、alt与加载/失败文案；onload/onerror都终结状态，缓存命中直接ready，失败保留学习与重试入口，不制造延迟。

按压有短位移，screen/tab/分节导航才进入pane；选择答案仅局部选中动效，不重播整页。章节展开、解析局部呈现；真实进度从旧值过渡到新值；完成星星一次触发而非循环。prefers-reduced-motion关闭移动与过渡，图片、结果、进度和静态星星仍可读。

## Do's and Don'ts
- 展示真实学习任务与状态，把统计留在我的，不恢复首页圆环或2×2模板。
- 图片加载占位与成品同高；错误结束加载，不阻塞用户继续。
- 页面重建只在导航触发整页进入，保留滚动位置和未保存实践。
- 核心30/60与技术19/38分开，示例未执行、粗学不代表实践认证。
- 不用z-index解决宿主遮挡，不将system safe-area当宿主几何。
- 素材原始提示与来源在ILLUSTRATIONS.md，不能用mock切片替代真实UI。

概念图对齐：窗边场景融合雾蓝背景，不把场景做大矩形卡片；紧凑横向杏黄任务ticket与每日目标、双探索入口形成首屏层级。章节保持左圆标右纯角色，浮动胶囊导航与独立学习操作条，其他功能、内容1.2.0和旧状态兼容不变。

## 逐页层次精修（2026-10-14）
以批准概念图为基准，优化容器、信息密度和层次。首页近景场景、居中标题、任务衔接和双探索入口；课程将图鉴与搜索合为工具行，白色章节面与浅蓝节点行，首屏可见下一章；训练移除重复banner，把选阶段与开始收在一个workspace；单题完整白色工作面，题型标签/题干/选项归组，确认后解析滚入可见区，以状态标签和浅蓝提示面分层；我的把4完成量与2正确情况合并一个档案面，记录和安排分组。真实数据/全部课程与原操作保持。

## Agent 方法主线 · 内容1.3.0
2026-10-14：课程与首页任务主线调整为ReAct、Plan and Execute、Reflexion、Tree of Thoughts。各4段机制、4步教学轨迹、1过程/剪枝图、3步离线决策实验、3实战FAQ、2条深入阅读指引；每条指引有用途、前置、阅读任务、网址和日期。统一政策工单案例，明确决策说明不是模型隐藏思维、固定实验不运行真实模型或SDK。
六实现入口：LangGraph、AutoGen、CrewAI、Semantic Kernel、Dify、Coze（LangGraph归T01组合项）。新增T20/T21，图鉴21项42题，正确位置14/14/14。AutoGen维护模式和MAF后继关系按微软官方核查，旧API不当当前签名。原30节点、60题、12故障保留为基础补给，按需查阅，未删历史。
methodReads/methodRuns为独立结构化进度，不混入基础成绩。1.0/1.1/1.2兼容迁移；恢复过滤未知ID、非法路径与虚构完成标记，已学与实验完成仍不代表岗位认证。我的与摘要包含新模式进度，备份预览可见模式计数。

## 未发布阶段取消兼容（2026-10-14，覆盖前文迁移约定）
按用户要求删除旧版迁移与兼容。应用使用新的开发存储键agent-engineer-lab-dev-1.3，并清除旧键agent-bootcamp-1。不同内容版本记录直接丢弃，不显示升级/保留提示；备份仅接受当前内容版本。旧版读取、事件、实践和技术进度不恢复。历史验收中的迁移结果仅记录当时行为，现已废止；旧版本夹具用于测试拒绝/清空。16单元测试与lint/build通过，最终预览6,338,800 bytes；当前版本正常保存与备份仍可用。


## 首页分类入口与知识图谱

2026-10-14在现有蓝白口袋学院设计内调整首页：原插画缩为130px场景，六张双色分类卡以两列呈现，入口为知识图谱、故障挑战、专项训练、实验台、项目工坊、学习档案。继续学习和统计在入口后。不是复制外部截图，沿用本项目已批准插画与组件。

课程tab改为知识图谱：学习路线/知识库双视图。路线有4阶段8必修节点，建议前置ID可直接跳课程，读取实际已读/作答记录；语言基础默认折叠，8框架路线作为分支，3项目作为实践入口。知识库索引84条真实现有内容，支持类型、多关键词搜索、分批加载和直达原资料，不创建重复课程或新的学习计分。

本次未改题序、存储版本和面试官。所有业务标题与路线关系在content.json，无新依赖/后端/API。详细图谱不作为阅读锁定或就业认证。
