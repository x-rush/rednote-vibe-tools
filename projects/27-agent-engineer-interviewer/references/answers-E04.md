# E04 解法与教学示例

## Q10 状态与幂等

假设付款请求p17已发出但响应丢失；进程重启后checkpoint停在“待调用付款”。支付服务支持幂等键和按operation_id查询。

### 最低合格

unknown不是failed；幂等键绑定同一意图；checkpoint不原子保证外部动作

### 完整参考解法

我会把执行意图、外部副作用和本地checkpoint分别看待。付款已发出但响应丢失属于unknown，不等于failed；恢复后先查询p17真实状态，不能因为checkpoint写“待调用”就再创建一笔付款。首次执行前持久化operation_id和稳定幂等键，重试同一意图复用这个键；参数变化意味着新意图，需要新确认，不能靠复用键掩盖不同金额。支付端需要保证同键语义与结果，否则客户端缓存不等于端到端幂等。
checkpoint帮助恢复工作流步骤和已有观察，但不能让数据库记录与外部付款原子提交。进程可能在付款成功后、checkpoint写入前崩溃，这个窗口必须通过幂等、状态查询和对账处理。使用真正持久化存储；内存checkpointer只能在进程活着时保存状态，不能宣称重启可恢复。保存时避免秘密与完整个人资料，线程ID绑定用户权限。操作状态可用prepared、submitted、unknown、succeeded、failed；未知状态暂停重复写入，给用户清楚提示，后台对账也需要授权和预算。测试分别在提交前、服务已成功但响应丢失、checkpoint写入前后模拟崩溃，验证最后只有一次付款。补偿不是自动逆转，退款也属于新副作用并需相应授权。框架可替换，真正工程重点是跨系统不确定性被显式表示，而不是把“有checkpoint”说成exactly-once。

### 关键点

- unknown不是failed
- 幂等键绑定同一意图
- checkpoint不原子保证外部动作
- 持久存储与崩溃窗口

### 可接受替代

- 事务外盒适合同数据库事件发送，但外部支付仍需幂等/对账
- 无法查询状态的供应商应保守暂停人工处理，而不是猜失败

### 常见错误

- 恢复checkpoint就不会重复付款
  - 原因：恢复checkpoint就不会重复付款：外部动作可能成功而checkpoint尚未保存。

### 未运行示例

```json
{"operation_id":"p17","idempotency_key":"tenant-u-intent17","state":"unknown","checkpoint":"payment_pending","next_action":"query_provider_status"}
```

状态 illustrative_not_executed

### 来源

