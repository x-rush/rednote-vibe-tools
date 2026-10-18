/* Small offline fallbacks for this game's structured data, loaded before the app. */
(function (root) {
  if (typeof root.globalThis === 'undefined') root.globalThis = root;
  function method(target, name, value) { if (!target[name]) Object.defineProperty(target, name, {value: value, configurable: true, writable: true}); }
  method(Array.prototype, 'at', function (index) { var n = Math.trunc(Number(index) || 0); return this[n < 0 ? this.length + n : n]; });
  method(Array.prototype, 'flat', function (depth) {
    var result = [], level = depth === undefined ? 1 : Math.max(0, Math.trunc(Number(depth) || 0));
    function append(array, remaining) { array.forEach(function (item) { if (remaining > 0 && Array.isArray(item)) append(item, remaining - 1); else result.push(item); }); }
    append(this, level); return result;
  });
  method(Array.prototype, 'flatMap', function (callback, receiver) { return this.map(callback, receiver).flat(); });
  method(Object, 'fromEntries', function (entries) { var result = {}; for (var entry of entries) Object.defineProperty(result, entry[0], {value: entry[1], enumerable: true, writable: true, configurable: true}); return result; });
  // The game clones plain structured records, arrays and undefined fields, not media.
  method(root, 'structuredClone', function (value) {
    var seen = new Map();
    function copy(item) {
      if (!item || typeof item !== 'object') return item;
      if (seen.has(item)) return seen.get(item);
      var result = Array.isArray(item) ? [] : {}; seen.set(item, result);
      Object.keys(item).forEach(function (key) { Object.defineProperty(result, key, {value: copy(item[key]), enumerable: true, writable: true, configurable: true}); });
      return result;
    }
    return copy(value);
  });
})(typeof globalThis !== 'undefined' ? globalThis : window);
(function () {
  function detectLayout() {
    var probe = document.createElement('div');
    probe.style.cssText = 'position:absolute;visibility:hidden;display:flex;flex-direction:column;row-gap:1px';
    probe.appendChild(document.createElement('div')); probe.appendChild(document.createElement('div'));
    document.body.appendChild(probe);
    if (probe.scrollHeight !== 1) document.documentElement.classList.add('no-flex-gap');
    document.body.removeChild(probe);
    if (!window.CSS || !CSS.supports('top', 'env(safe-area-inset-top)')) {
      var current = getComputedStyle(document.documentElement).getPropertyValue('--safe-area-inset-top');
      if (!current.trim() || current.indexOf('env(') >= 0) document.documentElement.style.setProperty('--safe-area-inset-top', '0px');
    }
  }
  if (typeof document !== 'undefined') {
    if (document.body) detectLayout(); else document.addEventListener('DOMContentLoaded', detectLayout, {once:true});
  }
})();
