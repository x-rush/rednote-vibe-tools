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

  /* 收宝石：清亮的双音 */
  function playGem(index) {
    var base = 660 + (index || 0) * 55;
    tone(base, base * 1.5, 0.26, 0.11, 'sine', 0);
    tone(base * 2, base * 2.4, 0.22, 0.07, 'triangle', 0.04);
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
    playSuccess: playSuccess,
    playFail: playFail,
    setMuted: function (v) {
      muted = !!v;
      if (muted && ctx && typeof ctx.suspend === 'function') ctx.suspend();
    },
    isMuted: function () { return muted; }
  };
})(typeof window !== 'undefined' ? window : global);
