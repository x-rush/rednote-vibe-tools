(function (root) {
  'use strict';
  root.StoryAudio = function (data, config, notify) {
    var context, ready = false, unlocking = null, generation = 0, cache = {}, wanted = null;
    var music = { token: 0, id: null }, voice = { token: 0, id: null }, cueTimer, pendingCue = null;
    var musicEnabled = true, voiceEnabled = true, reported = false, lastVoiceAt = -Infinity;
    function stop(channel) {
      channel.token++;
      if (channel.source) { channel.source.onended = null; try { channel.source.stop(); } catch (ignore) {} channel.source.disconnect(); channel.source = null; }
      if (channel.gain) { channel.gain.disconnect(); channel.gain = null; }
      if (channel.id) delete cache[channel.id];
      channel.id = null;
    }
    function musicLevel(duck) {
      if (!music.gain || !context) return;
      var param = music.gain.gain;
      param.cancelScheduledValues(context.currentTime);
      param.setValueAtTime(param.value, context.currentTime);
      param.linearRampToValueAtTime(config.musicVolume * (duck ? config.duckRatio : 1), context.currentTime + .2);
    }
    function cancelVoice() { clearTimeout(cueTimer); pendingCue = null; stop(voice); musicLevel(false); }
    function fail() {
      ready = false; generation++; unlocking = null; cancelVoice(); stop(music); cache = {};
      if (!reported) { reported = true; notify(config.failure); }
    }
    function decode(id) {
      if (!cache[id]) cache[id] = new Promise(function (resolve, reject) {
        try {
          if (!data[id]) throw Error('Missing audio');
          var binary = atob(data[id]), bytes = new Uint8Array(binary.length);
          for (var i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
          // Callback form also works on older webkitAudioContext implementations.
          context.decodeAudioData(bytes.buffer, resolve, reject);
        } catch (error) { reject(error); }
      });
      return cache[id];
    }
    function play(channel, id, loop, volume) {
      stop(channel); channel.id = id;
      var token = channel.token;
      decode(id).then(function (buffer) {
        if (!ready || token !== channel.token) return;
        if (!loop && Date.now() - lastVoiceAt < config.voiceGapMs) { stop(channel); return; }
        var source = context.createBufferSource(), gain = context.createGain();
        channel.source = source; channel.gain = gain;
        source.buffer = buffer; source.loop = loop;
        gain.gain.setValueAtTime(loop ? 0 : volume, context.currentTime);
        if (loop) gain.gain.linearRampToValueAtTime(volume, context.currentTime + .4);
        source.connect(gain); gain.connect(context.destination);
        source.onended = function () { if (token !== channel.token) return; stop(channel); if (!loop) musicLevel(false); };
        if (!loop) { lastVoiceAt = Date.now(); musicLevel(true); }
        source.start(0);
      }).catch(function () { if (token === channel.token) fail(); });
    }
    function reconcile() {
      var id = musicEnabled ? wanted : null;
      if (!id) { if (music.id) stop(music); return; }
      if (ready && music.id !== id) play(music, id, true, config.musicVolume);
    }
    function scheduleCue() {
      if (!ready || !voiceEnabled || !pendingCue) return;
      var cue = pendingCue; pendingCue = null;
      clearTimeout(cueTimer);
      cueTimer = setTimeout(function () { if (ready && voiceEnabled) play(voice, cue.id, false, cue.volume || config.voiceVolume); }, config.voiceDelayMs);
    }
    return {
      unlock: function () {
        if (!musicEnabled && !voiceEnabled) return;
        if (ready && context && context.state === 'running') return;
        if (unlocking) return;
        var token = generation;
        try {
          var Audio = root.AudioContext || root.webkitAudioContext;
          if (!Audio) throw Error('Audio unavailable');
          if (!context) context = new Audio();
          unlocking = Promise.resolve(context.resume()).then(function () {
            if (token !== generation) return;
            unlocking = null;
            if (context.state !== 'running') throw Error('Audio suspended');
            ready = true; reported = false; reconcile(); scheduleCue();
          }).catch(function () { if (token === generation) fail(); });
        } catch (error) { fail(); }
      },
      configure: function (musicOn, voiceOn) {
        musicEnabled = musicOn; voiceEnabled = voiceOn;
        if (!voiceOn) cancelVoice();
        reconcile();
      },
      scene: function (id, cue) {
        cancelVoice(); wanted = id; reconcile();
        if (cue && voiceEnabled) { pendingCue = cue; scheduleCue(); }
      },
      cancelVoice: cancelVoice,
      pause: function () {
        generation++; ready = false; unlocking = null; wanted = null;
        cancelVoice(); stop(music); cache = {};
        if (context && context.suspend) Promise.resolve(context.suspend()).catch(function () {});
      }
    };
  };
}(window));
