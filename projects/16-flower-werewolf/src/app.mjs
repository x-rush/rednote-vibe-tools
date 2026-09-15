import {createGame, transition, observe, evidenceFrom, advanceSpectator, restoreGame} from './engine.mjs';

const host = document.querySelector('#app');
const STORE = 'flower-werewolf-v1';
let content, game = null, screen = 'home', selected = null, actionKind = 'accuse', potion = 'skip', claimResult = 'wolf', evidenceId = '', revealed = false, locked = false, showHistory = false, expanded = false, storageMessage = '', stale = false, dialogReturn = null;
const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const format = (s, args = {}) => String(s ?? '').replace(/\{(\w+)\}/g, (_, key) => args[key] ?? '');
const t = (key, args) => format(content.ui[key] ?? key, args);
const tpl = (key, args) => format(content.templates[key] ?? key, args);
const character = id => content.characters.find(c => c.id === id);
const person = seat => game?.players[seat] ? character(game.players[seat].character) : null;
const name = seat => seat === null || seat === undefined ? t('nobody') : person(seat)?.alias ?? t('nobody');
const names = seats => seats.map(name).join('、');
const seatLabel = id => t('seat', {n: id + 1});
const symbol = (id, cls = '') => {
  const paths = {
    moon:'<path d="M19 15a8 8 0 0 1-10-10A8 8 0 1 0 19 15Z"/>',
    sun:'<circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l2 2m10 10 2 2M5 19l2-2M17 7l2-2"/>',
    eye:'<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/>',
    flask:'<path d="M9 3h6m-5 0v7l-5 8q-2 3 2 3h10q4 0 2-3l-5-8V3M8 15h8"/>',
    arrow:'<path d="M4 12h15m-6-6 6 6-6 6"/>',
    book:'<path d="M3 4h7q2 0 2 2v15q0-3-3-3H3Zm18 0h-7q-2 0-2 2v15q0-3 3-3h6Z"/>',
    leaf:'<path d="M20 3C5 2 1 12 7 17s14-1 13-14Z"/><path d="M4 21 15 10"/>',
    ticket:'<path d="M3 6h18v4a2 2 0 0 0 0 4v4H3v-4a2 2 0 0 0 0-4Zm13 0v12"/>',
    close:'<path d="m6 6 12 12M6 18 18 6"/>',
    check:'<path d="m4 12 5 5L20 6"/>',
    lock:'<rect x="5" y="10" width="14" height="11" rx="3"/><path d="M8 10V7a4 4 0 0 1 8 0v3m-4 5v2"/>'
  };
  return '<svg class="icon '+cls+'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+(paths[id] || paths.leaf)+'</svg>';
};
const button = (label, action, cls = '', extra = '', icon = '') => '<button class="'+cls+'" data-action="'+action+'" '+extra+'>'+esc(label)+(icon ? symbol(icon) : '')+'</button>';
const portrait = (c, cls = '', eager = false) => '<img class="'+cls+'" src="./'+esc(c.portrait)+'" alt="'+esc(t('portraitAlt',{name:c.alias}))+'" width="480" height="480" '+(eager ? 'fetchpriority="high"' : 'loading="lazy"')+'>';
function save() {
  try {localStorage.setItem(STORE, JSON.stringify(game));}
  catch {storageMessage = t('storageWarning');}
}
function load() {
  storageMessage='';
  try {
    const raw = localStorage.getItem(STORE);
    if (raw) {game = restoreGame(raw, content.characters.map(c => c.id)); if(!game) storageMessage=t('corruptSave');}
  } catch {storageMessage=t('storageWarning');}
}
function header() {
  return '<header class="masthead"><button class="brand" data-action="home" aria-label="'+esc(t('home'))+'"><img src="./assets/logo/flower-wolf-128.png" alt="" width="35" height="35"><span>'+esc(t('brand'))+'</span><small>'+esc(t('volume'))+'</small></button><nav aria-label="'+esc(t('home'))+'">'+button(t('cast'),'gallery','nav-link')+button(t('help'),'rules','nav-link')+'</nav></header>';
}
function home() {
  const c = content.characters;
  return '<main id="main" class="home">'+
    '<section class="hero"><div class="hero-copy"><div class="eyebrow"><span class="live-dot"></span>'+esc(t('edition'))+'</div><p class="hero-kicker">'+esc(t('heroSmall'))+'</p><h1>'+esc(t('heroTitle'))+'<br><em>'+esc(t('heroAccent'))+'</em></h1><p class="hero-desc">'+esc(t('heroBody')).replace(/\n/g,'<br>')+'</p><div class="hero-actions">'+button(t('start'),'new','primary large','','arrow')+(game?button(t('resume'),'resume','secondary'): '')+'</div><p class="hero-note">'+esc(t('heroNote'))+'</p></div>'+
    '<div class="hero-art" aria-label="'+esc(t('stamp'))+'"><div class="orbit orbit-one"></div><div class="orbit orbit-two"></div><div class="sun-disc"></div><span class="art-spark spark-one">✳</span><span class="art-spark spark-two">✧</span>'+
    [1,5,3].map((index,i)=>'<button class="postcard card-'+i+'" data-action="character" data-id="'+c[index].id+'">'+portrait(c[index],'',true)+'<span class="postcard-caption">'+esc(c[index].alias)+'<small>'+esc(t('roleTag'))+'</small></span></button>').join('')+
    '<div class="travel-stamp">'+symbol('moon')+'<span>'+esc(t('stamp'))+'</span><small>'+esc(t('stampEnglish'))+'</small></div><div class="art-label">'+esc(t('eyebrow'))+'</div></div></section>'+
    '<section class="boarding"><div class="boarding-name">'+symbol('ticket')+'<div><small>'+esc(t('ticketCode'))+'</small><strong>'+esc(t('ticketTitle'))+'</strong></div></div><div class="boarding-route"><span>'+esc(t('ticketFrom'))+'</span><span class="route-line"></span>'+symbol('arrow')+'<span>'+esc(t('ticketTo'))+'</span></div><div class="barcode" aria-hidden="true"></div></section>'+
    '<section class="features">'+[1,2,3].map((n)=>'<div><span class="feature-num">0'+n+'</span><div><h3>'+esc(t('feature'+n))+'</h3><p>'+esc(t('feature'+n+'Body'))+'</p></div></div>').join('')+'</section>'+
    '<section class="cast-section" id="cast"><div class="section-heading"><div><p class="eyebrow">'+esc(t('castEnglish'))+'</p><h2>'+esc(t('castTitle'))+'</h2></div><span class="count-label">'+esc(t('castCount'))+'</span></div><p class="section-desc">'+esc(t('castBody'))+'</p><div class="cast-grid">'+c.map((ch,i)=>'<button class="cast-card" data-action="character" data-id="'+ch.id+'" aria-label="'+esc(ch.alias+' · '+t('cardHint'))+'"><div class="cast-image"><span class="index-badge">0'+(i+1)+'</span>'+portrait(ch)+'</div><div class="cast-copy"><strong>'+esc(ch.alias)+'</strong><span>'+esc(ch.fictionalArchetype)+'</span></div></button>').join('')+'</div></section>'+
    '<section class="rules-preview"><div>'+symbol('book')+'<h2>'+esc(t('rulesTitle'))+'</h2><p>'+esc(t('rulesSub'))+'</p></div>'+button(t('rules'),'rules','secondary','','arrow')+'</section></main>';
}
function phaseLabel() {
  return t(({deal:'dealNav',night:'nightNav',day:'dayNav',vote:'voteNav',roundEnd:'voteNav',over:'finishedNav'})[game.phase]);
}
function roleBlock() {
  const me = game.players[game.human], role = content.roles[me.role];
  const v = observe(game, me.id);
  return '<div class="role-symbol '+me.role+'">'+symbol(role.symbol)+'</div><p class="eyebrow">'+esc(t('roleSide'))+'</p><h2>'+esc(role.name)+'</h2><p class="role-subtitle">'+esc(role.subtitle)+'</p><p class="body-copy">'+esc(role.description)+'</p>'+
    (me.role==='wolf'?'<div class="private-note"><strong>'+esc(t('allies'))+'</strong><p>'+esc(names(v.allies.filter(x=>x!==me.id)))+'</p></div>':'')+
    (me.role==='seer'?'<div class="private-note"><strong>'+esc(t('privateNotes'))+'</strong><p>'+esc(v.checks.length ? v.checks.map(c=>t('checkLine',{day:c.day,target:name(c.target),result:t(c.wolf?'checkWolf':'checkGood')})).join('\n') : t('noChecks'))+'</p></div>':'');
}
function deal() {
  const me = person(game.human);
  return '<main id="main" class="deal-screen"><p class="eyebrow">'+esc(t('sealed'))+'</p><h1>'+esc(t('dealTitle'))+'</h1><p class="section-desc">'+esc(t('dealBody'))+'</p><div class="deal-card '+(revealed?'is-revealed':'')+'">'+
    (revealed ? '<div class="deal-person">'+portrait(me,'',true)+'<span>'+esc(seatLabel(game.human))+' · '+esc(me.alias)+'</span></div><div class="deal-role">'+roleBlock()+'</div>' : '<div class="card-back"><img src="./assets/logo/flower-wolf-128.png" alt="" width="94" height="94"><span>'+esc(t('brand'))+'</span><small>'+esc(t('cardBackEnglish'))+'</small>'+symbol('lock')+'</div>')+
    '</div>'+button(t(revealed?'begin':'reveal'),revealed?'begin':'reveal','primary large','','arrow')+'</main>';
}
function roster() {
  return '<div class="roster">'+game.players.map(p=>{
    const c = person(p.id);
    return '<button class="seat '+(!p.alive?'eliminated ':'')+(p.id===game.human?'is-you':'')+'" data-action="player" data-id="'+p.id+'"><span class="seat-top">'+esc(seatLabel(p.id))+(p.id===game.human?'<b>'+esc(t('you'))+'</b>':'')+'</span>'+portrait(c)+'<strong>'+esc(c.alias)+'</strong><span class="seat-status">'+esc(t(p.alive?'alive':'dead'))+'</span></button>';
  }).join('')+'</div>';
}
function targets(options) {
  return '<div class="target-grid" role="group" aria-label="'+esc(t('target'))+'">'+options.map(p=>'<button class="target '+(selected===p.id?'selected':'')+'" data-action="select" data-id="'+p.id+'" aria-pressed="'+(selected===p.id)+'">'+portrait(person(p.id))+'<span>'+esc(name(p.id))+'</span>'+(selected===p.id?symbol('check'):'')+'</button>').join('')+'</div>';
}
function nightPanel() {
  const me=game.players[game.human], view=observe(game,me.id);
  if(!me.alive) return '<p>'+esc(t('nightDead'))+'</p>'+button(t('spectate'),'night','primary')+button(t('fastForward'),'fast','secondary');
  const options=game.players.filter(p=>p.alive && p.id!==me.id && (me.role!=='wolf' || !view.allies.includes(p.id)));
  let html='<div class="panel-icon">'+symbol(content.roles[me.role].symbol)+'</div><h2>'+esc(t('night'+me.role[0].toUpperCase()+me.role.slice(1)))+'</h2>';
  if(me.role==='wolf' || me.role==='seer') html+=targets(options);
  if(me.role==='witch') {
    const healAvailable=!!view.heal && view.victim!==null && (view.victim!==me.id || game.day===1);
    html+='<p class="potion-stock">'+esc(t('potionStock',{heal:view.heal,poison:view.poison}))+'</p><div class="private-note">'+esc(view.heal ? t('witchVictim',{target:name(view.victim)}) : t('witchUnknown'))+(view.victim===me.id&&game.day>1?'<p>'+esc(t('witchSelf'))+'</p>':'')+'</div><div class="potion-options">'+['skip','heal','poison'].map(p=>button(t('potion'+p[0].toUpperCase()+p.slice(1)),'potion','choice '+(potion===p?'active':''),'data-id="'+p+'" aria-pressed="'+(potion===p)+'" '+((p==='heal'&&!healAvailable)||(p==='poison'&&!view.poison)?'disabled':''))).join('')+'</div>';
    if(potion==='poison') html+=targets(options);
  }
  const disabled=(me.role==='wolf' && selected===null)||(me.role==='witch'&&potion==='poison'&&selected===null);
  html+=button(t(me.role==='villager'?'nightWait':me.role==='seer'&&selected===null?'skipCheck':'nightCommit'),'night','primary full',disabled?'disabled':'','arrow')+'<p class="micro-copy">'+esc(t('nightPrivacy'))+'</p>';
  return html;
}
function evidenceText(e) {return tpl(e.kind,{target:name(e.target),other:name(e.other),day:e.day});}
function discussionPanel() {
  if(!game.players[game.human].alive) return '<h2>'+esc(t('deadNotice'))+'</h2>'+button(t('spectate'),'speak-skip','primary')+button(t('fastForward'),'fast','secondary');
  let html='<p class="eyebrow">'+esc(t('you'))+' / '+esc(t('yourTurnEnglish'))+'</p><h2>'+esc(t('discussTitle'))+'</h2><p class="body-copy">'+esc(t('discussBody'))+'</p><div class="action-tabs">';
  for(const kind of ['accuse','support','defend','claim','skip']) html+=button(t('action'+kind[0].toUpperCase()+kind.slice(1)),'action-kind','choice '+(actionKind===kind?'active':''),'data-id="'+kind+'" aria-pressed="'+(actionKind===kind)+'"');
  html+='</div>';
  if(['accuse','support','claim'].includes(actionKind)) html+=targets(game.players.filter(p=>p.alive&&p.id!==game.human));
  if(actionKind==='accuse' && selected!==null) {
    const clues=evidenceFrom(game.events).filter(e=>e.target===selected);
    html+='<label class="field-label" for="evidence">'+esc(t('evidence'))+'</label><select id="evidence"><option value="">'+esc(t(clues.length?'evidenceOptional':'evidenceNone'))+'</option>'+clues.map(e=>'<option value="'+esc(e.id)+'" '+(evidenceId===e.id?'selected':'')+'>'+esc(evidenceText(e))+'</option>').join('')+'</select>';
  }
  if(actionKind==='claim') html+='<p class="micro-copy">'+esc(t('claimHint'))+'</p><div class="claim-options">'+['wolf','good'].map(r=>button(t(r==='wolf'?'claimWolf':'claimGood'),'claim-result','choice '+(claimResult===r?'active':''),'data-id="'+r+'" aria-pressed="'+(claimResult===r)+'"')).join('')+'</div>';
  const disabled=['accuse','support','claim'].includes(actionKind)&&selected===null;
  return html+button(t(actionKind==='skip'?'speakSkip':'speak'),'speak','primary full',disabled?'disabled':'','arrow');
}
function votePanel() {
  if(!game.players[game.human].alive) return '<h2>'+esc(t('deadNotice'))+'</h2>'+button(t('spectate'),'abstain','primary')+button(t('fastForward'),'fast','secondary');
  const opts=game.players.filter(p=>p.alive&&p.id!==game.human&&(!game.runoff||game.runoff.includes(p.id)));
  return '<p class="eyebrow">'+esc(t('voteEnglish'))+'</p><h2>'+esc(t(game.runoff?'runoffTitle':'voteTitle'))+'</h2><p class="body-copy">'+esc(t(game.runoff?'runoffBody':'voteBody'))+'</p>'+targets(opts)+button(t('vote'),'vote','primary full',selected===null?'disabled':'','check')+button(t('abstain'),'abstain','text-button full');
}
function eventText(e) {
  const say=(key,args)=>{
    const pool=content.dialogueVariants?.[key];
    if(!Array.isArray(pool)||!pool.length) return tpl(key,args);
    let offset=game.seed>>>0;
    for(let i=0;i<key.length;i++) offset=(Math.imul(offset,31)+key.charCodeAt(i))>>>0;
    const position=game.events.findIndex(x=>x.id===e.id);
    const occurrence=game.events.slice(0,Math.max(0,position)).filter(x=>x.kind===e.kind&&(x.result??'')===(e.result??'')).length;
    return format(pool[(offset%pool.length+occurrence)%pool.length],args);
  };
  const args={actor:name(e.actor),target:name(e.target),targets:names(e.targets??[]),result:t(e.result==='wolf'?'checkWolf':'checkGood')};
  if(e.kind==='dawn') return e.targets.length?say('dawn',args):say('peace');
  if(e.kind==='claim') return say('claim',args);
  if(e.kind==='accuse') {
    const evidence=evidenceFrom(game.events).find(x=>x.id===e.evidence);
    return evidence?say('evidenceAccuse',{...args,evidence:evidenceText(evidence)}):say('trial',args);
  }
  if(e.kind==='response') {
    const parent=game.events.find(x=>x.id===e.parent);
    const clue=evidenceFrom(game.events).find(x=>x.id===parent?.evidence);
    if(clue) return say('response'+clue.kind,{...args,evidence:evidenceText(clue)});
    if(parent?.kind==='claim' && parent.result==='good') return say('goodClaimResponse',args);
  }
  if(e.kind==='response'||e.kind==='reaction') return say(e.result,args);
  if(e.kind==='ballot') return say(e.target===null?'abstain':'ballot',args);
  if(e.kind==='tally') return Object.keys(e.counts).length?say('tally',{counts:Object.entries(e.counts).map(([id,n])=>say('count',{target:name(Number(id)),n})).join(' / ')}):say('noVotes');
  if(e.kind==='finish') return say('finish',{result:t(e.result==='wolf'?'wolfWin':e.result==='good'?'goodWin':'drawWin')});
  return say(e.kind,args);
}
function flavor() { return ''; }
function feed() {
  let events=game.events.filter(e=>showHistory||e.day===game.day);
  const earlier=events.length>9&&!expanded;
  if(earlier) events=events.slice(-9);
  return '<section class="discussion-feed panel"><div class="panel-heading"><div><p class="eyebrow">'+esc(t('diaryEnglish'))+'</p><h2>'+esc(t(showHistory?'history':'current'))+'</h2></div>'+button(t(showHistory?'current':'history'),'history','text-button')+'</div>'+
    (earlier?button(t('logMore'),'expand','text-button full'):'')+
    '<p class="simulation-notice">'+esc(t('simulationNotice'))+'</p><div class="messages">'+events.map(e=>{
      const hasActor=Number.isInteger(e.actor)&&e.kind!=='ballot';
      return '<article id="event-'+esc(e.id)+'" class="message '+(hasActor?'':'system-message')+(e.actor===game.human?' own':'')+'">'+(hasActor?portrait(person(e.actor),'message-avatar'):'<span class="system-dot"></span>')+'<div class="message-content">'+(hasActor?'<div class="message-who"><strong>'+esc(name(e.actor))+'</strong><small>'+esc(seatLabel(e.actor))+(e.actor===game.human?' · '+esc(t('you')):'')+'</small></div>':'')+'<p>'+esc(eventText(e))+'</p>'+(flavor(e)?'<blockquote>'+esc(flavor(e))+'</blockquote>':'')+(showHistory?'<small class="event-day">'+esc(t('dayLabel',{day:e.day}))+'</small>':'')+'</div></article>';
    }).join('')+'</div></section>';
}
function clues() {
  const list=evidenceFrom(game.events);
  if(!list.length) return '';
  return '<section class="clues panel"><div class="panel-heading"><div>'+symbol('book')+'<h2>'+esc(t('evidenceTitle'))+'</h2></div><small>'+esc(t('clueCount',{n:list.length}))+'</small></div><p class="micro-copy">'+esc(t('evidenceBody'))+'</p>'+
    (list.length?list.map(e=>'<div class="clue"><span>'+esc(t('evidenceLabel'))+'</span><p>'+esc(evidenceText(e))+'</p></div>').join(''):'<p class="empty-note">'+esc(t('noEvidence'))+'</p>')+'</section>';
}
function gameScreen() {
  if(locked) return '<main class="locked-screen"><div class="panel">'+symbol('lock')+'<h1>'+esc(t('lockedTitle'))+'</h1><p>'+esc(t('lockedBody'))+'</p>'+button(t('unlock'),'unlock','primary')+'</div></main>';
  if(game.phase==='deal') return deal();
  if(game.phase==='over') return resultScreen();
  const panel=game.phase==='night'?nightPanel():game.phase==='day'?discussionPanel():game.phase==='vote'?votePanel():'<div class="panel-icon">'+symbol('sun')+'</div><h2>'+esc(t('roundEndTitle'))+'</h2>'+button(t('next'),'next','primary full','','arrow')+(!game.players[game.human].alive?button(t('fastForward'),'fast','secondary full'):'');
  return '<main id="main" class="game-screen '+(game.phase==='night'?'is-night':'')+'"><div class="game-heading"><div><p class="eyebrow">'+esc(phaseLabel())+'</p><h1>'+esc(t(game.phase==='night'?'nightLabel':'dayLabel',{day:game.day}))+'<span> / '+esc(t('living',{n:game.players.filter(p=>p.alive).length}))+'</span></h1></div><div class="game-tools">'+button(t('viewIdentity'),'identity','secondary compact','','lock')+button(t('newGame'),'new','text-button')+'</div></div>'+roster()+journeyBoard()+
    '<div class="game-layout"><div class="feed-column">'+(game.phase==='night'?'<div class="night-scene"><div class="crescent"></div><span class="night-star star-1">✦</span><span class="night-star star-2">✧</span><span class="night-star star-3">✦</span><p>'+esc(t('nightEnglish'))+'</p><h2>'+esc(t('nightTitle'))+'</h2><span>'+esc(t('nightBody'))+'</span></div>':feed())+clues()+'</div><aside class="control panel" id="control" aria-label="'+esc(phaseLabel())+'">'+(game.players[game.human].role==='seer' && game.players[game.human].checks.some(c=>c.day===game.day) && game.phase!=='night'?'<div class="check-ready"><p>'+esc(t('privateCheckHint'))+'</p>'+button(t('viewCheck'),'identity','secondary full')+'</div>':'')+panel+'</aside></div><nav class="mobile-game-nav" aria-label="'+esc(t('continue'))+'">'+button(t('readDiscussion'),'jump-feed','secondary')+button(t('goAction'),'jump-control','primary')+'</nav></main>';
}

