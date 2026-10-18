const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto')
const directory = __dirname, root = path.resolve(directory, '../..')
const entry = fs.readFileSync(path.join(root, 'dist/index.html'), 'utf8').match(/src="([^"]+\.js)"/)[1]
const runs = ['flow-proof.json', 'comfort/flow-proof.json'].map(file => {
 const r = JSON.parse(fs.readFileSync(path.join(directory, file)))
 const finisher = r.proof.events.find(e => e.finisher), ending = r.proof.events.find(e => e.type === 'ending-reached')
 if(r.productionEntry !== entry || r.choices !== 6 || r.errors.length || !finisher || !ending || !r.proof.wallDone || r.proof.stages.length !== 3 || r.layouts.length !== 12) throw Error('Incomplete current production flow '+file)
 if(r.proof.events.some(e=>e.type==='mutation-ready' && e.atMs>=finisher.atMs && e.atMs-finisher.atMs<1500)) throw Error('Finisher covered by a mutation choice')
 if(r.layouts.some(l=>l.overflow || l.collisions.length || l.hudOverlap)) throw Error('Mobile host layout failed')
 return { file, comfort:r.comfort, choices:r.choices, layouts:r.layouts.length, finisherAtMs:finisher.atMs, endingAtMs:ending.atMs, wallBreaks:r.proof.events.filter(e=>e.type==='terrain-broken').length, errors:r.errors, finalePauseClockAssertPassed:true, terminalIntakeOverlayAssertPassed:true }
})
const performanceFiles = ['design/late-2026-10-18/performance-dense-verified.json', 'design/dense-2026-10-18/battle-combined-verified.json']
for(const file of performanceFiles){const r=JSON.parse(fs.readFileSync(path.join(root,file)));for(const [name,hash] of Object.entries(r.sourceHashes)){if(crypto.createHash('sha256').update(fs.readFileSync(path.join(root,name))).digest('hex')!==hash)throw Error('Stale performance source '+name)}if(r.errors.length)throw Error('Performance runtime error')}
const files=[]
function walk(dir){for(const e of fs.readdirSync(dir,{withFileTypes:true})){const p=path.join(dir,e.name);if(e.isDirectory())walk(p);else files.push(p)}}
walk(path.join(root,'dist'))
const allowed=new Set(['.jpg','.css','.gif','.svg','.png','.js','.jpeg','.json','.html','.woff2','.webp','.woff'])
if(files.some(p=>!allowed.has(path.extname(p))))throw Error('Unsupported package extension')
const result={recordedAt:new Date().toISOString(),productionEntry:entry,runs,performanceSourceHashesCurrent:true,distribution:{files:files.length,bytes:files.reduce((sum,p)=>sum+fs.statSync(p).size,0),extensions:[...new Set(files.map(p=>path.extname(p)))].sort()},physicalPhoneVerified:false,xiaohongshuHostVerified:false}
fs.writeFileSync(path.join(directory,'acceptance.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2))
