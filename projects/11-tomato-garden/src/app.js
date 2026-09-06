import { freshState, stageOf, remaining, startSession, togglePause, settle, collect, restore, localDay, STORAGE_KEY } from './engine.js';
import { plantArt, icon } from './art.js';

const content = await fetch(new URL('./content/content.json', import.meta.url)).then(response => {
  if (!response.ok) throw Error(response.status);
  return response.json();
});
const { ui: t, plants, timing, brand } = content;
let state = freshState();
let storageMessage = '';
try { const raw = localStorage.getItem(STORAGE_KEY); if (raw) state = restore(raw, plants); } catch { storageMessage = t.storageReset; }
let page = 'focus';
let minutes = timing.default;
let task = '';
let dialog = null;
let focusReturn = null;
const app = document.querySelector('#app');
const escape = value => String(value).replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);
const id = () => `${Date.now()}-${Math.random().toString(36).slice(2)}`;
const plant = () => plants.find(item => item.id === state.selected);
const grown = () => state.progress[state.selected] || 0;
const isMature = () => grown() >= plant().stages.at(-1).at;
function save() { try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch { storageMessage = t.storageError; } }
function reconcile() {
  if (state.session?.status === 'running' && remaining(state.session, Date.now()) === 0) {
    const outcome = settle(state, Date.now(), plants); state = outcome.state; dialog = { type: 'result', ...outcome.result }; save(); return true;
  }
  return false;
}
function stats() {
  const today = state.records.filter(record => localDay(record.at) === localDay(Date.now()));
  return `<div class="stats"><div><span>${t.today}</span><strong>${today.reduce((sum, r) => sum + r.minutes, 0)}<small>${t.minutes}</small></strong></div><div><span>${t.sessions}</span><strong>${today.filter(r => r.complete).length}<small> / ${t.today.slice(0, 2)}</small></strong></div><div><span>${t.total}</span><strong>${state.total}<small>${t.minutes}</small></strong></div></div>`;
}
function progressBlock() {
  const p = plant(); const index = stageOf(p, grown()); const next = p.stages[index + 1];
  return `<div class="growth-heading"><span>${t.stage}</span><span>${grown()} / ${p.stages.at(-1).at} ${t.minutes}</span></div><div class="stage-track">${p.stages.map((stage, i) => `<div class="stage ${i <= index ? 'achieved' : ''}" ${i === index ? 'aria-current="step"' : ''}><i>${i < index ? '✓' : i + 1}</i><span>${stage.name}</span><small>${stage.at}′</small></div>`).join('')}</div><p class="growth-note">${next ? `${t.next} <strong>${next.at - grown()} ${t.minutes}</strong> · ${next.name}` : t.mature}</p>`;
}
function focusPage() {
  const p = plant(); const s = state.session; const stage = stageOf(p, grown());
  return `<div class="page-heading"><div><p class="eyebrow">${t.eyebrow}</p><h1>${t.focusTitle}</h1></div><span class="season">${icon('sun')} ${brand.tagline}</span></div><div class="focus-layout"><section class="timer-panel"><div class="panel-top"><span class="live-label"><i class="${s?.status === 'running' ? 'live' : ''}"></i>${s ? s.mode === 'rest' ? t.resting : s.status === 'paused' ? t.paused : t.focusing : t.ready}</span><span class="tiny-leaf">${icon('garden')}</span></div><div class="timer-area"><div id="timer" class="timer" role="timer" aria-label="${t.nav[0]}">25<span>:</span>00</div><div class="duration-options" aria-label="${t.minutes}">${timing.presets.map(value => `<button class="duration ${minutes === value ? 'active' : ''}" data-action="duration" data-value="${value}" ${s ? 'disabled' : ''}>${value} ${t.minutes}</button>`).join('')}</div></div><label class="task-label" for="task">${t.taskLabel}</label><input id="task" maxlength="80" placeholder="${t.taskPlaceholder}" value="${escape(s?.task || task)}" ${s ? 'disabled' : ''}><div class="timer-actions">${s ? `<button class="primary" data-action="pause">${s.status === 'paused' ? t.resume : t.pause}</button><button class="text-button" data-action="finish">${s.mode === 'rest' ? t.skipRest : t.finish}</button>` : `<button class="primary" data-action="${isMature() ? 'collect' : 'start'}">${isMature() ? t.collect : t.start} ${icon('arrow')}</button>`}</div>${stats()}</section><section class="plant-panel"><div class="plant-panel-head"><span class="eyebrow">${t.growing}</span><button class="text-button" data-action="seeds" ${s ? 'disabled' : ''}>${t.newPlant} ↗</button></div><div class="hero-plant">${plantArt(p.id, stage, true)}<span class="specimen-number">0${plants.indexOf(p) + 1} / 04</span></div><div class="plant-caption"><h2>${p.name}<span>${p.stages[stage].name}</span></h2><p>${p.stages[stage].note}</p></div>${progressBlock()}</section></div><div class="bottom-note"><span>${icon('garden')} ${t.keepGrowing}</span><span>${t.local}</span></div>`;
}
function seedsMarkup() {
  return `<div class="seed-grid">${plants.map(p => {
    const locked = state.total < p.unlock; const index = stageOf(p, state.progress[p.id] || 0);
    return `<button class="seed-card ${p.id === state.selected ? 'chosen' : ''} ${locked ? 'locked' : ''}" data-action="select" data-id="${p.id}" ${locked || state.session ? 'disabled' : ''}>${plantArt(p.id, 4)}<div class="seed-info"><span class="plant-kind">${p.kind}</span><h3>${p.name}</h3><p>${p.description}</p><span class="seed-status">${locked ? icon('lock') + t.locked.replace('{n}', p.unlock) : p.id === state.selected ? icon('check') + t.selected : `${t.select} · ${state.progress[p.id] ? p.stages[index].name : p.stages.at(-1).at + '′'}`} </span></div></button>`;
  }).join('')}</div>`;
}
function gardenPage() {
  return `<div class="page-heading"><div><p class="eyebrow">${t.nav[1]}</p><h1>${t.gardenTitle}</h1><p class="subheading">${t.gardenSubtitle}</p></div><span class="garden-count">${state.collection.length}<small>${t.collection}</small></span></div><section class="collection">${state.collection.length ? state.collection.slice().reverse().map(item => { const p = plants.find(p => p.id === item.plantId); return `<article class="collected-plant">${plantArt(p.id, 4)}<h3>${p.name}</h3><p>${new Date(item.at).toLocaleDateString('zh-CN')} · ${item.minutes}′</p></article>`; }).join('') : `<div class="empty-garden">${plantArt(state.selected, 1)}<h2>${t.emptyGarden}</h2><p>${t.emptyGardenNote}</p><button class="text-button" data-action="focus">${t.start} ${icon('arrow')}</button></div>`}</section><div class="section-heading"><h2>${t.seedTitle}</h2><span>${t.plantDetail}</span></div>${seedsMarkup()}<p class="footnote">${t.seedIntro}</p>`;
}
function journalPage() {
  const days = Array.from({ length: 7 }, (_, i) => { const date = new Date(); date.setHours(12, 0, 0, 0); date.setDate(date.getDate() - 6 + i); return { label: t.dayNames[date.getDay()], value: state.records.filter(r => localDay(r.at) === localDay(date)).reduce((sum, r) => sum + r.minutes, 0) }; });
  const max = Math.max(25, ...days.map(d => d.value));
  return `<div class="page-heading"><div><p class="eyebrow">${t.nav[2]}</p><h1>${t.journalTitle}</h1></div></div>${stats()}<section class="week-panel"><h2>${t.week}</h2><div class="chart">${days.map((d, i) => `<div class="chart-column ${i === 6 ? 'today' : ''}"><span>${d.value}′</span><div class="bar-track"><div class="bar" style="height:${Math.max(2, d.value / max * 100)}%"></div></div><span>${d.label}</span></div>`).join('')}</div></section><div class="section-heading"><h2>${t.recent}</h2></div><div class="records">${state.records.length ? state.records.slice(-30).reverse().map(r => `<article class="record">${icon(r.complete ? 'check' : 'timer')}<div><strong>${escape(r.task || t.taskDefault)}</strong><p>${new Date(r.at).toLocaleString('zh-CN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })} · ${r.complete ? t.complete : t.partial} · ${plants.find(p => p.id === r.plantId).name}</p></div><b>+${r.minutes}<small>${t.minuteShort}</small></b></article>`).join('') : `<p class="empty-records">${t.emptyRecords}</p>`}</div>`;
}
function modalMarkup() {
  if (!dialog) return '';
  let body;
  if (dialog.type === 'seeds') body = `<h2 id="dialog-title">${t.seedTitle}</h2><p>${t.replace}</p>${seedsMarkup()}<p class="footnote">${t.seedIntro}</p>`;
  else if (dialog.type === 'finish') body = `<div class="dialog-icon">${icon('timer')}</div><h2 id="dialog-title">${t.finishTitle}</h2><p>${t.finishNote}</p><button class="primary" data-action="confirm-finish">${t.confirmFinish}</button><button class="text-button" data-action="close">${t.cancel}</button>`;
  else if (dialog.type === 'result') {
    const p = plants.find(p => p.id === dialog.plantId) || plant();
    body = `${dialog.rest ? `<div class="dialog-icon">${icon('sun')}</div>` : `<div class="result-plant">${plantArt(p.id, dialog.stage)}</div>`}<h2 id="dialog-title">${dialog.rest ? t.restDone : t.success}</h2>${dialog.rest ? '' : `<p class="reward">+${dialog.minutes}<span>${t.minutes} ${t.growth}</span></p><p>${p.name} · ${p.stages[dialog.stage].name}</p>`}<button class="primary" data-action="${dialog.rest ? 'close' : 'rest'}">${dialog.rest ? t.again : t.rest}</button><button class="text-button" data-action="garden">${t.viewGarden}</button>`;
  }
  return `<div class="modal-backdrop"><section class="modal ${dialog.type === 'seeds' ? 'wide' : ''}" role="dialog" aria-modal="true" aria-labelledby="dialog-title"><button class="close" data-action="close" aria-label="${t.close}">×</button>${body}</section></div>`;
}
function render() {
  app.innerHTML = `<header class="site-header"><a class="brand" href="#" data-action="focus">${icon('garden')}<span>${brand.name}<small>${brand.en}</small></span></a><nav aria-label="${brand.name}">${['focus', 'garden', 'journal'].map((key, i) => `<button data-action="${key}" class="nav-button ${page === key ? 'active' : ''}" ${page === key ? 'aria-current="page"' : ''}>${icon(['timer', 'garden', 'book'][i])}<span>${t.nav[i]}</span></button>`).join('')}</nav><span class="header-note">${t.saved}</span></header><main id="main">${storageMessage ? `<p class="storage-warning" role="alert">${storageMessage}</p>` : ''}${page === 'focus' ? focusPage() : page === 'garden' ? gardenPage() : journalPage()}</main><footer>${brand.en}<span>${t.localDetail}</span></footer>${modalMarkup()}`;
  document.querySelector('main').inert = !!dialog;
  document.querySelector('header').inert = !!dialog;
  document.querySelector('footer').inert = !!dialog;
  document.body.classList.toggle('modal-open', !!dialog);
  updateTimer();
  if (dialog) document.querySelector('.modal button:not(:disabled)')?.focus();
}
function updateTimer() {
  const target = document.querySelector('#timer');
  const seconds = Math.ceil(state.session ? remaining(state.session, Date.now()) / 1000 : minutes * 60);
  const clock = `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
  if (target) target.textContent = clock;
  document.title = state.session ? `${clock} · ${brand.name}` : brand.name;
}
app.addEventListener('input', event => { if (event.target.id === 'task') task = event.target.value; });
app.addEventListener('click', event => {
  const button = event.target.closest('[data-action]'); if (!button || button.disabled) return;
  event.preventDefault();
  if (reconcile()) { render(); return; }
  const action = button.dataset.action;
  if (['focus', 'garden', 'journal'].includes(action)) { page = action; dialog = null; }
  else if (action === 'duration') minutes = Number(button.dataset.value);
  else if (action === 'start') { if (isMature()) return; state = startSession(state, { id: id(), minutes, task: task.trim() || t.taskDefault, now: Date.now() }); }
  else if (action === 'pause') state = togglePause(state, Date.now());
  else if (action === 'finish') { if (state.session?.mode === 'rest') { state = settle(state, Date.now(), plants).state; } else { focusReturn = action; dialog = { type: 'finish' }; } }
  else if (action === 'confirm-finish') { const outcome = settle(state, Date.now(), plants); state = outcome.state; dialog = { type: 'result', ...outcome.result }; }
  else if (action === 'seeds') { focusReturn = action; dialog = { type: 'seeds' }; }
  else if (action === 'close') dialog = null;
  else if (action === 'rest') { dialog = null; page = 'focus'; state = startSession(state, { id: id(), minutes: timing.rest, task: t.resting, mode: 'rest', now: Date.now() }); }
  else if (action === 'collect') { state = collect(state, plants, Date.now(), id()); dialog = { type: 'seeds' }; }
  else if (action === 'select') { const p = plants.find(p => p.id === button.dataset.id); if (!p || p.unlock > state.total || state.session) return; state = { ...state, selected: p.id }; page = 'focus'; dialog = null; }
  save(); render();
  if (action === 'close') document.querySelector(`[data-action="${focusReturn || 'start'}"]`)?.focus();
});
document.addEventListener('keydown', event => {
  if (!dialog) return;
  if (event.key === 'Escape') { dialog = null; render(); document.querySelector(`[data-action="${focusReturn || 'start'}"]`)?.focus(); }
  if (event.key === 'Tab') {
    const buttons = [...document.querySelectorAll('.modal button:not(:disabled)')];
    const first = buttons[0]; const last = buttons.at(-1);
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  }
});
window.addEventListener('storage', event => {
  if (event.key !== STORAGE_KEY) return;
  try { state = event.newValue ? restore(event.newValue, plants) : freshState(); dialog = null; reconcile(); render(); } catch { storageMessage = t.storageReset; render(); }
});
document.addEventListener('visibilitychange', () => { if (reconcile()) render(); else updateTimer(); });
setInterval(() => { if (reconcile()) render(); else updateTimer(); }, 250);
reconcile(); render();
