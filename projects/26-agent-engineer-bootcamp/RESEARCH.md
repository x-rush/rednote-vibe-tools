# 来源与研究记录

检索日期：2026-10-14。官方来源已通过浏览工具打开：Python tutorial、asyncio，GitHub About Git，OpenAI Function calling、Structured outputs、Retrieval、Evaluation best practices，MCP Architecture overview，OpenTelemetry Observability primer。地址、日期随内容保存到content.json。教学文字为原创中文案例改写，来源用于概念校对和延伸阅读，不承诺某一SDK版本、价格或厂商服务可用。

研究结论：工具调用须由应用执行和验证；检索需要文档与出处关系；评估应包含任务相关失败样本；观测以请求链路关联日志与耗时；MCP是连接协议而非自动赋予业务权限。课程因此采用可验证的工单项目、故障推理与自报证据，避免单靠名词背诵。

补充核对：MDN HTTP状态码、Anthropic Building Effective AI Agents和Demystifying evals for AI agents已打开。Python教程与asyncio锁定3.12文档，MCP明确的2026-07-28架构地址已打开确认有效。讲解围绕稳定工程概念，代码/数据均为本课程原创工单案例；不是复制官方文档段落。A02对应HTTP资料，D02/F01/F05对应架构取舍资料，E01对应评估资料。

小红书在线文档本次获取超时，读取仓库 .codex/references/js-api.md 2026-09-23 快照及6项构建reference。使用无网络的经典JS及包内CSS，当前原型不调用宿主API；本地存储按用户本轮授权使用localStorage结构化状态。正式交付前须重新核实远程规范与平台真机表现。


## 技术栈官方核查快照
2026-10-14总控与并行研究实际打开官方文档，19项事实写入src/content/content.json的tech.items，25条TCxx来源带supports具体事实与accessed日期。包括LangChain/LangGraph、Deep Agents、OpenAI Agents SDK、Claude Agent SDK与Managed Agents区别、ADK、Microsoft Agent Framework、Pydantic AI、MCP、Agent Skills、A2A、Dify、Coze Studio、LlamaIndex、混合检索/RRF、Langfuse、Promptfoo、FastAPI、Vercel AI SDK及CrewAI。学习步骤、工单伪代码、取舍与38题为原创教学综合；不宣称代码运行或当前热度排行。A2A用中文状态避免把示意拼写当API；CrewAI保留稳定入口，不从宣传词判断生产质量。
