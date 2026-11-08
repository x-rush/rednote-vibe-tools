/*
 * 蛋落地 · 本地存储回归
 *
 * 覆盖一个真实缺陷：容器 Storage API 不可用时（低版本客户端 / 非小红书容器），
 * 降级到 localStorage。原实现的写入与读取编码不成对（写裸值、读也拿裸串），
 * 与容器 Storage API 路径返回的类型不一致，且一旦改成存对象就会退化。
 * 现在两条路径统一为「写 JSON、读时成对解析」。
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
  return global.EggStorage;
}

test('localStorage 降级路径：写入是 JSON，下一次启动能读回原始值', async () => {
  const store = installLocalStorage();
  delete global.xhs;

  const first = freshStorage();
  await first.loaded;
  assert.ok(await first.write('egg-best-score', 1234), '写入应该成功');
  assert.strictEqual(store['egg-best-score'], '1234', '落盘内容应该是 JSON 数字');

  const second = freshStorage();
  await second.loaded;
  const value = second.read('egg-best-score');
  assert.strictEqual(value, 1234, '读回来应该是数字 1234');
  assert.strictEqual(Number(value), 1234, 'Number() 也应该拿到 1234');
});

test('localStorage 降级路径：静音标记能原样往返', async () => {
  installLocalStorage();
  delete global.xhs;

  const first = freshStorage();
  await first.loaded;
  await first.write('egg-muted', 'true');

  const second = freshStorage();
  await second.loaded;
  const value = second.read('egg-muted');
  assert.ok(value === true || value === 'true', '静音标记应该读回可用的真值，实际：' + JSON.stringify(value));
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
  assert.strictEqual(storage.read('egg-best-score'), null, '读不到应该返回 null 而不是抛错');
  assert.strictEqual(await storage.write('egg-best-score', 1), false, '写不了应该返回 false 而不是抛错');
});