function scoreData(){
  if(!game||game.phase!=='over') return null;
  const me=game.players[game.human], ballots=game.events.filter(e=>e.kind==='ballot'&&e.actor===game.human);
  const votes=ballots.filter(e=>e.target!==null), hits=votes.filter(e=>game.players[e.target]?.role==='wolf').length;
  return {alias:person(me.id).alias,portrait:person(me.id).portrait,role:content.roles[me.role].name,outcome:game.winner==='draw'?'draw':game.winner===(me.role==='wolf'?'wolf':'good')?'win':'lose',alive:me.alive,days:game.day,votes:votes.length,hits,abstain:ballots.length-votes.length};
}
function scoreCard(){
  const s=scoreData(),c=content.scorecard;if(!s)return '';
  const bridge=window.xhs?.miniTool;
  return '<section class="score-panel panel"><h2>'+esc(c.title)+'</h2><canvas id="score-canvas" width="720" height="960" role="img" aria-label="'+esc(c.title+' '+s.alias+' '+s.role+' '+c[s.outcome])+'"></canvas><p id="score-status" role="status">'+esc(c.loading)+'</p><p class="score-summary">'+esc(s.alias+' · '+s.role+' · '+c[s.outcome]+' · '+c[s.alive?'alive':'dead'])+'</p><p class="micro-copy">'+esc(c.days+' '+s.days+' / '+c.votes+' '+s.votes+' / '+c.hits+' '+s.hits+' / '+c.abstain+' '+s.abstain)+'</p>'+button(c.save,'save-score','primary','disabled')+'<p class="micro-copy">'+esc(bridge&&typeof bridge.saveImageToPhotosAlbum==='function'?c.note:c.fallback)+'</p></section>';
}
function postcardStory(s){
  const c=content.scorecard,me=game.players[game.human],records=[];
  const support=game.events.find(e=>e.kind==='support'&&e.actor===me.id&&Number.isInteger(e.target)&&e.target!==me.id);
  const supported=game.events.find(e=>e.kind==='support'&&e.target===me.id&&e.actor!==me.id);
  if(support){records.push(format(c.supportLine,{day:support.day,target:name(support.target)}));records.push(game.players[support.target].role==='wolf'?c.wolfReveal:c.goodReveal);}
  else if(supported)records.push(format(c.supportedLine,{day:supported.day,actor:name(supported.actor)}));
  const notes=Array.isArray(game.travelNotes)?game.travelNotes:[];
  const note=notes.find(n=>n&&Number.isInteger(n.choice)&&content.travel.scenes.some(x=>x.id===n.scene&&x.choices[n.choice]));
  if(note){const scene=content.travel.scenes.find(x=>x.id===note.scene);records.push(format(c.travelLine,{choice:scene.choices[note.choice].label}));}
  const exit=game.events.find(e=>(e.kind==='dawn'&&e.targets?.includes(me.id))||(e.kind==='eliminate'&&e.target===me.id));
  if(records.length<3)records.push(!me.alive&&exit?format(c.exitLine,{day:exit.day}):s.alive?c.aliveLine:format(c.finishLine,{day:game.day}));
  const ending=s.outcome==='draw'?c.drawEnding:me.role==='wolf'?c.wolfEnding:s.outcome==='win'?c.winEnding:c.loseEnding;
  return {records:records.slice(0,3),ending};
}
async function paintScore(){
  const canvas=document.querySelector('#score-canvas'),s=scoreData();if(!canvas||!s)return;
  const c=content.scorecard,status=document.querySelector('#score-status'),saveButton=document.querySelector('[data-action="save-score"]');
  try{
    canvas.width=900;canvas.height=1200;
    const ctx=canvas.getContext('2d');if(!ctx)throw Error('canvas');
    const loadImage=src=>new Promise((ok,fail)=>{const img=new Image();img.onload=()=>ok(img);img.onerror=fail;img.src=src;});
    const faces=[];for(const p of game.players)faces.push(await loadImage('./'+character(p.character).portrait));
    const logo=await loadImage('./assets/logo/flower-wolf-128.png');if(!canvas.isConnected)return;
    const paper=ctx.createLinearGradient(0,0,900,1200);paper.addColorStop(0,'#f4edde');paper.addColorStop(1,'#e6eadc');ctx.fillStyle=paper;ctx.fillRect(0,0,900,1200);
    const rounded=(x,y,w,h,r)=>{ctx.beginPath();ctx.moveTo(x+r,y);ctx.arcTo(x+w,y,x+w,y+h,r);ctx.arcTo(x+w,y+h,x,y+h,r);ctx.arcTo(x,y+h,x,y,r);ctx.arcTo(x,y,x+w,y,r);ctx.closePath();};
    ctx.save();ctx.shadowColor='rgba(41,61,52,.14)';ctx.shadowBlur=22;ctx.shadowOffsetY=9;ctx.fillStyle='#fffcf4';rounded(38,44,824,1112,16);ctx.fill();ctx.restore();
    ctx.strokeStyle='#e8e2d5';ctx.lineWidth=1;for(let y=594;y<965;y+=48){ctx.beginPath();ctx.moveTo(76,y);ctx.lineTo(824,y);ctx.stroke();}
    ctx.save();ctx.translate(450,52);ctx.rotate(-.035);ctx.fillStyle='rgba(185,199,158,.72)';ctx.fillRect(-98,-15,196,40);ctx.strokeStyle='rgba(255,255,255,.24)';for(let x=-90;x<100;x+=18){ctx.beginPath();ctx.moveTo(x,-15);ctx.lineTo(x+24,25);ctx.stroke();}ctx.restore();
    const sans='"Microsoft YaHei", "PingFang SC", sans-serif',serif='"STKaiti", "KaiTi", serif';
    const text=(value,x,y,size,color='#293d34',font=sans)=>{ctx.fillStyle=color;ctx.font=size+'px '+font;ctx.fillText(value,x,y);};
    const wrap=(value,x,y,width,size=25,line=40,color='#465747',font=sans)=>{ctx.font=size+'px '+font;let row='';for(const char of value){if(ctx.measureText(row+char).width>width&&row){text(row,x,y,size,color,font);y+=line;row=char;}else row+=char;}if(row)text(row,x,y,size,color,font);return y+line;};
    ctx.drawImage(logo,77,99,44,44);text(c.eyebrow,135,129,20,'#66775f');
    text(c.heading,78,200,43,'#24594d',serif);
    ctx.strokeStyle='#ce7959';ctx.lineWidth=4;ctx.beginPath();ctx.moveTo(80,225);ctx.quadraticCurveTo(257,218,417,226);ctx.stroke();
    const group=game.players.filter(p=>p.id!==game.human);group.splice(3,0,game.players[game.human]);
    group.forEach((p,i)=>{const big=p.id===game.human,w=big?116:90,h=big?158:135,x=78+i*104+(big?-10:0),y=big?270:286;ctx.save();ctx.translate(x+w/2,y+h/2);ctx.rotate((i%2?1:-1)*.04);ctx.shadowColor='rgba(40,55,35,.12)';ctx.shadowBlur=7;ctx.shadowOffsetY=4;ctx.fillStyle=big?'#f0ead8':'#fffef8';ctx.fillRect(-w/2-5,-h/2-5,w+10,h+10);ctx.shadowColor='transparent';ctx.drawImage(faces[p.id],-w/2,-h/2,w,w);ctx.textAlign='center';text(character(p.character).alias,0,-h/2+w+25,big?20:17,'#365746');ctx.restore();});
    ctx.textAlign='left';text(format(c.departure,{alias:s.alias}),80,504,27,'#293d34',serif);text(format(c.identityLine,{role:s.role}),80,546,23,'#66775f');
    const story=postcardStory(s);let y=620;for(let i=0;i<story.records.length;i++){ctx.fillStyle='#c67657';ctx.beginPath();ctx.arc(88,y-9,3,0,Math.PI*2);ctx.fill();y=wrap(story.records[i],108,y,686,24,39)+13;}
    text(story.ending,80,912,27,'#49654f',serif);text(c.subtitle,80,960,30,'#24594d',serif);
    ctx.fillStyle='#edf0e3';rounded(76,994,748,88,9);ctx.fill();ctx.textAlign='center';text(c[s.outcome],253,1032,24,'#24594d');text(s.role+' / '+c[s.alive?'alive':'dead'],253,1061,17,'#687761');ctx.strokeStyle='#cbd4bb';ctx.beginPath();ctx.moveTo(435,1011);ctx.lineTo(435,1066);ctx.stroke();text(c.days+' '+s.days+'  ·  '+c.votes+' '+s.votes,630,1032,19,'#49654f');text(c.hits+' '+s.hits+'  ·  '+c.abstain+' '+s.abstain,630,1061,18,'#687761');
    text(c.smallNote,450,1122,17,'#7b8475');ctx.textAlign='left';
    canvas.dataset.ready='true';status.textContent='';saveButton.disabled=!(window.xhs?.miniTool&&typeof window.xhs.miniTool.saveImageToPhotosAlbum==='function');
  }catch{if(canvas.isConnected)status.textContent=c.error;}
}
async function saveScore(buttonEl){
  const canvas=document.querySelector('#score-canvas'),c=content.scorecard,bridge=window.xhs?.miniTool,status=document.querySelector('#score-status');
  if(!game||game.phase!=='over'||canvas?.dataset.ready!=='true'||!bridge||typeof bridge.saveImageToPhotosAlbum!=='function')return;
  buttonEl.disabled=true;buttonEl.textContent=c.saving;
  try{await bridge.saveImageToPhotosAlbum({filePath:canvas.toDataURL('image/png')});if(status.isConnected)status.textContent=c.saved;}
  catch{if(status.isConnected)status.textContent=c.failed;}
  finally{if(buttonEl.isConnected){buttonEl.disabled=false;buttonEl.textContent=c.save;}}
}

