from pathlib import Path
from zipfile import ZipFile, ZIP_DEFLATED
root=Path(__file__).resolve().parent
source=root/'preview'
output=root/'dist'/'agent-engineer-bootcamp-2.1.0.zip'
allowed={'.jpg','.css','.gif','.svg','.png','.js','.jpeg','.json','.html','.woff2','.webp','.woff'}
files=sorted(p for p in source.rglob('*') if p.is_file())
assert (source/'index.html').is_file()
assert all(p.suffix.lower() in allowed for p in files)
assert sum(p.stat().st_size for p in files)<=10*1024*1024
output.parent.mkdir(exist_ok=True)
with ZipFile(output,'w',ZIP_DEFLATED) as z:
    for p in files:z.write(p,p.relative_to(source).as_posix())
with ZipFile(output) as z:
    assert z.testzip() is None
    assert 'index.html' in z.namelist()
    assert all(Path(n).suffix.lower() in allowed and not n.startswith('/') and '..' not in Path(n).parts for n in z.namelist())
assert output.stat().st_size<=10*1024*1024
print(f'Audited {len(files)} entries, {output.stat().st_size} bytes: {output}')
