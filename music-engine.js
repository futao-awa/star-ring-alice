(function () {
  'use strict';

  const THEMES = {
    'starlight-idle': { name: '星光待机', tag: '轻灵 / 动漫感', bpm: 92, root: 220, scale: [0, 4, 7, 11, 7, 4, 2, 7], wave: 'sine', energy: .34 },
    'anime-flight': { name: '晴空航线', tag: '动漫 / 明快', bpm: 146, root: 196, scale: [0, 4, 7, 12, 11, 7, 4, 9], wave: 'triangle', energy: .68 },
    'pixel-rush': { name: '像素疾驰', tag: '8BIT / 节奏', bpm: 172, root: 164.81, scale: [0, 3, 7, 10, 12, 10, 7, 3], wave: 'square', energy: .82 },
    'neon-beat': { name: '霓虹脉冲', tag: '电音 / 强拍', bpm: 158, root: 146.83, scale: [0, 3, 7, 8, 12, 10, 7, 5], wave: 'sawtooth', energy: .9 },
    'heroic-orbit': { name: '星环决战', tag: '交响 / 热血', bpm: 134, root: 174.61, scale: [0, 7, 12, 4, 9, 7, 12, 14], wave: 'triangle', energy: .76 },
    'chrono-abyss': { name: '时渊回响', tag: '暗色 / 时间系', bpm: 118, root: 123.47, scale: [0, 1, 6, 8, 7, 3, 1, -2], wave: 'sawtooth', energy: .64 },
  };

  class OrbitMusicPlayer {
    constructor() {
      this.context = null;
      this.master = null;
      this.noise = null;
      this.audio = new Audio();
      this.audio.loop = true;
      this.audio.preload = 'metadata';
      this.themeId = 'anime-flight';
      this.customSource = '';
      this.playing = false;
      this.timer = 0;
      this.nextBeat = 0;
      this.step = 0;
      this.volume = .48;
    }

    unlock() {
      if (!this.context) {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        if (!AudioContext) return false;
        this.context = new AudioContext();
        this.master = this.context.createGain();
        this.master.gain.value = this.volume;
        this.master.connect(this.context.destination);
        this.noise = this.context.createBuffer(1, this.context.sampleRate, this.context.sampleRate);
        const data = this.noise.getChannelData(0);
        for (let i = 0; i < data.length; i += 1) data[i] = Math.random() * 2 - 1;
      }
      if (this.context.state === 'suspended') this.context.resume().catch(() => {});
      return true;
    }

    configure(music) {
      const config = music && typeof music === 'object' ? music : {};
      this.themeId = THEMES[config.track] ? config.track : 'anime-flight';
      this.customSource = config.mode === 'custom' && typeof config.data === 'string' ? config.data : '';
      if (this.customSource && this.audio.src !== this.customSource) {
        this.audio.pause(); this.audio.src = this.customSource; this.audio.load();
      }
      this.audio.volume = this.volume;
      if (this.playing) this.restart();
    }

    setVolume(value) {
      this.volume = Math.max(0, Math.min(1, Number(value) || 0));
      if (this.master && this.context) this.master.gain.setTargetAtTime(this.volume, this.context.currentTime, .04);
      this.audio.volume = this.volume;
    }

    start() {
      this.unlock();
      this.playing = true;
      if (this.customSource) {
        this.clearTimer();
        this.audio.play().catch(() => {});
        return;
      }
      this.audio.pause();
      this.step = 0;
      this.nextBeat = this.context ? this.context.currentTime + .04 : 0;
      this.schedule();
    }

    stop() {
      this.playing = false;
      this.clearTimer();
      this.audio.pause();
    }

    restart() {
      this.stop();
      this.audio.currentTime = 0;
      this.start();
    }

    clearTimer() {
      if (this.timer) window.clearTimeout(this.timer);
      this.timer = 0;
    }

    tone(frequency, at, duration, gainValue, type, cutoff) {
      if (!this.context || !this.master || gainValue <= 0) return;
      const osc = this.context.createOscillator();
      const gain = this.context.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(Math.max(30, frequency), at);
      gain.gain.setValueAtTime(.0001, at);
      gain.gain.exponentialRampToValueAtTime(gainValue, at + .008);
      gain.gain.exponentialRampToValueAtTime(.0001, at + duration);
      if (cutoff) {
        const filter = this.context.createBiquadFilter();
        filter.type = 'lowpass'; filter.frequency.value = cutoff;
        osc.connect(filter).connect(gain);
      } else osc.connect(gain);
      gain.connect(this.master); osc.start(at); osc.stop(at + duration + .02);
    }

    noiseHit(at, duration, gainValue, cutoff) {
      if (!this.context || !this.noise) return;
      const source = this.context.createBufferSource();
      const filter = this.context.createBiquadFilter();
      const gain = this.context.createGain();
      source.buffer = this.noise; filter.type = 'highpass'; filter.frequency.value = cutoff;
      gain.gain.setValueAtTime(gainValue, at); gain.gain.exponentialRampToValueAtTime(.0001, at + duration);
      source.connect(filter).connect(gain).connect(this.master); source.start(at); source.stop(at + duration);
    }

    beat(at, step, theme) {
      const sixteenth = step % 16;
      const note = theme.root * Math.pow(2, theme.scale[Math.floor(sixteenth / 2) % theme.scale.length] / 12);
      if (sixteenth === 0 || sixteenth === 8 || (theme.energy > .78 && (sixteenth === 6 || sixteenth === 14))) {
        this.tone(150, at, .16, .1 + theme.energy * .06, 'sine', 800);
        this.tone(52, at, .24, .08, 'sine', 300);
      }
      if (sixteenth === 4 || sixteenth === 12) {
        this.noiseHit(at, .11, .045 + theme.energy * .025, 1700);
        this.tone(185, at, .08, .022, 'triangle', 900);
      }
      if (sixteenth % 2 === 0 || theme.energy > .75) this.noiseHit(at, .03, .008 + theme.energy * .008, 6200);
      if (sixteenth % 4 === 0) this.tone(note / 2, at, .22, .03 + theme.energy * .025, 'sawtooth', 680);
      if ((sixteenth + Math.floor(step / 16)) % (theme.energy > .74 ? 2 : 4) === 0) {
        this.tone(note * 2, at, .12, .012 + theme.energy * .012, theme.wave, 2600);
      }
      if (sixteenth === 0) {
        [0, 4, 7, 12].forEach((semitone) => this.tone(theme.root * 2 * Math.pow(2, semitone / 12), at, 1.2, .008 + theme.energy * .004, 'triangle', 1900));
      }
    }

    schedule() {
      if (!this.playing || this.customSource || !this.context) return;
      const theme = THEMES[this.themeId] || THEMES['anime-flight'];
      const interval = 60 / theme.bpm / 4;
      while (this.nextBeat < this.context.currentTime + .14) {
        this.beat(this.nextBeat, this.step, theme);
        this.step += 1; this.nextBeat += interval;
      }
      this.timer = window.setTimeout(() => this.schedule(), 55);
    }
  }

  window.OrbitMusic = { THEMES, OrbitMusicPlayer };
})();
