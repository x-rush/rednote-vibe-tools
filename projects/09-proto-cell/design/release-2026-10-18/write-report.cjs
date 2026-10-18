const fs=require('node:fs'),crypto=require('node:crypto'),base='release-assets/proto-cell-20261018-v5',qa='design/release-2026-10-18'
const manifest=JSON.parse(fs.readFileSync(base+'-manifest.json','utf8')),flows=['legacy','native'].map(profile=>({profile,...JSON.parse(fs.readFileSync(qa+'/'+profile+'/flow-proof.json','utf8'))})),offspring=JSON.parse(fs.readFileSync(qa+'/native/offspring-proof.json','utf8')),matrix=JSON.parse(fs.readFileSync(qa+'/mobile/matrix.json','utf8'))
const zipHash=crypto.createHash('sha256').update(fs.readFileSync(base+'.zip')).digest('hex');if(zipHash!==manifest.sha256)throw Error('Archive changed after flow verification')
for(const f of flows){if(f.sha256!==zipHash||f.errors.length||f.choices!==6||!f.proof.events.some(e=>e.type==='ending-reached')||!f.proof.wallDone)throw Error('Invalid final flow evidence')}
if(matrix.some(r=>r.overflow||r.collisions.length||r.errors.length))throw Error('Layout failure')
const sourcePaths=['vite.config.ts','index.html','public/compat.js','src/main.tsx','src/release-compat.css','scripts/css-baseline.ts','src/storage/host-storage.ts','src/storage/repository.ts']
const result={archive:manifest.archive,sha256:zipHash,zipBytes:manifest.zipBytes,unpackedBytes:manifest.unpackedBytes,fileCount:manifest.fileCount,checks:{lint:{status:'passed',errors:0,warnings:0},tests:{files:92,passed:560,failed:0},releaseFocusedTests:{passed:12,failed:0},build:{status:'passed',entry:flows[0].productionEntry},directoryAudit:{files:80,warnings:0},zipAudit:{files:80,warnings:['ZIP exceeds recommended 2MiB; below hard 10MiB limit']},zipRootEntry:true,extensionWhitelist:true,crc:true,extractedBytesMatch:true,classicScripts:manifest.scripts,noRuntimeNetworkTokens:true,offlinePackageFlows:flows.map(f=>({profile:f.profile,oldApiFallbackSimulation:true,nativeStorageMock:f.nativeStorageMock,resourcesRequested:new Set(f.requests).size,events:f.proof.events.length,tiers:f.proof.stages.length,choices:f.choices,wallBroken:f.proof.wallDone,finisher:f.proof.events.some(e=>e.finisher),ending:true,layouts:f.layouts.length,errors:f.errors})),nativeOffspring:{reloadRetained:true,firstTier:offspring.child.tier,inheritedTraits:offspring.child.traits,recipe:offspring.child.recipe},additionalLayouts:matrix.length,totalLayoutChecks:matrix.length+flows.reduce((n,f)=>n+f.layouts.length,0),physicalAndroid:'not run',physicalIOS:'not run',platformSimulator:'not run',chrome61Engine:'not run'},sourceHashes:Object.fromEntries(sourcePaths.map(p=>[p,crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex')]))}
fs.writeFileSync(base+'-verification.json',JSON.stringify(result,null,2))
const report=`# 原胞进化 v5 — 最终包验收报告

交付物：\`${manifest.archive}\`；SHA-256：\`${zipHash}\`。

本轮冻结玩法，只完成上传必需的兼容、资源核对和打包。保留三生态圈、新形态、品系、种源孵化、破壁和终局吞噬。未上传或发布到小红书。

## 包体与入口

- ZIP：${manifest.zipBytes.toLocaleString('en-US')} 字节，${(manifest.zipBytes/1048576).toFixed(2)} MiB；低于10 MiB上限，高于建议2 MiB，记录1项建议性提示。
- 解压：${manifest.unpackedBytes.toLocaleString('en-US')} 字节，${manifest.fileCount}文件，只有一个根目录index.html。
- 入口脚本：${manifest.scripts.join(' → ')}，均为包内经典脚本，无module、动态import或顶层await。
- 逐项扩展名白名单、ZIP CRC、每个文件的SHA-256、解压内容与dist字节一致性均通过。未包含源码、测试、node_modules、日志、截图或验收文档。没有直接打入MP3/WAV等不支持的媒体格式；游戏声音仍为本地Web Audio合成。
- 目录审计80文件0警告，最终ZIP审计80文件1项体积建议。主JS650.10kB（gzip191.26kB），有构建器500kB建议提示；不为了消除提示改成离线容器不适用的动态模块。

## 发布适配

JS构建指定ES2017 / Chrome61；仅为游戏实际使用的globalThis、Array.at/flat/flatMap、Object.fromEntries、结构化数据克隆补少量离线回退。CSS保留旧值与明确@supports增强，构建转换现代颜色和定位简写；Flex gap有布局行为检测，关键方形预览有旧布局回退。玩法数值与渲染预算未调整。

按本次读取的[平台文档](https://miniapp-sandbox.xiaohongshu.com/minitool/doc)，客户端9.46.0及以上且公开方法可用时，优先平台缓存；旧版本/未知版本保留浏览器兼容路径。设置随平台存档保存，可从既有浏览器档迁移；异步保存与清除串行化，失败进入可见session状态，清空标记阻止旧档复活。相关拒绝、迁移和并发顺序回归已通过。

## 实际执行的检查

- pnpm lint：通过，最终0错误0警告（生成的解压产物按生成物排除，不改变源码检查）。
- pnpm test：92测试文件、560项通过；最后发布适配与产物定向回归12项通过。
- pnpm build：通过；产物入口与解压包一致。
- 解压后的最终ZIP在独立Chrome中运行，限制CSP，所有页面资源从包内提供，运行时fetch/XHR被阻止，无外部请求或缺失资源。启动前移除游戏使用的几种新运行时API，验证包内回退生效。该测试不是实际旧Chrome61内核。
- 两套实际App完整流程：浏览器兼容存储路径，以及平台缓存API模拟路径（同时禁用旧IndexedDB），均完成三层、6次选择、成熟破壁、巨物暴露与反杀吞噬、终局暂停和结局。只输入方向并加速固定步，没有改角色或敌人数值。
- 平台缓存模拟路径继续实际留下种源、孵化一个新细胞、重载保留选中品系，再以该后代开始第一层；仅继承1个器官，配方为${offspring.child.recipe}。
- ${result.checks.totalLayoutChecks}组布局检查：游戏24组；首页、细胞库、释放确认、种源和孵化弹窗另24组。覆盖375/390/430 CSS px和844×390横屏、44px模拟系统安全区与左右宿主按钮。无横向溢出、按钮覆盖冲突或页面异常。抽查第三层与孵化完成截图，主要画面正常。
- 发布适配代码复核发现并已修复异步保存顺序、清除标记顺序与CSS变量fallback三个问题，复核无新增必修项。

## 尚未执行

创服平台实际上传/模拟器、Android与iPhone宿主扫码、实际Chrome61旧内核、设备温升与主流手机帧率均未实测。平台缓存为公开接口的本地模拟验证，没有冒充真实SDK验证。低端手机极端120AI组合压力目标仍未通过，不计入本次冻结交付承诺。请按同目录真机清单验收同一SHA包。

## 附件

- 真机清单：\`${base.split('/')[1]}-真机验收清单.md\`
- 全文件清单与哈希：\`${base.split('/')[1]}-manifest.json\`
- 机器可读验收：\`${base.split('/')[1]}-verification.json\`
- 校验码：\`${base.split('/')[1]}-SHA256.txt\`
- 原始浏览器记录：\`design/release-2026-10-18/legacy\`、\`native\`、\`mobile\`。

自动审批曾拒绝删除临时解压目录的清理命令，返回策略拦截，未说明更具体原因；该目录已保留，ZIP及验证字节未改变。上传时仅选择ZIP本身。
`
fs.writeFileSync(base+'-验收报告.md',report);console.log(JSON.stringify({sha256:zipHash,layouts:result.checks.totalLayoutChecks,flows:result.checks.offlinePackageFlows,offspring:result.checks.nativeOffspring},null,2))
