"""Build an upload ZIP from dist only, then independently inspect its contents."""
from pathlib import Path, PurePosixPath
from html.parser import HTMLParser
import hashlib, json, re, zipfile, sys

ROOT = Path(__file__).resolve().parent.parent
DIST = ROOT / 'dist'
OUT = ROOT / 'release-assets'
NAME = sys.argv[1] if len(sys.argv) > 1 else 'proto-cell-20261018-v7'
assert re.fullmatch(r'proto-cell-[0-9]{8}-v[0-9]+', NAME), 'Invalid release name'
ALLOWED = {'jpg','css','gif','svg','png','js','jpeg','json','html','woff2','webp','woff'}

def digest(data): return hashlib.sha256(data).hexdigest()
files = sorted(p for p in DIST.rglob('*') if p.is_file())
assert files and (DIST / 'index.html').is_file()
entries = {p.relative_to(DIST).as_posix(): p.read_bytes() for p in files}
assert [n for n in entries if n.endswith('.html')] == ['index.html'], 'Only one HTML entry is allowed'
for name in entries:
    path = PurePosixPath(name)
    assert not path.is_absolute() and '..' not in path.parts
    assert path.suffix[1:].lower() in ALLOWED, f'Unsupported file: {name}'
    assert not any(x in path.parts for x in ['node_modules','.git','src','design']), name

class EntryParser(HTMLParser):
    def __init__(self): super().__init__(); self.scripts=[]; self.in_script=False
    def handle_starttag(self, tag, attrs):
        attrs=dict(attrs)
        assert tag not in ('iframe','object','base')
        assert not any(k.startswith('on') for k in attrs)
        if tag=='script':
            assert attrs.get('src') and attrs.get('type') != 'module'
            self.scripts.append(attrs['src']); self.in_script=True
        for key in ('src','href'):
            value=attrs.get(key)
            if value:
                assert value.startswith('./'), (tag,key,value)
                assert value[2:] in entries, f'Missing entry reference: {value}'
    def handle_endtag(self,tag):
        if tag=='script': self.in_script=False
    def handle_data(self,data):
        assert not (self.in_script and data.strip()), 'Inline JavaScript is forbidden'

parser=EntryParser(); parser.feed(entries['index.html'].decode('utf8'))
assert parser.scripts[0]=='./compat.js' and len(parser.scripts)==2
for name,data in entries.items():
    if name.endswith('.js'):
        code=data.decode('utf8')
        for token in ['fetch(', 'XMLHttpRequest', 'new Worker(', 'new SharedWorker(', 'new WebSocket(', 'new EventSource(', 'eval(', 'new Function(', 'navigator.connection', 'WebAssembly.', 'import(']:
            assert token not in code, f'Forbidden runtime token {token} in {name}'
        assert not re.search(r'\b(?:import|export)\s+(?:\{|\*|default)',code), name
        for embedded in re.findall(r'data:[a-zA-Z0-9.+-]+/[a-zA-Z0-9.+-]+;base64,([A-Za-z0-9+/=]+)',code):
            import base64
            assert len(base64.b64decode(embedded)) <= 1024*1024
OUT.mkdir(exist_ok=True)
archive=OUT / (NAME+'.zip')
with zipfile.ZipFile(archive,'w',zipfile.ZIP_DEFLATED,compresslevel=9) as package:
    for name,data in entries.items():
        info=zipfile.ZipInfo(name,date_time=(2026,10,18,0,0,0));info.compress_type=zipfile.ZIP_DEFLATED
        info.external_attr=0o100644 << 16
        package.writestr(info,data,compress_type=zipfile.ZIP_DEFLATED,compresslevel=9)
assert archive.stat().st_size <= 10*1024*1024
sha=digest(archive.read_bytes())
extracted=OUT / (NAME+'-verify-'+sha[:8])
extracted.mkdir(exist_ok=True)
with zipfile.ZipFile(archive) as package:
    assert package.testzip() is None, 'ZIP CRC check failed'
    assert sorted(package.namelist()) == sorted(entries)
    for member in package.infolist():
        assert not member.is_dir() and PurePosixPath(member.filename).suffix[1:].lower() in ALLOWED
        data=package.read(member)
        assert data == entries[member.filename]
        target=extracted / member.filename
        assert target.resolve().is_relative_to(extracted.resolve())
        target.parent.mkdir(parents=True,exist_ok=True);target.write_bytes(data)
manifest={'archive':archive.name,'sha256':sha,'zipBytes':archive.stat().st_size,'unpackedBytes':sum(map(len,entries.values())),'fileCount':len(entries),'extractedRoot':str(extracted),'scripts':parser.scripts,'overRecommended2MiB':archive.stat().st_size>2*1024*1024,'uploadLimitMiB':10,'entries':[{'path':n,'bytes':len(d),'sha256':digest(d)} for n,d in entries.items()]}
(OUT/(NAME+'-manifest.json')).write_text(json.dumps(manifest,ensure_ascii=False,indent=2),encoding='utf8')
(OUT/(NAME+'-SHA256.txt')).write_text(sha+'  '+archive.name+'\n',encoding='utf8')
print(json.dumps({k:v for k,v in manifest.items() if k!='entries'},ensure_ascii=False))
