import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, statSync } from 'node:fs';
import '../src/flow.js';

const root = new URL('../', import.meta.url);
const html = readFileSync(new URL('index.html', root), 'utf8');
const script = readFileSync(new URL('src/sketch.js', root), 'utf8');

test('the artwork includes a local p5 runtime and no runtime CDN', () => {
  assert.match(html, /vendor\/p5\.min\.js/);
  assert.ok(statSync(new URL('vendor/p5.min.js', root)).size > 500_000);
  assert.doesNotMatch(script, /loadImage|reference-early|reference-full|drawReference|concealWatermark/);
  assert.doesNotMatch(readFileSync(new URL('tools.mjs', root), 'utf8'), /reference-early|reference-full/);
  assert.doesNotMatch(html, /https?:\/\//);
});

test('procedural streams stay finite, continuous and span a broad moon source', () => {
  for(const seed of [1,38,974]) {
    const streams=globalThis.MoonFlow.create(seed);
    const source=streams.filter(s=>s.points[0][1]<440).map(s=>s.points[0][0]);
    assert.ok(Math.max(...source)-Math.min(...source)>55);
    for(const stream of streams) {
      assert.ok(stream.points.length>2);
      for(let i=0;i<stream.points.length;i++) {
        const point=stream.points[i];assert.ok(point.every(Number.isFinite));
        assert.ok(point[2]>=0 && point[2]<=1);
        if(i)assert.ok(point[2]>=stream.points[i-1][2], 'water arrival must progress downstream');
        if(i)assert.ok(Math.hypot(point[0]-stream.points[i-1][0],point[1]-stream.points[i-1][1])<20);
      }
    }
  }
});

test('the scene uses an interactive staged film and respects reduced motion', () => {
  assert.match(script, /prefers-reduced-motion: reduce/);
  assert.match(script, /trigger\.addEventListener\('click', startFilm\)/);
  assert.match(script, /PULLBACK_END = 3\.4/);
  assert.match(script, /MOON_END = 6\.5/);
  assert.match(script, /WATER_START = 7\.1/);
  assert.match(script, /if \(started\)/);
  assert.match(script, /artwork\.noLoop\(\)/);
  assert.match(script, /artwork\.loop\(\)/);
});

test('the main channel descends without repeated horizontal switchbacks', () => {
  const route=globalThis.MoonFlow.route;
  let horizontal=0;
  for(let i=1;i<route.length;i++){
    assert.ok(route[i][1]>route[i-1][1], 'the river must not climb uphill');
    horizontal+=Math.abs(route[i][0]-route[i-1][0]);
  }
  const displacement=Math.abs(route.at(-1)[0]-route[0][0]);
  assert.ok(horizontal/displacement<1.25, 'avoid repeated left-right detours');
});

test('every side branch flows out of view before the reveal finishes', () => {
  for(const seed of [1,38,974]) {
    const branches=globalThis.MoonFlow.create(seed).filter(s=>s.branch);
    assert.ok(branches.length>0);
    for(const branch of branches) {
      const last=branch.points.at(-1);
      assert.ok(last[0]<-20 || last[0]>920 || last[1]>1220, 'a side branch must exit the canvas');
      assert.ok(last[2]+branch.delay<.999, 'the outlet must be reached without a final-frame jump');
      for(let i=1;i<branch.points.length;i++)assert.ok(branch.points[i][2]>branch.points[i-1][2], 'branch reveal must keep advancing');
    }
  }
});

test('glints follow traveled distance through differently sized path segments', () => {
  const stream={points:[[0,0,0],[0,20,.2],[80,20,1]],distances:[0,20,100],length:100};
  assert.deepEqual(globalThis.MoonFlow.sampleDistance(stream,10),[0,10,.1]);
  const halfway=globalThis.MoonFlow.sampleDistance(stream,60);
  assert.deepEqual(halfway.slice(0,2),[40,20]);
  assert.ok(Math.abs(halfway[2]-.6)<1e-12);
  assert.deepEqual(globalThis.MoonFlow.sampleDistance(stream,-4),[0,0,0]);
  assert.deepEqual(globalThis.MoonFlow.sampleDistance(stream,150),[80,20,1]);
  for(const s of globalThis.MoonFlow.create(38)){
    assert.ok(s.speed>=10 && s.speed<=24);
    assert.ok(s.length>0);
    assert.equal(s.distances.length,s.points.length);
  }
});
