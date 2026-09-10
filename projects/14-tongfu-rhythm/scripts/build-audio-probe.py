from pathlib import Path
import base64, json, zipfile, hashlib

root = Path(__file__).resolve().parent.parent
out = root / 'release/audio-probe'
out.mkdir(parents=True, exist_ok=True)
sample = (root / 'release/audio-probe-sample.mp3').read_bytes()
assert len(sample) < 100 * 1024
content = json.loads((root / 'src/content/content.json').read_text(encoding='utf-8-sig'))
config = content['audioProbe']
(out / 'index.html').write_text('''<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'self'; style-src 'self'; connect-src 'none'; media-src 'none'; img-src 'none'; object-src 'none'; base-uri 'none'"><title>音频验证</title><link rel="stylesheet" href="./style.css"></head><body><main><h1 id="title"></h1><p id="intro"></p><button id="play"></button><button id="pause" disabled></button><button id="restart" disabled></button><p id="clock">0.00 s</p><p id="state" role="status" aria-live="polite"></p><p id="hint"></p><pre id="log"></pre></main><script src="./config.js"></script><script src="./app.js"></script></body></html>''', encoding='utf-8')
(out / 'config.js').write_text('window.PROBE='+json.dumps(config,ensure_ascii=False)+';window.PROBE_AUDIO="'+base64.b64encode(sample).decode()+'";',encoding='utf-8')
(out / 'app.js').write_text((root/'src/audio-probe.js').read_text(encoding='utf-8'),encoding='utf-8')
(out / 'style.css').write_text('''*{box-sizing:border-box}body{margin:0;background:#101925;color:#f4dec0;font:16px/1.65 system-ui,sans-serif}main{max-width:480px;margin:auto;padding:24px;padding-top:calc(24px + var(--safe-area-inset-top,0px));padding-bottom:calc(24px + var(--safe-area-inset-bottom,0px))}@supports(padding:env(safe-area-inset-top)){main{padding-top:calc(24px + var(--safe-area-inset-top,env(safe-area-inset-top,0px)));padding-bottom:calc(24px + var(--safe-area-inset-bottom,env(safe-area-inset-bottom,0px)))}}h1{font-size:25px}button{display:block;width:100%;min-height:48px;margin:12px 0;border:1px solid #dcb675;border-radius:8px;background:#e4c184;color:#222;font:inherit;touch-action:manipulation}button:disabled{opacity:.45}button:focus{outline:3px solid #80d0bd}pre{white-space:pre-wrap;word-break:break-word;font:12px/1.7 monospace;border:1px solid #53616e;padding:12px}#state{color:#80d0bd}#hint{font-size:14px}#clock{font-size:24px;font-variant-numeric:tabular-nums}''',encoding='utf-8')
dest=root/'release/tongfu-audio-probe-v1.zip'
with zipfile.ZipFile(dest,'w',zipfile.ZIP_DEFLATED,compresslevel=9) as z:
    for p in sorted(out.iterdir()):
        assert p.suffix in {'.html','.css','.js'}
        z.write(p,p.name)
with zipfile.ZipFile(dest) as z: assert z.testzip() is None
print(json.dumps({'zip':str(dest),'bytes':dest.stat().st_size,'embeddedAudioBytes':len(sample),'sha256':hashlib.sha256(dest.read_bytes()).hexdigest()},ensure_ascii=False))
