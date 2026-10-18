const fs=require('node:fs'),out='design/tail-2026-10-18'
const before=JSON.parse(fs.readFileSync(out+'/battle-combined-events-before.json')).cases.find(c=>c.throttle===4&&!c.catchUp),after=JSON.parse(fs.readFileSync(out+'/battle-combined-events-final.json')).cases[0],app=JSON.parse(fs.readFileSync(out+'/app-final.json')),normal=JSON.parse(fs.readFileSync(out+'/flow-proof.json')),comfort=JSON.parse(fs.readFileSync(out+'/comfort/flow-proof.json'))
const summary={entry:normal.productionEntry,checks:{lint:true,testFiles:89,tests:550,build:true,artifactFiles:79,artifactWarnings:0,normalFlow:normal.proof.events.some(e=>e.type==='ending-reached'),comfortFlow:comfort.proof.events.some(e=>e.type==='ending-reached'),layouts:normal.layouts.length+comfort.layouts.length,mutationSelections:[normal.choices,comfort.choices],pixelHashesEqual:true,stressTargetPassed:false,physicalPhone:false,hostApp:false},eventHandling:{before:before.eventHandling,after:after.eventHandling},fixedStress:after.total,actualApp:app.map(r=>({throttle:r.throttle,renderCost:r.renderCost,renderGap:r.renderGap,longTasks:r.longTasks,errors:r.errors}))}
fs.writeFileSync(out+'/final-summary.json',JSON.stringify(summary,null,2))
const f=n=>n.toFixed(1)
const text=`# 极端密集性能第二轮：验收记录

本轮已落实事件处理和界面同步优化，并通过完整功能回归；**极端120AI组合负载的低端机性能目标仍未通过**。没有删减新形态、精细器官、进化、破壁和吞噬效果，也没有降低敌人数、AI频率、物理更新或画布DPR。

保留的改动：同一模拟帧批量记录事件；高频HUD不复制整局日志；图鉴和奖励未变化时复用原存档，避免重复持久化；普通战斗数字合并至已有100ms定时器。进化、破壁、迁徙、死亡与结局仍立即同步。完整历史、结局归档和奖励继续保留。

## 测量结果与未达标项

390×844 CSS px、DPR2、balanced画质、独立桌面Chrome的CPU降速测试。第三层成熟状态、120个真实AI追击者、实际破壁、连续补充食物；QA只保护存活用于持续压力，不属于正常通关。CPU降速不能替代真实低端手机。

包含1000条既有历史的同口径固定步压力样本中，事件处理P99从${f(before.eventHandling.p99)}ms降至${f(after.eventHandling.p99)}ms；单位测试同时证明120条同帧事件从逐事件读取状态变为一次读取。这个局部收益**不代表整体长帧已解决**。最终4×固定步总CPU耗时P95为${f(after.total.p95)}ms、P99为${f(after.total.p99)}ms，未达到本轮P95≤33ms、P99≤50ms的初始目标。

完整App（含HUD、声音和本地存档）的最终压力结果如下；render提交耗时与真实帧间隔分别记录，不互相替代：

| CPU降速 | render P95/P99 | RAF帧间隔 P95/P99 | 长任务最大值 |
| --- | --- | --- | --- |
${app.map(r=>`| ${r.throttle}× | ${f(r.renderCost.p95)} / ${f(r.renderCost.p99)} ms | ${f(r.renderGap.p95)} / ${f(r.renderGap.p99)} ms | ${f(r.longTasks.max)} ms |`).join('\n')}

样本间有明显波动，最终结果未证明整机长帧稳定改善，故不以中途最好成绩做性能承诺。剩余热点主要在密集主体绘制和慢帧下的模拟追赶；本轮没有贸然改动其质量或时间语义。多种绘制缓存、遮挡与自动帧率原型因收益不足撤回，详见[t尾部探测记录](tail-2026-10-18/PERFORMANCE.md)。

## 功能与画面验收

- pnpm lint、pnpm test、pnpm build均通过：89文件、550测试；产物79文件、3,426,103字节，静态审计0警告。构建保留单一经典脚本，仍有既有的大于500kB构建提示。
- 新生产入口为 ${normal.productionEntry}。默认和减少动态/闪烁/震动两套实际App流程均走完三生态圈、各6次进化选择、成熟破壁、巨物披甲→暴露→被吞噬、终局暂停和结局。只输入方向和加速固定步，没有修改角色/敌人数值。
- 24组布局覆盖375/390/430 CSS px及844×390横屏，模拟44px系统安全区与左右宿主按钮。无横向溢出、按钮碰撞或HUD/目标重叠；不是实际小红书宿主验收。
- 同一极端战斗在第60/90/120/180帧分别比较优化前后完整Canvas像素哈希，4组完全相同。生产没有保留本轮绘制原型。
- 舒适模式第一遍自动驾驶卡在旧舱壁坐标；失败证据保存在comfort-stalled-proof.json。测试脚本改为随世界扩张实时读墙体坐标后通过，未为此修改游戏代码或数值。
- 代码只读复核未发现必须修正项；曾发现导出路线计数共享引用，已补独立克隆及红绿回归。

真实低端Android/iOS、小红书宿主按钮和长时间温升表现尚未验证。功能回归通过不能代替性能目标通过；本轮保留未达标状态。

原始数据和方法见[最终摘要](tail-2026-10-18/final-summary.json)、[完整流程](tail-2026-10-18/flow-proof.json)、[舒适模式](tail-2026-10-18/comfort/flow-proof.json)、[完整App压力](tail-2026-10-18/app-final.json)及[像素对照](tail-2026-10-18/visual-comparison.json)。
`
fs.writeFileSync('design/2026-10-18-tail-performance.md',text.replace('[t尾部探测记录]','[探测记录]'));console.log(JSON.stringify(summary.checks))
