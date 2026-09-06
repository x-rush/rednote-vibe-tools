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
let minutes = state.session?.mode === 'focus' ? state.session.duration / 60000 : timing.default;
let task = '';
let dialog = null;
let focusReturn = null;
let plantFilter = 'all';
let scene = 'daylight';
let customDuration = !timing.presets.includes(minutes);
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
function focusPage() {
  const p = plant(); const stage = stageOf(p, grown()); const maturity = p.stages.at(-1).at;
  return `<div class="page-heading"><div><p class="eyebrow">${t.eyebrow}</p><h1>${t.focusTitle}</h1></div><span class="season">${icon('sun')} ${brand.tagline}</span></div>
  <section class="home-workbench ${scene}">
    <div class="workbench-header"><span>${icon('garden')}${t.chooseCompanion}</span><div class="scene-switch" role="group" aria-label="${t.sceneLabel}">${['daylight', 'sunset'].map(key => `<button data-action="scene" data-value="${key}" aria-pressed="${scene === key}" aria-label="${t[key]}">${icon(key === 'daylight' ? 'sun' : 'moon')}</button>`).join('')}</div></div>
    <div class="workbench-scene"><div class="home-clock"><p class="eyebrow">${t.nav[0]}</p><div id="timer" class="timer" role="timer" aria-label="${t.nav[0]}"></div><p>${t.timerHint}</p></div><div class="home-plant">${plantArt(p.id, stage, true)}</div></div>
    <div class="home-plant-summary"><div class="plant-caption"><h2>${p.name}<span>${p.stages[stage].name}</span></h2><p>${p.stages[stage].note}</p></div><button class="text-button" data-action="seeds">${t.newPlant} ↗</button></div>
    <div class="home-growth"><div class="home-growth-track" role="progressbar" aria-label="${t.stage}" aria-valuemin="0" aria-valuemax="${maturity}" aria-valuenow="${grown()}"><span style="width:${grown() / maturity * 100}%"></span></div><span>${grown()} / ${maturity}′</span><button class="text-button" data-action="detail" data-id="${p.id}">${t.growthPreview} ↗</button></div>
    <div class="home-settings"><div class="duration-options" role="group" aria-label="${t.customLabel}">${timing.presets.map(value => `<button class="duration ${minutes === value && !customDuration ? 'active' : ''}" aria-pressed="${minutes === value && !customDuration}" data-action="duration" data-value="${value}">${value} ${t.minutes}</button>`).join('')}<button class="duration ${customDuration ? 'active' : ''}" data-action="custom" aria-pressed="${customDuration}">${customDuration ? minutes + '′' : t.custom}</button></div>
    <label class="task-label" for="task">${t.taskLabel}</label><input id="task" maxlength="80" placeholder="${t.taskPlaceholder}" value="${escape(task)}"><div class="task-suggestions">${t.taskSuggestions.map((label, i) => `<button data-action="suggest" data-value="${i}">${label}</button>`).join('')}</div>
    <button class="primary" data-action="${isMature() ? 'collect' : 'start'}">${icon(isMature() ? 'garden' : 'play')}${isMature() ? t.collect : t.start}${icon('arrow')}</button><div class="rest-options"><button data-action="rest">${icon('sun')}${t.shortBreak} · ${timing.rest}′</button><span>·</span><button data-action="long-rest">${t.longBreak} · ${timing.longRest}′</button></div></div>
  </section>${stats()}
  <section class="garden-invitation"><div class="invitation-copy"><p class="eyebrow">${t.seedTitle}</p><h2>${t.seedShelfTitle}</h2><p>${t.seedShelfNote}</p></div><div class="invitation-art">${content.showcase.map(id => plantArt(id, 4)).join('')}</div><button class="text-button" data-action="seeds"><span>${t.catalogLink}</span>${icon('arrow')}</button></section>
  <div class="bottom-note"><span>${icon('garden')} ${t.keepGrowing}</span><span>${t.local}</span></div>`;
}
function sessionPage() {
  const session = state.session; const p = plants.find(item => item.id === session.plantId);
  const paused = session.status === 'paused'; const rest = session.mode === 'rest';
  return `<main id="main" class="focus-sanctuary ${scene} ${paused ? 'is-paused' : ''} ${rest ? 'is-rest' : ''}" tabindex="-1" aria-label="${rest ? t.sessionRest : t.nav[0]}">
    <div class="session-intro"><p class="eyebrow">${brand.name} / ${rest ? t.sessionRest : t.sessionTask}</p><h1>${rest ? t.resting : t.focusSanctuary}</h1><p class="session-task">${escape(session.task)}</p></div>
    <div class="session-world" aria-hidden="true"><div class="growth-halo"></div><div class="growth-motes"><i></i><i></i><i></i><i></i><i></i></div><div id="live-plant"></div><div class="soil-ripples"><i></i><i></i></div></div>
    <div class="session-readout"><p id="live-growth-note" class="session-status" role="status">${paused ? t.livePaused : rest ? t.liveRest : t.liveGrowth}</p><div id="timer" class="timer" role="timer" aria-label="${t.nav[0]}"></div><p class="session-duration">${t.sessionDuration} ${session.duration / 60000} ${t.minutes}<span>·</span>${p.name}<span id="live-stage"></span></p><div class="session-progress" role="progressbar" aria-label="${rest ? t.sessionRest : t.nav[0]}" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0"><span id="session-progress-fill"></span></div><p class="session-earned" id="session-earned"></p></div>
    <div class="session-controls"><button class="primary" data-action="pause">${icon(paused ? 'play' : 'pause')}${paused ? t.resume : t.pause}</button><button class="stop-button" data-action="finish">${icon('stop')}${t.stop}</button></div>
    <p class="session-footnote">${rest ? t.restHint : t.sessionProgressNote}</p>${storageMessage ? `<p class="session-storage" role="alert">${storageMessage}</p>` : ''}
  </main>`;
}
function seedsMarkup() {
  const filters = [['all', t.allPlants], ['available', t.available], ...['fruiting', 'blooming', 'foliage', 'herbs'].map(key => [t[key], t[key]])];
  const visible = plants.filter(p => plantFilter === 'all' || (plantFilter === 'available' ? p.unlock <= state.total : p.kind === plantFilter));
  return `<div class="catalog-meta"><span>${plants.filter(p => p.unlock <= state.total).length} / ${plants.length} ${t.discovered}</span><span>${plants.length} ${t.seedCount}</span></div><div class="plant-filters" role="group" aria-label="${t.plantDetail}">${filters.map(([value,label]) => `<button data-action="filter" data-value="${value}" aria-pressed="${plantFilter === value}">${label}</button>`).join('')}</div><div class="seed-grid">${visible.map(p => {
    const locked = state.total < p.unlock;
    return `<article class="seed-card ${p.id === state.selected ? 'chosen' : ''} ${locked ? 'locked' : ''}"><button class="seed-art-button" data-action="detail" data-id="${p.id}" aria-label="${p.name} · ${t.preview}">${plantArt(p.id, 4)}<span>${t.preview} ↗</span></button><div class="seed-info"><span class="plant-kind">${p.kind} · ${p.stages.at(-1).at}′</span><h3>${p.name}</h3><p>${p.description}</p><button class="seed-status" data-action="select" data-id="${p.id}" ${locked || state.session ? 'disabled' : ''}>${locked ? icon('lock') + t.unlockRemaining.replace('{n}', p.unlock - state.total) : p.id === state.selected ? icon('check') + t.selected : t.select + ' ↗'}</button></div></article>`;
  }).join('') || `<p>${t.noPlants}</p>`}</div>`;
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
  if (dialog.type === 'custom') body = `<div class="dialog-icon">${icon('timer')}</div><h2 id="dialog-title">${t.customLabel}</h2><p id="custom-hint">${t.customHint}</p><form id="duration-form" novalidate><label class="custom-input-label" for="custom-minutes">${t.minutes}</label><input id="custom-minutes" type="number" inputmode="numeric" min="${timing.min}" max="${timing.max}" step="1" value="${minutes}" aria-describedby="custom-hint custom-error"><p id="custom-error" class="form-error" role="alert"></p><button class="primary" type="submit">${t.apply}</button></form>`;
  else if (dialog.type === 'detail') {
    const p = plants.find(p => p.id === dialog.plantId); const index = dialog.stage; const locked = state.total < p.unlock;
    body = `<p class="eyebrow">${t.plantDetail} / ${p.kind}</p><h2 id="dialog-title">${p.name}</h2><p class="latin">${p.latin}</p><div class="detail-plant">${plantArt(p.id, index, true)}</div><div class="preview-stages" role="group" aria-label="${t.growthPreview}">${p.stages.map((stage,i) => `<button data-action="preview-stage" data-value="${i}" aria-pressed="${i === index}"><span>${stage.name}</span><small>${stage.at}′</small></button>`).join('')}</div><p>${p.stages[index].note}</p><p class="preview-note">${t.previewNote}</p><button class="primary" data-action="select" data-id="${p.id}" ${locked || state.session ? 'disabled' : ''}>${locked ? t.unlockRemaining.replace('{n}', p.unlock - state.total) : t.select}</button><button class="text-button" data-action="seeds">${t.backSeeds}</button>`;
  }
  else if (dialog.type === 'seeds') body = `<h2 id="dialog-title">${t.seedTitle}</h2><p>${t.replace}</p>${seedsMarkup()}<p class="footnote">${t.seedIntro}</p>`;
  else if (dialog.type === 'result') {
    const p = plants.find(p => p.id === dialog.plantId) || plant();
    body = `${dialog.rest ? `<div class="dialog-icon">${icon('sun')}</div>` : `<div class="result-plant">${plantArt(p.id, dialog.stage)}</div>`}<h2 id="dialog-title">${dialog.rest ? t.restDone : t.success}</h2>${dialog.rest ? '' : `<p class="reward">+${dialog.minutes}<span>${t.minutes} ${t.growth}</span></p><p>${p.name} · ${p.stages[dialog.stage].name}</p>`}<button class="primary" data-action="${dialog.rest ? 'close' : 'rest'}">${dialog.rest ? t.again : t.rest}</button><button class="text-button" data-action="garden">${t.viewGarden}</button>`;
  }
  return `<div class="modal-backdrop"><section class="modal ${dialog.type === 'seeds' ? 'wide' : ''}" role="dialog" aria-modal="true" aria-labelledby="dialog-title"><button class="close" data-action="close" aria-label="${t.close}">×</button>${body}</section></div>`;
}
function returnFocus() {
  const target = [...document.querySelectorAll(`[data-action="${focusReturn || 'start'}"]`)].find(element => !element.disabled && element.getClientRects().length);
  const fallback = ['[data-action=start]', '[data-action=collect]', 'nav [aria-current]'].map(selector => document.querySelector(selector)).find(element => element && !element.disabled && element.getClientRects().length);
  (target || fallback)?.focus();
}
function render() {
  const active = !!state.session;
  app.innerHTML = active ? sessionPage() : `<a class="skip-link" href="#main">${t.skipMain}</a><header class="site-header"><a class="brand" href="#" data-action="focus">${icon('garden')}<span>${brand.name}<small>${brand.en}</small></span></a><nav aria-label="${brand.name}">${['focus', 'garden', 'journal'].map((key, i) => `<button data-action="${key}" class="nav-button ${page === key ? 'active' : ''}" ${page === key ? 'aria-current="page"' : ''}>${icon(['timer', 'garden', 'book'][i])}<span>${t.nav[i]}</span></button>`).join('')}</nav><span class="header-note">${t.saved}</span></header><main id="main" tabindex="-1">${storageMessage ? `<p class="storage-warning" role="alert">${storageMessage}</p>` : ''}${page === 'focus' ? focusPage() : page === 'garden' ? gardenPage() : journalPage()}</main><footer>${brand.en}<span>${t.localDetail}</span></footer>${modalMarkup()}`;
  [...app.children].filter(element => !element.classList.contains('modal-backdrop')).forEach(element => { element.inert = !!dialog; });
  document.body.classList.toggle('modal-open', !!dialog);
  document.body.classList.toggle('session-active', active);
  updateTimer();
  if (dialog) document.querySelector('.modal button:not(:disabled)')?.focus();
}
function updateTimer() {
  const target = document.querySelector('#timer');
  const seconds = Math.ceil(state.session ? remaining(state.session, Date.now()) / 1000 : minutes * 60);
  const clock = `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
  if (target) target.textContent = clock;
  if (state.session) {
    const session = state.session; const p = plants.find(item => item.id === session.plantId);
    const elapsed = session.duration - remaining(session, Date.now());
    const earned = session.mode === 'rest' ? 0 : Math.floor(elapsed / 60000);
    const progress = Math.min(p.stages.at(-1).at, (state.progress[p.id] || 0) + earned);
    const stage = stageOf(p, progress); const art = document.querySelector('#live-plant');
    if (art && art.dataset.stage !== String(stage)) {
      art.innerHTML = plantArt(p.id, stage); art.dataset.stage = String(stage);
    }
    document.querySelector('#live-stage').textContent = ' · ' + p.stages[stage].name;
    document.querySelector('#session-earned').textContent = session.mode === 'rest' ? t.growingTogether : `${t.sessionGrowth} +${earned} ${t.minutes}`;
    const percent = Math.min(100, elapsed / session.duration * 100);
    document.querySelector('#session-progress-fill').style.transform = `scaleX(${percent / 100})`;
    document.querySelector('.session-progress').setAttribute('aria-valuenow', String(Math.floor(percent)));
  }
  document.title = state.session ? `${clock} · ${brand.name}` : brand.name;
}
app.addEventListener('input', event => { if (event.target.id === 'task') task = event.target.value; });
app.addEventListener('click', event => {
  const button = event.target.closest('[data-action]'); if (!button || button.disabled) return;
  event.preventDefault();
  if (reconcile()) { render(); return; }
  const action = button.dataset.action;
  if (state.session && !['pause', 'finish'].includes(action)) return;
  if (['focus', 'garden', 'journal'].includes(action)) { page = action; dialog = null; }
  else if (action === 'duration') { minutes = Number(button.dataset.value); customDuration = false; }
  else if (action === 'custom') { focusReturn = action; dialog = { type: 'custom' }; }
  else if (action === 'suggest') task = t.taskSuggestions[Number(button.dataset.value)];
  else if (action === 'scene') scene = button.dataset.value;
  else if (action === 'filter') plantFilter = button.dataset.value;
  else if (action === 'detail') { focusReturn = action; dialog = { type: 'detail', plantId: button.dataset.id, stage: 4 }; }
  else if (action === 'preview-stage') dialog.stage = Number(button.dataset.value);
  else if (action === 'start') { if (isMature()) return; state = startSession(state, { id: id(), minutes, task: task.trim() || t.taskDefault, now: Date.now() }); }
  else if (action === 'pause') state = togglePause(state, Date.now());
  else if (action === 'finish') { const outcome = settle(state, Date.now(), plants); state = outcome.state; page = 'focus'; dialog = { type: 'result', ...outcome.result }; }
  else if (action === 'seeds') { focusReturn = action; dialog = { type: 'seeds' }; }
  else if (action === 'close') dialog = null;
  else if (action === 'rest' || action === 'long-rest') { dialog = null; page = 'focus'; state = startSession(state, { id: id(), minutes: action === 'long-rest' ? timing.longRest : timing.rest, task: t.resting, mode: 'rest', now: Date.now() }); }
  else if (action === 'collect') { state = collect(state, plants, Date.now(), id()); dialog = { type: 'seeds' }; }
  else if (action === 'select') { const p = plants.find(p => p.id === button.dataset.id); if (!p || p.unlock > state.total || state.session) return; state = { ...state, selected: p.id }; page = 'focus'; dialog = null; }
  save(); render();
  if (['focus', 'garden', 'journal', 'select', 'start', 'rest', 'long-rest'].includes(action)) {
    document.querySelector('#main').focus({ preventScroll: true });
    window.scrollTo({ top: 0, behavior: 'instant' });
  }
  if (['filter', 'preview-stage', 'scene', 'duration', 'suggest', 'pause'].includes(action)) [...(dialog ? document.querySelector('.modal') : app).querySelectorAll('[data-action]')].find(el => el.dataset.action === action && el.dataset.value === button.dataset.value)?.focus();
  if (['start', 'rest', 'long-rest'].includes(action)) document.querySelector('[data-action=pause]')?.focus({ preventScroll: true });
  if (action === 'custom') document.querySelector('#custom-minutes')?.focus();
  if (action === 'close') returnFocus();
});
app.addEventListener('submit', event => {
  if (event.target.id !== 'duration-form') return;
  event.preventDefault();
  const input = document.querySelector('#custom-minutes'); const value = Number(input.value);
  if (!Number.isInteger(value) || value < timing.min || value > timing.max) { input.setAttribute('aria-invalid', 'true'); document.querySelector('#custom-error').textContent = t.customError; input.focus(); return; }
  minutes = value; customDuration = true; dialog = null; render(); document.querySelector('[data-action=custom]')?.focus();
});
document.addEventListener('keydown', event => {
  if (state.session) {
    if (event.key === 'Tab') {
      const first = document.querySelector('[data-action=pause]'); const last = document.querySelector('[data-action=finish]');
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    }
    return;
  }
  if (!dialog) return;
  if (event.key === 'Escape') { dialog = null; render(); returnFocus(); }
  if (event.key === 'Tab') {
    const buttons = [...document.querySelectorAll('.modal button:not(:disabled), .modal input:not(:disabled)')];
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
