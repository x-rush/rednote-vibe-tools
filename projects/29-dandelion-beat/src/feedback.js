(function(root){
const clamp=v=>Math.max(0,Math.min(1,v)),smooth=v=>{v=clamp(v);return v*v*(3-2*v);};
function create(){return {dodge:null,miss:null};}
function success(f,c,index,at,result){const a=c.attacks[index];f.dodge={index,at,result,type:a.type,noteTime:a.beat*60/c.bpm,direction:a.type==='headbutt'?1:a.type==='spin'?1:a.side===1?1:-1};f.miss=null;}
function failure(f,index,at){f.miss={index,at};f.dodge=null;}
function hero(f,c,t){let dodge=0,hurt=0,direction=1,result=null;if(f.dodge){const e=f.dodge,hold=Math.max(e.at+.20,e.noteTime+.16);dodge=smooth((t-e.at)/.016)*(1-smooth((t-hold)/.28));direction=e.direction;if(dodge>0)result=e.result;}if(f.miss){let d=t-f.miss.at;hurt=d>=0?(1-smooth(d/.48)):0;if(hurt>0)result='miss';}const near=f.dodge?Math.exp(-Math.pow((t-f.dodge.noteTime-.035)/.13,2))*dodge:0;const type=f.dodge&&f.dodge.type,shift=type==='spin'?.50:type==='kick'?.56:type==='headbutt'?.68:.64,lower=type==='spin'?.46:type==='kick'?.18:.32;return {dodge,hurt,direction,result,near,head:[direction*shift*dodge+Math.sin(t*40)*.045*hurt,.86-lower*dodge-.23*hurt,1.25-.04*dodge],roll:-direction*.95*dodge+Math.sin(t*25)*.17*hurt};}
function cue(c,t,results=[]){for(let i=0;i<c.attacks.length;i++){let a=c.attacks[i],time=a.beat*60/c.bpm,lead=c.feedback.leads[a.type];if(results[i]!==null&&results[i]!==undefined)continue;if(t<=time&&t>=time-lead){let side=a.side||0;if(a.type==='spin'){let first=i;while(first>0&&c.attacks[first-1].type==='spin'&&c.attacks[first-1].beat===c.attacks[first].beat-1)first--;side=(i-first)%2;}return Object.assign({},a,{index:i,time,side,progress:clamp((t-time+lead)/lead)});}}return null;}
function fallTime(c){return c.intro.duration+c.intro.fallBeat*60/c.bpm+c.feedback.fallDelay;}
function shake(c,t,reduced=false){const d=t-fallTime(c);if(reduced||d<0||d>c.feedback.shakeDuration)return [0,0,0];const gain=Math.exp(-d*13)*c.feedback.shakeAmount;return [Math.sin(d*97)*gain,Math.cos(d*113)*gain*.6,0];}
const api={create,success,failure,hero,cue,fallTime,shake};root.Feedback=api;if(typeof module!=='undefined')module.exports=api;
})(typeof window!=='undefined'?window:global);
