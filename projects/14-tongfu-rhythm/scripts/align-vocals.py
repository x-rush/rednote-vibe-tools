import sys,os
from pathlib import Path
root=Path(__file__).resolve().parents[1];sys.path.insert(0,str(root/'test-results/audio-tools'))
os.environ['HF_HOME']=str(root/'test-results/hf-cache');os.environ['HF_HUB_DISABLE_XET']='1'
from faster_whisper import WhisperModel
model=WhisperModel('small',device='cpu',compute_type='int8',download_root=str(root/'test-results/whisper-model'),cpu_threads=4)
print('ASR model ready',flush=True)
import json
segments,info=model.transcribe(str(root/'test-results/mix-stereo.wav'),language='zh',word_timestamps=True,beam_size=5,vad_filter=False,condition_on_previous_text=False)
result=[]
for s in segments:
 result.append({'start':s.start,'end':s.end,'text':s.text,'words':[{'start':w.start,'end':w.end,'word':w.word,'probability':w.probability} for w in s.words]})
 print(round(s.start,2),round(s.end,2),flush=True)
(root/'test-results/word-alignment.json').write_text(json.dumps(result,ensure_ascii=False,indent=2),encoding='utf-8')
