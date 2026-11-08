/*
 * 沙丘速降 · 音效
 * 全部由 Web Audio 实时合成，不引入任何音频文件。
 * 风声跟着速度走，雪崩的轰鸣跟着距离走——声音本身就是仪表盘。
 */
(function (root) {
  'use strict';

  var ctx = null;
  var muted = false;
  var wind = null;
  var windGain = null;
  var windFilter = null;
  var rumble = null;
  var rumbleGain = null;
  var rumbleFilter = null;

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
    if (ctx.state === 'suspended' && typeof ctx.resume === 'function') ctx.resume();
    return ctx;
  }

  function noiseBuffer(c, seconds) {
    var len = Math.floor(c.sampleRate * (seconds || 2));
    var buf = c.createBuffer(1, len, c.sampleRate);
    var data = buf.getChannelData(0);
    var last = 0;
    for (var i = 0; i < len; i++) {
      /* 略带布朗色，听起来更像风而不像白噪 */
      var white = Math.random() * 2 - 1;
      last = (last + 0.02 * white) / 1.02;
      data[i] = last * 3.2;
    }
    return buf;
  }

  function buildWind() {
    var c = ensure();
    if (!c || wind) return;
    try {
      var src = c.createBufferSource();
      src.buffer = noiseBuffer(c, 3);
      src.loop = true;
      windFilter = c.createBiquadFilter();
      windFilter.type = 'bandpass';
      windFilter.frequency.value = 480;
      windFilter.Q.value = 0.7;
      windGain = c.createGain();
      windGain.gain.value = 0.0001;
      src.connect(windFilter);
      windFilter.connect(windGain);
      windGain.connect(c.destination);
      src.start(0);
      wind = src;

      var rsrc = c.createBufferSource();
      rsrc.buffer = noiseBuffer(c, 3);
      rsrc.loop = true;
      rumbleFilter = c.createBiquadFilter();
      rumbleFilter.type = 'lowpass';
      rumbleFilter.frequency.value = 160;
      rumbleGain = c.createGain();
      rumbleGain.gain.value = 0.0001;
      rsrc.connect(rumbleFilter);
      rumbleFilter.connect(rumbleGain);
      rumbleGain.connect(c.destination);
      rsrc.start(0);
      rumble = rsrc;
    } catch (error) {
      wind = null;
      rumble = null;
    }
  }

  function tone(freq, endFreq, dur, gain, type, delay) {
    var c = ensure();
    if (!c) return;
    var now = c.currentTime + (delay || 0);
    var osc = c.createOscillator();
    osc.type = type || 'triangle';
    osc.frequency.setValueAtTime(freq, now);
    if (endFreq) osc.frequency.exponentialRampToValueAtTime(endFreq, now + dur);
    var g = c.createGain();
    g.gain.setValueAtTime(0.0001, now);
    g.gain.exponentialRampToValueAtTime(gain, now + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, now + dur);
    osc.connect(g);
    g.connect(c.destination);
    osc.start(now);
    osc.stop(now + dur + 0.02);
  }

  /* 风声：速度越快越亮越响 */
  function setSpeed(speed) {
    var c = ensure();
    if (!c) return;
    buildWind();
    if (!windGain) return;
    var t = Math.max(0, Math.min(1, (speed - 150) / 700));
    var now = c.currentTime;
    try {
      windGain.gain.setTargetAtTime(0.02 + t * 0.12, now, 0.12);
      windFilter.frequency.setTargetAtTime(320 + t * 1100, now, 0.15);
    } catch (error) {
      /* 老内核没有 setTargetAtTime 时忽略 */
    }
  }

  /* 雪崩轰鸣：越近越响 */
  function setDanger(near) {
    var c = ensure();
    if (!c) return;
    buildWind();
    if (!rumbleGain) return;
    var v = Math.max(0, Math.min(1, near));
    try {
      rumbleGain.gain.setTargetAtTime(0.01 + v * 0.16, c.currentTime, 0.15);
      rumbleFilter.frequency.setTargetAtTime(90 + v * 140, c.currentTime, 0.2);
    } catch (error) {
      /* 忽略 */
    }
  }

  function silence() {
    var c = ctx;
    if (!c) return;
    try {
      if (windGain) windGain.gain.setTargetAtTime(0.0001, c.currentTime, 0.08);
      if (rumbleGain) rumbleGain.gain.setTargetAtTime(0.0001, c.currentTime, 0.08);
    } catch (error) {
      /* 忽略 */
    }
  }

  /* 穿旗门：清亮的两音上行 */
  function playGate() {
    tone(784, 784, 0.16, 0.1, 'sine', 0);
    tone(1175, 1175, 0.24, 0.08, 'triangle', 0.06);
  }

  /* 漏旗门：一声闷响 */
  function playGateMiss() {
    tone(300, 240, 0.16, 0.05, 'sine', 0);
  }

  /* 撞岩脊：低频闷响 + 噪声 */
  function playCrash() {
    var c = ensure();
    if (!c) return;
    tone(160, 60, 0.26, 0.14, 'sine', 0);
    tone(90, 45, 0.34, 0.1, 'square', 0.02);
  }

  /* 起跳 */
  function playJump() {
    tone(420, 880, 0.18, 0.09, 'triangle', 0);
  }

  /* 落地 */
  function playLand() {
    tone(180, 110, 0.14, 0.09, 'sine', 0);
  }

  /* 甩尾：短促的风声 */
  function playCarve(power) {
    var c = ensure();
    if (!c) return;
    var now = c.currentTime;
    var src = c.createBufferSource();
    src.buffer = noiseBuffer(c, 0.4);
    var filter = c.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(900, now);
    filter.frequency.exponentialRampToValueAtTime(2600, now + 0.22);
    filter.Q.value = 1.6;
    var g = c.createGain();
    var vol = 0.05 + (power || 0.5) * 0.08;
    g.gain.setValueAtTime(0.0001, now);
    g.gain.exponentialRampToValueAtTime(vol, now + 0.04);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 0.3);
    src.connect(filter);
    filter.connect(g);
    g.connect(c.destination);
    src.start(now);
    src.stop(now + 0.34);
  }

  /* 被追上：闷住的下行 */
  function playOver() {
    tone(330, 110, 0.6, 0.14, 'sawtooth', 0);
    tone(220, 70, 0.8, 0.1, 'sine', 0.08);
    silence();
  }

  root.DuneAudio = {
    resume: function () { ensure(); buildWind(); },
    setSpeed: setSpeed,
    setDanger: setDanger,
    silence: silence,
    playGate: playGate,
    playGateMiss: playGateMiss,
    playCrash: playCrash,
    playJump: playJump,
    playLand: playLand,
    playCarve: playCarve,
    playOver: playOver,
    setMuted: function (v) {
      muted = !!v;
      if (muted) {
        silence();
        if (ctx && typeof ctx.suspend === 'function') ctx.suspend();
      }
    },
    isMuted: function () { return muted; }
  };
})(typeof window !== 'undefined' ? window : global);
