import {validSavedOutline,toppingFits} from './contour.js';
export const clamp = (x, lo = 0, hi = 1) => Math.max(lo, Math.min(hi, x));
export const smooth = x => { x = clamp(x); return x * x * (3 - 2 * x); };
export function sampleUnmold(progress) {
  const p = clamp(progress);
  const lift = smooth((p - .08) / .42);
  const exit = smooth((p - .51) / .33);
  const attachment = Math.sin(clamp((p - .08) / .41) * Math.PI);
  const jellyLift = p < .30 ? smooth((p-.08)/.22)*.68 : .68*(1-clamp((p-.30)/.19)**2);
  const elapsed = Math.max(0, (p - .49) * 5.8);
  return { moldY: lift * 2.9 + exit * .65, moldX: exit * 2.25, moldAngle: exit * .58,
    moldOpacity: 1 - smooth((p - .7) / .25), jellyLift,
    stretch: attachment * .23, bounce: p < .49 ? 0 : -Math.sin(elapsed * 15) * Math.exp(-elapsed * 2.5) * .19,
    camera: Math.sin(p * Math.PI) * .55, complete: p >= 1 };
}
export function pokeWave(age, height, distance) {
  if (age < 0 || age > 2.5) return 0;
  return Math.sin(age * 19 - height * 3.2 - distance * 2.4) * Math.exp(-age * 2.3) * Math.exp(-distance * .7) * .105 * (.25 + height * .75);
}
export function cleanCollection(raw, flavorIds, limit = 18) {
  if (!Array.isArray(raw)) return [];
  const seen = new Set();
  return raw.filter(item => item && typeof item.id === 'string' && item.id.length <= 80 && flavorIds.includes(item.flavor) && Number.isFinite(item.createdAt) && item.createdAt>=0 && item.createdAt<=8640000000000000 && !seen.has(item.id) && seen.add(item.id))
    .slice(0, limit).map(({id, flavor, createdAt}) => ({id, flavor, createdAt}));
}
export function addCollection(existing, item, flavorIds, limit = 18) {
  return cleanCollection([item, ...existing], flavorIds, limit);
}
export function mulberry32(seed) { return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

export function pourAmount(amount, seconds, layer, rules) {
  if (!Number.isFinite(seconds) || seconds <= 0) return amount;
  const maximum = layer === 1 ? rules.maxFirst : 1;
  const next = clamp(amount + seconds * rules.pourRate, 0, maximum);
  return maximum - next < 1e-9 ? maximum : next;
}
export function cleanRecipe(raw, content) {
  if (!raw || !(raw.mold==='custom'||content.molds.some(m => m.id === raw.mold)) ||
      !content.flavors.some(f => f.id === raw.first) || !content.flavors.some(f => f.id === raw.second) ||
      !Number.isFinite(raw.split) || raw.split < content.craft.minFirst || raw.split > content.craft.maxFirst) return null;
  const outline=raw.mold==='custom'?validSavedOutline(raw.outline,content.customRules):null;
  if(raw.mold==='custom'&&!outline)return null;
  const toppings = Array.isArray(raw.toppings) ? raw.toppings.filter(t => t &&
    content.toppings.some(kind => kind.id === t.kind) && Number.isFinite(t.x) && Number.isFinite(t.z) &&
    toppingFits({...raw,outline},t,content)).slice(0, content.craft.maxToppings)
    .map(({kind,x,z}) => ({kind,x,z})) : [];
  return {mold:raw.mold,first:raw.first,second:raw.second,split:raw.split,toppings,...(outline?{outline}: {})};
}
export function cleanRecipeCollection(raw, content) {
  const base = cleanCollection(raw, content.flavors.map(f => f.id), content.limits.collection);
  return base.flatMap(item => {
    const original = raw.find(x => x?.id === item.id);
    const recipe = original.recipe ? cleanRecipe(original.recipe, content) :
      {mold:content.molds[0].id,first:item.flavor,second:item.flavor,split:.5,toppings:[]};
    return recipe ? [{...item,recipe}] : [];
  });
}

// Map a circular cross-section onto a closed, locally authored mold outline.
export function moldPoint(angle, radius, mold) {
  // Close the polar seam exactly; tiny cos(PI / 2) residues make central rays
  // miss triangles which visually share the same edge.
  const snap = value => Math.abs(value) < 1e-7 ? 0 : value;
  if (mold === 'heart') return {
    x: snap(radius * Math.sin(angle) ** 3),
    z: snap(-radius * (13*Math.cos(angle)-5*Math.cos(2*angle)-2*Math.cos(3*angle)-Math.cos(4*angle))/17)
  };
  const ribs = mold === 'star' ? .84 + .16*Math.cos(angle*5) : 1 + .065*Math.cos(angle*12);
  return {x:snap(Math.cos(angle)*radius*ribs),z:snap(Math.sin(angle)*radius*ribs)};
}
