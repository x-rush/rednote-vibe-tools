const fs=require('node:fs');let s=fs.readFileSync('design/scroll-2026-10-18/scroll.cjs','utf8'),flow=fs.readFileSync('design/release-2026-10-18/flow.cjs','utf8');const route=flow.slice(flow.indexOf('const manifest='),flow.indexOf(' await page.addInitScript')).replace('proto-cell-20261018-v5-manifest','proto-cell-20261018-v6-manifest')
s=s.replace("await page.goto('http://127.0.0.1:4110/?v=scroll-'+tag)",()=>route+"\n  await page.goto('http://proto-cell.offline/')")
s=s.replace('const record={width,height,before,wheel,errors}', 'const record={archive:manifest.archive,sha256:manifest.sha256,width,height,before,wheel,errors}')
fs.writeFileSync('design/scroll-2026-10-18/package-scroll.cjs',s)
