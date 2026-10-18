const fs=require('node:fs'),crypto=require('node:crypto'),base='release-assets/proto-cell-20261018-v6'
const m=JSON.parse(fs.readFileSync(base+'-manifest.json','utf8')),proof=JSON.parse(fs.readFileSync('design/scroll-2026-10-18/package.json','utf8'))
const hash=crypto.createHash('sha256').update(fs.readFileSync(base+'.zip')).digest('hex');if(hash!==m.sha256||proof.length!==5||proof.some(r=>r.sha256!==hash||r.errors.length||!r.hatchAndStart||r.wheel.scrollTop<=0||r.touch.scrollTop<=0))throw Error('Final ZIP proof mismatch')
let checklist=fs.readFileSync('release-assets/proto-cell-20261018-v5-真机验收清单.md','utf8').replaceAll('20261018-v5','20261018-v6').replaceAll('原胞进化 v5','原胞进化 v6').replace('不使用历史的 v4 包','不使用历史的 v4 / v5 包').replace('10b8239a7ea434ba946399b1c2604d26a25c6219f273bdf1c5121eb11e944cc3',hash).replace('2,976,221',m.zipBytes.toLocaleString('en-US')).replace('3,456,856',m.unpackedBytes.toLocaleString('en-US')).replace('index-BcRB6BGU.js',m.scripts[1].split('/').at(-1))
checklist=checklist.replace('## 已完成与待完成','本次v6修复生命谱系页无法滚动。已用最终ZIP在5种视口中验证鼠标滚轮与Chrome模拟触摸滑动，可以到达“开始培育”，完成孵化并以新细胞开局；真机仍需实际手势复验。\n\n## 已完成与待完成')
fs.writeFileSync(base+'-真机验收清单.md',checklist)
const report=`# 原胞进化 v6 — 谱系滚动修复与交付

上传包：\`${m.archive}\`；SHA-256：\`${hash}\`。v6替代v5；旧包保留用于追溯，不要再上传v5。

## 原因与修复

生命谱系页只设置最小高度，没有限定滚动视口，内容随页面增高；body为了战斗操作保持overflow:hidden，导致谱系页底部被裁切。复现时390×700视口中内容高1591px，滚轮后scrollTop仍为0，培育按钮底部位于1562.7px。

仅给.nursery-shell增加视口高度、独立纵向滚动及触摸惯性滚动。保留安全区、宿主按钮预留与战斗滚动锁定。未调整玩法、数值、存档结构或视觉设计。

之前的布局回归只检查首屏几何，并通过自动定位点击部分按钮，没有证明用户能真实滑到底部；本次新增真实输入回归补上该缺口。

## 验证

- pnpm lint通过；全量92个测试文件、560项通过；pnpm build通过。
- 修复前的浏览器滚轮断言失败；修复后375×700、390×700、430×780、457×692和844×390五组通过。
- 最终ZIP解压后独立验证相同5组：滚轮与CDP可信touchStart/touchMove/touchEnd手势均能滑到培育操作，实际完成培育、孵化和下一局。390×700下滚轮与触摸scrollTop均为891px，按钮底部671.7px，完整位于视口内。
- 每组开启下一局后，body仍禁止页面滚动，战斗Canvas可见；无页面异常。运行资源均由解压包提供，限制CSP，无外部资源或缺失请求。
- 本轮最终ZIP未再重复整场三层UI自动通关；上一版v5的三层、巨物吞噬、平台存储模拟和48组布局记录保留在上一份报告中。本轮全量逻辑回归和定向滚动验证通过。

## 包体

${m.fileCount}文件；ZIP ${m.zipBytes.toLocaleString('en-US')}字节（${(m.zipBytes/1048576).toFixed(2)}MiB），解压${m.unpackedBytes.toLocaleString('en-US')}字节。唯一入口index.html在ZIP根目录，脚本顺序${m.scripts.join(' → ')}。扩展名白名单、CRC、逐文件字节一致性和哈希通过。

包体低于10MiB上限，超过建议2MiB，保留1项体积提示；主JS仍有大于500kB的构建建议。没有为消除提示删减画面或改为动态模块。

## 待真机验收

平台实际上传/模拟器、Android/iPhone宿主与旧版Chrome61实测仍未完成。浏览器触摸输入模拟不代表实际手机手势通过。请使用同目录v6真机清单验证同一SHA包。

原始记录：design/scroll-2026-10-18/before-failure.txt、after.json、package.json与截图。文件清单：${base.split('/')[1]}-manifest.json；校验码：${base.split('/')[1]}-SHA256.txt。
`
fs.writeFileSync(base+'-验收报告.md',report)
fs.writeFileSync(base+'-verification.json',JSON.stringify({archive:m.archive,sha256:hash,tests:{files:92,passed:560},lint:'pass',build:'pass',zip:{bytes:m.zipBytes,files:m.fileCount,warning:'over recommended2MiB; under10MiB'},scrollCases:proof,physicalPhone:'not tested',sourceChange:'src/App.css .nursery-shell independent viewport scroller'},null,2));console.log(JSON.stringify({archive:m.archive,sha256:hash,bytes:m.zipBytes,cases:proof.length}))
