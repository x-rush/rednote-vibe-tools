/*
 * 弹珠神殿 · 音效
 * 全部由 Web Audio 实时合成，不引入任何音频文件。
 * 撞墙是石头闷响，宝石收进掌心是一声清亮的铃。
 */
(function (root) {
  'use strict';

  var ctx = null;
  var muted = false;

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

  /* 撞墙：低频闷响 */
  function playBounce(strength) {
    var c = ensure();
    if (!c) return;
    var now = c.currentTime;
    var osc = c.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(220, now);
    osc.frequency.exponentialRampToValueAtTime(90, now + 0.09);
    var g = c.createGain();
    var vol = 0.06 + Math.min(0.14, (strength || 1) * 0.14);
    g.gain.setValueAtTime(0.0001, now);
    g.gain.exponentialRampToValueAtTime(vol, now + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 0.16);
    osc.connect(g);
    g.connect(c.destination);
    osc.start(now);
    osc.stop(now + 0.18);
  }

  /* 发射：短促的弹拨 */
  function playShoot(power) {
    var c = ensure();
    if (!c) return;
    var now = c.currentTime;
    var osc = c.createOscillator();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(320 + (power || 0.5) * 260, now);
    osc.frequency.exponentialRampToValueAtTime(140, now + 0.12);
    var g = c.createGain();
    g.gain.setValueAtTime(0.0001, now);
    g.gain.exponentialRampToValueAtTime(0.14, now + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 0.16);
    osc.connect(g);
    g.connect(c.destination);
    osc.start(now);
    osc.stop(now + 0.18);
  }

  /* 收宝石：音阶递进——连收越多，音调越高 */
  /* 五声音阶：听起来是一串上行，不会打架 */
  var GEM_SCALE = [523.25, 587.33, 659.25, 783.99, 880, 1046.5, 1174.66, 1318.51];

  function playGem(index, combo) {
    var step = combo || 0;
    if (step < 0) step = 0;
    if (step > GEM_SCALE.length - 1) step = GEM_SCALE.length - 1;
    /* 每殿的基音略微上移，八殿越打越高 */
    var base = GEM_SCALE[step] + (index || 0) * 14;
    tone(base, base * 1.5, 0.28, 0.12, 'sine', 0);
    tone(base * 2, base * 2.4, 0.22, 0.07, 'triangle', 0.045);
    tone(base * 3, base * 3, 0.14, 0.035, 'sine', 0.09);
  }

  /* 一杆清空：全屏光爆的音效，音阶一路冲上去 */
  function playOneShotClear() {
    var steps = [523.25, 659.25, 783.99, 1046.5, 1318.51];
    for (var i = 0; i < steps.length; i++) {
      tone(steps[i], steps[i], 0.5 - i * 0.04, 0.11, 'triangle', i * 0.075);
      tone(steps[i] * 2, steps[i] * 2.6, 0.36, 0.05, 'sine', i * 0.075 + 0.02);
    }
    tone(1567.98, 2093, 0.7, 0.09, 'sine', 0.42);
  }

  /* 过关：上行三音 */
  function playSuccess() {
    tone(523.25, 523.25, 0.3, 0.13, 'triangle', 0);
    tone(659.25, 659.25, 0.3, 0.13, 'triangle', 0.1);
    tone(783.99, 783.99, 0.42, 0.14, 'triangle', 0.2);
  }

  /* 失败：下行两音 */
  function playFail() {
    tone(392, 392, 0.22, 0.1, 'sine', 0);
    tone(311.13, 311.13, 0.32, 0.1, 'sine', 0.14);
  }

  root.BilliardAudio = {
    resume: function () { ensure(); },
    playBounce: playBounce,
    playShoot: playShoot,
    playGem: playGem,
    playOneShotClear: playOneShotClear,
    playSuccess: playSuccess,
    playFail: playFail,
    setMuted: function (v) {
      muted = !!v;
      if (muted && ctx && typeof ctx.suspend === 'function') ctx.suspend();
    },
    isMuted: function () { return muted; }
  };
})(typeof window !== 'undefined' ? window : global);