function resultScreen() {
  const role=game.players[game.human].role, myTeam=role==='wolf'?'wolf':'good';
  const outcome=game.winner==='draw'?'draw':game.winner===myTeam?'win':'lose';
  const actions=game.events.filter(e=>e.actor===game.human&&['accuse','support','defend','claim','skip'].includes(e.kind));
  const ballots=game.events.filter(e=>e.kind==='ballot'&&e.actor===game.human);
  return '<main id="main" class="result-screen"><section class="result-hero"><span class="result-seal">'+symbol(outcome==='win'?'sun':'moon')+'</span><p class="eyebrow">'+esc(t('overTitle'))+'</p><h1>'+esc(t(outcome))+'</h1><p>'+esc(t(game.winner==='wolf'?'wolfWin':game.winner==='good'?'goodWin':'drawWin'))+'</p><div class="result-stats"><span>'+esc(t('roundLabel',{day:game.day}))+'</span><span>'+esc(t('actionCount',{n:actions.length}))+'</span><span>'+esc(t('voteCount',{n:ballots.length}))+'</span></div>'+button(t('again'),'new','primary large','','arrow')+'</section>'+
    scoreCard()+'<section class="result-cast panel"><div class="panel-heading"><h2>'+esc(t('resultCard'))+'</h2><small>'+esc(t('resultHint'))+'</small></div><div class="reveal-grid">'+game.players.map(p=>'<div class="reveal-player '+(p.id===game.human?'is-you':'')+'">'+portrait(person(p.id))+'<strong>'+esc(name(p.id))+(p.id===game.human?' · '+esc(t('you')):'')+'</strong><span class="role-badge '+p.role+'">'+symbol(content.roles[p.role].symbol)+esc(content.roles[p.role].name)+'</span></div>').join('')+'</div></section>'+
    '<div class="recap-grid"><section class="panel"><h2>'+esc(t('recap'))+'</h2>'+(actions.length?actions.map(e=>'<div class="recap-event"><small>'+esc(t('dayLabel',{day:e.day}))+'</small><p>'+esc(eventText(e))+'</p></div>').join(''):'<p>'+esc(t('noActions'))+'</p>')+'</section><section class="panel"><h2>'+esc(t('nightAudit'))+'</h2>'+game.audit.filter(e=>e.kind==='nightResolution').map(e=>'<div class="recap-event"><p>'+esc(t('auditNight',{day:e.day,kill:name(e.kill),heal:t(e.healed?'used':'unused'),poison:name(e.poison)}))+'</p></div>').join('')+'</section></div>'+feed()+'</main>';
}
function render() {
  host.dataset.phase=screen==='game'&&game&&!locked?game.phase:'home';
  host.removeAttribute('aria-busy');
  host.innerHTML=header()+(storageMessage?'<div class="notice" role="status">'+esc(storageMessage)+'</div>':'')+(stale?'<div class="stale-screen panel"><p>'+esc(t('changedSave'))+'</p>'+button(t('changedReturn'),'reload-save','primary')+'</div>':screen==='home'?home():gameScreen())+
    '<footer><strong>'+esc(t('footerTag'))+'</strong><p>'+esc(content.product.notice)+'</p><small>'+esc(t('footerMeta'))+'</small></footer><dialog id="modal" aria-labelledby="modal-title"></dialog><div id="toast" role="status"></div>';
  if(screen==='game'&&game?.phase==='over'&&!locked) paintScore();
}
function modal(body, title) {
  const el=document.querySelector('#modal');
  if(!el.open) dialogReturn=document.activeElement;
  el.innerHTML='<div class="modal-head"><h2 id="modal-title">'+esc(title)+'</h2>'+button(t('close'),'close','close-button','','close')+'</div>'+body;
  el.showModal();
  el.addEventListener('click',e=>{if(e.target===el) el.close();});
  el.addEventListener('close',()=>dialogReturn?.focus(),{once:true});
}
function showCharacter(id) {
  const c=character(id);
  if(!c) return;
  modal('<div class="character-detail">'+portrait(c,'',true)+profileBody(c)+'<p class="micro-copy">'+esc(t('detailRole'))+'</p></div>',c.alias);
}
function showRules() {
  modal('<p class="rules-intro">'+esc(t('roleCount'))+'</p><div class="rules-list">'+content.rules.map(r=>'<section><h3>'+esc(r.title)+'</h3><p>'+esc(r.body)+'</p></section>').join('')+'</div>',t('rules'));
}
function profileBody(c) {
  const p=c.profile;
  if(!p) return '';
  return '<section class="profile-notes"><p class="eyebrow">'+esc(p.order)+' / '+esc(t('aliasLabel'))+'</p><h3>'+esc(c.alias)+'</h3><p>'+esc(p.aliasOrigin)+'</p><h4>'+esc(t('referenceLabel'))+'</h4><p>'+esc(p.referenceNote)+'</p><p class="micro-copy">'+esc(t('portraitBoundary'))+'</p></section>';
}
function journeyContext() {
  const scene=content.travel.scenes[((game.seed>>>0)+Math.max(0,game.day-1))%content.travel.scenes.length];
  const dawn=game.events.find(e=>e.kind==='dawn'&&e.day===game.day);
  const seats=(game.night?.alive ?? game.players.map(p=>p.id)).filter(id=>!dawn?.targets.includes(id));
  const guide=seats.length ? seats[(((game.seed>>>0)%seats.length)+game.day-1)%seats.length] : game.human;
  const notes=Array.isArray(game.travelNotes)?game.travelNotes:[];
  const note=notes.find(n=>n&&n.day===game.day&&n.scene===scene.id&&Number.isInteger(n.choice)&&n.choice>=0&&n.choice<scene.choices.length);
  return {scene,guide,note};
}
function journeyBoard() {
  if(!game||game.phase==='deal'||game.phase==='over'||game.phase==='night'||locked) return '';
  const {scene,guide,note}=journeyContext();
  const playable=game.phase==='day'&&game.players[game.human].alive;
  return '<details class="journey-board panel" '+(playable&&!note?'open':'')+'><summary><span>'+symbol('ticket')+'<strong>'+esc(scene.title)+'</strong></span><small>'+esc(t('guideLabel',{name:name(guide)}))+'</small></summary><div class="journey-content"><p class="micro-copy">'+esc(t('journeyBoundary'))+'</p><p>'+esc(scene.body)+'</p>'+(note?'<div class="journey-result" role="status"><strong>'+esc(scene.choices[note.choice].label)+'</strong><p>'+esc(scene.choices[note.choice].outcome)+'</p><p>'+esc(name(guide))+'：'+esc(scene.choices[note.choice].reply)+'</p></div>':playable?'<div class="journey-choices">'+scene.choices.map((c,i)=>button(c.label,'journey-choice','secondary','data-id="'+i+'"')).join('')+'</div>':'<p class="micro-copy">'+esc(t('journeyWait'))+'</p>')+'</div></details>';
}
function chooseJourney(id) {
  if(!game||locked||game.phase!=='day'||!game.players[game.human].alive) return;
  const {scene,note}=journeyContext(), choice=Number(id);
  if(note||!Number.isInteger(choice)||choice<0||choice>=scene.choices.length) return;
  const notes=Array.isArray(game.travelNotes)?game.travelNotes:[];
  game.travelNotes=notes.filter(n=>n&&Number.isInteger(n.day)&&n.day!==game.day).slice(-999);
  game.travelNotes.push({day:game.day,scene:scene.id,choice});
  save();render();
  document.querySelector('.journey-board').open=true;
  document.querySelector('.journey-board summary')?.focus({preventScroll:true});
}
function resetControls() {selected=null; actionKind='accuse'; potion='skip'; claimResult='wolf'; evidenceId='';}
function command(value) {
  try {
    game=transition(game,value); resetControls(); save(); render();
    const ownSpeech = [...game.events].reverse().find(e => e.actor === game.human && ['accuse','support','claim','defend','skip'].includes(e.kind));
    const tally = [...game.events].reverse().find(e => e.kind === 'tally');
    const anchor = value.type === 'speak' && ownSpeech ? '#event-' + ownSpeech.id : value.type === 'vote' && tally && game.phase !== 'over' ? '#event-' + tally.id : value.type === 'night' && game.phase === 'day' ? '.discussion-feed' : '.game-heading, .result-hero';
    document.querySelector(anchor)?.scrollIntoView({block:'start',behavior:'instant'});
  } catch {document.querySelector('#toast').textContent=t('error');}
}
function fresh() {
  storageMessage='';
  const seed=crypto.getRandomValues(new Uint32Array(1))[0];
  game=createGame(seed,content.characters.map(c=>c.id),content.roleDeck);
  screen='game'; revealed=false; locked=false; stale=false; showHistory=false; expanded=false;resetControls();save();render();window.scrollTo(0,0);
}
host.addEventListener('change',e=>{if(e.target.id==='evidence') evidenceId=e.target.value;});
host.addEventListener('click',e=>{
  const el=e.target.closest('[data-action]'); if(!el||el.disabled)return;
  const act=el.dataset.action, id=el.dataset.id;
  if(stale&&!['reload-save','close'].includes(act))return;
  if(act==='jump-feed'||act==='jump-control'){document.querySelector(act==='jump-feed'?'.feed-column':'#control')?.scrollIntoView({block:'start',behavior:'instant'});}
  else if(act==='home'){screen='home';render();window.scrollTo(0,0);}
  else if(act==='gallery'){
    if(screen==='game'&&game){
      modal('<div class="cast-grid">'+content.characters.map(c=>'<button class="cast-card" data-action="character" data-id="'+c.id+'">'+portrait(c)+'<div class="cast-copy"><strong>'+esc(c.alias)+'</strong><span>'+esc(c.fictionalArchetype)+'</span></div></button>').join('')+'</div>',t('galleryTitle'));
    }else{screen='home';render();document.querySelector('#cast').scrollIntoView({block:'start'});}
  }
  else if(act==='journey-choice')chooseJourney(id);
  else if(act==='save-score')saveScore(el);
  else if(act==='rules')showRules();
  else if(act==='close')document.querySelector('#modal').close();
  else if(act==='new') {
    if(game&&game.phase!=='over') modal('<p>'+esc(t('newConfirm'))+'</p><div class="modal-actions">'+button(t('cancel'),'close','secondary')+button(t('confirm'),'confirm-new','primary')+'</div>',t('newGame'));
    else fresh();
  }
  else if(act==='confirm-new')fresh();
  else if(act==='resume'){screen='game';locked=true;revealed=false;resetControls();render();window.scrollTo(0,0);}
  else if(act==='reload-save'){load();stale=false;screen='home';render();}
  else if(act==='unlock'){locked=false;render();}
  else if(act==='reveal'){revealed=true;render();}
  else if(act==='begin')command({type:'begin'});
  else if(act==='character')showCharacter(id);
  else if(act==='identity')modal(roleBlock(),person(game.human).alias);
  else if(act==='player')showCharacter(game.players[Number(id)].character);
  else if(act==='select'){selected=Number(id);evidenceId='';render();document.querySelector('.target.selected')?.focus({preventScroll:true});}
  else if(act==='action-kind'){actionKind=id;selected=null;evidenceId='';render();document.querySelector('[data-action="action-kind"][data-id="'+id+'"]')?.focus({preventScroll:true});}
  else if(act==='potion'){potion=id;selected=null;render();}
  else if(act==='claim-result'){claimResult=id;render();}
  else if(act==='night')command({type:'night',target:selected,potion});
  else if(act==='speak')command({type:'speak',kind:actionKind,target:selected,evidence:evidenceId,result:claimResult});
  else if(act==='speak-skip')command({type:'speak',kind:'skip'});
  else if(act==='vote')command({type:'vote',target:selected});
  else if(act==='abstain')command({type:'vote',target:null});
  else if(act==='next')command({type:'next'});
  else if(act==='fast'){game=advanceSpectator(game);resetControls();save();render();window.scrollTo(0,0);}
  else if(act==='history'){showHistory=!showHistory;expanded=true;render();}
  else if(act==='expand'){expanded=true;render();}
});
window.addEventListener('storage',e=>{if(e.key===STORE&&e.newValue!==JSON.stringify(game)){stale=true;render();}});
try {
  const response=await fetch('./content.json');
  if(!response.ok)throw new Error('content-load');
  content=await response.json();
  document.title=content.product.workingTitle;
  load();render();
} catch {
  host.removeAttribute('aria-busy');
  host.innerHTML='<main class="locked-screen"><p>Unable to load. Please refresh.</p><button onclick="location.reload()">Reload</button></main>';
}
