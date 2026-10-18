const fs=require('node:fs'),p='design/tail-2026-10-18/battle.cjs'
let s=fs.readFileSync(p,'utf8')
s=s.replace("fs.writeFileSync(out+'/bundle-'+tag+'.js.txt',code);", "fs.writeFileSync(out+'/bundle-'+tag+'.js.txt',code); if(process.argv.includes('--compile-only')){await browser.close();return}")
fs.writeFileSync(p,s)
