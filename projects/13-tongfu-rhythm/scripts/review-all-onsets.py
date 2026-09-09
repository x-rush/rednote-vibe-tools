"""Conservative whole-chart evidence review. No grid snapping or global offset."""
import json, sys
from pathlib import Path
root=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(root/'test-results/audio-tools'))
import numpy as np
import soundfile as sf
p=root/'src/content/content.json'; c=json.loads(p.read_text(encoding='utf8'))
if c['track']['chartRevision']!=5: raise SystemExit('Requires the approved v5 baseline')
x,sr=sf.read(root/'test-results/vocals.wav');x=x.mean(1);hop=220;N=441
frames=np.lib.stride_tricks.sliding_window_view(x,N)[::hop]
amp=np.sqrt((frames*frames).mean(1));ts=(np.arange(len(amp))*hop+N/2)/sr
locked={a['id'] for a in c['chartPlan']['calloutRevision']['changes']}
original=json.loads(json.dumps(c['notes'])); audit=[]; changes=[]
for n in c['notes']:
 row={'id':n['id'],'time':n['time'],'source':n['source'],'decision':'retained'};audit.append(row)
 if n['id'] in locked:row['reason']='user-approved callout';continue
 if n['source']=='drum':row['reason']='instrumental layer retained; existing transient evidence';continue
 if n['duration']:
  tail=n['time']+n['duration'];samples=amp[(ts>=n['time'])&(ts<=tail)]
  row.update(reason='sustained note retained',voicedFraction=round(float(np.mean(samples>.008)),3),tail=tail);continue
 t=n['time'];lo=np.searchsorted(ts,t-.19);hi=np.searchsorted(ts,t+.06);pk=lo+np.argmax(amp[lo:hi]);height=amp[pk]
 candidates=[]
 for ratio in [.18,.23,.30]:
  j=pk
  while j>lo and amp[j-1]>ratio*height:j-=1
  candidates.append(j)
 j=candidates[1];candidate=round(float(ts[j]),4);shift=(candidate-t)*1000
 row.update(candidate=candidate,shiftMs=round(shift,1),thresholdSpreadMs=round(float(ts[max(candidates)]-ts[min(candidates)])*1000,1))
 if not (-160<shift<-40 and min(candidates)>lo and height>.025 and amp[j]>.008 and row['thresholdSpreadMs']<=25):row['reason']='no unambiguous earlier attack';continue
 if not c['rapPracticeRange']['start']<=t<c['rapPracticeRange']['end']:row['reason']='singing/hook candidate requires listening; preserved';continue
 phrase=next(q for q in c['phrases'] if q['start']<=t<q['end'])
 if candidate<phrase['start']+.04:row['reason']='too close to character entrance; preserved';continue
 others=[o for o in c['notes'] if o is not n]
 if any(abs(candidate-o['time'])<.17 for o in others):row['reason']='would crowd an adjacent tap; preserved';continue
 row.update(decision='moved',reason='stable local vocal attack; same layer; spacing and phrase checked',amplitude=float(amp[j]))
 changes.append(row.copy());n['time']=candidate
c['notes'].sort(key=lambda n:(n['time'],n['lane']))
report={'baseline':5,'revision':6,'notesReviewed':len(audit),'moves':len(changes),'humanListeningApproved':False,'approvedCalloutsUnchanged':all(next(n for n in c['notes'] if n['id']==i)==next(n for n in original if n['id']==i) for i in locked),'changes':changes,'review':audit,'baselineNotes':original}
(root/'test-results/all-onsets-review.json').write_text(json.dumps(report,indent=2),encoding='utf8')
if '--apply' in sys.argv:
 c['track']['chartRevision']=6;c['track']['chartStatus']='修订6：全谱技术复查，保留已确认喊词；修订明确偏后的人声起音，待实际听感验收。'
 c['chartPlan']['onsetReview']={'revision':6,'baseline':5,'moves':[{k:r[k] for k in ['id','time','candidate','shiftMs']} for r in changes],'approvedCalloutsLocked':list(locked),'humanListeningApproved':False}
 c['practiceNotes']=[n.copy() for n in c['notes'] if c['practiceRange']['start']<=n['time'] and n['time']+n['duration']<c['practiceRange']['end']]
 p.write_text(json.dumps(c,ensure_ascii=False,indent=2)+'\n',encoding='utf8')
 rp=root/'design/vocal-chart-report.json';r=json.loads(rp.read_text(encoding='utf8'))
 for e in changes:r['vocalEvidence'].append({'time':e['candidate'],'target':e['time'],'amplitude':e['amplitude'],'source':'vocal','method':'stable onset across three local thresholds; not listening approval'})
 r['rapRevision']=6;rp.write_text(json.dumps(r,indent=2)+'\n',encoding='utf8')
 (root/'design/all-onsets-review.json').write_text(json.dumps(report,indent=2),encoding='utf8')
print(json.dumps({k:v for k,v in report.items() if k not in ['review','baselineNotes']},indent=2))
