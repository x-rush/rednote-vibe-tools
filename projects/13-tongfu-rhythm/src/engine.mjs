export class RhythmEngine {
  constructor(chart,rules){this.rules=rules;this.notes=chart.map(n=>({...n,status:'pending',earned:0,last:null,quality:0}));this.score=0;this.combo=0;this.maxCombo=0;this.counts={perfect:0,good:0,miss:0};this.events=[];this.time=0;this.doubleAwarded=new Set();this.tapChords=new Set();}
  emit(type,n,extra={}){this.events.push({type,lane:n?.lane,id:n?.id,...extra});}
  hit(lane,t){
    const suspended=this.notes.find(n=>n.lane===lane&&n.status==='suspended'&&t<=n.resumeDeadline);
    if(suspended){suspended.status='holding';suspended.last=Math.max(t,suspended.time);this.emit('resume',suspended,{hold:true});return suspended;}
    if(this.notes.some(n=>n.lane===lane&&n.status==='holding'))return null;
    const n=this.notes.find(n=>n.lane===lane&&n.status==='pending'&&Math.abs(n.time-t)<=this.rules.good);
    if(!n)return null;
    const perfect=Math.abs(n.time-t)<=this.rules.perfect;
    n.quality=perfect?1:.6;n.earned=perfect?100:60;this.score+=n.earned;this.counts[perfect?'perfect':'good']++;
    this.combo++;this.maxCombo=Math.max(this.combo,this.maxCombo);
    n.status=n.duration?'holding':'done';n.last=Math.max(t,n.time);
    this.emit(perfect?'perfect':'good',n,{hold:!!n.duration});
    if(!n.duration){const key=n.time.toFixed(4),group=this.notes.filter(p=>!p.duration&&Math.abs(p.time-n.time)<.001);if(group.length>1&&group.every(p=>p.status==='done')&&!this.tapChords.has(key)){this.tapChords.add(key);this.emit('double',n,{tap:true});}}
    return n;
  }
  accrue(n,t){const end=Math.min(t,n.time+n.duration);if(end>n.last){const v=(end-n.last)*this.rules.holdPointsPerSecond;this.score+=v;n.earned+=v;n.last=end;}}
  release(lane,t){for(const n of this.notes.filter(n=>n.lane===lane&&n.status==='holding')){this.accrue(n,t);if(t>=n.time+n.duration)this.finish(n);else{n.status='broken';this.combo=0;this.emit('break',n);}}}
  finish(n){n.status='done';n.earned+=this.rules.holdBonus;this.score+=this.rules.holdBonus;this.emit('complete',n);
    const pair=this.notes.find(p=>p.id!==n.id&&p.duration&&Math.abs(p.time-n.time)<.001&&p.status==='done');
    const key=n.time.toFixed(4);if(pair&&!this.doubleAwarded.has(key)){this.doubleAwarded.add(key);this.score+=this.rules.doubleBonus;this.emit('double',n);}
  }
  update(t){this.time=t;for(const n of this.notes){if(n.status==='suspended'&&t>n.resumeDeadline){n.status='broken';this.combo=0;this.emit('break',n);}else if(n.status==='holding'){this.accrue(n,t);if(t>=n.time+n.duration)this.finish(n);}else if(n.status==='pending'&&t>n.time+this.rules.good){n.status='miss';this.counts.miss++;this.combo=0;this.emit('miss',n);}}}
  suspend(t){for(const n of this.notes)if(n.status==='holding'){this.accrue(n,t);if(t>=n.time+n.duration)this.finish(n);else n.status='suspended';}}
  drain(){return this.events.splice(0);}
  get maxScore(){let total=this.notes.reduce((s,n)=>s+100+(n.duration?n.duration*this.rules.holdPointsPerSecond+this.rules.holdBonus:0),0);const seen=new Set(),awarded=new Set();for(const n of this.notes.filter(n=>n.duration)){const key=n.time.toFixed(4);if(seen.has(key)&&!awarded.has(key)){total+=this.rules.doubleBonus;awarded.add(key);}else seen.add(key);}return total;}
  get accuracy(){return Math.min(100,this.score/this.maxScore*100)||0;}
  phraseSuccess(start,end){const ns=this.notes.filter(n=>n.time>=start&&n.time<end);return ns.length>0&&ns.filter(n=>n.status==='done').length/ns.length>=.75;}
  phraseResolved(start,end){return this.notes.filter(n=>n.time>=start&&n.time<end).every(n=>['done','miss','broken'].includes(n.status));}
}
export function validateChart(notes,duration){const errors=[];const ids=new Set();for(const n of notes){if(ids.has(n.id))errors.push('duplicate id');ids.add(n.id);if(!Number.isFinite(n.time)||n.time<0||n.time+n.duration>duration)errors.push('invalid time');if(!Number.isInteger(n.lane)||n.lane<0||n.lane>3||n.duration<0)errors.push('invalid lane/duration');}
  for(let lane=0;lane<4;lane++){
    const ns=notes.filter(n=>n.lane===lane).sort((a,b)=>a.time-b.time);
    for(let i=1;i<ns.length;i++){
      const prev=ns[i-1],next=ns[i],gap=next.time-prev.time;
      // A short, isolated two-tap repeat is a deliberate pattern, not a hold overlap.
      // These limits are this project's difficulty budget, not universal mapping rules.
      const pair=!prev.duration&&!next.duration&&gap>=.12-1e-6&&
        (!ns[i-2]||prev.time-ns[i-2].time-ns[i-2].duration>=.3-1e-6)&&
        (!ns[i+1]||ns[i+1].time-next.time>=.3-1e-6);
      if(next.time<prev.time+prev.duration+.18-1e-6&&!pair)errors.push('overlapping lane');
    }
  }return errors;}

// Presentation follows score settlement; it never gates music, notes or input.
export class StageTimeline {
  constructor(phrases,dwell){this.phrases=phrases;this.dwell=dwell;this.current=-1;this.releaseAt=0;this.settled=new Set();this.frozen=0;}
  update(engine,now,judge,allowSettlement=true){
    let desired=0;for(let i=0;i<this.phrases.length;i++)if(this.phrases[i].start<=now)desired=i;
    let entered=null;const results=[];
    if(this.current<0){this.current=desired;entered=desired;}
    if(allowSettlement){
      for(let i=0;i<this.phrases.length;i++){
        const p=this.phrases[i];if(judge<p.end||this.settled.has(i)||!engine.phraseResolved(p.start,p.end))continue;
        const success=engine.phraseSuccess(p.start,p.end);this.settled.add(i);if(success)this.frozen++;
        const visible=i===this.current;results.push({index:i,success,visible});
        if(visible)this.releaseAt=now+this.dwell;
      }
      if(desired>this.current&&this.settled.has(this.current)&&now>=this.releaseAt){this.current=desired;entered=desired;}
    }
    return {entered,results};
  }
}
