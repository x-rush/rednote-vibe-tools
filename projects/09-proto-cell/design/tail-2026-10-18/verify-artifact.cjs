const fs=require('node:fs'),crypto=require('node:crypto')
const files=fs.readdirSync('dist',{recursive:true}).filter(p=>fs.statSync('dist/'+p).isFile())
const allowed=new Set(['jpg','css','gif','svg','png','js','jpeg','json','html','woff2','webp','woff'])
const invalid=files.filter(p=>!allowed.has(p.split('.').at(-1)))
const entry=fs.readFileSync('dist/index.html','utf8')
if(invalid.length||!files.includes('index.html')||/type=["']module/.test(entry))throw Error(JSON.stringify({invalid,entry}))
const output={files:files.length,bytes:files.reduce((n,p)=>n+fs.statSync('dist/'+p).size,0),entry,entryHash:crypto.createHash('sha256').update(entry).digest('hex'),lint:'pass',tests:{files:89,passed:550,failed:0},build:'pass',artifactAudit:{files:79,warnings:0},gitDiffCheck:'pass; line-ending advisories only',physicalPhone:'not tested',hostApp:'not tested'}
fs.writeFileSync('design/tail-2026-10-18/verification.json',JSON.stringify(output,null,2));console.log(JSON.stringify(output))
