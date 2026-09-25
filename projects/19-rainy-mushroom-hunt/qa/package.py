from pathlib import Path
import zipfile,json,hashlib
root=Path(__file__).resolve().parents[1];dist=root/'dist';out=root/'release';out.mkdir(exist_ok=True)
files=sorted(p for p in dist.rglob('*') if p.is_file());allowed={'.jpg','.css','.gif','.svg','.png','.js','.jpeg','.json','.html','.woff2','.webp','.woff'}
for p in files:assert p.suffix.lower() in allowed,p
assert (dist/'index.html').is_file();assert 'fixture' not in (dist/'index.html').read_text(encoding='utf-8')
archive=out/'rainy-mushroom-hunt.zip'
with zipfile.ZipFile(archive,'w',zipfile.ZIP_DEFLATED,compresslevel=9) as z:
 for p in files:z.write(p,p.relative_to(dist).as_posix())
with zipfile.ZipFile(archive) as z:
 assert z.testzip() is None;assert 'index.html' in z.namelist()
 for name in z.namelist():assert Path(name).suffix.lower() in allowed
assert archive.stat().st_size<10*1024*1024
manifest={'bytes':archive.stat().st_size,'sha256':hashlib.sha256(archive.read_bytes()).hexdigest(),'files':[p.relative_to(dist).as_posix() for p in files]};(out/'manifest.json').write_text(json.dumps(manifest,indent=2)+'\n',encoding='utf-8');print(json.dumps(manifest))
