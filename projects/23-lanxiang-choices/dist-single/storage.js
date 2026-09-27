(function (root) {
  'use strict';
  var MIN_STORAGE_CLIENT = 9460;

  function buildVersion(options) {
    var env = options && options.miniToolEnv;
    return Number(env && env.buildVersion) || 0;
  }
  function clientVersion(version) { return Math.floor(version / 1000); }
  function getVersion() {
    var xhs = root.xhs, syncVersion = buildVersion(xhs && xhs.launchOptions);
    if (syncVersion) return Promise.resolve(syncVersion);
    var bridge = xhs && xhs.miniTool;
    if (!bridge || typeof bridge.getLaunchOptions !== 'function') return Promise.resolve(0);
    return Promise.resolve().then(function () { return bridge.getLaunchOptions(); }).then(buildVersion, function () { return 0; });
  }
  function localRead(key) {
    try { return root.localStorage.getItem(key); } catch (error) { return null; }
  }
  function localWrite(key, data) {
    try { root.localStorage.setItem(key, data); return true; } catch (error) { return false; }
  }
  function create(key) {
    return getVersion().then(function (version) {
      var bridge = root.xhs && root.xhs.miniTool;
      var native = clientVersion(version) >= MIN_STORAGE_CLIENT && bridge &&
        typeof bridge.getStorage === 'function' && typeof bridge.setStorage === 'function';
      var pending = Promise.resolve();
      function read() {
        if (!native) return Promise.resolve(localRead(key));
        return Promise.resolve().then(function () { return bridge.getStorage({ key: key }); }).then(function (result) {
          if (result && typeof result.data === 'string') return result.data;
          var legacy = localRead(key);
          if (legacy === null) return null;
          return Promise.resolve().then(function () { return bridge.setStorage({ key: key, data: legacy }); }).then(function () {
            return legacy;
          }, function () {
            native = false;
            return legacy;
          });
        }, function () {
          native = false;
          return localRead(key);
        });
      }
      function write(value) {
        var data;
        try { data = JSON.stringify(value); } catch (error) { return Promise.resolve(false); }
        if (typeof data !== 'string') return Promise.resolve(false);
        if (!native) return Promise.resolve(localWrite(key, data));
        pending = pending.then(function () {
          if (!native) return localWrite(key, data);
          return Promise.resolve().then(function () { return bridge.setStorage({ key: key, data: data }); }).then(function () {
            return true;
          }, function () {
            native = false;
            localWrite(key, data);
            return false;
          });
        });
        return pending;
      }
      return { read: read, write: write, native: function () { return !!native; } };
    });
  }
  root.StoryStorage = { create: create, clientVersion: clientVersion };
}(window));
