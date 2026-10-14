# Agent 应用工程技术栈研究

核验日期：2026-10-14。本文是课程选型研究，未据此改动应用课程。框架推荐是教育与工程选型判断，不是全球市场份额排行榜，也不是职业资格标准。

## 岗位证据与局限

- 神州数码融信 2027 校招 Agent 开发岗位，2026-09-07 发布：要求 Python、至少一个应用框架，工具调用、规划、记忆、多轮编排、RAG、评测与产品工程能力。框架举例不等于全部必修。https://career.nankai.edu.cn/correcruit/content/id/117965.html
- 海外实习样本 Davis AI：上下文组装、工具编排、验证、真实数据、评测与可观测性。ATS 正文直接访问受 JS 限制，搜索索引可见；只作为补充，不能视为完整岗位统计。https://jobs.ashbyhq.com/meetdavis/2923e62b-4958-4f96-9577-aba7c05aa49c
- LangChain 报告于 2026-06-12 发布，但调查时间为 2025-11-18 至 2025-12-02，1340 份公开自选样本，技术行业占 63%。可支持可靠性、评测、可观测性的方向判断，不能当作 2026 年 10 月全世界市场份额。https://www.langchain.com/state-of-agent-engineering

## 推荐优先级

1. 通用必修能力：模型 API、结构化输出、工具参数校验、Agent 循环与停止条件、上下文与记忆、RAG 与引用、持久化状态、人审、超时重试与幂等、权限与注入防护、评测集、执行追踪、延迟与成本、部署与回归测试。
2. 默认深练路线：先小型原生工具循环，再 LangChain/LangGraph；理解框架提供什么以及无需框架时如何实现。模型接入可选择一家服务商，不把单一供应商设为资格门槛。
3. 轻量 SDK 对照：OpenAI Agents SDK 或 PydanticAI，选一个做比较；无需两个都精通。
4. 技术路线分支：TypeScript 使用 Vercel AI SDK / Mastra；Google 生态 ADK；微软企业生态 Microsoft Agent Framework；知识密集应用 LlamaIndex；多 Agent 编排比较 CrewAI / Agno。
5. 低代码选修：Dify / Coze，学习工作流、工具、知识库及发布边界，不替代代码工程能力。
6. 前沿概览：Claude Agent SDK、Deep Agents 等 harness；上下文压缩与工件交接、沙箱、Skills、MCP、A2A、多 Agent 独立验证、长任务恢复。MCP 工具接入优先于 A2A 跨 Agent 协作的深入实现。
7. AutoGen 放入既有项目识读：官方已进入维护模式，建议新用户使用 Microsoft Agent Framework。Semantic Kernel 作为微软既有生态与组件识读，不与新主线框架并列要求掌握。

## 方法定位修正

ReAct 与 Plan-and-Execute 用于理解循环、规划和执行分离；Reflexion 与 Tree of Thoughts 作为经典方法选修，学习适用边界、验证与搜索成本。四个名称不能概括当下 Agent 工程，也不能直接当作完整就业主线。

## 建议课程主线

模型与结构化输出 → 工具与循环 → 上下文与记忆 → 工作流与恢复 → 检索与证据 → 协议与权限 → 评测与调试 → 交付与成本。每章采用基础资料、流程图、操作实验、故障问答、官方深读指引。框架专区按任务选型；前沿专区清楚区分可掌握技能与概念认识。

## 初级能力验收建议

能独立实现带检索与工具调用的应用；写操作有确认、权限与幂等保护；失败能从追踪中定位并修复；维护包含正常、缺失信息、冲突证据、工具失败和攻击输入的评测集；解释架构选择、完成率、成本和延迟。至少交付一个可运行项目及复现说明。此标准是本训练营建议，具体雇主要求会不同。

纯前端学习工具可内置知识、固定数据的状态机实验、追踪分析与故障练习；实际调用模型、服务端凭证、数据库与部署的项目提供外部实践指引。完成内置模拟不等于完成真实工程交付，不用积分宣称已获得工程师资格。

## 核验的官方资料

- LangGraph：状态、持久化、流式与人审；LangChain 与 Deep Agents 分层：https://docs.langchain.com/oss/python/langgraph/overview
- OpenAI Agents SDK：循环、工具、handoff、guardrails、sessions、tracing：https://openai.github.io/openai-agents-python/
- Microsoft Agent Framework：https://learn.microsoft.com/en-us/agent-framework/overview/
- AutoGen 项目状态：https://github.com/microsoft/autogen
- Google ADK：https://adk.dev/
- Mastra：https://mastra.ai/docs
- PydanticAI：https://pydantic.dev/docs/ai/overview/
- Vercel AI SDK：https://ai-sdk.dev/docs/introduction
- MCP 架构：https://modelcontextprotocol.io/docs/learn/architecture
- 长任务 harness 工程案例，2026-03-24：https://www.anthropic.com/engineering/harness-design-long-running-apps
- Agent 评测：https://www.anthropic.com/engineering/demystifying-evals-for-ai-agents
- CrewAI：https://docs.crewai.com/en/introduction
- Agno：https://docs.agno.com/
- Dify：https://docs.dify.ai/en/home
- Coze Studio：https://github.com/coze-dev/coze-studio
- LlamaIndex：https://developers.llamaindex.ai/python/framework/
- Langfuse：https://langfuse.com/docs
- Promptfoo：https://www.promptfoo.dev/docs/intro/
- Agent Skills：https://agentskills.io/specification
- A2A：https://a2a-protocol.org/latest/

## 面试官 skill 的配套原则

重点询问真实约束、实现与故障分析，允许候选人选择熟悉的主框架。答案包含最低合格方案、取舍、失败路径和验证办法，不以框架名词数量计分。前沿题为加分或识读题；不强迫初级候选人实现复杂多 Agent 系统、模型训练或完整云平台。
