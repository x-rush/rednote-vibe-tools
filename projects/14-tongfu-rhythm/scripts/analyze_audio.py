"""Offline transient evidence from the actual decoded recording (NumPy only).
The pulse grid filters candidates; it never invents events. Attack times are
rising half-height, not delayed FFT peaks. This is not vocal transcription.
"""
import hashlib,json,wave
from pathlib import Path
import numpy as np
root=Path(__file__).resolve().parents[1]
with wave.open(str(root/'design/analysis.wav')) as f:
 sr=f.getframerate()
 assert f.getnchannels()==1 and f.getsampwidth()==2
 x=np.frombuffer(f.readframes(f.getnframes()),'<i2').astype(float)/32768
size,hop=1024,110
frames=np.lib.stride_tricks.sliding_window_view(x,size)[::hop]
spec=np.abs(np.fft.rfft(frames*np.hanning(size),axis=1))
freq=np.fft.rfftfreq(size,1/sr)
flux=np.maximum(0,np.diff(np.log1p(spec*20),axis=0));bands=[]
for lo,hi in [(40,250),(500,3500),(3500,8000)]:
 v=flux[:,(freq>=lo)&(freq<hi)].mean(1)
 v=np.maximum(0,v-np.convolve(v,np.ones(41)/41,'same'))
 bands.append(v/max(float(np.quantile(v,.96)),1e-8))
score=.60*bands[0]+.30*bands[1]+.10*bands[2];events=[]
for i in range(5,len(score)-3):
 if score[i]!=max(score[i-3:i+4]) or score[i]<=.22:continue
 j=i
 while j>i-5 and score[j-1]>score[i]*.5:j-=1
 events.append({'time':round(((j+1)*hop+size/2)/sr,4),'peak':round(((i+1)*hop+size/2)/sr,4),'strength':round(float(score[i]),4),'bass':round(float(bands[0][i]),4),'mid':round(float(bands[1][i]),4)})
phase=np.arange(0,.25,.001);ts=np.array([e['time'] for e in events]);weights=np.array([e['strength'] for e in events])
scores=[sum(weights*np.exp(-((ts-p+.125)%.25-.125)**2/(2*.015**2))) for p in phase]
best=float(phase[np.argmax(scores)]);selected=[]
for t in np.arange(best,len(x)/sr,.25):
 near=[e for e in events if abs(e['time']-t)<.045 and (e['bass']>.30 or e['mid']>.55) and e['strength']>=1]
 if near:selected.append(max(near,key=lambda e:e['strength']))
out={'duration':len(x)/sr,'sampleRate':sr,'hopSeconds':hop/sr,'audioSha256':hashlib.sha256((root/'public/audio/hao-jiu-bu-jian.m4a').read_bytes()).hexdigest(),'gridPhase':round(best,3),'events':events,'selected':selected}
(root/'design/audio-analysis.json').write_text(json.dumps(out,indent=2),encoding='utf-8')
print(json.dumps({'phase':out['gridPhase'],'attacks':len(events),'strongAttacks':len(selected)}))
