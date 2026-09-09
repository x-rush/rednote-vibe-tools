"""Refine only Rap anchors; keep the rest of the published song byte-for-byte.
No uniform offset, grid quantization, or newly generated hold notes.
"""
import json,sys,hashlib
from pathlib import Path
root=Path(__file__).resolve().parents[1];sys.path.insert(0,str(root/'test-results/audio-tools'))
import numpy as np,soundfile as sf
from scipy.signal import find_peaks
path=root/'src/content/content.json';c=json.loads(path.read_text('utf-8'));plan=c['chartPlan']['rapRevision']
if '--apply' in sys.argv and c['track'].get('chartRevision',0)>=5:raise SystemExit('Callout revision exists; do not overwrite with the older peak-based refiner.')
rpath=root/'design/vocal-chart-report.json';report=json.loads(rpath.read_text('utf-8'))
evidence=report['vocalEvidence'];anchors={round(e['target'],4):e for e in evidence if plan['start']<=e['target']<plan['end']}
x,sr=sf.read(root/'test-results/vocals.wav');x=x.mean(1);hop=220;N=441
frames=np.lib.stride_tricks.sliding_window_view(x,N)[::hop];amp=np.convolve(np.sqrt((frames*frames).mean(1)),np.ones(3)/3,'same');ts=(np.arange(len(amp))*hop+N/2)/sr
rise=np.maximum(0,amp-np.roll(amp,3));peaks,_=find_peaks(rise,distance=12)
notes=[];details=[];available=[-1]*4
for gi,group in enumerate(plan['groups']):
 for ni,target in enumerate(group):
  old=anchors[round(target,4)];oldtime=old.get('previousTime',old['time']);t=oldtime;confirmed=False
  ids=peaks[(ts[peaks]>=target-.055)&(ts[peaks]<=target+.09)]
  if len(ids):
   strong=ids[rise[ids]>=rise[ids].max()*.55];peak=int(min(strong,key=lambda i:abs(ts[i]-target)));i=peak
   while i>peak-6 and ts[i-1]>=target-.055 and rise[i-1]>.25*rise[peak]:i-=1
   while i<peak and amp[i]<.009:i+=1
   if amp[i]>=.009:t=round(float(ts[i]),4);confirmed=True
  if notes and t-notes[-1]['time']<.17:continue
  preferred=[0,2,1,3][ni%4];lane=next(l for l in [preferred]+[l for l in range(4) if l!=preferred] if available[l]+.18<=t)
  notes.append({'id':f'v4-rap-{gi}-{ni}','time':t,'lane':lane,'duration':0,'source':'vocal'});available[lane]=t
  amplitude=float(amp[np.argmin(abs(ts-t))]) if confirmed else old['amplitude']
  details.append({**old,'time':t,'previousTime':oldtime,'amplitude':round(amplitude,5),'refined':confirmed,'shiftMs':round((t-oldtime)*1000,1),'group':gi})
outside=[n for n in c['notes'] if not plan['start']<=n['time']<plan['end']]
c['notes']=sorted(outside+notes,key=lambda n:(n['time'],n['lane']))
# Relocate only character boundaries inside Rap to actual rests after revision.
phrases=[dict(p) for p in plan['previousPhrases']]
for j in range(1,len(phrases)):
 if not plan['start']<phrases[j]['start']<plan['end']:continue
 candidates=[]
 for k in range(1,len(c['notes'])):
  prev=c['notes'][k-1];n=c['notes'][k];gap=n['time']-prev['time']-prev['duration']
  if gap>=.5 and abs(n['time']-(phrases[j]['start']+.12))<1.5:candidates.append((abs(n['time']-(phrases[j]['start']+.12)),prev['time']+prev['duration'],n['time']))
 if not candidates:raise RuntimeError('No safe character rest')
 _,end,start=min(candidates);phrases[j-1]['end']=round(end+.17,4);phrases[j]['start']=round(start-.12,4)
c['phrases']=phrases;c['practiceNotes']=[n.copy() for n in c['notes'] if c['practiceRange']['start']<=n['time'] and n['time']+n['duration']<c['practiceRange']['end']]
c['track']['chartRevision']=4;c['track']['chartStatus']='Rap 局部修订：按字音邻域的起音前沿重定位，短句分组并减少零散连点；仍需实际演奏听感验收。'
report['vocalEvidence']=[e for e in evidence if not plan['start']<=e['target']<plan['end']]+details
report.update({'notes':len(c['notes']),'rapRevision':4,'humanListeningApproved':False})
audit={'before':len(plan['previousNotes']),'after':len(notes),'unchangedOutsideRap':outside==[n for n in c['notes'] if not plan['start']<=n['time']<plan['end']],'refined':sum(e['refined'] for e in details),'medianShiftMs':float(np.median([e['shiftMs'] for e in details])),'changes':details,'humanListeningApproved':False}
if '--apply' in sys.argv:path.write_text(json.dumps(c,ensure_ascii=False,indent=2)+'\n','utf-8');rpath.write_text(json.dumps(report,indent=2)+'\n','utf-8')
else:(root/'test-results/rap-chart-candidate.json').write_text(json.dumps(c,ensure_ascii=False,indent=2)+'\n','utf-8')
(root/'design/rap-revision-report.json').write_text(json.dumps(audit,indent=2)+'\n','utf-8')
print(json.dumps({k:v for k,v in audit.items() if k!='changes'}))

