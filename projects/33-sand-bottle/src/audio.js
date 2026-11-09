/*
 * 彩沙瓶 · 音效
 * 全部由 Web Audio 实时合成，不引入任何音频文件。
 * 三组交互音效按原版参数 1:1 复刻（eazo 原版 chunk 12gurs1rhkq1r.js）：
 *   playPour    倒沙：0.08s 白噪声（长度 .08*sampleRate，线性衰减包络）过 1800Hz 高通，
 *               音量 .08 → .001（exponentialRamp，+.08s）。
 *   playClick   选择色块 / 切换工具：triangle 440→560Hz（linearRamp，+.06s），
 *               音量 .06 → .001（+.09s）。
 *   playRelease 松手（指针抬起时必播，倒沙/推杆都一样）：sine 220→140Hz
 *               （exponentialRamp，+.12s），音量 .05 → .001（+.14s）。
 * 封瓶光爆的合成音属于视觉演出层（二期保留项），不影响任何玩法判定。
 * Chrome 61 基线：经典脚本，无可选链。
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
    if (ctx.state === 'suspended' && typeof ctx.resume === 'function') {
      ctx.resume();
    }
    return ctx;
  }

  /* 原版 y(e)：倒沙沙沙声。0.08s 的一次性噪声 buffer，高通 1800Hz */
  function playPour() {
    var c = ensure();
    if (!c) return;
    var len = Math.floor(0.08 * c.sampleRate);
    var buffer = c.createBuffer(1, len, c.sampleRate);
    var data = buffer.getChannelData(0);
    for (var i = 0; i < len; i++) {
      data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    }
    var src = c.createBufferSource();
    src.buffer = buffer;
    var filter = c.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.value = 1800;
    var gain = c.createGain();
    var now = c.currentTime;
    gain.gain.setValueAtTime(0.08, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
    src.connect(filter);
    filter.connect(gain);
    gain.connect(c.destination);
    src.start(now);
  }

  /* 原版 v(e)：色块 / 工具点击，triangle 440→560 */
  function playClick() {
    var c = ensure();
    if (!c) return;
    var osc = c.createOscillator();
    var now = c.currentTime;
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(440, now);
    osc.frequency.linearRampToValueAtTime(560, now + 0.06);
    var gain = c.createGain();
    gain.gain.setValueAtTime(0.06, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.09);
    osc.connect(gain);
    gain.connect(c.destination);
    osc.start(now);
    osc.stop(now + 0.1);
  }

  /* 原版松手音：sine 220→140，指针抬起时必播 */
  function playRelease() {
    var c = ensure();
    if (!c) return;
    var osc = c.createOscillator();
    var now = c.currentTime;
    osc.type = 'sine';
    osc.frequency.setValueAtTime(220, now);
    osc.frequency.exponentialRampToValueAtTime(140, now + 0.12);
    var gain = c.createGain();
    gain.gain.setValueAtTime(0.05, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.14);
    osc.connect(gain);
    gain.connect(c.destination);
    osc.start(now);
    osc.stop(now + 0.15);
  }

  /* 封瓶光爆（视觉演出配乐，二期保留项） */
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

  root.SandAudio = {
    resume: function () { ensure(); },
    playPour: playPour,
    playClick: playClick,
    playRelease: playRelease,
    playSeal: playSeal,
    setMuted: function (v) {
      muted = !!v;
      if (muted && ctx && typeof ctx.suspend === 'function') ctx.suspend();
    },
    isMuted: function () { return muted; }
  };
})(typeof window !== 'undefined' ? window : global);
