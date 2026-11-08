/*
 * 蛋落地 · 音效
 * 全部 Web Audio 实时合成：喷气的气声、蛋壳的清脆碎裂、软着陆的轻响。
 * 不含音频文件，不产生 Base64，也不进 ZIP。
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

    /* 带通扫频的噪声，用来做气声 */
    function hiss(duration, gain, delay, from, to) {
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
      filter.frequency.setValueAtTime(from || 1800, t0);
      filter.frequency.exponentialRampToValueAtTime(Math.max(60, to || 500), t0 + duration);
      filter.Q.value = 0.8;
      var g = c.createGain();
      g.gain.setValueAtTime(gain || 0.12, t0);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
      src.connect(filter);
      filter.connect(g);
      g.connect(master);
      src.start(t0);
      src.stop(t0 + duration + 0.02);
    }

    function bell(freq, duration, gain, delay) {
      var ratios = [1, 2.76, 5.4];
      var amps = [1, 0.42, 0.2];
      for (var i = 0; i < ratios.length; i++) {
        tone(freq * ratios[i], duration * (1 - i * 0.2), 'sine', (gain || 0.12) * amps[i], (delay || 0) + i * 0.004);
      }
    }

    /* 喷气：气声 + 一声闷推 */
    function playThrust() {
      hiss(0.26, 0.1, 0, 2000, 420);
      tone(150, 0.14, 'triangle', 0.07, 0, 96);
    }

    /* 软着陆：轻轻的「咚」+ 一声清脆 */
    function playLand(perfect) {
      tone(210, 0.1, 'sine', 0.11, 0, 120);
      if (perfect) {
        bell(1568, 0.5, 0.1);
        bell(2093, 0.34, 0.05, 0.06);
      } else {
        bell(1046, 0.36, 0.075);
      }
    }

    /* 蛋碎：尖锐的碎裂声 */
    function playCrack() {
      hiss(0.16, 0.16, 0, 4200, 1400);
      tone(320, 0.1, 'square', 0.08, 0, 120);
      for (var i = 0; i < 5; i++) {
        tone(900 + Math.random() * 1500, 0.05, 'triangle', 0.05, 0.03 + i * 0.035);
      }
    }

    /* 没接住：闷响 + 下行 */
    function playMiss() {
      tone(150, 0.24, 'sine', 0.13, 0, 70);
      hiss(0.3, 0.05, 0, 600, 180);
    }

    /* 过关：上行铃音 */
    function playWin() {
      var notes = [784, 988, 1175, 1568];
      for (var i = 0; i < notes.length; i++) bell(notes[i], 0.55, 0.09, i * 0.1);
    }

    /* 失败：铃散掉 */
    function playLose() {
      tone(392, 0.26, 'sine', 0.12, 0, 260);
      hiss(0.4, 0.05, 0.02, 1400, 300);
    }

    function playUi() {
      tone(880, 0.06, 'sine', 0.07);
    }

    function setMuted(v) {
      muted = !!v;
      if (master) master.gain.value = muted ? 0 : 0.5;
      return muted;
    }

    function isMuted() { return muted; }

    return {
      resume: resume,
      playThrust: playThrust,
      playLand: playLand,
      playCrack: playCrack,
      playMiss: playMiss,
      playWin: playWin,
      playLose: playLose,
      playUi: playUi,
      setMuted: setMuted,
      isMuted: isMuted,
      isReady: function () { return ready; }
    };
  }

  root.EggAudio = { createAudio: createAudio };
})(typeof window !== 'undefined' ? window : global);
