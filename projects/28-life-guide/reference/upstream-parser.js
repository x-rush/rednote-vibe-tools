// Upstream MIT; see LICENSE-CODE. Commit 5f210ca953b7b538c042ad8515d5c355b766a194
const COST_W = { money:{'0':0,'少':1,'多':2}, time:{'少':0,'中':1,'多':2}, will:{'否':0,'些':1,'是':2} };
function parseReadme(md){
  const lines = md.split(/\r?\n/);
  const sections = [];
  let sec = null, entry = null;
  const flush = () => { if (entry && sec) { sec.entries.push(entry); } entry = null; };
  for (const raw of lines){
    const line = raw.trimEnd();
    let m;
    if ((m = /^#{1,2} (\d+)\. (.+)$/.exec(line))) { flush(); sec = {n:m[1], title:m[2].trim(), intro:[], entries:[]}; sections.push(sec); continue; }
    if (/^#{1,2} /.test(line)) { flush(); sec = null; continue; }
    if (!sec) continue;
    if ((m = /^### (\d+)\. (.+)$/.exec(line))) { flush(); entry = {sec:sec.n, n:m[1], title:m[2].trim(), cost:'', human:'', gain:'', grade:'', src:'', note:'', money:'', time:'', will:'', level:'', lens:'', who:[]}; continue; }
    if ((m = /^\x3c!--\s*成本标签:\s*(.*?)\s*-->/.exec(line)) && entry){
      for (const kv of m[1].split(/\s+/)){ const [k,v] = kv.split('='); if(k==='钱') entry.money=v; if(k==='时间') entry.time=v; if(k==='毅力') entry.will=v; if(k==='收益') entry.level=v; if(k==='口径') entry.lens=v; if(k==='人群') entry.who=v.split(',').map(g => g.split('+')); }
      continue;
    }
    if (entry){
      if ((m = /^- 成本：(.*)$/.exec(line))) entry.cost = m[1];
      else if ((m = /^- 说人话：(.*)$/.exec(line))) entry.human = m[1];
      else if ((m = /^- 收益：(.*)$/.exec(line))) entry.gain = m[1];
      else if ((m = /^- 证据等级：\s*([ABC])/.exec(line))) entry.grade = m[1];
      else if ((m = /^- 来源：(.*)$/.exec(line))) entry.src = m[1];
      else if ((m = /^- 备注：(.*)$/.exec(line))) entry.note = m[1];
      continue;
    }
    if (line) sec.intro.push(line);   // 第一条之前的每一段导读都收，不止第一段
  }
  flush();
  for (const s of sections) for (const e of s.entries){
    e.dispute = /^争议/.test(e.note);
    e.todo = /待核实|TODO/.test(e.src + e.gain + e.note + e.cost);
    e.cs = (COST_W.money[e.money] ?? 0) + (COST_W.time[e.time] ?? 0) + (COST_W.will[e.will] ?? 0);
    e.ratio = e.level === '大' ? (e.cs === 0 ? '极高' : (e.cs <= 2 ? '高' : '一般'))
            : e.level === '中' ? (e.cs === 0 ? '高' : '一般') : '一般';
    e.hay = [e.title, e.human, e.cost, e.gain, e.note, e.src, e.grade].join('\n').replace(/\*\*/g, '').replace(/\\([*_])/g, '$1').toLowerCase();
  }
  return sections;
}