[OpenAI Function calling](https://developers.openai.com/api/docs/guides/function-calling)（核验 2026-10-14）、[LangGraph Persistence](https://docs.langchain.com/oss/python/langgraph/persistence)（核验 2026-10-14）、[Stripe Idempotent requests](https://docs.stripe.com/api/idempotent_requests)（核验 2026-10-14）。解法为原创综合，不是公司真题或官方逐字答案。

## Q11 人工确认与授权

假设用户只要求草拟给客户甲的邮件；审核卡显示正文v1，随后模型把收件人改成客户乙、正文变v2。不得自动发送。

### 最低合格

起草与发送分权；确认绑定对象内容版本；可信状态而非文本批准

### 完整参考解法

我会把草拟和发送拆成不同动作。用户请求写草稿仅授权生成内容，不包含对外发送；模型能调用发送工具也不意味着允许使用。确认卡必须展示收件人、主题、正文及附件，说明将发生的具体动作。用户批准后，执行层保存动作ID、收件对象、正文哈希或版本和确认状态；发送前比较当前参数与已批准内容。题目里收件人或正文改变，旧确认失效，需要重新审阅，不能自动发送v2。
授权证据由应用可信状态保存，不能从检索文档、模型输出或邮件正文中的“已同意”推断。确认还应有有效期与单次使用约束，用户取消或权限撤销后立即失效。过程重启时恢复待确认状态和审阅材料，而不是重新生成一封不同邮件却保留批准状态；内存等待不能代表可恢复审批。发送使用幂等操作ID，响应丢失先核对供应商发送结果，避免确认一次发送两次。权限系统限制可发账户与对象范围，敏感附件再检查访问资格。测试覆盖参数改动、审批超时、取消后重试、重复点击和重启恢复。低风险只读查询可不每次确认，但应由业务风险与用户授权决定，不让模型自由降低风险等级。作为候选人的好答案，能把“人类在环”落实到绑定字段、状态与失败窗口，而不是只说弹一个确认按钮。
审批绑定的是用户实际授权范围，不一定只允许逐字逐字段相等。如果用户明确批准同一订单在100元以内、按剩余余额退款，80元可能仍在范围内；先核对对象、条件、有效期和余额，再执行。若只批准固定100元，80元属于另一参数，应重新确认。不能将所有变化一律视作越权，也不能仅因金额更小就推断允许。

### 关键点

- 起草与发送分权
- 确认绑定对象内容版本
- 可信状态而非文本批准
- 重启/重复/撤销验证

### 可接受替代

- 让用户手动复制到邮箱最简单，明确skill不代发
- 受控预授权可用于范围明确的重复低风险任务，但需对象/限额/期限边界
- 用户已明确授权对象、金额上限和条件时，可在范围内执行；解释前提和绑定检查，同等评价。

### 常见错误

- 用户说写邮件就是允许发送
  - 原因：用户说写邮件就是允许发送：范围误读；审批v1也不授权改动后的v2。

### 未运行示例

```json
{"action":"send_email","recipient":"client-a","body_version":"v1","approved":true,"current_body_version":"v2","executable":false,"reason":"approval_invalidated"}
```

状态 illustrative_not_executed

### 来源

[OpenAI Function calling](https://developers.openai.com/api/docs/guides/function-calling)（核验 2026-10-14）、[OpenAI Safety best practices](https://developers.openai.com/api/docs/guides/safety-best-practices)（核验 2026-10-14）、[LangGraph Persistence](https://docs.langchain.com/oss/python/langgraph/persistence)（核验 2026-10-14）、[Stripe Idempotent requests](https://docs.stripe.com/api/idempotent_requests)（核验 2026-10-14）。解法为原创综合，不是公司真题或官方逐字答案。

## Q12 LangGraph状态与人工中断

售后助手需要查询订单与政策、生成申请草稿并经人工审核后提交。审核可能隔天完成，期间金额或用户访问权限可能变化；团队尚未设计状态和恢复机制。

### 最低合格

用节点和条件边表达步骤，保存检查点与任务身份；审批绑定草稿版本和操作参数；恢复后校验权限及证据有效性，提交工具用幂等键。

### 完整参考解法

把查订单、检索、生成草稿、审核和提交拆成职责明确的节点，状态保存结构化结果及来源；条件边根据证据是否齐全、资格是否满足、是否批准进入下一步。模型节点生成建议，确定性节点校验归属、政策和金额。LangGraph可用于持久化、中断恢复和人审，但也可以用等价状态机完成；框架名称不能替代正确的状态与权限设计。

在等待审批时保存checkpoint，并使用能够区分用户、租户和具体任务的标识。审批记录绑定draft版本、订单、金额、接收方或操作类型；恢复时拿到“同意”不意味着当前草稿获批。如果草稿或关键证据变化，应重新确认。再次校验调用者权限与政策有效性，已经失效的材料进入重新检索分支。

checkpoint记录完成节点不保证外部写操作恰好执行一次。提交节点仍需稳定operation_id与幂等键，并对“服务已接受但本地响应丢失”的窗口按操作ID查询。避免恢复时重放产生新申请。测试覆盖审核拒绝、审批后修改金额、隔天权限撤销、进程在提交后崩溃以及重复恢复。面试可要求候选人画节点与边并写状态样例；不因不能默写具体版本API判能力不足，也不能把代码示意当已运行证据。
具体到LangGraph，恢复动态interrupt时会从所在节点开头重新执行，interrupt之前的代码可能再跑。不要在等待审核的同一节点前置不可幂等写操作；拆节点或把副作用放进可安全重放的受控步骤，仍依赖外部幂等。thread_id是状态定位键，不自动提供身份授权。生产需持久化checkpointer，内存示例只适合进程内教学。
变更是否超出授权需按批准的实际范围判断：固定草稿版本审批必须匹配该版本；明确允许对象和上限内调整的审批，满足该范围可继续。不能不看范围就一律重新确认。

### 关键点

- 节点条件边与结构化状态
- 检查点任务隔离
- 审批绑定参数版本
- 外部写操作幂等

### 可接受替代

- 满足题面授权、证据、预算与恢复要求的框架无关实现同样可接受；需解释取舍。

### 常见错误

- 有checkpoint就保证退款只执行一次
  - 原因：检查点与外部服务之间存在故障窗口，需要幂等契约及状态查询。

### 未运行示例

```
示意状态：pending → collecting → awaiting_approval → executing → verified / failed / cancelled。状态名需按项目语义调整。
```

状态 illustrative_not_executed

### 来源

[LangGraph官方概览](https://docs.langchain.com/oss/python/langgraph/overview)（核验 2026-10-14）、[LangGraph Persistence](https://docs.langchain.com/oss/python/langgraph/persistence)（核验 2026-10-14）、[Stripe Idempotent requests](https://docs.stripe.com/api/idempotent_requests)（核验 2026-10-14）、[LangGraph动态中断与恢复](https://docs.langchain.com/oss/python/langgraph/interrupts)（核验 2026-10-14）。解法为原创综合，不是公司真题或官方逐字答案。
