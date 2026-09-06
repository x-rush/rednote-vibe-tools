export const STORAGE_KEY = 'tomato-garden-v1';
export function freshState() {
  return { version: 1, selected: 'tomato', progress: {}, total: 0, records: [], collection: [], session: null };
}
export function stageOf(plant, minutes) {
  return plant.stages.reduce((stage, item, index) => minutes >= item.at ? index : stage, 0);
}
export function remaining(session, now) {
  if (!session) return 0;
  return Math.max(0, session.status === 'paused' ? session.left : Math.min(session.duration, session.end - now));
}
export function startSession(state, { id, minutes, task, mode = 'focus', now }) {
  if (state.session) return state;
  return { ...state, session: { id, plantId: state.selected, task, mode, duration: minutes * 60000, left: minutes * 60000, end: now + minutes * 60000, status: 'running' } };
}
export function togglePause(state, now) {
  const session = state.session;
  if (!session) return state;
  const left = remaining(session, now);
  return { ...state, session: { ...session, left, status: session.status === 'paused' ? 'running' : 'paused', end: now + left } };
}
export function settle(state, now, plants) {
  const session = state.session;
  if (!session) return { state, result: null };
  const complete = remaining(session, now) === 0;
  if (session.mode === 'rest') return { state: { ...state, session: null }, result: { rest: true, complete } };
  if (state.records.some(record => record.id === session.id)) return { state: { ...state, session: null }, result: null };
  const minutes = Math.floor((session.duration - remaining(session, now)) / 60000);
  const plant = plants.find(item => item.id === session.plantId);
  const previous = state.progress[plant.id] || 0;
  const progress = Math.min(plant.stages.at(-1).at, previous + minutes);
  const record = { id: session.id, task: session.task, plantId: plant.id, minutes, complete, at: now };
  return { state: { ...state, session: null, total: state.total + minutes, progress: { ...state.progress, [plant.id]: progress }, records: minutes || complete ? [...state.records, record] : state.records }, result: { minutes, complete, plantId: plant.id, stage: stageOf(plant, progress) } };
}
export function collect(state, plants, now, id) {
  const plant = plants.find(item => item.id === state.selected);
  if (state.session || (state.progress[plant.id] || 0) < plant.stages.at(-1).at) return state;
  return { ...state, progress: { ...state.progress, [plant.id]: 0 }, collection: [...state.collection, { id, plantId: plant.id, at: now, minutes: plant.stages.at(-1).at }] };
}
export function localDay(timestamp) {
  const date = new Date(timestamp);
  return `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
}
export function restore(raw, plants) {
  const state = JSON.parse(raw);
  const ids = plants.map(plant => plant.id);
  const number = value => Number.isFinite(value) && value >= 0;
  if (!state || state.version !== 1 || !ids.includes(state.selected) || !number(state.total) || !state.progress || !Array.isArray(state.records) || !Array.isArray(state.collection)) throw Error('Invalid state');
  if (plants.find(p => p.id === state.selected).unlock > state.total) throw Error('Locked plant');
  for (const [id, value] of Object.entries(state.progress)) if (!ids.includes(id) || !number(value) || value > plants.find(p => p.id === id).stages.at(-1).at) throw Error('Invalid progress');
  for (const record of state.records) if (!ids.includes(record.plantId) || typeof record.id !== 'string' || typeof record.task !== 'string' || !number(record.minutes) || !number(record.at) || typeof record.complete !== 'boolean') throw Error('Invalid record');
  for (const item of state.collection) if (!ids.includes(item.plantId) || typeof item.id !== 'string' || !number(item.at) || !number(item.minutes)) throw Error('Invalid collection');
  const s = state.session;
  if (s && (!ids.includes(s.plantId) || !['focus', 'rest'].includes(s.mode) || !['running', 'paused'].includes(s.status) || !number(s.duration) || s.duration === 0 || !number(s.left) || s.left > s.duration || !number(s.end) || typeof s.id !== 'string' || typeof s.task !== 'string')) throw Error('Invalid session');
  return state;
}
