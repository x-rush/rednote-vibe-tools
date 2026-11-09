/*
 * 毽子连击 · 音效
 *
 * 全部由 Web Audio 实时合成：皮托的「啪」、铜铃的「叮」、落地闷响。
 * 不含任何音频文件，不产生 Base64，也不进 ZIP。
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

    function noise(duration, gain, delay, filterFreq, filterType) {
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
      filter.type = filterType || 'bandpass';
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

    /* 铜铃：几个非谐分音叠加，快速衰减 */
    function bell(freq, duration, gain, delay) {
      var ratios = [1, 2.76, 5.4, 8.93];
      var amps = [1, 0.46, 0.24, 0.11];
      for (var i = 0; i < ratios.length; i++) {
        tone(freq * ratios[i], duration * (1 - i * 0.17), 'sine', (gain || 0.12) * amps[i], (delay || 0) + i * 0.004);
      }
    }

    /* 皮托踢中：短促的「啪」 */
    function playKick() {
      tone(200, 0.075, 'square', 0.09, 0, 118);
      noise(0.085, 0.12, 0, 900);
    }

    /* 踢法命中：皮托「啪」+ 铜铃音高随踢法倍率抬升，正中带心再加一层亮铃 */
    function playKickType(multiplier, strength) {
      playKick();
      var m = Math.max(1, multiplier || 1);
      var freq = 740 * Math.pow(m, 1.35);
      bell(freq, 0.34, 0.09);
      if (strength >= 0.55) {
        bell(freq * 1.5, 0.3, 0.06, 0.05);
        tone(freq * 3, 0.14, 'triangle', 0.045, 0.03);
      }
    }

    /* 踢空：闷、钝的一声（原 playWhiff 语义） */
    function playWhiff() {
      tone(148, 0.13, 'sine', 0.1, 0, 86);
      noise(0.17, 0.05, 0.005, 460);
    }

    /* 接住：铜铃轻响，连击越高音越亮 */
    function playCatch(combo) {
      var step = Math.min(combo || 1, 20);
      var freq = 1180 * Math.pow(1.022, step - 1);
      bell(freq, 0.42, 0.1);
      /* 升调：一小段上滑，落地瞬间听得出「接住了」 */
      tone(freq * 0.9, 0.16, 'triangle', 0.05, 0.02, freq * 1.32);
    }

    /* 完美接住：双铃 + 一点糖 */
    function playPerfect(combo) {
      var step = Math.min(combo || 1, 20);
      var freq = 1480 * Math.pow(1.02, step - 1);
      bell(freq, 0.5, 0.12);
      bell(freq * 1.5, 0.36, 0.07, 0.07);
      tone(freq * 3, 0.18, 'triangle', 0.05, 0.02);
      tone(freq * 0.85, 0.2, 'triangle', 0.05, 0.03, freq * 1.4);
    }

    /* 擦边：接住了但没计入连击，音短、偏闷，向上收一下提示「差一点」 */
    function playEdge() {
      tone(520, 0.13, 'sine', 0.075, 0, 760);
      noise(0.1, 0.05, 0, 780);
    }

    /* 落地：闷响 + 羽毛飘落 */
    function playLand() {
      tone(104, 0.18, 'sine', 0.17, 0, 58);
      noise(0.3, 0.06, 0.01, 640, 'lowpass');
    }

    /* 升档：连击进入新档位，天色换一层 */
    function playTier() {
      var notes = [784, 1046, 1318];
      for (var i = 0; i < notes.length; i++) {
        bell(notes[i], 0.6, 0.075, i * 0.085);
      }
      noise(0.5, 0.035, 0.05, 4200);
    }

    /* 新踢法解锁：两声短铃上行，轻快不抢戏 */
    function playUnlockKick() {
      bell(988, 0.3, 0.08);
      bell(1318, 0.36, 0.07, 0.09);
    }

    /* 新庭院解锁：低沉钟声三连，场景感 */
    function playCourtyard() {
      bell(523, 0.7, 0.1);
      bell(659, 0.66, 0.08, 0.14);
      bell(784, 0.72, 0.08, 0.28);
      noise(0.6, 0.028, 0.1, 3200);
    }

    /* 新纪录：快速上行的四连亮铃 */
    function playBest() {
      var notes = [1046, 1318, 1568, 2093];
      for (var i = 0; i < notes.length; i++) {
        bell(notes[i], 0.4, 0.075, i * 0.07);
      }
    }

    /* 过关：铃音上行 */
    function playWin() {
      var notes = [880, 1046, 1318, 1568];
      for (var i = 0; i < notes.length; i++) {
        bell(notes[i], 0.62, 0.1, i * 0.11);
      }
    }

    /* 失败：铃散掉 */
    function playLose() {
      bell(660, 0.5, 0.1);
      tone(330, 0.4, 'sine', 0.1, 0.16, 210);
    }

    function playUi() {
      tone(920, 0.06, 'sine', 0.08);
    }

    function setMuted(v) {
      muted = !!v;
      if (master) master.gain.value = muted ? 0 : 0.5;
      return muted;
    }

    function isMuted() { return muted; }

    return {
      resume: resume,
      playKick: playKick,
      playKickType: playKickType,
      playWhiff: playWhiff,
      playCatch: playCatch,
      playPerfect: playPerfect,
      playEdge: playEdge,
      playLand: playLand,
      playTier: playTier,
      playUnlockKick: playUnlockKick,
      playCourtyard: playCourtyard,
      playBest: playBest,
      playWin: playWin,
      playLose: playLose,
      playUi: playUi,
      setMuted: setMuted,
      isMuted: isMuted,
      isReady: function () { return ready; }
    };
  }

  root.JianziAudio = { createAudio: createAudio };
})(typeof window !== 'undefined' ? window : global);
