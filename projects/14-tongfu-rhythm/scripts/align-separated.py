import sys,os,json,faulthandler
faulthandler.dump_traceback_later(120,repeat=True)
from pathlib import Path
root=Path(__file__).resolve().parents[1];sys.path.insert(0,str(root/'test-results/audio-tools'))
os.environ['HF_HOME']=str(root/'test-results/hf-cache')
print('loading libraries',flush=True)
from faster_whisper import WhisperModel
import soundfile as sf,numpy as np
print('loading signal tools',flush=True)
from scipy.signal import resample_poly
print('loading model',flush=True)
model=WhisperModel(str(root/'test-results/whisper-model/models--Systran--faster-whisper-small/snapshots/536b0662742c02347bc0e980a01041f333bce120'),device='cpu',compute_type='int8',cpu_threads=4)
x,sr=sf.read(root/'test-results/vocals.wav');x=resample_poly(x.mean(1),160,sr//100).astype('float32')
print('model and audio ready',flush=True)
result=[]
for start in range(16,96,8):
 if np.sqrt(np.mean(x[start*16000:(start+8)*16000]**2))<.001:continue
 segments,info=model.transcribe(x[start*16000:(start+8)*16000],language='zh',word_timestamps=True,beam_size=5,vad_filter=False,condition_on_previous_text=False)
 for s in segments:
  result.append({'start':start+s.start,'end':start+s.end,'text':s.text,'words':[{'start':start+w.start,'end':start+w.end,'word':w.word,'probability':w.probability} for w in s.words]})
 print('aligned vocal section',start,flush=True)
(root/'test-results/vocal-word-alignment-short.json').write_text(json.dumps(result,ensure_ascii=False,indent=2),encoding='utf-8')
