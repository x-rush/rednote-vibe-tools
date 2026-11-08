/*
 * 珍珠消消乐 · 音效
 * 纯 Web Audio 合成，无外部音频文件：不产生 Base64，也不进 ZIP。
 */
(function (root) {
  'use strict';

  function createAudio() {
    var ctx = null;
    var master = null;
    var muted = false;
    var ready = false;

    function ensure() {
      if (ctx) return ctx;
      var AC = root.AudioContext || root.webkitAudioContext;
      if (!AC) return null;
      try {
        ctx = new AC();
        master = ctx.createGain();
        master.gain.value = muted ? 0 : 0.5;
        master.connect(ctx.destination);
        ready = true;
      } catch (error) {
        ctx = null;
      }
      return ctx;
    }

    function resume() {
      var c = ensure();
      if (!c) return;
      if (c.state === 'suspended' && c.resume) c.resume();
    }

    function tone(freq, duration, type, gain, delay, sweepTo) {
      var c = ensure();
      if (!c || muted) return;
      var t0 = c.currentTime + (delay || 0);
      var osc = c.createOscillator();
      var g = c.createGain();
      osc.type = type || 'sine';
      osc.frequency.setValueAtTime(freq, t0);
      if (sweepTo) osc.frequency.exponentialRampToValueAtTime(Math.max(40, sweepTo), t0 + duration);
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(Math.max(0.0002, gain || 0.2), t0 + 0.012);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
      osc.connect(g);
      g.connect(master);
      osc.start(t0);
      osc.stop(t0 + duration + 0.03);
    }

    function noise(duration, gain, delay, filterFreq) {
      var c = ensure();
      if (!c || muted) return;
      var t0 = c.currentTime + (delay || 0);
      var frames = Math.max(1, Math.floor(c.sampleRate * duration));
      var buffer = c.createBuffer(1, frames, c.sampleRate);
      var data = buffer.getChannelData(0);
      for (var i = 0; i < frames; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / frames);
      var src = c.createBufferSource();
      src.buffer = buffer;
      var filter = c.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.value = filterFreq || 1400;
      filter.Q.value = 0.9;
      var g = c.createGain();
      g.gain.setValueAtTime(gain || 0.12, t0);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
      src.connect(filter);
      filter.connect(g);
      g.connect(master);
      src.start(t0);
      src.stop(t0 + duration + 0.02);
    }

    /* 点击反馈：清脆「啵」 */
    function playTap() {
      tone(660, 0.1, 'triangle', 0.16, 0, 880);
      noise(0.06, 0.05, 0, 2200);
    }

    /* 消除：随连锁数升调 */
    function playPop(chain) {
      var step = Math.min(chain || 1, 8);
      var base = 420 * Math.pow(1.16, step - 1);
      tone(base, 0.16, 'sine', 0.22, 0, base * 1.6);
      tone(base * 1.5, 0.11, 'triangle', 0.1, 0.015);
      noise(0.09, 0.07, 0, 1800);
    }

    /* 下落撞击 */
    function playLand(count) {
      tone(180, 0.09, 'sine', 0.1, 0, 90);
      if (count > 3) tone(240, 0.07, 'sine', 0.06, 0.04, 140);
    }

    /* 连锁升级：清亮琶音 */
    function playChain(chain) {
      var step = Math.min(chain || 1, 8);
      var root = 523.25 * Math.pow(1.09, step - 1);
      var ratios = [1, 1.26, 1.5];
      for (var i = 0; i < ratios.length; i++) {
        tone(root * ratios[i], 0.22, 'sine', 0.13, i * 0.055);
      }
      noise(0.16, 0.05, 0.02, 3200);
    }

    /* 过关：上行音阶 */
    function playWin() {
      var notes = [523.25, 659.25, 783.99, 1046.5];
      for (var i = 0; i < notes.length; i++) {
        tone(notes[i], 0.3, 'triangle', 0.15, i * 0.11);
      }
      noise(0.4, 0.04, 0.1, 2600);
    }

    /* 失败：下行 */
    function playLose() {
      tone(392, 0.22, 'sine', 0.14, 0, 300);
      tone(294, 0.3, 'sine', 0.12, 0.16, 200);
    }

    /* 界面点按 */
    function playUi() {
      tone(880, 0.07, 'sine', 0.1);
    }

    function setMuted(v) {
      muted = !!v;
      if (master) master.gain.value = muted ? 0 : 0.5;
      return muted;
    }

    function isMuted() { return muted; }

    var api = {
      resume: resume,
      playTap: playTap,
      playPop: playPop,
      playLand: playLand,
      playChain: playChain,
      playWin: playWin,
      playLose: playLose,
      playUi: playUi,
      setMuted: setMuted,
      isMuted: isMuted,
      isReady: function () { return ready; }
    };
    return api;
  }

  root.BobaAudio = { createAudio: createAudio };
})(typeof window !== 'undefined' ? window : global);
