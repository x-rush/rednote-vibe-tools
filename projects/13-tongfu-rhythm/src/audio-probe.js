(function () {
  'use strict';
  var C = window.PROBE, ctx, buffer, source, offset = 0, origin = 0, playing = false, busy = false, frame = 0, epoch = 0;
  var $ = function (id) { return document.getElementById(id); };
  ['title', 'intro', 'play', 'pause', 'restart', 'hint'].forEach(function (id) { $(id).textContent = C[id]; });
  document.title = C.title;
  function log(message) { $('log').textContent = (message + '\n' + $('log').textContent).slice(0, 4000); }
  function status(key) { $('state').textContent = C[key]; $('state').setAttribute('data-state', key); }
  function position() { return playing ? Math.min(buffer.duration, Math.max(0, ctx.currentTime - origin)) : offset; }
  function render() { $('clock').textContent = position().toFixed(2) + ' s'; if (playing) frame = requestAnimationFrame(render); }
  function stop() { if (source) { source.onended = null; try { source.stop(); } catch (e) {} source.disconnect(); source = null; } playing = false; cancelAnimationFrame(frame); }
  function pause() { epoch++; if (playing) offset = position(); stop(); render(); $('pause').disabled = true; status('paused'); }
  function timeout(promise) { return new Promise(function (resolve, reject) { var timer = setTimeout(function () { reject(new Error(C.timeout)); }, 8000); promise.then(function (value) { clearTimeout(timer); resolve(value); }, function (error) { clearTimeout(timer); reject(error); }); }); }
  async function play(restart) {
    if (busy) return;
    busy = true; $('play').disabled = true; $('restart').disabled = true;
    var token = ++epoch;
    try {
      if (!ctx) {
        var Audio = window.AudioContext || window.webkitAudioContext;
        if (!Audio) throw new Error(C.unavailable);
        ctx = new Audio();
        ctx.onstatechange = function () { log('AudioContext: ' + ctx.state); if (ctx.state !== 'running' && playing) pause(); };
      }
      var resumed = timeout(ctx.resume());
      if (!buffer) {
        status('decoding');
        var raw = atob(window.PROBE_AUDIO), bytes = new Uint8Array(raw.length);
        for (var i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
        var decoded = new Promise(function (resolve, reject) { ctx.decodeAudioData(bytes.buffer, resolve, reject); });
        var results = await Promise.all([resumed, timeout(decoded)]);
        buffer = results[1];
        window.PROBE_AUDIO = null;
        log(C.decoded + ': ' + buffer.duration.toFixed(3) + ' s / ' + buffer.sampleRate + ' Hz / ' + buffer.numberOfChannels + ' ch');
      } else await resumed;
      if (token !== epoch || document.hidden) return;
      if (ctx.state !== 'running') throw new Error(C.resumeFailed);
      if (playing) offset = position();
      stop();
      if (restart || offset >= buffer.duration) offset = 0;
      source = ctx.createBufferSource(); source.buffer = buffer; source.connect(ctx.destination);
      source.onended = function () { offset = buffer.duration; stop(); render(); $('pause').disabled = true; status('ended'); log(C.ended); };
      origin = ctx.currentTime - offset; source.start(0, offset); playing = true;
      $('pause').disabled = false; status('playing'); log(C.playing); render();
    } catch (error) { stop(); $('pause').disabled = true; status('failed'); log((error.name || 'Error') + ': ' + error.message); }
    finally { busy = false; $('play').disabled = false; $('restart').disabled = !buffer; }
  }
  $('play').addEventListener('click', function () { play(false); });
  $('restart').addEventListener('click', function () { play(true); });
  $('pause').addEventListener('click', pause);
  document.addEventListener('visibilitychange', function () { if (document.hidden) pause(); });
  window.addEventListener('pagehide', function () { pause(); if (ctx) ctx.suspend().catch(function () {}); });
  status('ready'); log(C.initial);
}());
