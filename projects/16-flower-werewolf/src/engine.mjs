export const VERSION = 1;
const PHASES = ['deal', 'night', 'day', 'vote', 'roundEnd', 'over'];
const copy = value => structuredClone(value);
function random(s) {
  s.rng = (s.rng + 0x6D2B79F5) >>> 0;
  let n = s.rng;
  n = Math.imul(n ^ n >>> 15, n | 1);
  n ^= n + Math.imul(n ^ n >>> 7, n | 61);
  return ((n ^ n >>> 14) >>> 0) / 4294967296;
}
export function shuffle(values, rng) {
  const a = [...values];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
function ensure(condition, message = 'invalid-action') {
  if (!condition) throw new Error(message);
}
export function createGame(seed, characters, roles) {
  ensure(characters.length === 7 && roles.length === 7);
  ensure(new Set(characters).size === 7);
  ensure(roles.filter(r => r === 'wolf').length === 2 && roles.filter(r => r === 'seer').length === 1 && roles.filter(r => r === 'witch').length === 1 && roles.filter(r => r === 'villager').length === 3);
  const s = {version: VERSION, rng: seed >>> 0, seed: seed >>> 0, day: 0, phase: 'deal', winner: null, events: [], audit: [], evidence: [], runoff: null, night: null};
  const ids = shuffle(characters, () => random(s));
  const assigned = shuffle(roles, () => random(s));
  s.human = Math.floor(random(s) * 7);
  s.players = ids.map((character, id) => ({id, character, role: assigned[id], alive: true, checks: [], heal: 1, poison: 1, bias: Array.from({length: 7}, () => random(s) * 0.8)}));
  return s;
}
function emit(s, event) {
  const result = {id: 'e' + (s.events.length + 1), day: s.day, ...event};
  s.events.push(result);
  return result;
}
export function winnerOf(players) {
  const living = players.filter(p => p.alive);
  const wolves = living.filter(p => p.role === 'wolf').length;
  if (!living.length) return 'draw';
  if (!wolves) return 'good';
  if (wolves >= living.length - wolves) return 'wolf';
  return null;
}
function conclude(s) {
  s.winner = winnerOf(s.players);
  if (s.winner) { s.phase = 'over'; emit(s, {kind: 'finish', result: s.winner}); }
}
export function evidenceFrom(events) {
  const found = [];
  for (const e of events) {
    if (e.kind === 'ballot') {
      const support = events.find(x => x.kind === 'support' && x.actor === e.actor && x.target === e.target && x.day === e.day && x.id !== e.id);
      if (support && e.target !== null) found.push({id: 'flip-' + e.id, kind: 'flip', target: e.actor, other: e.target, day: e.day, eventIds: [support.id, e.id]});
    }
    if (e.kind === 'claim') {
      const previous = events.find(x => x.kind === 'claim' && x.actor === e.actor && x.target === e.target && x.result !== e.result && x.id !== e.id && events.indexOf(x) < events.indexOf(e));
      if (previous) found.push({id: 'contradict-' + e.id, kind: 'contradict', target: e.actor, other: e.target, day: e.day, eventIds: [previous.id, e.id]});
      const rival = events.find(x => x.kind === 'claim' && x.actor !== e.actor && events.indexOf(x) < events.indexOf(e));
      if (rival && !found.some(x => x.kind === 'rival' && x.target === e.actor)) found.push({id: 'rival-' + e.id, kind: 'rival', target: e.actor, other: rival.actor, day: e.day, eventIds: [rival.id, e.id]});
    }
  }
  return found;
}
// The policy receives only the observer's permitted view, never the complete game.
export function observe(s, id) {
  const p = s.players[id];
  return {
    id, day: s.day, role: p.role, checks: copy(p.checks), heal: p.heal, poison: p.poison,
    allies: p.role === 'wolf' ? s.players.filter(x => x.role === 'wolf').map(x => x.id) : [],
    bias: [...p.bias], players: s.players.map(x => ({id: x.id, alive: x.alive})),
    events: copy(s.events), evidence: evidenceFrom(s.events),
    victim: p.role === 'witch' && p.heal && s.phase === 'night' ? s.night?.kill ?? null : null
  };
}
export function suspicion(view) {
  const scores = Object.fromEntries(view.players.map(p => [p.id, view.bias[p.id]]));
  for (const e of view.evidence) scores[e.target] += e.kind === 'rival' ? 0.7 : 2.2;
  for (const e of view.events.filter(e => e.day >= view.day - 1)) {
    if (e.kind === 'accuse') {
      const valid = view.evidence.find(v => v.id === e.evidence && v.target === e.target);
      const knownLiar = view.checks.some(c => c.target === e.actor && c.wolf);
      if (!knownLiar) scores[e.target] += valid ? (valid.kind === 'rival' ? 0.9 : 2.4) : 0.45;
    }
    if (e.kind === 'support') scores[e.target] -= 0.35;
    if (e.kind === 'defend') scores[e.actor] -= 0.2;
    if (e.kind === 'claim') {
      const otherClaimants = new Set(view.events.filter(x => x.kind === 'claim' && x.actor !== e.actor).map(x => x.actor));
      const credibility = otherClaimants.size ? 0.6 : 1.6;
      scores[e.target] += e.result === 'wolf' ? credibility : -credibility * 0.55;
      if (e.target === view.id && (e.result === 'wolf') !== (view.role === 'wolf')) scores[e.actor] += 4;
      if (view.role === 'seer' && e.actor !== view.id) scores[e.actor] += 3;
    }
    if (e.kind === 'ballot' && e.target === view.id) scores[e.actor] += 0.15;
  }
  for (const check of view.checks) scores[check.target] = check.wolf ? 100 : -100;
  for (const ally of view.allies) scores[ally] = -200;
  scores[view.id] = -Infinity;
  return scores;
}
export function chooseVote(view, candidates, rng = Math.random, allowAbstain = false) {
  const options = candidates.filter(id => id !== view.id && view.players[id]?.alive);
  if (!options.length) return null;
  const scores = suspicion(view);
  const eligible = allowAbstain ? options.filter(id => scores[id] > -90) : options;
  return eligible.map(id => ({id, score: scores[id] + rng() * 1.25})).sort((a, b) => b.score - a.score)[0]?.id ?? null;
}
function chooseKill(view, rng) {
  const choices = view.players.filter(p => p.alive && !view.allies.includes(p.id));
  return choices.map(p => ({id: p.id, score: (view.events.some(e => e.kind === 'claim' && e.actor === p.id) ? 2.4 : 0) + rng()})).sort((a, b) => b.score - a.score)[0]?.id ?? null;
}
function startNight(s) {
  s.day++;
  s.phase = 'night';
  s.runoff = null;
  const wolf = s.players.find(p => p.alive && p.role === 'wolf');
  s.night = {alive: s.players.filter(p => p.alive).map(p => p.id), kill: null};
  if (wolf && !(s.players[s.human].alive && s.players[s.human].role === 'wolf')) s.night.kill = chooseKill(observe(s, wolf.id), () => random(s));
  emit(s, {kind: 'night'});
}
function validateTarget(s, target, exclude = []) {
  ensure(Number.isInteger(target) && s.players[target]?.alive && !exclude.includes(target), 'invalid-target');
}
function performNight(s, action) {
  const human = s.players[s.human], active = human.alive;
  if (active && human.role === 'wolf') {
    validateTarget(s, action.target, s.players.filter(p => p.role === 'wolf').map(p => p.id));
    s.night.kill = action.target;
  }
  const seer = s.players.find(p => p.alive && p.role === 'seer');
  if (seer) {
    let target = null;
    if (seer.id === s.human) {
      target = action.target ?? null;
      if (target !== null) validateTarget(s, target, [seer.id]);
    } else {
      const view = observe(s, seer.id);
      const choices = view.players.filter(p => p.alive && p.id !== seer.id && !view.checks.some(c => c.target === p.id)).map(p => p.id);
      target = chooseVote(view, choices, () => random(s));
    }
    if (target !== null) {
      const check = {day: s.day, target, wolf: s.players[target].role === 'wolf'};
      seer.checks.push(check);
      s.audit.push({kind: 'check', actor: seer.id, ...check});
    }
  }
  const witch = s.players.find(p => p.alive && p.role === 'witch');
  let healed = false, poison = null;
  if (witch) {
    const canHeal = witch.heal > 0 && s.night.kill !== null && (s.night.kill !== witch.id || s.day === 1);
    let potion = 'skip', target = null;
    if (witch.id === s.human) {
      potion = action.potion ?? 'skip'; target = action.target;
      ensure(['skip', 'heal', 'poison'].includes(potion));
    } else {
      const view = observe(s, witch.id);
      if (canHeal && (s.day === 1 || view.victim === witch.id || random(s) < 0.7)) potion = 'heal';
      else if (witch.poison) {
        const scores = suspicion(view);
        const selected = chooseVote(view, view.players.filter(p => p.alive).map(p => p.id), () => random(s));
        if (selected !== null && scores[selected] > 3 && random(s) < 0.65) { potion = 'poison'; target = selected; }
      }
    }
    if (potion === 'heal') { ensure(canHeal, 'no-heal'); witch.heal--; healed = true; }
    if (potion === 'poison') { ensure(witch.poison > 0, 'no-poison'); validateTarget(s, target, [witch.id]); witch.poison--; poison = target; }
  }
  const dead = [...new Set([healed ? null : s.night.kill, poison].filter(x => x !== null))];
  s.audit.push({kind: 'nightResolution', day: s.day, kill: s.night.kill, healed, poison, dead});
  for (const id of dead) s.players[id].alive = false;
  emit(s, {kind: 'dawn', targets: dead});
  s.phase = 'day';
  conclude(s);
  if (s.phase !== 'over') openingSpeeches(s);
}
function npcSpeech(s, id, initialView) {
  const view = initialView ?? observe(s, id);
  const lastCheck = [...view.checks].reverse().find(c => !view.events.some(e => e.kind === 'claim' && e.actor === id && e.target === c.target && e.result === (c.wolf ? 'wolf' : 'good')));
  if (view.role === 'seer' && lastCheck && (lastCheck.wolf || view.day >= 2 || view.events.some(e => e.kind === 'claim'))) {
    return emit(s, {kind: 'claim', actor: id, target: lastCheck.target, result: lastCheck.wolf ? 'wolf' : 'good', tone: 'opening'});
  }
  if (view.role === 'wolf' && !view.events.some(e => e.kind === 'claim' && view.allies.includes(e.actor)) && (random(s) < 0.38 || view.events.some(e => e.kind === 'claim' && e.result === 'wolf' && view.allies.includes(e.target)))) {
    const target = chooseVote(view, view.players.filter(p => p.alive).map(p => p.id), () => random(s));
    return emit(s, {kind: 'claim', actor: id, target, result: random(s) < 0.65 ? 'wolf' : 'good', tone: 'opening'});
  }
  const choices = view.players.filter(p => p.alive && p.id !== id).map(p => p.id);
  const target = chooseVote(view, choices, () => random(s));
  const evidence = view.evidence.find(e => e.target === target);
  if (evidence) return emit(s, {kind: 'accuse', actor: id, target, evidence: evidence.id, tone: 'suspect'});
  if (random(s) < 0.23) {
    const scores = suspicion(view);
    const supported = choices.sort((a, b) => scores[a] - scores[b])[0];
    return emit(s, {kind: 'support', actor: id, target: supported, tone: 'opening'});
  }
  return emit(s, {kind: 'accuse', actor: id, target, evidence: null, tone: 'opening'});
}
function openingSpeeches(s) {
  const order = shuffle(s.players.filter(p => p.alive && p.id !== s.human).map(p => p.id), () => random(s));
  const initialViews = new Map(order.map(id => [id, observe(s, id)]));
  for (const id of order) npcSpeech(s, id, initialViews.get(id));
  s.evidence = evidenceFrom(s.events);
}
function speak(s, action) {
  ensure(['accuse', 'support', 'defend', 'claim', 'skip'].includes(action.kind));
  const p = s.players[s.human];
  if (!p.alive) { ensure(action.kind === 'skip', 'eliminated'); s.phase = 'vote'; return; }
  if (['accuse', 'support', 'claim'].includes(action.kind)) validateTarget(s, action.target, [s.human]);
  if (action.kind === 'claim') ensure(['wolf', 'good'].includes(action.result));
  if (action.kind === 'accuse' && action.evidence) ensure(evidenceFrom(s.events).some(e => e.id === action.evidence && e.target === action.target), 'invalid-evidence');
  const event = emit(s, {kind: action.kind, actor: s.human, target: action.target ?? s.human, evidence: action.evidence || null, result: action.result ?? null, tone: action.kind === 'defend' ? 'defend' : 'opening'});
  if (['accuse', 'claim'].includes(action.kind)) {
    emit(s, {kind: 'response', actor: action.target, target: s.human, parent: event.id, tone: 'defend', result: action.kind === 'claim' ? 'claimResponse' : action.evidence ? 'evidenceResponse' : 'trialResponse'});
    const challenged=observe(s,action.target);
    if(challenged.role==='seer' && challenged.checks.length) {
      const check=challenged.checks.at(-1);
      if(!challenged.events.some(e=>e.kind==='claim' && e.actor===challenged.id && e.target===check.target && e.result===(check.wolf?'wolf':'good')))
        emit(s,{kind:'claim',actor:challenged.id,target:check.target,result:check.wolf?'wolf':'good',tone:'defend'});
    }
    const witnesses = s.players.filter(x => x.alive && x.id !== s.human && x.id !== action.target);
    if (witnesses.length) {
      const observer = witnesses[Math.floor(random(s) * witnesses.length)];
      const view = observe(s, observer.id);
      const target = chooseVote(view, view.players.filter(x => x.alive).map(x => x.id), () => random(s));
      emit(s, {kind: 'reaction', actor: observer.id, target, parent: event.id, result: target === action.target ? 'leanTarget' : 'reserve', tone: 'vote'});
    }
  } else if (action.kind === 'support') emit(s, {kind: 'response', actor: action.target, target: s.human, parent: event.id, result: 'supportResponse', tone: 'opening'});
  s.evidence = evidenceFrom(s.events);
  s.phase = 'vote';
}
export function tallyBallots(ballots) {
  const counts = {};
  for (const ballot of ballots) if (ballot.target !== null) counts[ballot.target] = (counts[ballot.target] || 0) + 1;
  const max = Math.max(0, ...Object.values(counts));
  return {counts, tied: Object.keys(counts).filter(id => counts[id] === max).map(Number)};
}
function vote(s, target) {
  const candidates = s.runoff ?? s.players.filter(p => p.alive).map(p => p.id);
  if (s.players[s.human].alive && target !== null) {
    validateTarget(s, target, [s.human]); ensure(candidates.includes(target));
  }
  if (!s.players[s.human].alive) ensure(target === null, 'eliminated');
  const ballots = s.players.filter(p => p.alive).map(p => ({
    actor: p.id,
    target: p.id === s.human ? target : chooseVote(observe(s, p.id), candidates, () => random(s), true)
  }));
  for (const ballot of ballots) emit(s, {kind: 'ballot', ...ballot, runoff: !!s.runoff});
  const {counts, tied} = tallyBallots(ballots);
  emit(s, {kind: 'tally', counts, targets: tied, runoff: !!s.runoff});
  if (tied.length > 1 && !s.runoff) {
    s.runoff = tied;
    emit(s, {kind: 'runoff', targets: tied});
    return;
  }
  s.phase = 'roundEnd';
  s.runoff = null;
  if (tied.length === 1) {
    s.players[tied[0]].alive = false;
    emit(s, {kind: 'eliminate', target: tied[0], tone: 'eliminated'});
  } else emit(s, {kind: 'noElimination'});
  s.evidence = evidenceFrom(s.events);
  conclude(s);
}
// Every command is transactional. Invalid/duplicate inputs cannot partially spend abilities.
export function transition(state, command) {
  const s = copy(state);
  ensure(!s.winner, 'game-over');
  if (command.type === 'begin') { ensure(s.phase === 'deal'); startNight(s); }
  else if (command.type === 'night') { ensure(s.phase === 'night'); performNight(s, command); }
  else if (command.type === 'speak') { ensure(s.phase === 'day'); speak(s, command); }
  else if (command.type === 'vote') { ensure(s.phase === 'vote'); vote(s, command.target ?? null); }
  else if (command.type === 'next') { ensure(s.phase === 'roundEnd'); startNight(s); }
  else throw new Error('unknown-command');
  return s;
}
export function advanceSpectator(state) {
  ensure(!state.players[state.human].alive);
  let s = state;
  for (let i = 0; i < 100 && s.phase !== 'over'; i++) {
    if (s.phase === 'night') s = transition(s, {type: 'night'});
    else if (s.phase === 'day') s = transition(s, {type: 'speak', kind: 'skip'});
    else if (s.phase === 'vote') s = transition(s, {type: 'vote', target: null});
    else if (s.phase === 'roundEnd') s = transition(s, {type: 'next'});
    else break;
  }
  return s;
}
export function restoreGame(raw, characterIds) {
  try {
    const s = typeof raw === 'string' ? JSON.parse(raw) : copy(raw);
    ensure(s && s.version === VERSION && PHASES.includes(s.phase));
    ensure(Number.isInteger(s.rng) && s.rng >= 0 && s.rng <= 4294967295);
    ensure(Number.isInteger(s.seed) && Number.isInteger(s.human) && s.human >= 0 && s.human < 7);
    ensure(Number.isInteger(s.day) && s.day >= 0 && s.day < 1000);
    ensure(Array.isArray(s.players) && s.players.length === 7);
    ensure(new Set(s.players.map(p => p.character)).size === 7);
    const roles = s.players.map(p => p.role);
    ensure(roles.filter(r => r === 'wolf').length === 2 && roles.filter(r => r === 'seer').length === 1 && roles.filter(r => r === 'witch').length === 1 && roles.filter(r => r === 'villager').length === 3);
    const seat = n => Number.isInteger(n) && n >= 0 && n < 7;
    s.players.forEach((p, i) => {
      ensure(p.id === i && characterIds.includes(p.character) && typeof p.alive === 'boolean');
      ensure([0, 1].includes(p.heal) && [0, 1].includes(p.poison));
      ensure(Array.isArray(p.bias) && p.bias.length === 7 && p.bias.every(Number.isFinite));
      ensure(Array.isArray(p.checks) && p.checks.every(c => seat(c.target) && typeof c.wolf === 'boolean' && Number.isInteger(c.day)));
    });
    const kinds = ['night','dawn','finish','claim','accuse','support','defend','skip','response','reaction','ballot','tally','runoff','eliminate','noElimination'];
    ensure(Array.isArray(s.events) && s.events.length < 20000 && Array.isArray(s.audit));
    s.events.forEach((e, i) => {
      ensure(e.id === 'e' + (i + 1) && kinds.includes(e.kind) && Number.isInteger(e.day));
      if (e.actor !== undefined) ensure(seat(e.actor));
      if (e.target !== undefined && e.target !== null) ensure(seat(e.target));
      if (e.targets !== undefined) ensure(Array.isArray(e.targets) && e.targets.every(seat));
      if (e.kind === 'claim') ensure(['wolf','good'].includes(e.result));
      if (['claim','accuse','support','defend','skip','response','reaction','ballot'].includes(e.kind)) ensure(seat(e.actor));
      if (['claim','accuse','support','response','reaction','eliminate'].includes(e.kind)) ensure(seat(e.target));
      if (e.kind === 'dawn' || e.kind === 'runoff') ensure(Array.isArray(e.targets));
      if (e.kind === 'tally') ensure(e.counts && typeof e.counts === 'object' && !Array.isArray(e.counts) && Object.entries(e.counts).every(([id,n]) => seat(Number(id)) && Number.isInteger(n) && n > 0 && n <= 7));
      if (e.kind === 'response' || e.kind === 'reaction') ensure(['claimResponse','evidenceResponse','trialResponse','supportResponse','leanTarget','reserve'].includes(e.result));
    });
    ensure(s.runoff === null || (Array.isArray(s.runoff) && s.runoff.length > 1 && s.runoff.every(n => seat(n) && s.players[n].alive)));
    if (s.phase === 'night') ensure(s.night && Array.isArray(s.night.alive) && s.night.alive.every(seat) && (s.night.kill === null || seat(s.night.kill)));
    ensure(s.audit.every(e => e && ['check','nightResolution'].includes(e.kind) && Number.isInteger(e.day)));
    ensure(s.phase === 'over' ? s.winner === winnerOf(s.players) && !!s.winner : s.winner === null);
    return s;
  } catch { return null; }
}
