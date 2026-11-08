/*
 * 彩沙瓶 · 本地存储回归
 *
 * 覆盖一个真实缺陷：容器 Storage API 不可用时（低版本客户端 / 非小红书容器），
 * 降级到 localStorage。原实现写入时做了 JSON 序列化、读取时却没有成对解析，
 * 两条路径返回的类型不一致。现在统一为「写 JSON、读时成对解析」。
 */
import test from 'node:test';
import assert from 'node:assert';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const STORAGE_PATH = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
  'src',
  'storage.js'
);

function installLocalStorage() {
  const store = {};
  global.localStorage = {
    getItem(key) {
      return Object.prototype.hasOwnProperty.call(store, key) ? store[key] : null;
    },
    setItem(key, value) {
      store[key] = String(value);
    },
    removeItem(key) {
      delete store[key];
    }
  };
  return store;
}

/* 重新加载一份全新的 storage 实例（模拟下一次启动） */
function freshStorage() {
  delete require.cache[require.resolve(STORAGE_PATH)];
  require(STORAGE_PATH);
  return global.SandStorage;
}

test('localStorage 降级路径：写入是 JSON，下一次启动能读回原始值', async () => {
  const store = installLocalStorage();
  delete global.xhs;

  const first = freshStorage();
  await first.loaded;
  assert.ok(await first.write('sand-best-score', 1234), '写入应该成功');
  assert.strictEqual(store['sand-best-score'], '1234', '落盘内容应该是 JSON 数字');

  const second = freshStorage();
  await second.loaded;
  const value = second.read('sand-best-score');
  assert.strictEqual(value, 1234, '读回来应该是数字 1234');
  assert.strictEqual(Number(value), 1234, 'Number() 也应该拿到 1234');
});

test('localStorage 降级路径：静音标记能原样往返', async () => {
  installLocalStorage();
  delete global.xhs;

  const first = freshStorage();
  await first.loaded;
  await first.write('sand-muted', 1);

  const second = freshStorage();
  await second.loaded;
  assert.strictEqual(second.read('sand-muted'), 1, '静音标记应该读回数字 1');
});

test('存储不可用时也不能抛异常（容器不允许时静默降级）', async () => {
  installLocalStorage();
  delete global.xhs;
  global.localStorage.getItem = () => {
    throw new Error('storage disabled');
  };
  global.localStorage.setItem = () => {
    throw new Error('storage disabled');
  };

  const storage = freshStorage();
  await storage.loaded;
  assert.strictEqual(storage.read('sand-best-score'), null, '读不到应该返回 null 而不是抛错');
  assert.strictEqual(await storage.write('sand-best-score', 1), false, '写不了应该返回 false 而不是抛错');
});
