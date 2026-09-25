"""Prepare local audition files only; no audio is added to the release package."""
import json
import hashlib
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / 'assets/audio/source'
OUT = ROOT / 'assets/audio/audition'
OUT.mkdir(parents=True, exist_ok=True)
tracks = [
    ('female-giggle', '女声轻笑', 'IENBA', 'https://freesound.org/people/IENBA/sounds/652991/', 'CC0', 0, 0.70, '小莲私下打趣；年龄感待试听确认', ''),
    ('female-hmm', '女声疑问：嗯？', 'esperar', 'https://freesound.org/people/esperar/sounds/170768/', 'CC0', 0, 0.711, '短促疑问；不是中文“咦”的录音', ''),
    ('male-chuckle', '男声轻笑', 'jodybruchon', 'https://freesound.org/people/jodybruchon/sounds/459455/', 'CC0', 0, 1.463, '放松后的轻笑；角色适配待试听', ''),
    ('female-sighs', '女声呼吸／叹气', 'SpliceSound', 'https://freesound.org/people/SpliceSound/sounds/218311/', 'CC0', 15.55, 1.65, '母亲欲言又止候选；原录音低音量，放大后需检查底噪', 'volume=28dB,'),
    ('ripples', 'Ripples', 'Kevin MacLeod', 'https://incompetech.com/music/royalty-free/index.html?isrc=USUAN1100691', 'CC BY 4.0', 15, 30, '日常、独处与内心戏备选；非原剧 OST', 'loudnorm=I=-23:TP=-3:LRA=7,'),
    ('eastern-thought', 'Eastern Thought', 'Kevin MacLeod', 'https://incompetech.com/music/royalty-free/index.html?isrc=USUAN1100682', 'CC BY 4.0', 15, 30, '试探、权衡与暗流场景备选；非原剧 OST', 'loudnorm=I=-23:TP=-3:LRA=7,'),
]

def probe(path):
    return json.loads(subprocess.check_output(['ffprobe', '-v', 'error', '-show_entries', 'format=duration,size:stream=codec_name,sample_rate,channels', '-of', 'json', str(path)], encoding='utf8'))

records = []
for ident, title, author, page, license_name, start, duration, purpose, gain in tracks:
    source = SOURCE / (ident + '.mp3')
    dest = OUT / (ident + '.mp3')
    fade = min(.12, duration / 8)
    filters = gain + f'afade=t=in:d={fade},afade=t=out:st={duration-fade}:d={fade}'
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-ss', str(start), '-i', str(source), '-t', str(duration), '-af', filters, '-ac', '1', '-ar', '24000', '-codec:a', 'libmp3lame', '-b:a', '40k', str(dest)], check=True)
    subprocess.run(['ffmpeg', '-v', 'error', '-i', str(source), '-f', 'null', '-'], check=True, stdout=subprocess.DEVNULL)
    subprocess.run(['ffmpeg', '-v', 'error', '-i', str(dest), '-f', 'null', '-'], check=True, stdout=subprocess.DEVNULL)
    source_info, clip_info = probe(source), probe(dest)
    records.append(dict(id=ident, title=title, author=author, sourcePage=page, license=license_name,
        sourceFile=source.relative_to(ROOT).as_posix(), auditionFile=dest.relative_to(ROOT).as_posix(),
        sourceSeconds=float(source_info['format']['duration']), sourceBytes=source.stat().st_size,
        sourceSHA256=hashlib.sha256(source.read_bytes()).hexdigest(),
        auditionSeconds=float(clip_info['format']['duration']), auditionBytes=dest.stat().st_size,
        sampleRate=24000, channels=1, bitrate=40000, trimStart=start, trimSeconds=duration,
        proposedUse=purpose, status='downloaded-decoded-audition-pending', integrated=False,
        sourceVariant='public HQ MP3 preview' if license_name == 'CC0' else 'official full MP3 download',
        attribution=(f'"{title}" Kevin MacLeod (incompetech.com). Licensed under Creative Commons: By Attribution 4.0 License. https://creativecommons.org/licenses/by/4.0/; audition excerpt trimmed, mono, faded and level adjusted.' if license_name != 'CC0' else ''),
        packageNote='Development audition only. Not in upload ZIP. Exceeds 100 KiB: reduce length/bitrate before runtime integration.' if dest.stat().st_size > 102400 else 'Development audition only. Not in upload ZIP.'))

content_path = ROOT / 'src/content/content.json'
content = json.loads(content_path.read_text(encoding='utf-8-sig'))
content['audioCandidates'] = records
content_path.write_text(json.dumps(content, ensure_ascii=False, indent=2) + '\n', encoding='utf8')
print(json.dumps([dict(id=r['id'], seconds=r['auditionSeconds'], bytes=r['auditionBytes']) for r in records], ensure_ascii=False, indent=2))
