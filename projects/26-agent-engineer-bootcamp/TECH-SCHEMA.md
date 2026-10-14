# 技术栈速览数据契约

内容版本1.2.0，原有30节点不改ID。src/content/content.json新增tech命名空间：title/description/notice/sections/categories/selectionGuide/items。tech.items每项id T01..T19，name/category/position/useWhen/avoidWhen、architecture[{title,text}]、steps[]、example{label,code,note}、pitfalls[]、comparison{with,tradeoff}、relatedIds[]、questions[{id,prompt,options,answer,analysis}]、sourceIds[]。每项2道场景题，answer为选项索引，38题正确位置分布13/13/12。所有官方来源存入全局sources，包含accessed与supports已核查事实，不把来源URL当文章内容。

state新增techReads[]、techAnswers{}，与reads/answers严格分开。每日tech_read/tech_answer事件有独立类别，不能刷原有30/60分母。支持1.0.0/1.1.0/1.2.0迁移，旧基础阅读、首次正确、实践与每日记录保留，技术字段默认空；未知技术ID或题ID过滤。

首页快捷区域之后与课程页搜索之前各一个醒目入口；不增加第五tab。技术列表提供分类筛选与搜索，已读计数独立。技术详情沿用讲解screen世界，以概览/上手/理解题/来源分节，关联能力可跳转课程。两道理解题采用已有单题session，首次成绩独立，离开确认沿用已有机制。

例子统一明确为未执行教学伪代码，标示架构关系或应用侧控制点，不假冒可直接运行的厂商SDK代码。框架教学中提及后端不意味着本学习工具引入后端。选择指南区分自研loop、workflow、framework、harness与托管运行时；不做未经核查的人气、价格、许可证或版本排名。
