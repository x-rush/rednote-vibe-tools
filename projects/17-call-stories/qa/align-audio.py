"""Local production QA only; never included in the static app or release ZIP."""
import json
import sys
from pathlib import Path

qa = Path(__file__).resolve().parent
sys.path.insert(0, str(qa / '.audio-tools'))
from faster_whisper import WhisperModel

model = WhisperModel('base', device='cpu', compute_type='int8', download_root=str(qa / '.audio-models'))
output = {}
for path in sorted((qa.parent / 'assets/audio/doubao-source').glob('*.mp3')):
    segments, info = model.transcribe(str(path), language='zh', word_timestamps=True, beam_size=5, vad_filter=False)
    output[path.stem] = [dict(start=s.start, end=s.end, text=s.text, words=[dict(start=w.start,end=w.end,text=w.word) for w in s.words]) for s in segments]
    print(path.stem, json.dumps(output[path.stem], ensure_ascii=False), flush=True)
    (qa / 'output').mkdir(exist_ok=True)
    (qa / 'output/audio-alignment.json').write_text(json.dumps(output, ensure_ascii=False, indent=2), encoding='utf-8')
