import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const source=JSON.parse(readFileSync(new URL('../src/content/content.json',import.meta.url),'utf8'));
const one=source.singleStory;
const context={window:{}};
vm.runInNewContext(readFileSync(new URL('../src/engine.js',import.meta.url),'utf8'),context);
const engine=context.window.StoryEngine;

test('single-story edition has one chapter, two complete endings and no hidden old storyline',()=>{
  assert.equal(one.chapters.length,1);
  assert.equal(one.chapters[0].id,one.defaultChapter);
  const endings=[],visited=new Set();
  function walk(path){
    const state=engine.replay(one,path,one.defaultChapter);
    visited.add(state.node);
    if(one.endings[state.node]){endings.push(state.node);return;}
    assert.ok(path.length<5,'Story should finish promptly');
    for(const choice of one.nodes[state.node].choices)walk([...path,choice.id]);
  }
  walk([]);
  assert.equal(endings.length,8);
  assert.deepEqual([...new Set(endings)].sort(),['s_end_leaf','s_end_window']);
  assert.deepEqual([...visited].sort(),[...Object.keys(one.nodes),...Object.keys(one.endings)].sort());
  const serialized=JSON.stringify(one);
  assert.doesNotMatch(serialized,/兰香|小莲|lanxiang|xiaolian|离府|秋宴|府邸|口谕|http/i);
  assert.deepEqual(Object.keys(one.audio.files),[]);
});
