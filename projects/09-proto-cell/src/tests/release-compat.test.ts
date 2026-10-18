import { readFileSync } from 'node:fs'
import { runInNewContext } from 'node:vm'
import { expect, it } from 'vitest'

it('starts with only the local runtime helpers actually used by the game', () => {
  const result = runInNewContext(`
    Object.fromEntries=undefined; Array.prototype.at=undefined;
    Array.prototype.flat=undefined; Array.prototype.flatMap=undefined;
    this.structuredClone=undefined; this.globalThis=undefined; this.window=this;
    ${readFileSync('public/compat.js','utf8')}
    const old={body:{radius:4}, optional:undefined}; const copy=structuredClone(old); copy.body.radius=7;
    [globalThis===window, [1,2].at(-1), [1,2].flatMap(x=>[x,x]).length,
      [[1],,[2]].flat().join(','),Object.fromEntries([['a',2]]).a,old.body.radius,copy.optional];
  `)
  expect(Array.from(result)).toEqual([true,2,4,'1,2',2,4,undefined])
})
