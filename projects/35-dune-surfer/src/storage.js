/*
 * 沙丘速降 · 本地存储
 * 优先使用小工具容器 Storage API（9.46+），低版本降级 localStorage。
 * 只保存结构化状态：最高分、最好成绩、静音偏好，不保存任何用户媒体。
 */
(function (root) {
  'use strict';

  var native = null;
  var ready = false;
  var cache = {};
  var KEYS = ['dune-best-score', 'dune-best-run', 'dune-muted'];
  var STORAGE_MIN_CLIENT_VERSION = 9460;

  function readBuildVersion(launchOptions) {
    var env = launchOptions && launchOptions.miniToolEnv;
    return Number(env && env.buildVersion) || 0;
  }

  async function getBuildVersion() {
    var xhs = root.xhs;
    var sync = readBuildVersion(xhs && xhs.launchOptions);
    if (sync) return sync;
    var miniTool = xhs && xhs.miniTool;
    if (!miniTool || typeof miniTool.getLaunchOptions !== 'function') return 0;
    try {
      return readBuildVersion(await miniTool.getLaunchOptions());
    } catch (error) {
      return 0;
    }
  }

  async function initialize() {
    var version = await getBuildVersion();
    var miniTool = root.xhs && root.xhs.miniTool;
    if (
      Math.floor(version / 1000) >= STORAGE_MIN_CLIENT_VERSION / 1000 &&
      miniTool &&
      typeof miniTool.getStorage === 'function' &&
      typeof miniTool.setStorage === 'function'
    ) {
      native = miniTool;
      for (var i = 0; i < KEYS.length; i++) {
        try {
          var result = await miniTool.getStorage({ key: KEYS[i] });
          cache[KEYS[i]] = result.data == null ? null : JSON.parse(result.data);
        } catch (error) {
          cache[KEYS[i]] = null;
        }
      }
    }
    ready = true;
  }

  function read(key) {
    if (cache[key] !== undefined) return cache[key];
    try {
      return localStorage.getItem(key);
    } catch (error) {
      return null;
    }
  }

  async function write(key, value) {
    await loaded;
    if (native) {
      try {
        await native.setStorage({ key: key, data: JSON.stringify(value) });
        cache[key] = value;
        return true;
      } catch (error) {
        /* 容器写入失败则降级 */
      }
    }
    try {
      localStorage.setItem(key, JSON.stringify(value));
      cache[key] = value;
      return true;
    } catch (error) {
      return false;
    }
  }

  var loaded = initialize();
  root.DuneStorage = {
    read: read,
    write: write,
    loaded: loaded,
    isReady: function () { return ready; }
  };
})(typeof window !== 'undefined' ? window : global);
