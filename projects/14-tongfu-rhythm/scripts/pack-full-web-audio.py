from pathlib import Path
import base64, hashlib, json, re, zipfile

root = Path(__file__).resolve().parent.parent
package = root / 'release/package'
allowed = {'.html', '.css', '.js', '.jpg', '.jpeg', '.png', '.gif', '.svg', '.webp', '.woff', '.woff2', '.json'}
files = sorted(p for p in package.rglob('*') if p.is_file())
assert all(p.suffix in allowed for p in files)
assert (package / 'index.html').is_file()
audio_script = (package / 'audio-data.js').read_text(encoding='utf-8')
payload = json.loads(audio_script.split('=', 1)[1].rstrip(';'))
audio = base64.b64decode(payload, validate=True)
assert len(audio) <= 1024 * 1024
app = (package / 'app.js').read_text(encoding='utf-8')
assert not re.search(r'\bfetch\s*\(|XMLHttpRequest|import\.meta|\bimport\s*\(', app)
assert 'decodeAudioData' in app and 'createBufferSource' in app
dest = root / 'release/tongfu-fengbo-v11-pointing.zip'
with zipfile.ZipFile(dest, 'w', zipfile.ZIP_DEFLATED, compresslevel=9) as z:
    for p in files: z.write(p, p.relative_to(package).as_posix())
with zipfile.ZipFile(dest) as z: assert z.testzip() is None
assert dest.stat().st_size <= 10 * 1024 * 1024
report = {'zip':str(dest), 'bytes':dest.stat().st_size, 'files':len(files), 'embeddedAudioBytes':len(audio), 'audioBitrateKbps':80, 'audioChannels':2, 'sha256':hashlib.sha256(dest.read_bytes()).hexdigest(), 'shortProbeDevicePassedByUser':True, 'fullPackageDeviceTested':False}
(root / 'release/full-web-audio-manifest.json').write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding='utf-8')
print(json.dumps(report, ensure_ascii=False, indent=2))



