from pathlib import Path
import json,zipfile,hashlib,re
root=Path(__file__).resolve().parents[1];dist=root/'dist';out=root/'release';out.mkdir(exist_ok=True)
allowed={'.jpg','.css','.gif','.svg','.png','.js','.jpeg','.json','.html','.woff2','.webp','.woff'}
files=sorted(p for p in dist.rglob('*') if p.is_file());assert (dist/'index.html').is_file()
for p in files:assert p.suffix.lower() in allowed,p
html=(dist/'index.html').read_text(encoding='utf-8-sig');assert 'type="module"' not in html
for ref in re.findall(r'(?:src|href)="([^"]+)"',html):
 assert not re.match(r'(?:https?:|data:|blob:|/)',ref),ref
 assert (dist/ref).is_file(),ref
code=(dist/'app.js').read_text(encoding='utf-8-sig')
for pattern in [r'\bfetch\s*\(',r'XMLHttpRequest',r'new Worker\s*\(',r'new Function\s*\(',r'\beval\s*\(',r'WebAssembly',r'DeviceMotionEvent',r'DeviceOrientationEvent',r'qa-fishing',r'QA 抄网']:
 assert not re.search(pattern,code),pattern
archive=out/('wild-pond-fishing.zip')
with zipfile.ZipFile(archive,'w',zipfile.ZIP_DEFLATED,compresslevel=9) as z:
 for p in files:z.write(p,p.relative_to(dist).as_posix())
with zipfile.ZipFile(archive) as z:
 assert 'index.html' in z.namelist();assert z.testzip() is None
 for name in z.namelist():assert Path(name).suffix.lower() in allowed
assert archive.stat().st_size<10*1024*1024
manifest={'zip':archive.name,'bytes':archive.stat().st_size,'sha256':hashlib.sha256(archive.read_bytes()).hexdigest(),'files':[{'path':p.relative_to(dist).as_posix(),'bytes':p.stat().st_size} for p in files]}
(out/'manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n',encoding='utf-8');print(json.dumps(manifest,ensure_ascii=False))
