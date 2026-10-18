(function(root){
function createGame(c){return {health:c.health,combo:0,best:0,hits:0,perfect:0,extra:0,lastJudgement:null,results:c.attacks.map(()=>null)};}
function expire(s,c,t){let missed=[];c.attacks.forEach((a,i)=>{if(s.results[i]===null&&t>a.beat*60/c.bpm+c.window){s.results[i]='miss';missed.push(i);s.health=Math.max(0,s.health-1);s.combo=0;}});return missed;}
function hit(s,c,t){let nearest=-1,d=c.window+1e-9;c.attacks.forEach((a,i)=>{const diff=Math.abs(t-a.beat*60/c.bpm);if(s.results[i]===null&&diff<d){nearest=i;d=diff;}});if(nearest<0){s.extra++;s.combo=0;return 'early';}const result=d<=c.perfectWindow?'perfect':'good';s.lastJudgement={index:nearest,result,at:t};s.results[nearest]=result;s.hits++;s.perfect+=result==='perfect'?1:0;s.combo++;s.best=Math.max(s.best,s.combo);return result;}
const api={createGame,expire,hit};root.Rhythm=api;if(typeof module!=='undefined')module.exports=api;
})(typeof window!=='undefined'?window:global);
