const leaf = (x, y, angle = 0, size = 1, color = '#567e4b') => `<path d="M0 0C-34-3-43-39-39-43C-10-48 8-20 0 0Z" fill="${color}" transform="translate(${x} ${y}) rotate(${angle}) scale(${size})"/><path d="m0 0-29-33" stroke="#edf0cd" stroke-width="1.2" opacity=".35" transform="translate(${x} ${y}) rotate(${angle}) scale(${size})"/>`;
const flower = (x, y, color, scale = 1) => `<g transform="translate(${x} ${y}) scale(${scale})">${Array.from({ length: 8 }, (_, i) => `<ellipse cy="-13" rx="6" ry="12" fill="${color}" transform="rotate(${i * 45})"/>`).join('')}<circle r="9" fill="#805333"/><circle r="5" fill="#a87536"/></g>`;
const fruit = (x, y, strawberry = false) => `<g transform="translate(${x} ${y})">${strawberry ? '<path d="M-13-6Q-19 5 0 24Q19 5 13-6Q5-12 0-7Q-6-12-13-6Z" fill="#c65151"/><path d="m-7 0 1 2m8 0 1 2m-7 5 1 2m7 0 1 2m-6 5 1 2" stroke="#f7ce82" stroke-width="2"/>' : '<path d="M0-10C-29-23-32 22-8 26C-2 28 5 28 11 24C33 12 22-22 0-10Z" fill="#c64e37"/><ellipse cx="-10" cy="0" rx="4" ry="7" fill="#ef9b72" opacity=".7"/>'}<path d="m0-5-10-9 9 3 2-9 3 9 10-3-10 9Z" fill="#436d3c"/></g>`;
function foliage(id, stage) {
  if (stage === 0) return '<g class="seed-effort"><path d="M150 238v-22" stroke="#7d9b61" stroke-width="3" fill="none"/><path d="M150 225q-15-1-14-13 14 0 14 13m0-4q0-13 12-13 2 12-12 13" fill="#91ad75"/></g><path d="M145 239q5-9 10 0" fill="none" stroke="#bca070" stroke-width="3"/><circle cx="157" cy="235" r="2" fill="#d7ba8b"/>';
  if (stage === 1) return `<path d="M150 238V203" stroke="#597642" stroke-width="4" fill="none"/>${leaf(150, 213, -20, .55)}${leaf(150, 206, 95, .48, '#7e9b56')}`;
  if (id === 'cactus') {
    return `<path d="M129 238V163a21 21 0 0 1 42 0v75" fill="#73926a"/><path d="M143 237V161m15 76v-77" stroke="#adc392" stroke-width="3" fill="none"/>${stage >= 3 ? '<path d="M132 214h-14q-13 0-13-14v-17a9 9 0 0 1 18 0v13h9m35 4h15v-25a9 9 0 0 1 18 0v29q0 14-17 14h-16" fill="#84a074"/>' : ''}<path d="m129 173-5-2m6 19-5 2m47-17 5-2m-5 25 5 2m-27-35 3 2m-3 17 3 2m-3 20 3 2m-3 18 3 2" stroke="#e7e6b9" stroke-width="2"/>${stage === 4 ? flower(151, 145, '#d898a2', .75) : ''}`;
  }
  if (id === 'mint') {
    return `<path d="M150 239V143m0 67-28-30m28 23 27-37" stroke="#588257" stroke-width="4" fill="none"/>${[0,1,2].map(i => leaf(149, 226-i*30, -15, .7-i*.1, '#5f905f') + leaf(151, 221-i*30, 105, .75-i*.1, '#88a975')).join('')}${stage >= 3 ? leaf(124, 183, -20, .7, '#6c9d6b') + leaf(176, 174, 100, .8, '#739969') : ''}${stage === 4 ? leaf(150, 150, 20, .6, '#a4bb7a') + leaf(126, 219, -65, .65) : ''}`;
  }
  if (id === 'lavender') {
    return `${[[-30,160],[-14,130],[5,115],[24,143],[38,171]].map(([dx,y],i) => `<path d="M150 240Q${150+dx} 210 ${150+dx} ${y}" stroke="#789274" stroke-width="3" fill="none"/>${leaf(150+dx*.6, 210, dx < 0 ? -20 : 100, .5, '#91a18a')}${stage >= 3 ? `<g transform="translate(${150+dx} ${y})">${Array.from({length:stage === 4 ? 5 : 2},(_,j) => `<ellipse cx="${j%2 ? 3 : -3}" cy="${-j*7}" rx="6" ry="8" fill="${i%2 ? '#a18db3' : '#86739e'}"/>`).join('')}</g>` : ''}`).join('')}`;
  }
  if (id === 'daisy') {
    return `${leaf(150,235,-25,.85,'#7e9a68')}${leaf(152,234,105,.9,'#8da573')}${[[120,157],[158,128],[188,178]].map(([x,y]) => `<path d="M150 239Q${x-12} 200 ${x} ${y}" stroke="#799267" stroke-width="3" fill="none"/>${stage === 4 ? flower(x,y,'#fffdf2',.9).replaceAll('#805333','#d5ad51').replaceAll('#a87536','#ebc765') : stage === 3 ? `<ellipse cx="${x}" cy="${y}" rx="7" ry="10" fill="#97a275"/>` : ''}`).join('')}`;
  }
  if (id === 'monstera') {
    return `<g stroke="#496540" stroke-width="4" fill="none"><path d="M150 239Q135 171 113 145M150 239Q178 187 201 132M150 239V109"/></g>${leaf(150, 122, 15, 1.3, '#385f43')}${leaf(120, 163, -35, 1.55)}${leaf(180, 170, 100, 1.6, '#668b56')}${stage > 2 ? '<g stroke="#c9d4a7" stroke-width="5" stroke-linecap="round"><path d="m85 134 17 4m-15 8 20 4m99-35-14 15m20-1-13 13m-65-42 13 7m-12 7 14 7"/></g>' : ''}${stage === 4 ? leaf(150, 215, 80, 1.2, '#345a3b') + leaf(139, 212, -40, 1.1, '#78964e') : ''}`;
  }
  if (id === 'strawberry') {
    return `<path d="M150 240V175m0 52-37-35m37 26 34-39" fill="none" stroke="#547244" stroke-width="4"/>${leaf(150, 190, 38, 1)}${leaf(140, 211, -42, .95)}${leaf(167, 204, 102, 1)}${leaf(146, 227, -80, .75, '#78964e')}${stage >= 3 ? flower(124, 180, '#fffbed', .6) + flower(183, 172, '#fffbed', .5) : ''}${stage === 4 ? '<path d="M165 203q34-16 34 22M131 218q-34-18-31 19" stroke="#698447" stroke-width="3" fill="none"/>' + fruit(199, 230, true) + fruit(100, 243, true) : ''}`;
  }
  const top = id === 'sunflower' ? 86 : 126;
  return `<path d="M150 239V${top}M150 186l-30-25M150 163l32-24" fill="none" stroke="#567442" stroke-width="5" stroke-linecap="round"/>${leaf(148, 211, -30, .9)}${leaf(151, 188, 100, .9, '#78964e')}${leaf(129, 168, -8, .7)}${leaf(175, 145, 105, .65, '#6b8b4d')}${id === 'sunflower' ? (stage === 3 ? '<ellipse cx="150" cy="91" rx="17" ry="22" fill="#7d9142"/><path d="m143 99 7-27 5 28" fill="#c6a144"/>' : stage === 4 ? flower(150, 87, '#e5b747', 1.65) : leaf(150, 113, 40, .6)) : (stage >= 3 ? flower(149, 119, '#e6bf53', .45) + flower(191, 136, '#e6bf53', .35) : '') + (stage === 4 ? fruit(120, 188) + fruit(182, 170) : '')}`;
}
export function plantArt(id, stage = 0, scene = false) {
  return `<svg viewBox="0 0 300 330" aria-hidden="true" class="plant-art">${scene ? '<path class="scene-sky" d="M42 265V102a108 108 0 0 1 216 0v163Z" fill="#e6ead6"/><path d="M50 255V104a100 100 0 0 1 200 0v151M150 5v239M46 130h208" fill="none" stroke="#f8f7ee" stroke-width="8"/><circle class="scene-sun" cx="221" cy="62" r="28" fill="#f1d8a0"/><path d="M48 235q47-76 110-15t94-28v68H48Z" fill="#d8dfc3"/><path d="M20 277h260" stroke="#d5cdb6" stroke-width="3" stroke-linecap="round"/>' : ''}<ellipse cx="150" cy="310" rx="69" ry="9" fill="#384326" opacity=".09"/><path d="m109 246 11 53q30 15 60 0l11-53Z" fill="#c37b54"/><path d="m119 249 10 48q9 6 17 7l-3-55Z" fill="#d99970"/><path d="m177 249-7 54 10-4 11-53Z" fill="#a85e40"/><rect x="104" y="237" width="92" height="17" rx="5" fill="#d49169"/><ellipse cx="150" cy="238" rx="43" ry="7" fill="#745437"/><g class="living-foliage">${foliage(id, stage)}</g><path d="M133 273h34" stroke="#e9be96" stroke-width="2" stroke-linecap="round" opacity=".5"/></svg>`;
}
export const icons = {
  play: '<path d="m9 5 11 7-11 7Z"/>',
  stop: '<rect x="6" y="6" width="12" height="12" rx="2"/>',
  pause: '<path d="M8 5v14M16 5v14"/>',
  expand: '<path d="M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5"/>',
  collapse: '<path d="M3 8h5V3m8 0v5h5M8 21v-5H3m13 5v-5h5"/>',
  moon: '<path d="M20 14A8 8 0 0 1 10 4a8 8 0 1 0 10 10Z"/>',
  timer: '<circle cx="12" cy="13" r="8"/><path d="M9 2h6m-3 7v5l3 2"/>',
  garden: '<path d="M12 19V9m0 5C4 14 3 9 4 5c6-1 9 3 8 9Zm0-4c0-5 4-7 8-6 1 5-2 8-8 8M5 21h14"/>',
  book: '<path d="M12 5c-3-2-6-2-9-1v15c3-1 6-1 9 1 3-2 6-2 9-1V4c-3-1-6-1-9 1Zm0 0v15"/>',
  arrow: '<path d="M5 12h14m-5-5 5 5-5 5"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l2 2m10 10 2 2M5 19l2-2M17 7l2-2"/>',
  check: '<path d="m5 12 4 4L19 6"/>',
  lock: '<rect x="5" y="10" width="14" height="11" rx="3"/><path d="M8 10V7a4 4 0 0 1 8 0v3m-4 4v3"/>',
};
export const icon = name => `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[name] || icons.garden}</svg>`;
