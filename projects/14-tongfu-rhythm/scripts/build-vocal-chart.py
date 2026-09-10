"""Build an explicitly selected, vocal-led chart from stem/word evidence.
Selection lives in content.json, not amplitude rank or a repeating key template.
ASR gives word neighbourhoods; the isolated waveform locates attacks and releases.
"""
import sys,json,hashlib
from pathlib import Path
root=Path(__file__).resolve().parents[1];sys.path.insert(0,str(root/'test-results/audio-tools'))
import numpy as np,soundfile as sf
from scipy.signal import find_peaks
p=root/'src/content/content.json';c=json.loads(p.read_text(encoding='utf8'));plan=c['chartPlan']
if '--apply' in sys.argv and c['track'].get('chartRevision',0)>=4:raise SystemExit('Published Rap revision exists; use refine-rap.py instead.')
x,sr=sf.read(root/'test-results/vocals.wav');x=x.mean(1);hop=220;N=441
frames=np.lib.stride_tricks.sliding_window_view(x,N)[::hop];amp=np.sqrt(np.mean(frames**2,axis=1));amp=np.convolve(amp,np.ones(3)/3,'same');ts=(np.arange(len(amp))*hop+N/2)/sr
rise=np.maximum(0,amp-np.roll(amp,3));rise[:3]=0
words=[w for f in ['vocal-word-alignment.json','vocal-word-alignment-short.json','word-alignment.json'] for s in json.loads((root/'test-results'/f).read_text(encoding='utf8')) for w in s['words'] if .08<w['end']-w['start']<.85]
evidence=[]
def onset(target,hook=False):
 # Starts selected from explicit phrase/word anchors. Never replace a target by
 # an unrelated louder drum, and never force it onto the old 250ms grid.
 lo=target-.055;hi=target+(.13 if hook else .18)
 indices=np.where((ts>=lo)&(ts<=hi))[0]
 scores=rise[indices]*np.exp(-((ts[indices]-(target+.045))/.12)**2)
 i=int(indices[np.argmax(scores)])
 if amp[i]<.008:return None
 t=round(float(ts[i]-.01),4)
 supporting=[w for w in words if w['start']-.25<=t<=w['end']+.10]
 evidence.append({'target':target,'time':t,'source':'vocal','amplitude':round(float(amp[i]),5),'wordSupport':bool(supporting)})
 return {'time':t,'duration':0,'source':'vocal','target':target}
ns=[]
for target in plan['rapTargets']+plan['chorusTargets']:
 n=onset(target)
 if n:ns.append(n)
for base in plan['hookStarts']:
 for index,offset in enumerate(plan['hookWordOffsets']):
  n=onset(base+offset,True)
  if n:n['hookIndex']=index;ns.append(n)
# Coincident annotations of a boundary syllable become one note.
ns.sort(key=lambda n:n['time']);dedup=[]
for n in ns:
 if dedup and n['time']-dedup[-1]['time']<.17:
  if 'hookIndex' in n:dedup[-1]=n
  continue
 dedup.append(n)
ns=dedup
# Retain only sustained, voiced parts within the chosen word interval.
for target,end in plan['sustainCandidates']:
 n=min(ns,key=lambda n:abs(n['target']-target))
 if abs(n['target']-target)>.03:continue
 ids=np.where((ts>=n['time']+.05)&(ts<=end))[0]
 if not len(ids):continue
 voiced=amp[ids];threshold=max(.007,float(np.max(voiced))*.12)
 quiet=np.where(np.convolve((voiced<threshold).astype(float),np.ones(8),'valid')>=8)[0]
 tail=float(ts[ids[quiet[0]]]) if len(quiet) else end-.02
 duration=round(tail-n['time'],4)
 if duration>=.28 and float(np.mean(voiced>threshold))>=.8:n['duration']=duration;n['source']='sustain'
# Intro/outro accompany the music, never compete with the rap voice.
a=json.loads((root/'design/audio-analysis.json').read_text())
inst=[e for e in a['selected'] if .7<e['time']<16.4 or 94.25<e['time']<97]
last=-1
for e in sorted(inst,key=lambda e:e['time']):
 if e['time']-last<.35:continue
 ns.append({'time':e['time'],'duration':0,'source':'drum','target':e['time']});last=e['time']
ns.sort(key=lambda n:n['time'])
# The same call uses the same D/J/K gesture. Other vocals alternate hands.
available=[-1]*4;notes=[];flip=0;holds=0
for n in ns:
 preferred=([0,2,3][n['hookIndex']] if 'hookIndex' in n else [0,2,1,3][flip%4]);flip+=1
 lanes=sorted(range(4),key=lambda l:(l!=preferred,available[l]))
 lane=next(l for l in lanes if available[l]+.18<=n['time'])
 if n['duration'] and holds%2==1 and available[1]+.18<=n['time'] and available[2]+.18<=n['time']:pair=[1,2]
 else:pair=[lane]
 for l in pair:
  note={'id':f'v3-{len(notes)}','time':n['time'],'lane':l,'duration':n['duration'],'source':n['source']};notes.append(note);available[l]=n['time']+n['duration']
 if n['duration']:holds+=1
notes.sort(key=lambda n:(n['time'],n['lane']))
# Character changes use actual gaps, not a hard 8-second cut through a word.
unique=sorted(set(n['time'] for n in notes));boundaries=[];last=0
for target in range(8,94,8):
 gaps=[]
 for t in unique:
  if t<last+4 or abs(t-target)>3:continue
  previous=max((n['time']+n['duration'] for n in notes if n['time']<t),default=0)
  if t-previous>=.48:gaps.append((abs(t-target),previous,t))
 if gaps:
  _,end,start=min(gaps);boundaries.append((round(end+.17,4),round(start-.12,4)));last=start
phrases=[];start=0
for i,(end,next_start) in enumerate(boundaries+[(c['track']['duration'],c['track']['duration'])]):
 section=next((s for s in plan['sections'] if s['start']<=start+.5<s['end']),plan['sections'][-1])
 phrases.append({'start':start,'end':end,'cast':i%4,'title':section['label']});start=next_start
c['notes']=notes;c['phrases']=phrases;c['practiceRange']={'start':16,'end':36};c['practiceNotes']=[n.copy() for n in notes if 16<=n['time'] and n['time']+n['duration']<36]
c['track']['chartRevision']=3;c['track']['chartStatus']='分段人声谱：字音时间与独立人声波形交叉定位；前奏跟伴奏。尚未通过人工听感终审。'
c['ui']['practice']='先练人声 20 秒';c['ui']['practiceHint']='人声段练习 · 不计本机纪录';c['ui']['practiceTag']='人声练习';c['ui']['tutorial'][1]['text']='听持续声音按住，直到长条尾部过线。'
destination=p if '--apply' in sys.argv else root/'test-results/vocal-chart-candidate.json'
destination.write_text(json.dumps(c,ensure_ascii=False,indent=2)+'\n',encoding='utf8')
report={'audioSha256':c['track']['audioSha256'],'method':'explicit phrase anchors + word alignment + isolated vocal waveform','humanListeningApproved':False,'vocalEvidence':evidence,'notes':len(notes),'holds':sum(n['duration']>0 for n in notes),'phrases':len(phrases),'voicedDurationMin':min([n['duration'] for n in notes if n['duration']] or [0])}
(root/('design/vocal-chart-report.json' if '--apply' in sys.argv else 'test-results/vocal-chart-candidate-report.json')).write_text(json.dumps(report,indent=2),encoding='utf8')
print(json.dumps({k:v for k,v in report.items() if k!='vocalEvidence'}))
