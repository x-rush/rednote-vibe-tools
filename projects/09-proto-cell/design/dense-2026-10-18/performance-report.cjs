const fs=require('node:fs'),path=require('node:path')
const dir=__dirname,root=path.resolve(dir,'../..'),read=f=>JSON.parse(fs.readFileSync(path.join(root,f)))
const before=read('design/late-2026-10-18/performance-dense-before.json'),after=read('design/late-2026-10-18/performance-dense-verified.json'),battle=read('design/dense-2026-10-18/battle-combined-verified.json')
const fmt=n=>n.toFixed(2)
const rows=after.cases.map(c=>{const old=before.cases.find(b=>b.throttle===c.throttle&&b.tierIndex===c.tierIndex&&b.dense===c.dense);return `| ${c.throttle}× | ${c.tierIndex+1} | ${c.dense?'180全部可见':'普通'} | ${fmt(old.updateMs.mean+old.renderMs.mean)} | ${fmt(c.updateMs.mean)} | ${fmt(c.renderMs.mean)} | ${fmt(c.updateMs.mean+c.renderMs.mean)} | ${fmt(c.frameGapMs.p95)} | ${c.longTasks.count} |`})
const combined=battle.cases.map(c=>`| ${c.throttle}× | ${c.catchUp?'按实际RAF补步':'固定16.67ms推进'} | ${fmt(c.total.mean)} | ${fmt(c.total.p95)} | ${fmt(c.frameGap.p95)} | ${c.events.engulfs} | ${c.events.breaks} | ${c.events.overlapFrames} | ${c.events.maxChasing} | ${c.longTasks.count} |`)
const text=[
'# 最终性能明细',
'',
'数据来源为当前源码哈希已校验的 performance-dense-verified.json 和 battle-combined-verified.json。桌面 Chrome headless，390×844，DPR2，balanced。单位 ms，采样前预热30帧。下面不是手机FPS承诺。',
'',
'## 同口径前后测量',
'',
'普通例约11–18个世界实体。dense例约187–191个世界实体参与模拟，再独立构造180个全部可见的绘制对象；渲染对象不作为新增真实AI统计。优化前记录时间08:09 UTC，最终记录与当前生产代码哈希一致。',
'',
'| CPU降速 | 生态层 | 场景 | 优化前更新+绘制 | 最终更新 | 最终绘制 | 最终更新+绘制 | 最终RAF间隔P95 | 最终长任务数 |',
'|---|---|---|---:|---:|---:|---:|---:|---:|',...rows,
'',
'4× dense重复测量保留于performance-dense-final.json与performance-dense-repeat.json。连同最终测量，聚合层平均更新+绘制30.91–39.50ms，深域28.03–36.93ms。渲染和GPU排队存在波动；模拟更新的下降更稳定。原始数据中仍保留所有长帧，不能只用平均值宣称极端场景稳定60FPS。',
'',
'## 120个真实AI追击者与破壁、吞噬组合',
'',
'QA直接初始化成熟深域、真实来源的120个追击者，并补充食物、保护玩家避免死亡中断；没有把绘制克隆称为AI。每例采样300帧，事件计数包括30帧预热。固定步长例在测量期第约6帧破壁，三类事件重叠约47帧。实际RAF补步例推进的模拟时长随设备速度变化，不和固定步长例当作严格等长模拟比较。',
'',
'| CPU降速 | 模拟推进 | 主线程总耗时均值 | 总耗时P95 | RAF间隔P95 | 吞噬数 | 破壁数 | 三类事件重叠帧 | 最大追击数 | 长任务数 |',
'|---|---|---:|---:|---:|---:|---:|---:|---:|---:|',...combined,
'',
'该最终组合样本测量期无超过50ms长任务；此前组合复测仍出现过单次151ms峰值，原始battle-combined-final.json保留。因此没有把一次无长任务的结果泛化为所有硬件或所有局面。实体数量、绘制细节、粒子预算和攻击频率均未因本次优化而降低。',
'',
'## 复现',
'',
'在项目目录启动dist预览到4110，然后依次执行，避免其他重浏览器或测试任务并发影响测量：',
'',
'```powershell',
'node design/late-2026-10-18/performance.cjs custom-performance',
'node design/dense-2026-10-18/battle.cjs combined-custom',
'node design/dense-2026-10-18/visual-equivalence.cjs',
'node design/dense-2026-10-18/flow.cjs',
'node design/dense-2026-10-18/flow.cjs --comfort',
'```',
'',
'acceptance.cjs核对保留的最终命名记录、源码哈希、实际UI流程入口及产物扩展名。未进行手机GPU、温控或小红书宿主真机验证。',
''
].join('\n')
fs.writeFileSync(path.join(dir,'PERFORMANCE.md'),text)
