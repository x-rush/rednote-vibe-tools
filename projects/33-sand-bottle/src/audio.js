/*
 * 彩沙瓶 · 音效
 * 全部由 Web Audio 实时合成，不引入任何音频文件。
 * 倒沙是沙沙声，塑形是短促摩擦，封口是木塞压紧的闷响。
 */
(function (root) {
  'use strict';

  var ctx = null;
  var muted = false;
  var noiseBuffer = null;

  function ensure() {
    if (muted) return null;
    if (!ctx) {
      var AC = root.AudioContext || root.webkitAudioContext;
      if (!AC) return null;
      try {
        ctx = new AC();
      } catch (error) {
        return null;
      }
    }
    if (ctx.state === 'suspended' && typeof ctx.resume === 'function') {
      ctx.resume();
    }
    return ctx;
  }

  function getNoise(c) {
    if (noiseBuffer) return noiseBuffer;
    var len = Math.floor(c.sampleRate * 0.6);
    noiseBuffer = c.createBuffer(1, len, c.sampleRate);
    var data = noiseBuffer.getChannelData(0);
    for (var i = 0; i < len; i++) {
      data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    }
    return noiseBuffer;
  }

  /* 沙沙声：白噪声过带通，音量随时间衰减 */
  function playPour() {
    var c = ensure();
    if (!c) return;
    var src = c.createBufferSource();
    src.buffer = getNoise(c);
    var filter = c.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 2600;
    filter.Q.value = 0.8;
    var gain = c.createGain();
    var now = c.currentTime;
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.16, now + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.26);
    src.connect(filter);
    filter.connect(gain);
    gain.connect(c.destination);
    src.start(now);
    src.stop(now + 0.3);
  }

  /* 塑形：小棒刮过沙面的短促摩擦 */
  function playShape() {
    var c = ensure();
    if (!c) return;
    var src = c.createBufferSource();
    src.buffer = getNoise(c);
    var filter = c.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.value = 3400;
    var gain = c.createGain();
    var now = c.currentTime;
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.09, now + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.13);
    src.connect(filter);
    filter.connect(gain);
    gain.connect(c.destination);
    src.start(now);
    src.stop(now + 0.16);
  }

  /* 挖沙：比倒沙更闷一点 */
  function playScoop() {
    var c = ensure();
    if (!c) return;
    var src = c.createBufferSource();
    src.buffer = getNoise(c);
    var filter = c.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 1500;
    var gain = c.createGain();
    var now = c.currentTime;
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.13, now + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.2);
    src.connect(filter);
    filter.connect(gain);
    gain.connect(c.destination);
    src.start(now);
    src.stop(now + 0.24);
  }

  /* 封口：木塞压紧的一声闷响 + 一记亮音 */
  function playSeal() {
    var c = ensure();
    if (!c) return;
    var now = c.currentTime;
    var osc = c.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(180, now);
    osc.frequency.exponentialRampToValueAtTime(70, now + 0.16);
    var gain = c.createGain();
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.26, now + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.24);
    osc.connect(gain);
    gain.connect(c.destination);
    osc.start(now);
    osc.stop(now + 0.28);

    var tone = c.createOscillator();
    tone.type = 'triangle';
    tone.frequency.setValueAtTime(880, now + 0.06);
    var gain2 = c.createGain();
    gain2.gain.setValueAtTime(0.0001, now + 0.06);
    gain2.gain.exponentialRampToValueAtTime(0.1, now + 0.09);
    gain2.gain.exponentialRampToValueAtTime(0.0001, now + 0.32);
    tone.connect(gain2);
    gain2.connect(c.destination);
    tone.start(now + 0.06);
    tone.stop(now + 0.34);
  }

  /* 通关：上行三音 */
  function playSuccess() {
    var c = ensure();
    if (!c) return;
    var notes = [523.25, 659.25, 783.99];
    var now = c.currentTime;
    for (var i = 0; i < notes.length; i++) {
      var osc = c.createOscillator();
      osc.type = 'triangle';
      osc.frequency.value = notes[i];
      var gain = c.createGain();
      var start = now + i * 0.11;
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(0.16, start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.3);
      osc.connect(gain);
      gain.connect(c.destination);
      osc.start(start);
      osc.stop(start + 0.32);
    }
  }

  root.SandAudio = {
    resume: function () { ensure(); },
    playPour: playPour,
    playShape: playShape,
    playScoop: playScoop,
    playSeal: playSeal,
    playSuccess: playSuccess,
    setMuted: function (v) {
      muted = !!v;
      if (muted && ctx && typeof ctx.suspend === 'function') ctx.suspend();
    },
    isMuted: function () { return muted; }
  };
})(typeof window !== 'undefined' ? window : global);
