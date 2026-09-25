import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const script = readFileSync(new URL('../src/storage.js', import.meta.url), 'utf8');

function loadStorage(xhs, initial = {}) {
  const values = new Map(Object.entries(initial));
  const root = {
    xhs,
    localStorage: {
      getItem(key) { return values.has(key) ? values.get(key) : null; },
      setItem(key, value) { values.set(key, value); },
    },
  };
  root.window = root;
  vm.runInNewContext(script, root);
  return { storage: root.StoryStorage, values };
}

test('new client migrates an existing browser save to the native store', async () => {
  const written = [];
  const xhs = {
    launchOptions: { miniToolEnv: { buildVersion: 9460001 } },
    miniTool: {
      getStorage: async () => ({ data: null }),
      setStorage: async (entry) => { written.push(entry); },
    },
  };
  const { storage } = loadStorage(xhs, { story: '{"beat":3}' });
  const adapter = await storage.create('story');
  assert.equal(adapter.native(), true);
  assert.equal(await adapter.read(), '{"beat":3}');
  assert.deepEqual(JSON.parse(JSON.stringify(written)), [{ key: 'story', data: '{"beat":3}' }]);
  assert.equal(await adapter.write({ beat: 4 }), true);
  assert.deepEqual(JSON.parse(JSON.stringify(written[1])), { key: 'story', data: '{"beat":4}' });
});

test('older and unknown clients keep the guarded browser fallback', async () => {
  const xhs = {
    launchOptions: { miniToolEnv: { buildVersion: 9459009 } },
    miniTool: {
      getStorage() { throw Error('native store should not be used'); },
      setStorage() { throw Error('native store should not be used'); },
    },
  };
  const { storage, values } = loadStorage(xhs, { story: '{"beat":1}' });
  const adapter = await storage.create('story');
  assert.equal(adapter.native(), false);
  assert.equal(await adapter.read(), '{"beat":1}');
  assert.equal(await adapter.write({ beat: 2 }), true);
  assert.equal(values.get('story'), '{"beat":2}');
});

test('native saves are serialized in choice order and failures are reported', async () => {
  const writes = [];
  let fail = false;
  const xhs = {
    miniTool: {
      getLaunchOptions: async () => ({ miniToolEnv: { buildVersion: 9462004 } }),
      getStorage: async () => ({ data: '{"beat":0}' }),
      setStorage: async ({ data }) => {
        if (fail) throw Error('storage unavailable');
        await new Promise((resolve) => setTimeout(resolve, 2));
        writes.push(JSON.parse(data).beat);
      },
    },
  };
  const { storage, values } = loadStorage(xhs);
  const adapter = await storage.create('story');
  assert.equal(await adapter.read(), '{"beat":0}');
  await Promise.all([adapter.write({ beat: 1 }), adapter.write({ beat: 2 })]);
  assert.deepEqual(writes, [1, 2]);
  fail = true;
  assert.equal(await adapter.write({ beat: 3 }), false);
  assert.equal(adapter.native(), false);
  assert.equal(await adapter.write({ beat: 4 }), true);
  assert.equal(values.get('story'), '{"beat":4}');
});
