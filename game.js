(() => {
  'use strict';

  const W = 480;
  const H = 720;
  const CHART_W = 3400;
  const CHART_H = 2200;
  const TAU = Math.PI * 2;
  const STEP = 1 / 120;
  const QA_MODE = new URLSearchParams(location.search).has('qa');
  const OPEN_CHART = new URLSearchParams(location.search).get('chart') === '1';
  const $ = (id) => document.getElementById(id);
  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
  const lerp = (a, b, t) => a + (b - a) * t;
  const rand = (min, max) => min + Math.random() * (max - min);
  const easeOut = (t) => 1 - Math.pow(1 - clamp(t, 0, 1), 3);
  const BLOCKED_NICKNAME_TERMS = ['管理员', '官方', '系统消息', '客服', 'admin', 'administrator', 'system', 'official', '操你妈', '草泥马', '傻逼', '煞笔', '妈逼', '死妈', '杂种', '色情', '成人视频', '黄色网站', '约炮', '强奸', '赌博', '赌场', '博彩', '加微信', '微信号', 'qq群', '代练', '外挂', '刷单'];
  const normalizedNickname = (value) => String(value || '').normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '');
  const containsBlockedNickname = (value) => {
    const normalized = normalizedNickname(value);
    return BLOCKED_NICKNAME_TERMS.some((term) => normalized.includes(normalizedNickname(term))) || /(?:vx|v信|微.{0,2}信|q群|扣扣)[a-z0-9]{4,}/i.test(String(value || ''));
  };

  const canvas = $('game');
  const ctx = canvas.getContext('2d', { alpha: false });
  const shell = document.querySelector('.game-shell');
  const alicePixel = new Image();
  const aliceAttack = new Image();
  const aliceSkill = new Image();
  const planetSheet = new Image();
  const guardianSheet = new Image();
  alicePixel.src = 'assets/alice-pixel-v1.png';
  aliceAttack.src = 'assets/alice-pixel-attack-v1.png';
  aliceSkill.src = 'assets/alice-skill-cut-in-v1.png';
  planetSheet.src = 'assets/planet-sheet-v1.png';
  guardianSheet.src = 'assets/guardian-sheet-v1.png';

  const ui = {
    start: $('startScreen'), pause: $('pauseScreen'), result: $('resultScreen'),
    galaxy: $('galaxyScreen'), galaxyTrack: $('galaxyTrack'), galaxyCamera: $('galaxyCamera'), galaxyInfo: $('galaxyInfo'), galaxyStage: $('galaxyStage'),
    score: $('score'), best: $('best'), graze: $('graze'), chain: $('chain'),
    hp: $('playerHp'), maxHp: $('playerMaxHp'), hpFill: $('playerHpFill'), hpLag: $('playerHpLag'),
    hpTrack: $('playerHpTrack'), hpState: $('hpState'), core: $('bombPips'), bombBtn: $('bombBtn'),
    pauseBtn: $('pauseBtn'), muteBtn: $('muteBtn'), stage: $('stageReadout'),
    combo: $('comboDisplay'), comboHits: $('comboHits'),
    dialogue: $('dialogueLayer'), dialogueBox: $('dialogueBox'), dialogueName: $('dialogueName'),
    dialogueText: $('dialogueText'), dialogueLeft: $('dialogueLeft'), dialogueRight: $('dialogueRight'),
    coreToast: $('coreToast'), coreReason: $('coreReason'),
    debugTab: $('debugTab'), debugDrawer: $('debugDrawer'), debugClose: $('debugClose'),
    invincibleToggle: $('invincibleToggle'), debugStatus: $('debugStatus'),
    teaseToast: $('teaseToast'), teaseText: $('teaseText'), teaseClose: $('teaseClose'),
    profileGate: $('profileGate'), profileForm: $('profileForm'), profileName: $('profileName'),
    rankingList: $('rankingList'), rankingStatus: $('rankingStatus'), rankingGalaxy: $('rankingGalaxy'),
    homeMailBtn: $('homeMailBtn'), homeMailPanel: $('homeMailPanel'), homeMailList: $('homeMailList'),
  };

  const COLORS = {
    teal: '#43e1c1', coral: '#ff725e', gold: '#ffd05a', blue: '#5cc8ff',
    white: '#f7fcff', violet: '#d7a6ff', red: '#ff405d', ink: '#070b18',
  };

  const GALAXIES = [
    { id: 'atlas', name: '赤曜近地星系', guardian: 'ATLAS-G1 / 轨道哨卫', threat: '危险等级 Ⅱ', rhythm: '引导 · 卫星环轨', desc: '卫星弹沿轨道切线运行，安全缺口会像近地点一样周期回归，适合学习读阵。' },
    { id: 'lumen', name: '紫辉磁暴星系', guardian: 'LUMEN-G2 / 磁暴守卫', threat: '危险等级 Ⅲ', rhythm: '交错 · 移动门墙', desc: '磁暴将弹幕压成横纵门墙，安全通道随节拍换轨，间歇穿插定向放电激光。' },
    { id: 'vesper', name: '粉晶折光星系', guardian: 'VESPER-G3 / 棱镜守卫', threat: '危险等级 Ⅳ', rhythm: '折射 · 反弹分裂', desc: '棱镜弹会在边界折返，大型晶核撞击后分裂，星阵则向中心收束而非直接扩散。' },
    { id: 'null', name: '金寂终端星系', guardian: 'NULL-G4 / 星门守卫', threat: '危险等级 Ⅴ', rhythm: '封锁 · 激光走廊', desc: '终端守卫以交叉激光逐段封锁战场，仅留下短暂走廊，弹幕用于逼迫换位。' },
    { id: 'aether', name: '苍穹群星星系', guardian: 'AETHER-G5 / 星座编织者', threat: '危险等级 Ⅵ', rhythm: '构型 · 星座坠阵', desc: '弹体连接成星座、多边形和完整方阵，完成构型后会保持队形整体坠落。' },
    { id: 'mirage', name: '幻潮镜海星系', guardian: 'MIRAGE-G6 / 镜像摆卫', threat: '危险等级 Ⅶ', rhythm: '镜像 · 摆钟反射', desc: '左右镜像弹像钟摆一样摆动，触边后反射回场，并用对称激光制造真假航路。' },
    { id: 'umbra', name: '蚀影奇点星系', guardian: 'UMBRA-G7 / 时序裁决者', threat: '危险等级 Ⅷ', rhythm: '时序 · 冻结与回溯', desc: '奇点会冻结整个弹幕场，随后令全部弹体沿历史轨迹回溯；时间钟盘重新启动时会再次锁定。' },
    { id: 'zenith', name: '天极王座星系', guardian: 'ZENITH-G8 / 星环统御核', threat: '危险等级 Ⅸ', rhythm: '终局 · 万象轮转', desc: '星座坠阵、镜面反射、时间钟盘与交叉激光轮流接管战场，是八种协议的综合试炼。' },
  ];

  const NAMES = ['爱丽丝', 'ATLAS-G1', 'LUMEN-G2', 'VESPER-G3', 'NULL-G4', 'AETHER-G5', 'MIRAGE-G6', 'UMBRA-G7', 'ZENITH-G8'];
  const STAGES = [
    {
      name: '赤星守卫 · ATLAS-G1', short: 'ATLAS GUARD', sprite: 0, color: COLORS.coral,
      spells: [
        { name: '引力「近地点回廊」', hp: 6500, time: 64, pattern: 'beacon' },
        { name: '裂片「赤色星落」', hp: 7900, time: 68, pattern: 'pulse' },
        { name: '轨道「交错卫星阵」', hp: 9400, time: 72, pattern: 'crossfire' },
      ],
    },
    {
      name: '紫星守卫 · LUMEN-G2', short: 'LUMEN GUARD', sprite: 1, color: COLORS.blue,
      spells: [
        { name: '磁暴「双星偏航」', hp: 8200, time: 68, pattern: 'orbit' },
        { name: '碎屑「天穹雨幕」', hp: 9800, time: 72, pattern: 'rain' },
        { name: '坐标「经纬牢笼」', hp: 11600, time: 76, pattern: 'lattice' },
      ],
    },
    {
      name: '粉星守卫 · VESPER-G3', short: 'VESPER GUARD', sprite: 2, color: COLORS.gold,
      spells: [
        { name: '共振「五重轮舞」', hp: 10800, time: 72, pattern: 'spiral' },
        { name: '棱镜「七彩折光」', hp: 12600, time: 78, pattern: 'prism' },
        { name: '时差「逆时涡心」', hp: 14500, time: 82, pattern: 'vortex' },
      ],
    },
    {
      name: '金星守卫 · NULL-G4', short: 'NULL GUARD', sprite: 3, color: COLORS.violet,
      spells: [
        { name: '暗面「无光圆舞」', hp: 13800, time: 78, pattern: 'eclipse' },
        { name: '双星「绯蓝螺旋」', hp: 15800, time: 84, pattern: 'helix' },
        { name: '终端「万星华彩」', hp: 18200, time: 90, pattern: 'finale' },
      ],
    },
    {
      name: '苍穹守卫 · AETHER-G5', short: 'AETHER WEAVER', sprite: 0, color: COLORS.teal,
      spells: [
        { name: '星图「猎户连线」', hp: 15400, time: 82, pattern: 'constellation' },
        { name: '几何「苍穹八面体」', hp: 17600, time: 88, pattern: 'polygon' },
        { name: '天幕「群星坠阵」', hp: 20100, time: 94, pattern: 'magicstorm' },
      ],
    },
    {
      name: '幻潮守卫 · MIRAGE-G6', short: 'MIRAGE WARDEN', sprite: 1, color: COLORS.blue,
      spells: [
        { name: '摆律「镜海双钟」', hp: 17600, time: 86, pattern: 'pendulum' },
        { name: '折射「倒悬方庭」', hp: 19800, time: 92, pattern: 'mirrorgrid' },
        { name: '幻潮「万花镜回廊」', hp: 22400, time: 98, pattern: 'kaleidoscope' },
      ],
    },
    {
      name: '蚀影守卫 · UMBRA-G7', short: 'UMBRA JUDGE', sprite: 2, color: COLORS.violet,
      spells: [
        { name: '奇点「万物静止」', hp: 20200, time: 90, pattern: 'singularity' },
        { name: '逆流「时序方格」', hp: 22600, time: 96, pattern: 'chronogrid' },
        { name: '蚀影「黑星重启」', hp: 25400, time: 102, pattern: 'blackstar' },
      ],
    },
    {
      name: '天极守卫 · ZENITH-G8', short: 'ZENITH CORE', sprite: 3, color: COLORS.gold,
      spells: [
        { name: '圣堂「十二边星环」', hp: 22800, time: 94, pattern: 'cathedral' },
        { name: '终焉「几何天启」', hp: 25800, time: 102, pattern: 'apocalypse' },
        { name: '王座「天极万象」', hp: 29200, time: 110, pattern: 'zenith' },
      ],
    },
  ];

  const STORIES = [
    [
      { side: 'left', speaker: 0, text: '前方发现一颗有人居住的行星。轨道上有圆形机械体正在扫描我。' },
      { side: 'right', speaker: 1, text: 'ATLAS-G1：我是赤星轨道守卫。星球屏障异常，禁止任何外来武装靠近。' },
    ],
    [
      { side: 'left', speaker: 0, text: '第二颗行星被磁暴包围。守卫的核心似乎已经被异常信号接管。' },
      { side: 'right', speaker: 2, text: 'LUMEN-G2：保护协议优先。若无法证明无害，你必须离开紫星轨道。' },
    ],
    [
      { side: 'right', speaker: 3, text: 'VESPER-G3：粉星居民正在避难。我不能允许异常跃迁继续扩散。' },
      { side: 'left', speaker: 0, text: '我会击碎污染核心，不会伤害你保护的星球。' },
    ],
    [
      { side: 'left', speaker: 0, text: '最后一颗行星就在星门前。它的守卫仍然独自维持着破损屏障。' },
      { side: 'right', speaker: 4, text: 'NULL-G4：我的任务是保护金星。击败污染程序，我会为你打开安全航道。' },
    ],
    [
      { side: 'left', speaker: 0, text: '星图上出现了被连线包围的苍蓝行星。那台守卫正在重新编织星座。' },
      { side: 'right', speaker: 5, text: 'AETHER-G5：航路坐标遭到污染。通过我的星座试炼，我将交还导航权限。' },
    ],
    [
      { side: 'right', speaker: 6, text: 'MIRAGE-G6：镜海会复制一切威胁，包括你。请证明你能分辨真实的航道。' },
      { side: 'left', speaker: 0, text: '那就让武器的回声替我回答。爱丽丝，锁定镜像核心。' },
    ],
    [
      { side: 'left', speaker: 0, text: '这颗行星附近的时间几乎停止了，只有守卫核心还在奇点边缘运转。' },
      { side: 'right', speaker: 7, text: 'UMBRA-G7：污染正在吞噬保护协议。若你能穿过逆流，我会停止封锁。' },
    ],
    [
      { side: 'right', speaker: 8, text: 'ZENITH-G8：这里是星环王座。所有失控协议都汇聚于此，无人可以继续前进。' },
      { side: 'left', speaker: 0, text: '我不是来征服星球的。我会带着所有守卫的坐标，终止这场错误。' },
    ],
  ];

  const EPILOGUE = [
    { side: 'right', speaker: 8, text: 'ZENITH-G8：八颗行星屏障恢复。星门已重启，跃迁航道安全。' },
    { side: 'left', speaker: 0, text: '爱丽丝，准备回家。武器冷却，坐标锁定。' },
  ];

  class SoundEngine {
    constructor() {
      this.context = null;
      this.master = null;
      this.musicBus = null;
      this.sfxBus = null;
      this.compressor = null;
      this.noise = null;
      this.muted = false;
      this.clock = 0;
      this.step = 0;
      this.stage = -1;
      this.trackIndex = -1;
      this.intensityTier = 0;
      this.beatPulse = 0;
      this.beatIndex = 0;
      this.beatSerial = 0;
      this.downbeat = false;
      this.masterVolume = .82;
      this.musicVolume = .55;
      this.sfxVolume = .86;
      this.titleClock = 0;
      this.titleStep = 0;
      this.titleActive = false;
      this.tracks = [
        new Audio('assets/audio/harbor-drive.opus'),
        new Audio('assets/audio/fleet-allstars.ogg'),
      ];
      for (const track of this.tracks) { track.loop = true; track.preload = 'auto'; track.volume = 0; }
    }

    unlock() {
      if (!this.context) {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (!AudioCtx) return;
        this.context = new AudioCtx();
        this.master = this.context.createGain();
        this.musicBus = this.context.createGain();
        this.sfxBus = this.context.createGain();
        this.compressor = this.context.createDynamicsCompressor();
        this.master.gain.value = this.masterVolume;
        this.musicBus.gain.value = this.musicVolume;
        this.sfxBus.gain.value = this.sfxVolume;
        this.compressor.threshold.value = -20;
        this.compressor.knee.value = 14;
        this.compressor.ratio.value = 5;
        this.musicBus.connect(this.master);
        this.sfxBus.connect(this.master);
        this.master.connect(this.compressor).connect(this.context.destination);
        const length = this.context.sampleRate;
        this.noise = this.context.createBuffer(1, length, this.context.sampleRate);
        const data = this.noise.getChannelData(0);
        for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1;
      }
      if (this.context.state === 'suspended') this.context.resume();
    }

    setMuted(value) {
      this.muted = value;
      if (this.master) this.master.gain.setTargetAtTime(value ? 0.0001 : this.masterVolume, this.context.currentTime, 0.03);
      for (const track of this.tracks) track.muted = value;
    }

    setVolumes(master, music, sfx) {
      this.masterVolume = clamp(master, 0, 1);
      this.musicVolume = clamp(music, 0, 1);
      this.sfxVolume = clamp(sfx, 0, 1);
      if (this.context) {
        const now = this.context.currentTime;
        this.master.gain.setTargetAtTime(this.muted ? .0001 : this.masterVolume, now, .04);
        this.musicBus.gain.setTargetAtTime(this.musicVolume, now, .04);
        this.sfxBus.gain.setTargetAtTime(this.sfxVolume, now, .04);
      }
    }

    startTitle() {
      if (this.titleActive) return;
      this.titleActive = true; this.titleClock = 0; this.titleStep = 0;
      for (const track of this.tracks) { track.pause(); track.volume = 0; }
      this.trackIndex = -1; this.stage = -1;
    }

    stopMusic() {
      for (const track of this.tracks) { track.pause(); track.volume = 0; }
      this.titleActive = false; this.trackIndex = -1; this.stage = -1; this.clock = 0; this.step = 0; this.beatPulse = 0; this.beatSerial = 0;
    }

    oscillator(frequency, duration, volume, type = 'sine', bus = 'sfx', glide = null, cutoff = null) {
      if (!this.context || this.muted) return;
      const now = this.context.currentTime;
      const osc = this.context.createOscillator();
      const gain = this.context.createGain();
      const output = bus === 'music' ? this.musicBus : this.sfxBus;
      osc.type = type;
      osc.frequency.setValueAtTime(frequency, now);
      if (glide) osc.frequency.exponentialRampToValueAtTime(Math.max(28, glide), now + duration);
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(volume, now + 0.008);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
      if (cutoff) {
        const filter = this.context.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = cutoff;
        osc.connect(filter).connect(gain);
      } else osc.connect(gain);
      gain.connect(output);
      osc.start(now);
      osc.stop(now + duration + 0.02);
    }

    noiseHit(duration, volume, frequency, type = 'highpass', bus = 'music') {
      if (!this.context || this.muted || !this.noise) return;
      const now = this.context.currentTime;
      const src = this.context.createBufferSource();
      const filter = this.context.createBiquadFilter();
      const gain = this.context.createGain();
      src.buffer = this.noise;
      filter.type = type;
      filter.frequency.value = frequency;
      gain.gain.setValueAtTime(volume, now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
      src.connect(filter).connect(gain).connect(bus === 'music' ? this.musicBus : this.sfxBus);
      src.start(now);
      src.stop(now + duration);
    }

    kick(strong = false) {
      this.oscillator(strong ? 175 : 138, 0.2, strong ? 0.27 : 0.18, 'sine', 'music', 39);
      if (strong) this.noiseHit(0.025, 0.035, 5200, 'highpass');
    }
    snare(strong = false) {
      this.noiseHit(strong ? 0.18 : 0.12, strong ? 0.13 : 0.09, 1450, 'bandpass');
      this.oscillator(205, 0.09, strong ? 0.055 : 0.04, 'triangle', 'music', 118);
    }
    clap() {
      this.noiseHit(0.055, 0.042, 2400, 'bandpass');
      this.noiseHit(0.11, 0.026, 3600, 'highpass');
    }
    hat(open = false) { this.noiseHit(open ? 0.15 : 0.038, open ? 0.045 : 0.025, 6800, 'highpass'); }
    bass(note, strong = false) {
      this.oscillator(note, 0.19, strong ? 0.09 : 0.06, 'sawtooth', 'music', note * 0.94, 760);
      this.oscillator(note / 2, 0.23, strong ? 0.075 : 0.045, 'sine', 'music', note / 2 * .98);
    }
    chord(root, chord, intensity) {
      const gain = 0.018 + intensity * 0.012;
      for (const semitone of chord) this.oscillator(root * Math.pow(2, semitone / 12), 1.35, gain, 'triangle', 'music', null, 1900);
      this.oscillator(root / 2, 1.1, 0.028 + intensity * .012, 'sine', 'music', root / 2 * 1.01);
    }
    lead(note, intensity) {
      this.oscillator(note, 0.12 + intensity * 0.045, 0.025 + intensity * 0.018, intensity > 0.72 ? 'square' : 'triangle', 'music', note * 1.012, 2900);
      if (intensity > .6) this.oscillator(note * 1.005, 0.09, 0.012, 'sawtooth', 'music', note * .995, 2200);
    }

    setStage(stage) {
      if (this.stage === stage) return;
      this.titleActive = false;
      this.stage = stage;
      this.clock = 0;
      this.step = 0;
      this.intensityTier = 0;
      const nextTrack = stage < 2 || stage === 4 || stage === 5 ? 0 : 1;
      if (this.trackIndex !== nextTrack) {
        this.trackIndex = nextTrack;
        const track = this.tracks[nextTrack];
        track.currentTime = 0;
        track.play().catch(() => {});
      }
      const roots = [196, 165, 147, 130.81, 174.61, 155.56, 123.47, 110];
      const root = roots[stage] || roots[stage % roots.length];
      this.oscillator(root, 0.58, 0.095, 'sawtooth', 'music', root * 2, 1800);
      this.oscillator(root * 1.5, 0.66, 0.065, 'triangle', 'music', root * 3);
      this.noiseHit(.22, .055, 4200, 'highpass');
    }

    updateMusic(dt, stage, spell, intensity) {
      if (!this.context || this.muted) return;
      this.beatPulse = Math.max(0, this.beatPulse - dt * 7.5);
      this.downbeat = false;
      this.setStage(stage);
      const tier = intensity > .78 ? 2 : intensity > .52 ? 1 : 0;
      if (tier > this.intensityTier) {
        this.noiseHit(.34, .065, 3600, 'highpass');
        this.oscillator(220 + stage * 36, .42, .055, 'sawtooth', 'music', 440 + stage * 70, 2600);
      }
      this.intensityTier = tier;
      for (let i = 0; i < this.tracks.length; i++) {
        const track = this.tracks[i];
        const target = i === this.trackIndex ? 0.24 + Math.min(.12, intensity * .12) : 0;
        track.volume += (target - track.volume) * Math.min(1, dt * 1.7);
        track.playbackRate = 1 + Math.min(.065, intensity * .045);
        if (i === this.trackIndex && track.paused) track.play().catch(() => {});
      }
      const bpm = [132, 146, 158, 168, 176, 182, 188, 194][stage] + spell * 4 + Math.floor(intensity * 10);
      const interval = 60 / bpm / 4;
      this.clock += dt;
      const theme = stage % 8;
      const roots = [98, 110, 82.41, 73.42, 87.31, 77.78, 61.74, 65.41];
      const scales = [
        [0, 3, 7, 10, 7, 12, 10, 7],
        [0, 5, 7, 12, 10, 7, 5, 3],
        [0, 3, 8, 10, 12, 15, 12, 8],
        [0, 1, 6, 8, 11, 13, 8, 6],
        [0, 4, 7, 11, 14, 11, 7, 4],
        [0, 2, 7, 9, 12, 14, 9, 7],
        [0, 1, 6, 7, 10, 6, 3, 1],
        [0, 5, 8, 11, 15, 12, 8, 6],
      ];
      while (this.clock >= interval) {
        this.clock -= interval;
        const s = this.step % 16;
        const bar = Math.floor(this.step / 16);
        const root = roots[theme] * (stage >= 4 ? .89 : 1);
        const progression = [[0, -2, -5, -7], [0, -5, -2, -7], [0, -4, -7, -2], [0, -1, -6, -4], [0, 5, -2, 7], [0, -3, -7, -5], [0, -1, -6, -8], [0, -5, -7, -1]][theme];
        const harmonicRoot = root * Math.pow(2, progression[bar % 4] / 12);
        const semitone = scales[theme][Math.floor(s / 2) % 8];
        const note = harmonicRoot * Math.pow(2, semitone / 12);
        if (s % 4 === 0) {
          this.beatPulse = 1;
          this.beatIndex = s / 4;
          this.beatSerial += 1;
          this.downbeat = s === 0;
        }
        if (s === 0) this.chord(harmonicRoot * 2, theme === 3 ? [0, 3, 6, 10] : [0, 3, 7, 10], intensity);
        if (s === 0 || s === 8 || (theme === 2 && s % 4 === 2) || (intensity > .66 && (s === 6 || s === 14))) this.kick(s === 0);
        if ((theme === 6 ? s === 8 : s === 4 || s === 12)) { this.snare((s === 12 || theme === 6) && intensity > .72); this.clap(); }
        if (s % 2 === 0 || intensity > 0.48) this.hat(s === 14 && intensity > 0.48);
        if (intensity > .76 && s % 4 === 3) this.hat(false);
        if (s % 4 === 0 || (intensity > 0.7 && s % 2 === 0)) this.bass(note, s === 0 || s === 8);
        if ((s + spell + theme) % (intensity > 0.62 ? 2 : 4) === 0) this.lead(note * (theme === 3 || theme === 6 ? 4 : 2), intensity);
        if (theme === 4 && (s === 3 || s === 7 || s === 11 || s === 15)) this.oscillator(note * 3, .16, .014, 'triangle', 'music', note * 4, 3200);
        if (theme === 5 && s % 4 === 1) this.oscillator(note, .2, .016, 'sine', 'music', note * .5, 1800);
        if (intensity > .7 && (s === 7 || s === 15)) this.oscillator(note * 4, .08, .018, 'square', 'music', note * 5, 3600);
        this.step += 1;
      }
    }

    updateTitleMusic(dt) {
      if (!this.context || this.muted || !this.titleActive) return;
      this.titleClock += dt;
      const interval = 60 / 92 / 2;
      const notes = [261.63, 329.63, 392, 493.88, 440, 392, 329.63, 293.66];
      while (this.titleClock >= interval) {
        this.titleClock -= interval;
        const step = this.titleStep++;
        const note = notes[step % notes.length];
        this.oscillator(note, .7, .018, 'sine', 'music', note * 1.008, 2400);
        this.oscillator(note / 2, 1.15, .012, 'triangle', 'music', note / 2 * .998, 1100);
        if (step % 4 === 0) {
          this.oscillator(note / 4, 1.8, .018, 'sine', 'music', note / 4 * 1.01, 600);
          this.chord(note, [0, 4, 7, 12], .08);
        }
        if (step % 8 === 6) this.noiseHit(.32, .008, 5200, 'highpass', 'music');
      }
    }

    shot(accent = false) { this.oscillator(accent ? 630 : 540, 0.045, accent ? 0.038 : 0.026, 'square', 'sfx', accent ? 1180 : 920); this.oscillator(1060, 0.032, accent ? 0.022 : 0.014, 'triangle', 'sfx', 1320); }
    graze() { this.oscillator(1150, 0.045, 0.045, 'sine', 'sfx', 1550); }
    hit() { this.noiseHit(0.08, 0.045, 900, 'bandpass', 'sfx'); this.oscillator(220, 0.12, 0.055, 'triangle', 'sfx', 120); }
    bossHit() { this.oscillator(280, 0.035, 0.025, 'square', 'sfx', 180); }
    spell() { this.oscillator(260, 0.42, 0.09, 'sawtooth', 'sfx', 720); this.noiseHit(0.3, 0.08, 2500, 'highpass', 'sfx'); }
    burst() { this.oscillator(92, 0.72, 0.18, 'sawtooth', 'sfx', 980); this.noiseHit(0.55, 0.12, 800, 'bandpass', 'sfx'); }
    break() { this.oscillator(540, 0.28, 0.11, 'triangle', 'sfx', 1080); }
    death() { this.oscillator(180, 0.9, 0.18, 'sawtooth', 'sfx', 34); this.noiseHit(0.8, 0.16, 420, 'lowpass', 'sfx'); }
    dialogue() { this.oscillator(620, 0.035, 0.022, 'triangle', 'sfx', 680); }
    core() { this.oscillator(660, 0.12, 0.08, 'triangle', 'sfx', 990); }
    laserWarn() { this.oscillator(310, 0.42, 0.075, 'sawtooth', 'sfx', 690, 1800); }
    laserFire() { this.oscillator(74, 0.62, 0.18, 'sawtooth', 'sfx', 46, 900); this.noiseHit(.44, .11, 1100, 'bandpass', 'sfx'); }
  }

  const sound = new SoundEngine();
  const keys = Object.create(null);
  const bullets = [];
  const shots = [];
  const particles = [];
  const floaters = [];
  const shockwaves = [];
  const lasers = [];
  const bulletCache = new Map();
  const playerShotCache = new Map();
  const stars = Array.from({ length: 54 }, () => ({ x: rand(0, W), y: rand(0, H), speed: rand(12, 48), size: rand(0.5, 1.8), alpha: rand(0.2, 0.85) }));

  function loadStored(key, fallback) {
    try { return { ...fallback, ...JSON.parse(localStorage.getItem(key) || '{}') }; } catch { return { ...fallback }; }
  }

  const LEGAL_VERSION = 'ORBIT-LEGAL-2026.08';
  const profile = loadStored('star-ring-profile', { name: '', shareRanking: true, privacyAcceptedAt: '', privacyVersion: '' });
  if (profile.name && containsBlockedNickname(profile.name)) profile.name = '';
  const settings = loadStored('star-ring-settings', { master: 82, music: 55, sfx: 86, shake: true, beat: true });

  function saveProfile() {
    try { localStorage.setItem('star-ring-profile', JSON.stringify(profile)); } catch { /* unavailable */ }
  }

  function saveSettings() {
    try { localStorage.setItem('star-ring-settings', JSON.stringify(settings)); } catch { /* unavailable */ }
  }

  const player = { x: W / 2, y: H - 94, hp: 300, maxHp: 300, cores: 2, invulnerable: 0, fireClock: 0, recoil: 0, focus: false };
  const boss = { x: W / 2, y: 156, hp: 1, maxHp: 1, timer: 0, phase: 'idle', phaseClock: 0, flash: 0, rage: 0 };
  const game = {
    mode: 'title', difficulty: 'normal', stage: 0, spell: 0, time: 0,
    score: 0, graze: 0, chain: 1, maxChain: 1, combo: 0, maxCombo: 0, comboClock: 0,
    best: loadBest(), pattern: null, banner: 0, shake: 0, flash: 0, hitstop: 0,
    pointerActive: false, pointerType: 'mouse', lastGrazeSound: 0, nextCoreGraze: 80,
    cinematic: null, dialogue: null, coreToastClock: 0, hudSignature: '',
    invincible: QA_MODE, beatSerial: -1, selectedGalaxy: 0, selectedCommunity: null, runSingle: true,
    damageTaken: 0, hitsTaken: 0, spellsCaptured: 0, finalScore: 0,
    rankingEligible: !QA_MODE, debugUsed: QA_MODE, hubToken: 0,
    timeEffect: { mode: 'none', clock: 0, duration: 0, next: null, serial: 0 },
  };

  const chartCamera = { x: 0, y: 0, scale: 1, dragging: false, startX: 0, startY: 0, originX: 0, originY: 0, pinchDistance: 0, pinchScale: 1, pinchWorldX: 0, pinchWorldY: 0 };
  const chartPointers = new Map();
  let communityLevels = [];

  function loadBest() {
    try { return Number(localStorage.getItem('neon-rift-best') || 0); } catch { return 0; }
  }
  function saveBest() {
    try { localStorage.setItem('neon-rift-best', String(game.best)); } catch { /* unavailable */ }
  }
  function difficulty() {
    const galaxyPressure = clamp(game.stage, 0, GALAXIES.length - 1);
    return game.difficulty === 'hard'
      ? { rate: .94, speed: .98, hp: 1.2, score: 1.45, playerDamage: 38 }
      : { rate: .72 + galaxyPressure * .055, speed: Math.min(1.04, .88 + galaxyPressure * .022), hp: 1, score: 1 + galaxyPressure * .08, playerDamage: 26 + galaxyPressure * 2 };
  }

  function resizeCanvas() {
    const rect = canvas.getBoundingClientRect();
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const width = Math.max(1, Math.round(rect.width * dpr));
    const height = Math.max(1, Math.round(rect.height * dpr));
    if (canvas.width !== width || canvas.height !== height) { canvas.width = width; canvas.height = height; }
  }

  function resetRun() {
    Object.assign(game, { stage: 0, spell: 0, time: 0, score: 0, graze: 0, chain: 1, maxChain: 1, combo: 0, maxCombo: 0, comboClock: 0, shake: 0, flash: 0, hitstop: 0, nextCoreGraze: 80, cinematic: null, beatSerial: -1, damageTaken: 0, hitsTaken: 0, spellsCaptured: 0, finalScore: 0, rankingEligible: !game.invincible, debugUsed: game.invincible });
    Object.assign(game.timeEffect, { mode: 'none', clock: 0, duration: 0, next: null });
    bullets.length = 0; shots.length = 0; particles.length = 0; floaters.length = 0; shockwaves.length = 0; lasers.length = 0;
    Object.assign(player, { x: W / 2, y: H - 94, hp: 300, maxHp: 300, cores: 2, invulnerable: 1.8, fireClock: 0, recoil: 0 });
    boss.phase = 'idle';
    updateHud(true);
  }

  function applySettings() {
    sound.setVolumes(settings.master / 100, settings.music / 100, settings.sfx / 100);
    document.body.classList.toggle('reduced-shake', !settings.shake);
    document.body.classList.toggle('reduced-beat', !settings.beat);
    const controls = [['masterVolume', 'master'], ['musicVolume', 'music'], ['sfxVolume', 'sfx']];
    for (const [id, key] of controls) { const input = $(id); const output = $(`${id}Value`); if (input) input.value = settings[key]; if (output) output.value = settings[key]; }
    if ($('shakeToggle')) $('shakeToggle').checked = settings.shake;
    if ($('beatToggle')) $('beatToggle').checked = settings.beat;
    if ($('shareRankingToggle')) $('shareRankingToggle').checked = profile.shareRanking;
    ui.profileName.textContent = profile.name || '未登录';
  }

  function openProfile() {
    $('playerNameInput').value = profile.name;
    $('profileShare').checked = profile.shareRanking;
    $('privacyConsent').checked = profile.privacyVersion === LEGAL_VERSION;
    $('profileError').classList.add('hidden');
    ui.profileGate.classList.remove('hidden');
    setTimeout(() => $('playerNameInput').focus(), 30);
  }

  function switchHub(name) {
    document.querySelectorAll('[data-hub]').forEach((button) => button.classList.toggle('active', button.dataset.hub === name));
    const token = ++game.hubToken;
    const target = name === 'home' ? null : $(`${name}Panel`);
    const current = [...document.querySelectorAll('.hub-panel')].find((panel) => !panel.classList.contains('hidden')) || null;
    ui.start.classList.toggle('home-active', name === 'home');
    if (current && current !== target) {
      current.classList.remove('hub-enter'); current.classList.add('hub-exit');
      setTimeout(() => { if (!current.classList.contains('hub-exit')) return; current.classList.add('hidden'); current.classList.remove('hub-exit'); }, 220);
    }
    if (target && target !== current) {
      target.classList.remove('hidden', 'hub-exit');
      target.classList.add('hub-enter');
      setTimeout(() => target.classList.remove('hub-enter'), 460);
    }
    if (name === 'ranking') loadRankings(ui.rankingGalaxy.value);
  }

  async function loadRankings(galaxy = 'all') {
    ui.rankingStatus.textContent = '正在连接排名服务...';
    try {
      const response = await fetch(`/api/rankings?galaxy=${encodeURIComponent(galaxy)}`);
      if (!response.ok) throw new Error('ranking unavailable');
      const data = await response.json();
      ui.rankingList.replaceChildren(...data.rankings.map((row) => {
        const item = document.createElement('li');
        const name = document.createElement('b'); name.textContent = row.name;
        const target = document.createElement('span'); target.textContent = GALAXIES.find((entry) => entry.id === row.galaxy)?.name || row.galaxy;
        const score = document.createElement('strong'); score.textContent = Number(row.score).toLocaleString('zh-CN');
        item.append(name, target, score); return item;
      }));
      ui.rankingStatus.textContent = data.rankings.length ? `已同步 ${data.rankings.length} 条公开记录` : '该星系暂时没有公开记录';
      const selected = GALAXIES[game.selectedGalaxy];
      const best = data.rankings.find((row) => row.galaxy === selected.id) || (galaxy === selected.id ? data.rankings[0] : null);
      $('galaxyRecord').textContent = best ? `${best.name} · ${Number(best.score).toLocaleString('zh-CN')}` : '暂无公开记录';
    } catch {
      ui.rankingStatus.textContent = '排名服务未连接；请使用项目自带的 Node 服务启动游戏';
      ui.rankingList.replaceChildren();
      $('galaxyRecord').textContent = '服务未连接';
    }
  }

  async function submitRanking() {
    if (!profile.name || !profile.shareRanking || !game.runSingle || !game.rankingEligible || game.debugUsed) return;
    try {
      await fetch('/api/rankings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: profile.name, visible: true, galaxy: GALAXIES[game.selectedGalaxy].id, score: Math.round(game.finalScore), maxCombo: game.maxCombo, eligible: true, debugUsed: false }) });
    } catch { /* local best remains available */ }
  }

  function escapeMailText(value) {
    return String(value || '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
  }

  async function loadHomeMail(open = false) {
    if (open) ui.homeMailPanel.classList.remove('hidden');
    ui.homeMailList.innerHTML = '<p>正在同步星环消息...</p>';
    try {
      const creatorToken = localStorage.getItem('orbit-creator-token') || '';
      const response = await fetch('/api/inbox', { headers: creatorToken ? { Authorization: `Bearer ${creatorToken}` } : {} });
      const data = await response.json();
      const readAnnouncements = new Set(JSON.parse(localStorage.getItem('orbit-read-announcements') || '[]'));
      const rows = [...(data.messages || []), ...(data.announcements || []).map((item) => ({ ...item, type: 'announcement', readAt: readAnnouncements.has(item.id) ? 'local' : null }))].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      $('homeMailDot').classList.toggle('active', rows.some((item) => !item.readAt));
      $('homeMailAccount').textContent = data.user ? `创作者账号：${data.user.displayName}` : '公开公告频道 · 登录工坊后可查看审核回执';
      if (!rows.length) { ui.homeMailList.innerHTML = '<p>暂时没有公告或邮件。</p>'; return; }
      ui.homeMailList.replaceChildren(...rows.map((mail) => {
        const item = document.createElement('article'); item.className = `home-mail-item${mail.readAt ? '' : ' unread'}`; item.tabIndex = 0;
        item.innerHTML = `<span>${mail.type === 'announcement' ? 'SYSTEM ANNOUNCEMENT' : 'CREATOR MESSAGE'}${mail.readAt ? '' : ' · NEW'}</span><b>${escapeMailText(mail.title)}</b><p>${escapeMailText(mail.body)}</p><time>${new Date(mail.createdAt).toLocaleString('zh-CN')}</time>`;
        const expand = async () => {
          item.classList.toggle('open');
          if (!item.classList.contains('open') || !item.classList.contains('unread')) return;
          item.classList.remove('unread'); mail.readAt = new Date().toISOString();
          if (mail.type === 'announcement') {
            readAnnouncements.add(mail.id); localStorage.setItem('orbit-read-announcements', JSON.stringify([...readAnnouncements].slice(-200)));
          } else if (creatorToken) {
            try { await fetch('/api/inbox/read', { method: 'POST', headers: { Authorization: `Bearer ${creatorToken}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ id: mail.id }) }); } catch { /* retry on next open */ }
          }
          $('homeMailDot').classList.toggle('active', rows.some((row) => !row.readAt));
        };
        item.addEventListener('click', expand); item.addEventListener('keydown', (event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); expand(); } }); return item;
      }));
    } catch { ui.homeMailList.innerHTML = '<p>消息服务暂时无法连接。</p>'; }
  }

  function drawStarMap() {
    const map = $('starMapCanvas');
    if (!map || map.dataset.ready) return;
    const g = map.getContext('2d');
    const centerX = CHART_W / 2; const centerY = CHART_H / 2;
    let seed = 0x5f3759df;
    const seeded = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
    const bg = g.createRadialGradient(centerX, centerY, 60, centerX, centerY, 1520);
    bg.addColorStop(0, 'rgba(41,19,77,.98)'); bg.addColorStop(.28, 'rgba(16,28,69,.96)'); bg.addColorStop(.68, 'rgba(6,10,27,.78)'); bg.addColorStop(1, 'rgba(2,4,13,0)');
    g.fillStyle = bg; g.fillRect(0, 0, map.width, map.height);
    g.globalCompositeOperation = 'lighter';
    for (let arm = 0; arm < 5; arm++) {
      for (let i = 0; i < 330; i++) {
        const radius = 40 + Math.pow(seeded(), .62) * 1580;
        const angle = arm / 5 * TAU + radius * .0058 + (seeded() - .5) * (.22 + radius / 1900);
        const x = centerX + Math.cos(angle) * radius * 1.04;
        const y = centerY + Math.sin(angle) * radius * .64;
        const alpha = .09 + seeded() * .5; const size = seeded() > .93 ? 2.4 : .6 + seeded() * 1.25;
        g.fillStyle = seeded() > .72 ? `rgba(120,222,255,${alpha})` : `rgba(255,190,245,${alpha})`;
        g.fillRect(x, y, size, size);
      }
    }
    g.globalCompositeOperation = 'source-over';
    for (let i = 0; i < 150; i++) {
      const x = seeded() * map.width; const y = seeded() * map.height; const size = seeded() > .94 ? 2.2 : .7;
      g.fillStyle = `rgba(235,249,255,${.2 + seeded() * .75})`; g.fillRect(x, y, size, size);
    }
    const points = [...document.querySelectorAll('.galaxy-node')].map((node) => ({ x: Number(node.dataset.x), y: Number(node.dataset.y) }));
    g.strokeStyle = 'rgba(112,207,255,.14)'; g.lineWidth = 1;
    for (let i = 0; i < points.length - 1; i++) { g.beginPath(); g.moveTo(points[i].x, points[i].y); g.lineTo(points[i + 1].x, points[i + 1].y); g.stroke(); }

    for (let i = 0; i < 44; i++) {
      const side = i % 4; const along = seeded(); const depth = 70 + seeded() * 430;
      const x = side === 0 ? depth : side === 1 ? CHART_W - depth : along * CHART_W;
      const y = side === 2 ? depth : side === 3 ? CHART_H - depth : along * CHART_H;
      const radius = 190 + seeded() * 460;
      const cloud = g.createRadialGradient(x, y, 0, x, y, radius);
      cloud.addColorStop(0, i % 3 ? 'rgba(75,46,125,.34)' : 'rgba(25,94,136,.28)');
      cloud.addColorStop(.48, 'rgba(20,24,65,.18)'); cloud.addColorStop(1, 'rgba(2,4,13,0)');
      g.fillStyle = cloud; g.fillRect(x - radius, y - radius, radius * 2, radius * 2);
    }
    const edgeFog = [
      [0, 0, 620, 0], [CHART_W, 0, CHART_W - 620, 0], [0, 0, 0, 520], [0, CHART_H, 0, CHART_H - 520],
    ];
    for (let i = 0; i < edgeFog.length; i++) {
      const [x0, y0, x1, y1] = edgeFog[i]; const fog = g.createLinearGradient(x0, y0, x1, y1);
      fog.addColorStop(0, i % 2 ? 'rgba(32,12,72,.96)' : 'rgba(10,58,91,.94)'); fog.addColorStop(.36, i % 2 ? 'rgba(87,35,128,.62)' : 'rgba(24,102,132,.58)'); fog.addColorStop(1, 'rgba(2,4,13,0)');
      g.fillStyle = fog; g.fillRect(0, 0, CHART_W, CHART_H);
    }
    g.globalCompositeOperation = 'destination-in';
    const fade = g.createRadialGradient(centerX, centerY, 520, centerX, centerY, 1940);
    fade.addColorStop(0, 'rgba(0,0,0,1)'); fade.addColorStop(.68, 'rgba(0,0,0,.96)'); fade.addColorStop(.86, 'rgba(0,0,0,.56)'); fade.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = fade; g.fillRect(0, 0, CHART_W, CHART_H); g.globalCompositeOperation = 'source-over';
    map.dataset.ready = 'true';
  }

  function createCommunityNode(level, index) {
    const node = document.createElement('button'); const chart = level.chart || { x: 520 + index * 210, y: 430 + index * 170 };
    node.type = 'button'; node.className = `galaxy-node community-node community-variant-${Number(chart.variant) || 0}`; node.dataset.levelId = level.id; node.dataset.x = String(chart.x); node.dataset.y = String(chart.y); node.style.setProperty('--gx', `${chart.x}px`); node.style.setProperty('--gy', `${chart.y}px`); node.style.setProperty('--community-accent', level.accent || '#57F0E4'); node.setAttribute('role', 'option'); node.setAttribute('aria-selected', 'false');
    const planet = document.createElement('i'); planet.className = 'planet'; const name = document.createElement('span'); name.textContent = level.planetName; const meta = document.createElement('small'); meta.textContent = `WORKSHOP // ${String(index + 1).padStart(2, '0')}`; node.append(planet, name, meta); node.addEventListener('click', () => selectCommunityLevel(level, node)); return node;
  }

  async function loadCommunityGalaxies() {
    try {
      const response = await fetch('/api/levels'); if (!response.ok) throw new Error('levels_unavailable'); const result = await response.json(); communityLevels = Array.isArray(result.levels) ? result.levels : [];
      ui.galaxyTrack.querySelectorAll('.community-node').forEach((node) => node.remove()); communityLevels.forEach((level, index) => ui.galaxyTrack.appendChild(createCommunityNode(level, index)));
      const map = $('starMapCanvas'); if (map) { delete map.dataset.ready; map.getContext('2d').clearRect(0, 0, map.width, map.height); }
    } catch { communityLevels = []; }
  }

  function clampChartCamera() {
    const rect = ui.galaxyStage.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const edgeGuard = Math.min(150, Math.max(32, rect.width * .09));
    const scaledWidth = CHART_W * chartCamera.scale; const scaledHeight = CHART_H * chartCamera.scale;
    if (scaledWidth <= rect.width + edgeGuard * 2) chartCamera.x = (rect.width - scaledWidth) / 2;
    else chartCamera.x = clamp(chartCamera.x, rect.width + edgeGuard - scaledWidth, -edgeGuard);
    if (scaledHeight <= rect.height + edgeGuard * 2) chartCamera.y = (rect.height - scaledHeight) / 2;
    else chartCamera.y = clamp(chartCamera.y, rect.height + edgeGuard - scaledHeight, -edgeGuard);
  }

  function chartMinimumScale() {
    const rect = ui.galaxyStage.getBoundingClientRect();
    if (!rect.width || !rect.height) return .5;
    return clamp(Math.max(.5, (rect.width + 160) / CHART_W, (rect.height + 160) / CHART_H), .5, 1.05);
  }

  function applyChartTransform(animated = true) {
    clampChartCamera();
    ui.galaxyStage.scrollLeft = 0; ui.galaxyStage.scrollTop = 0; shell.scrollLeft = 0; shell.scrollTop = 0;
    ui.galaxyCamera.style.transition = animated ? 'transform 1.05s cubic-bezier(.16,.82,.2,1)' : 'none';
    ui.galaxyCamera.style.transform = `translate(${chartCamera.x}px, ${chartCamera.y}px) scale(${chartCamera.scale})`;
  }

  function resetGalaxyOverview(animated = true) {
    const rect = ui.galaxyStage.getBoundingClientRect();
    const mobile = rect.width < 700;
    chartCamera.scale = mobile ? .78 : clamp(Math.min(rect.width / CHART_W, rect.height / CHART_H) * 2, .62, .76);
    chartCamera.x = rect.width / 2 - CHART_W * .5 * chartCamera.scale;
    chartCamera.y = rect.height / 2 - CHART_H * .5 * chartCamera.scale;
    ui.galaxy.classList.add('overview'); ui.galaxy.classList.remove('inspecting');
    ui.galaxyInfo.classList.add('hidden'); $('galaxyModeTitle').textContent = '拖动星图并选择目标';
    document.querySelectorAll('.galaxy-node').forEach((node) => { node.classList.remove('selected'); node.setAttribute('aria-selected', 'false'); });
    game.selectedCommunity = null; $('deployBtn').innerHTML = '<span>▶</span> 跃迁至目标星系';
    $('galaxyIndex').textContent = `${String(GALAXIES.length + communityLevels.length).padStart(2, '0')} SYSTEMS`;
    applyChartTransform(animated);
  }

  function focusGalaxy(index, animated = true) {
    const node = document.querySelector(`.galaxy-node[data-galaxy="${index}"]`);
    if (!node) return;
    const rect = ui.galaxyStage.getBoundingClientRect();
    const mobile = rect.width < 700;
    chartCamera.scale = mobile ? 1.08 : 1.34;
    const focusX = mobile ? rect.width * .5 : rect.width * .34;
    const focusY = mobile ? rect.height * .33 : rect.height * .52;
    chartCamera.x = focusX - Number(node.dataset.x) * chartCamera.scale;
    chartCamera.y = focusY - Number(node.dataset.y) * chartCamera.scale;
    applyChartTransform(animated);
  }

  function selectGalaxy(index, inspect = true) {
    game.selectedCommunity = null;
    game.selectedGalaxy = (index + GALAXIES.length) % GALAXIES.length;
    const data = GALAXIES[game.selectedGalaxy];
    document.querySelectorAll('.galaxy-node').forEach((node, i) => { const selected = i === game.selectedGalaxy; node.classList.toggle('selected', selected); node.setAttribute('aria-selected', String(selected)); });
    $('galaxyIndex').textContent = `${String(game.selectedGalaxy + 1).padStart(2, '0')} / ${String(GALAXIES.length).padStart(2, '0')}`;
    $('galaxyThreat').textContent = data.threat; $('galaxyName').textContent = data.name; $('galaxyDesc').textContent = data.desc;
    $('galaxyGuardian').textContent = data.guardian; $('galaxyRhythm').textContent = data.rhythm; $('galaxyRecord').textContent = '正在同步...';
    if (inspect) {
      ui.galaxy.classList.remove('overview'); ui.galaxy.classList.add('inspecting'); ui.galaxyInfo.classList.remove('hidden');
      $('galaxyModeTitle').textContent = '目标已锁定 · 确认折跃'; focusGalaxy(game.selectedGalaxy);
    }
    loadRankings(data.id);
  }

  function selectCommunityLevel(level, node, inspect = true) {
    game.selectedCommunity = level;
    document.querySelectorAll('.galaxy-node').forEach((item) => { const selected = item === node; item.classList.toggle('selected', selected); item.setAttribute('aria-selected', String(selected)); });
    const position = communityLevels.findIndex((item) => item.id === level.id) + 1; $('galaxyIndex').textContent = `玩家星球 ${String(position).padStart(2, '0')}`;
    $('galaxyThreat').textContent = `危险等级 ${level.difficulty}`; $('galaxyName').textContent = level.planetName; $('galaxyDesc').textContent = level.description;
    $('galaxyGuardian').textContent = `${level.author} / 工坊守卫`; $('galaxyRhythm').textContent = `${level.phaseCount || 1} 阶段 · ${level.skillCount || 0} 个弹幕片段`; $('galaxyRecord').textContent = '已通过人工试玩审核'; $('deployBtn').innerHTML = '<span>▶</span> 试玩玩家关卡';
    if (inspect) {
      ui.galaxy.classList.remove('overview'); ui.galaxy.classList.add('inspecting'); ui.galaxyInfo.classList.remove('hidden'); $('galaxyModeTitle').textContent = '玩家关卡已锁定 · 确认折跃';
      const rect = ui.galaxyStage.getBoundingClientRect(); const mobile = rect.width < 700; chartCamera.scale = mobile ? 1.08 : 1.34; chartCamera.x = (mobile ? rect.width * .5 : rect.width * .34) - Number(node.dataset.x) * chartCamera.scale; chartCamera.y = (mobile ? rect.height * .33 : rect.height * .52) - Number(node.dataset.y) * chartCamera.scale; applyChartTransform(true);
    }
  }

  async function showGalaxyMap() {
    if (!profile.name) { openProfile(); return; }
    sound.unlock(); sound.startTitle(); shell.classList.add('chart-mode');
    ui.start.classList.add('hidden'); ui.galaxy.classList.remove('hidden');
    window.scrollTo(0, 0); shell.scrollTop = 0; shell.scrollLeft = 0;
    ui.galaxy.classList.remove('launching'); ui.galaxy.classList.add('map-entering'); $('warpCaption').classList.add('hidden');
    await loadCommunityGalaxies(); drawStarMap(); requestAnimationFrame(() => resetGalaxyOverview(false));
    setTimeout(() => ui.galaxy.classList.remove('map-entering'), 1050);
    setTimeout(() => { if (!ui.galaxy.classList.contains('hidden') && ui.galaxy.classList.contains('overview')) resetGalaxyOverview(true); }, 520); updateHud(true);
  }

  function deployGalaxy() {
    if (ui.galaxy.classList.contains('launching') || !ui.galaxy.classList.contains('inspecting')) return;
    sound.unlock(); ui.galaxy.classList.add('launching'); $('warpCaption').classList.remove('hidden');
    $('warpTarget').textContent = game.selectedCommunity ? `WORKSHOP // ${game.selectedCommunity.planetName}` : `TARGET // ${GALAXIES[game.selectedGalaxy].id.toUpperCase()}`;
    setTimeout(() => { if (game.selectedCommunity) location.href = game.selectedCommunity.playUrl; else { ui.galaxy.classList.add('hidden'); startRun(); } }, 1850);
  }

  function startRun() {
    window.scrollTo(0, 0); shell.scrollTop = 0; shell.scrollLeft = 0;
    sound.unlock(); shell.classList.remove('chart-mode');
    sound.stopMusic();
    ui.start.classList.add('hidden'); ui.galaxy.classList.add('hidden'); ui.pause.classList.add('hidden'); ui.result.classList.add('hidden');
    resetRun();
    const target = game.selectedGalaxy;
    game.stage = target;
    showDialogue(STORIES[target], [0, target + 1], () => beginStage(target));
  }

  function showTitle() {
    window.scrollTo(0, 0); shell.scrollTop = 0; shell.scrollLeft = 0;
    game.mode = 'title'; game.dialogue = null; game.cinematic = null; shell.classList.remove('chart-mode');
    sound.startTitle();
    bullets.length = 0; shots.length = 0; lasers.length = 0;
    ui.start.classList.remove('hidden'); ui.galaxy.classList.add('hidden'); ui.pause.classList.add('hidden'); ui.result.classList.add('hidden'); ui.dialogue.classList.add('hidden');
    switchHub('home');
    ui.pauseBtn.textContent = 'Ⅱ'; updateHud(true);
  }

  function togglePause(force) {
    if (game.mode !== 'playing' && game.mode !== 'paused') return;
    const pause = typeof force === 'boolean' ? force : game.mode === 'playing';
    game.mode = pause ? 'paused' : 'playing';
    ui.pause.classList.toggle('hidden', !pause); ui.pauseBtn.textContent = pause ? '▶' : 'Ⅱ'; updateHud(true);
  }

  function showDialogue(lines, cast, done) {
    game.mode = 'dialogue';
    game.dialogue = { lines, cast, index: 0, shown: 0, done };
    ui.dialogue.classList.remove('hidden');
    renderDialogue(); updateHud(true);
  }

  function portraitPosition(index) { return index <= 1 ? '0% 50%' : `${(index - 1) * 33.333}% 50%`; }
  function renderDialogue() {
    const d = game.dialogue;
    if (!d) return;
    const line = d.lines[d.index];
    ui.dialogueLeft.style.backgroundPosition = 'center bottom';
    ui.dialogueRight.style.backgroundPosition = portraitPosition(d.cast[1]);
    ui.dialogueLeft.classList.toggle('active', line.side === 'left');
    ui.dialogueRight.classList.toggle('active', line.side === 'right');
    ui.dialogueName.textContent = NAMES[line.speaker];
    ui.dialogueText.textContent = '';
  }

  function advanceDialogue() {
    const d = game.dialogue;
    if (!d) return;
    const line = d.lines[d.index];
    if (d.shown < line.text.length) { d.shown = line.text.length; ui.dialogueText.textContent = line.text; return; }
    sound.dialogue();
    d.index += 1; d.shown = 0;
    if (d.index >= d.lines.length) {
      const done = d.done; game.dialogue = null; ui.dialogue.classList.add('hidden'); done();
    } else renderDialogue();
  }

  function beginStage(index) {
    game.mode = 'playing'; game.stage = index; game.spell = 0;
    bullets.length = 0; shots.length = 0; lasers.length = 0;
    boss.x = W / 2; boss.y = 156; boss.phase = 'entrance'; boss.phaseClock = 2.35; boss.flash = 0;
    game.cinematic = { type: 'entrance', t: 0, duration: 2.35 };
    sound.setStage(index); sound.spell(); updateHud(true);
    if (QA_MODE) { game.cinematic.t = .78; boss.phaseClock -= .78; togglePause(true); ui.pause.classList.add('hidden'); }
  }

  function beginSpell() {
    const spell = STAGES[game.stage].spells[game.spell];
    boss.maxHp = Math.round(spell.hp * difficulty().hp);
    boss.hp = boss.maxHp; boss.timer = QA_MODE ? 999 : spell.time; boss.phase = 'spellIntro'; boss.phaseClock = 1.25; boss.rage = 0;
    game.pattern = { t: 0, clocks: Object.create(null), count: 0 };
    game.banner = 2.6; game.cinematic = { type: 'spell', t: 0, duration: 1.25 };
    bullets.length = 0; shots.length = 0; lasers.length = 0; sound.spell(); updateHud(true);
  }

  function grantCore(reason) {
    if (player.cores >= 5) { game.score += 8000 * game.chain; showCoreToast('库存已满，转化为分数'); return; }
    player.cores += 1; sound.core(); showCoreToast(reason); updateHud(true);
  }

  function showCoreToast(reason) {
    ui.coreReason.textContent = reason;
    ui.coreToast.classList.add('hidden');
    void ui.coreToast.offsetWidth;
    ui.coreToast.classList.remove('hidden');
    game.coreToastClock = 2.2;
  }

  function endSpell(captured) {
    if (boss.phase !== 'active') return;
    const stage = STAGES[game.stage];
    const last = game.spell === stage.spells.length - 1;
    clearBullets(captured ? 34 : 8); lasers.length = 0;
    if (captured) {
      game.spellsCaptured += 1;
      game.score += Math.round((18000 + boss.timer * 520) * difficulty().score * game.chain);
      player.hp = Math.min(player.maxHp, player.hp + 18);
      grantCore('行星核心击破补给');
    }
    if (last) {
      boss.phase = 'death'; boss.phaseClock = 2.7;
      game.cinematic = { type: 'death', t: 0, duration: 2.7 };
      createBossDeath(); sound.death();
    } else {
      boss.phase = 'spellBreak'; boss.phaseClock = 1.25;
      game.cinematic = { type: 'break', t: 0, duration: 1.25 };
      shockwaves.push({ x: boss.x, y: boss.y, r: 10, speed: 320, life: 0.9, color: stage.color });
      sound.break();
    }
    updateHud(true);
  }

  function advanceAfterPhase() {
    const stage = STAGES[game.stage];
    if (boss.phase === 'spellBreak') { game.spell += 1; beginSpell(); return; }
    if (boss.phase === 'death') {
      if (game.runSingle) { showDialogue([{ side: 'right', speaker: game.stage + 1, text: `${NAMES[game.stage + 1]}：污染核心已解除，行星航道恢复开放。` }, { side: 'left', speaker: 0, text: '航路确认。爱丽丝，准备返回星图。' }], [0, game.stage + 1], () => finishRun(true)); return; }
      if (game.stage + 1 < STAGES.length) {
        const next = game.stage + 1;
        player.hp = Math.min(player.maxHp, player.hp + 52);
        showDialogue(STORIES[next], [0, next + 1], () => beginStage(next));
      } else showDialogue(EPILOGUE, [0, 8], () => finishRun(true));
    }
  }

  function calculateResultScore(won) {
    const hpRatio = clamp(player.hp / player.maxHp, 0, 1);
    const totalPhases = STAGES[game.stage].spells.length;
    const clearedPhases = won ? totalPhases : clamp(game.spell, 0, totalPhases);
    const progressRatio = clearedPhases / totalPhases;
    const stageFactor = 1 + game.stage * .1;
    const combat = Math.round(game.score);
    const survival = Math.round(hpRatio * 42000 * stageFactor);
    const graze = Math.round(game.graze * 190 * stageFactor);
    const combo = Math.round(game.maxCombo * 62 * stageFactor);
    const captures = Math.round(game.spellsCaptured * 14000 * stageFactor);
    const clear = won ? Math.round(32000 * stageFactor) : 0;
    const damagePenalty = Math.round(game.damageTaken * 85 * stageFactor);
    const total = Math.max(0, combat + survival + graze + combo + captures + clear - damagePenalty);
    const grazeRatio = Math.min(1, game.graze / (62 + game.stage * 12));
    const comboRatio = Math.min(1, game.maxCombo / (170 + game.stage * 24));
    const performance = clamp(progressRatio * .46 + comboRatio * .22 + grazeRatio * .18 + hpRatio * .14 + (won ? .08 : 0), 0, 1);
    const grade = performance >= .92 ? 'S+' : performance >= .78 ? 'S' : performance >= .63 ? 'A' : performance >= .47 ? 'B' : performance >= .28 ? 'C' : 'D';
    return { total, grade, clearedPhases, totalPhases, performance };
  }

  const RESULT_COMMENTS = {
    'S+': [
      '{name}这次居然没露出破绽？哼，勉强允许你得意五秒钟~',
      '全程压制还拿到S+，{name}原来也不是只会嘴硬嘛。',
      '这种同步率……爱丽丝都快追不上{name}了，真让人不甘心呢~',
      '零失误级别的航路，{name}这次确实有资格被记住。',
    ],
    S: [
      '差一点就是完美啦，{name}不会正好在最后紧张了吧~',
      'S级通过，算你有两下子。下次可别把那一点擦伤带回来。',
      '{name}的节奏还算漂亮，就是离让我认输还差一点点哦。',
      '不错嘛，已经能让守卫认真起来了。可别因此得意忘形~',
    ],
    A: [
      'A而已就笑得那么开心？{name}还真容易满足呢~',
      '勉强算一次漂亮通关，漏掉的那些连击我可都记着哦。',
      '{name}总算学会看预警线了，下次试试少挨几下吧~',
      '稳定，但还不够惊艳。再努力一点或许能让我夸你呢。',
    ],
    B: [
      '{name}是靠运气挤过去的吧？弹幕都替你捏了把汗呢~',
      'B级通关也值得庆祝吗？先把断掉的连击捡回来啦。',
      '耐久掉得那么快，{name}该不会是故意用脸接弹幕吧~',
      '有惊无险就是不够熟练的好听说法，下次认真一点哦。',
    ],
    C: [
      '只拿到C还装作很轻松，{name}真是爱逞强呢~',
      '守卫都放了那么多安全窗口，你居然每个都差点错过。',
      '{name}能回来已经是奇迹了，先去练习移动再挑战吧~',
      '通关是通关了，但这个航行记录怎么看都摇摇晃晃的。',
    ],
    D: [
      '{name}真是杂鱼呢~这么简单都过不去，预警线是装饰吗？',
      '欸，已经结束了？{name}倒下的速度比折跃还快呢~',
      '连守卫的第一轮节拍都没听懂，杂鱼{name}要再练练哦。',
      '失败记录已经保存啦，正好提醒{name}下次别再乱撞弹幕~',
    ],
    debug: [
      '{name}真是杂鱼呢~居然弱到要开无敌？作弊成绩可不会进排名哦。',
      '偷偷打开无敌模式也会被爱丽丝发现，{name}的小心思太明显啦~',
      '原来{name}需要系统保护才能出击呀，这局只能留在本机哦。',
      '想看弹幕可以直说嘛，开着无敌还想冲榜可是不行的~',
      '{name}，调试权限不是冠军奖杯。先关掉无敌再认真打一局吧~',
    ],
  };

  function pickResultComment(grade) {
    const list = game.debugUsed ? RESULT_COMMENTS.debug : RESULT_COMMENTS[grade] || RESULT_COMMENTS.D;
    return list[Math.floor(Math.random() * list.length)].replaceAll('{name}', profile.name || '无名杂鱼');
  }

  let teaseTimer = 0; let teaseHideTimer = 0; let teaseGeneration = 0;
  function showDebugTease() {
    if (!ui.teaseToast || !ui.teaseText) return;
    teaseGeneration += 1; const generation = teaseGeneration;
    clearTimeout(teaseTimer); clearTimeout(teaseHideTimer);
    const lines = RESULT_COMMENTS.debug;
    ui.teaseText.textContent = lines[Math.floor(Math.random() * lines.length)].replaceAll('{name}', profile.name || '无名杂鱼');
    ui.teaseToast.classList.remove('hidden', 'leaving');
    void ui.teaseToast.offsetWidth; ui.teaseToast.classList.add('visible');
    teaseTimer = setTimeout(() => hideDebugTease(generation), 9000);
  }

  function hideDebugTease(expectedGeneration = null) {
    if (!ui.teaseToast) return;
    if (expectedGeneration !== null && expectedGeneration !== teaseGeneration) return;
    if (expectedGeneration === null) teaseGeneration += 1;
    const generation = teaseGeneration;
    clearTimeout(teaseTimer); clearTimeout(teaseHideTimer);
    ui.teaseToast.classList.remove('visible'); ui.teaseToast.classList.add('leaving');
    teaseHideTimer = setTimeout(() => { if (generation === teaseGeneration && !ui.teaseToast.classList.contains('visible')) ui.teaseToast.classList.add('hidden'); }, 320);
  }

  function enableDebugRun(showNotice = true) {
    game.debugUsed = true; game.rankingEligible = false;
    if (showNotice) showDebugTease();
  }

  function finishRun(won) {
    const result = calculateResultScore(won);
    game.finalScore = result.total;
    game.score = game.finalScore;
    game.mode = 'result'; game.best = Math.max(game.best, game.finalScore); saveBest();
    sound.stopMusic();
    if (won) submitRanking();
    $('resultEyebrow').textContent = won ? 'CHAPTER COMPLETE' : 'JOURNEY FAILED';
    $('resultTitle').textContent = won ? '星门已重启' : '跃迁中断';
    $('finalScore').textContent = game.finalScore.toLocaleString('zh-CN');
    $('finalGrade').textContent = result.grade;
    $('finalHp').textContent = `${Math.ceil(player.hp)} / ${player.maxHp}`;
    $('finalGraze').textContent = String(game.graze);
    $('finalChain').textContent = `${game.maxCombo} HIT`;
    $('finalCaptures').textContent = `${result.clearedPhases} / ${result.totalPhases}`;
    $('resultComment').textContent = pickResultComment(result.grade);
    $('resultCommentBox').dataset.grade = game.debugUsed ? 'DEBUG' : result.grade;
    $('resultRankingState').textContent = game.rankingEligible && !game.debugUsed
      ? '综合评分已计入耐久、擦弹、连击与符卡击破，可提交公开排名'
      : '本局曾启用无敌模式，仅保留本机成绩，不计入公开排名';
    $('resultRankingState').classList.toggle('invalid', !game.rankingEligible || game.debugUsed);
    ui.result.classList.remove('hidden'); ui.pauseBtn.textContent = 'Ⅱ'; updateHud(true);
  }

  function spawnBullet(x, y, angle, speed, options = {}) {
    if (bullets.length >= 1450) return;
    const d = difficulty();
    const earlyWorldSpeed = game.stage === 0 && game.difficulty === 'normal' ? .84 : 1;
    const releaseVx = Math.cos(angle) * speed * d.speed * earlyWorldSpeed;
    const releaseVy = Math.sin(angle) * speed * d.speed * earlyWorldSpeed;
    const delay = options.delay || 0;
    const orbitDuration = options.orbitDuration || 0;
    const orbitCx = options.orbitCx ?? boss.x; const orbitCy = options.orbitCy ?? boss.y;
    bullets.push({ x, y, vx: delay || orbitDuration ? 0 : releaseVx, vy: delay || orbitDuration ? 0 : releaseVy, releaseVx, releaseVy, delay,
      radius: options.radius || 4.5, color: options.color || COLORS.coral, shape: options.shape || 'orb',
      turn: options.turn || 0, age: 0, grazed: false, bounce: options.bounce || 0,
      pauseAt: options.pauseAt || 0, pauseDuration: options.pauseDuration || 0, pauseDone: false, pauseLeft: 0,
      redirectToPlayer: Boolean(options.redirectToPlayer), splitAt: options.splitAt || 0,
      splitCount: options.splitCount || 0, splitSpeed: options.splitSpeed || 0, splitDone: false, splitRemove: Boolean(options.splitRemove),
      group: options.group || '', linkOrder: options.linkOrder || 0, sway: options.sway || 0, swayFreq: options.swayFreq || 2.8,
      accel: options.accel || 0, reverseAfterPause: Boolean(options.reverseAfterPause),
      portalCount: options.portalCount || 0, magnetStrength: options.magnetStrength || 0,
      phaseFlipAt: options.phaseFlipAt || 0, phaseFlip: options.phaseFlip || 0, phaseFlipped: false,
      orbitLeft: orbitDuration, orbitDuration, orbitCx, orbitCy,
      orbitRadius: options.orbitRadius || Math.hypot(x - orbitCx, y - orbitCy), orbitAngle: options.orbitAngle ?? Math.atan2(y - orbitCy, x - orbitCx),
      orbitSpeed: options.orbitSpeed || 1.4, orbitRelease: options.orbitRelease || 'aimed', orbitReleaseSpeed: options.orbitReleaseSpeed || speed,
      history: [], historyClock: 0, rewindClock: 0 });
  }

  function nextFormationGroup(prefix) {
    if (!game.pattern) return `${prefix}-${Date.now()}`;
    game.pattern.formationSerial = (game.pattern.formationSerial || 0) + 1;
    return `${prefix}-${game.stage}-${game.spell}-${game.pattern.formationSerial}`;
  }

  function ring(count, speed, offset, options = {}, gaps = []) {
    for (let i = 0; i < count; i++) if (!gaps.includes(i)) spawnBullet(boss.x, boss.y + 12, offset + i / count * TAU, speed, options);
  }

  function aimed(count, spread, speed, options = {}, origin = boss) {
    const base = Math.atan2(player.y - origin.y, player.x - origin.x);
    for (let i = 0; i < count; i++) spawnBullet(origin.x, origin.y + 10, base + (i - (count - 1) / 2) * spread, speed, options);
  }

  function formationRing(count, radius, releaseSpeed, options = {}) {
    const group = nextFormationGroup('ring');
    for (let i = 0; i < count; i++) {
      const a = -Math.PI / 2 + i / count * TAU;
      const direction = options.motion === 'collapse' ? a + Math.PI : options.motion === 'drop' ? Math.PI / 2 : options.motion === 'tangent' ? a + Math.PI / 2 : a;
      spawnBullet(boss.x + Math.cos(a) * radius, boss.y + Math.sin(a) * radius, direction, releaseSpeed, { ...options, group, linkOrder: i, delay: options.delay || .85 });
    }
  }

  function formationStar(radius, releaseSpeed, options = {}) {
    const group = nextFormationGroup('star'); let orderIndex = 0;
    const vertices = Array.from({ length: 5 }, (_, i) => { const a = -Math.PI / 2 + i / 5 * TAU; return { x: boss.x + Math.cos(a) * radius, y: boss.y + Math.sin(a) * radius }; });
    const order = [0, 2, 4, 1, 3, 0];
    for (let edge = 0; edge < 5; edge++) for (let step = 0; step < 3; step++) {
      const a = vertices[order[edge]]; const b = vertices[order[edge + 1]]; const t = step / 3;
      const x = lerp(a.x, b.x, t); const y = lerp(a.y, b.y, t); const radial = Math.atan2(y - boss.y, x - boss.x);
      const angle = options.motion === 'collapse' ? radial + Math.PI : options.motion === 'drop' ? Math.PI / 2 : radial;
      spawnBullet(x, y, angle, releaseSpeed, { ...options, group, linkOrder: orderIndex++, delay: options.delay || 1 });
    }
  }

  function formationRectangle(width, height, releaseSpeed, options = {}) {
    const group = nextFormationGroup('rect');
    const points = [];
    for (let i = 0; i < 5; i++) { const t = i / 4; points.push({ x: boss.x - width / 2 + width * t, y: boss.y - height / 2 }, { x: boss.x - width / 2 + width * t, y: boss.y + height / 2 }); }
    for (let i = 1; i < 4; i++) { const t = i / 4; points.push({ x: boss.x - width / 2, y: boss.y - height / 2 + height * t }, { x: boss.x + width / 2, y: boss.y - height / 2 + height * t }); }
    for (let i = 0; i < points.length; i++) { const point = points[i]; const radial = Math.atan2(point.y - boss.y, point.x - boss.x); const angle = options.motion === 'radial' ? radial : options.motion === 'collapse' ? radial + Math.PI : Math.PI / 2; spawnBullet(point.x, point.y, angle, releaseSpeed, { ...options, group, linkOrder: i, delay: options.delay || .9 }); }
  }

  function formationMagicSeal(gentle) {
    const outer = gentle ? 12 : 16;
    const ringGroup = nextFormationGroup('seal-ring'); const starGroup = nextFormationGroup('seal-star');
    const target = Math.atan2(player.y - boss.y, player.x - boss.x);
    for (let i = 0; i < outer; i++) {
      const a = -Math.PI / 2 + i / outer * TAU;
      spawnBullet(boss.x + Math.cos(a) * 78, boss.y + Math.sin(a) * 78, target + Math.sin(a) * .2, gentle ? 84 : 104, { color: COLORS.violet, shape: 'diamond', group: ringGroup, linkOrder: i, delay: 1.35 + i % 4 * .07 });
    }
    const order = [0, 2, 4, 1, 3, 0];
    const vertices = Array.from({ length: 5 }, (_, i) => { const a = -Math.PI / 2 + i / 5 * TAU; return { x: boss.x + Math.cos(a) * 50, y: boss.y + Math.sin(a) * 50 }; });
    for (let edge = 0; edge < 5; edge++) for (let step = 0; step < 2; step++) {
      const from = vertices[order[edge]]; const to = vertices[order[edge + 1]]; const t = step / 2;
      spawnBullet(lerp(from.x, to.x, t), lerp(from.y, to.y, t), Math.PI / 2, gentle ? 76 : 92, { color: COLORS.gold, radius: 5.5, group: starGroup, linkOrder: edge * 2 + step, delay: 1.68 });
    }
  }

  function formationDropSquare(gentle) {
    const group = nextFormationGroup('drop-square');
    const width = gentle ? 116 : 148; const height = gentle ? 70 : 88; const points = [];
    for (let i = 0; i < 6; i++) { const t = i / 5; points.push({ x: boss.x - width / 2 + width * t, y: boss.y - 24 }, { x: boss.x - width / 2 + width * t, y: boss.y - 24 + height }); }
    for (let i = 1; i < 4; i++) { const t = i / 4; points.push({ x: boss.x - width / 2, y: boss.y - 24 + height * t }, { x: boss.x + width / 2, y: boss.y - 24 + height * t }); }
    for (let i = 0; i < points.length; i++) { const point = points[i]; spawnBullet(point.x, point.y, Math.PI / 2, gentle ? 112 : 142, { color: COLORS.blue, shape: 'needle', group, linkOrder: i, delay: 1.28 }); }
  }

  function formationPolygon(sides, radius, speed, color, rotate = 0, motion = 'collapse') {
    const group = nextFormationGroup(`poly-${sides}`);
    for (let i = 0; i < sides; i++) {
      const a = -Math.PI / 2 + rotate + i / sides * TAU;
      const direction = motion === 'drop' ? Math.PI / 2 : motion === 'tangent' ? a + Math.PI / 2 : motion === 'radial' ? a : a + Math.PI;
      spawnBullet(boss.x + Math.cos(a) * radius, boss.y + Math.sin(a) * radius, direction, speed, { color, shape: 'diamond', group, linkOrder: i, delay: 1.45 + i * .035, turn: motion === 'tangent' ? (i % 2 ? 1 : -1) * .16 : 0 });
    }
  }

  function formationConstellation() {
    const group = nextFormationGroup('constellation');
    const points = [[-94,-15],[-52,-68],[-4,-38],[31,-84],[78,-24],[46,24],[91,64],[12,54],[-42,78],[-78,34]];
    for (let i = 0; i < points.length; i++) {
      const [x, y] = points[i];
      spawnBullet(boss.x + x, boss.y + y, Math.PI / 2 + Math.sin(i) * .22, 118 + i % 3 * 12, { color: i % 3 ? COLORS.teal : COLORS.white, radius: i % 3 ? 5 : 8, group, linkOrder: i, delay: 1.7, sway: .42, swayFreq: 2.2 });
    }
  }

  function formationGravityGrid() {
    const group = nextFormationGroup('gravity-grid'); let order = 0;
    for (let row = 0; row < 4; row++) for (let col = 0; col < 6; col++) {
      const x = boss.x - 110 + col * 44; const y = boss.y - 42 + row * 34;
      spawnBullet(x, y, Math.PI / 2, 108 + row * 10, { color: (row + col) % 2 ? COLORS.violet : COLORS.blue, shape: 'diamond', group, linkOrder: order++, delay: 1.55, pauseAt: 2.35, pauseDuration: .62, redirectToPlayer: row % 2 === 0 });
    }
  }

  function formationLaneGate(vertical = true, gentle = false) {
    const group = nextFormationGroup(vertical ? 'vertical-gate' : 'horizontal-gate');
    const lanes = vertical ? (gentle ? 9 : 12) : (gentle ? 7 : 10);
    const gap = Math.floor(rand(2, lanes - 2));
    for (let i = 0; i < lanes; i++) {
      if (Math.abs(i - gap) <= 1) continue;
      if (vertical) {
        const x = 24 + i * (W - 48) / (lanes - 1);
        spawnBullet(x, -18, Math.PI / 2, gentle ? 118 : 152, { color: i % 2 ? COLORS.blue : COLORS.white, shape: 'needle', group, linkOrder: i, delay: .7 + i % 2 * .08 });
      } else {
        const y = 150 + i * 390 / (lanes - 1); const fromLeft = i % 2 === 0;
        spawnBullet(fromLeft ? -18 : W + 18, y, fromLeft ? 0 : Math.PI, gentle ? 108 : 138, { color: fromLeft ? COLORS.gold : COLORS.violet, shape: 'diamond', group, linkOrder: i, delay: .72 });
      }
    }
  }

  function formationOrbitCage(gentle = false, aroundPlayer = true) {
    const cx = aroundPlayer ? player.x : boss.x; const cy = aroundPlayer ? player.y : boss.y + 20;
    const count = gentle ? 12 : 18; const radius = aroundPlayer ? (gentle ? 76 : 102) : 88; const group = nextFormationGroup('orbit-cage');
    for (let i = 0; i < count; i++) {
      const a = i / count * TAU;
      spawnBullet(cx + Math.cos(a) * radius, cy + Math.sin(a) * radius, a, gentle ? 98 : 126, {
        color: i % 3 ? COLORS.teal : COLORS.gold, shape: i % 3 ? 'diamond' : 'orb', group, linkOrder: i,
        orbitCx: cx, orbitCy: cy, orbitRadius: radius, orbitAngle: a, orbitDuration: gentle ? 1.9 : 2.45,
        orbitSpeed: (i % 2 ? -1 : 1) * (gentle ? .78 : 1.05), orbitRelease: aroundPlayer ? 'tangent' : 'aimed', orbitReleaseSpeed: gentle ? 96 : 124,
      });
    }
  }

  function formationTimeDial(intense = false) {
    const count = intense ? 24 : 18; const radius = intense ? 108 : 88; const group = nextFormationGroup('time-dial');
    for (let i = 0; i < count; i++) {
      const a = -Math.PI / 2 + i / count * TAU;
      spawnBullet(boss.x + Math.cos(a) * radius, boss.y + Math.sin(a) * radius, a, intense ? 132 : 112, {
        color: i % 4 === 0 ? COLORS.white : i % 2 ? COLORS.violet : COLORS.blue, shape: i % 4 === 0 ? 'needle' : 'diamond',
        radius: i % 4 === 0 ? 7 : 4.5, group, linkOrder: i, orbitCx: boss.x, orbitCy: boss.y, orbitRadius: radius,
        orbitAngle: a, orbitDuration: intense ? 3.1 : 2.55, orbitSpeed: intense ? -.86 : .72, orbitRelease: i % 3 ? 'aimed' : 'reverse', orbitReleaseSpeed: intense ? 146 : 122,
      });
    }
  }

  function formationMirrorCross(gentle = false) {
    const group = nextFormationGroup('mirror-cross'); const rows = gentle ? 5 : 8;
    for (let i = 0; i < rows; i++) {
      const y = 155 + i * (360 / Math.max(1, rows - 1)); const offset = (i - (rows - 1) / 2) * .035;
      spawnBullet(-14, y, offset, gentle ? 118 : 152, { color: COLORS.blue, shape: 'needle', bounce: 2, group, linkOrder: i * 2, sway: .32, swayFreq: 2.2 });
      spawnBullet(W + 14, y, Math.PI - offset, gentle ? 118 : 152, { color: COLORS.coral, shape: 'needle', bounce: 2, group, linkOrder: i * 2 + 1, sway: -.32, swayFreq: 2.2 });
    }
  }

  function formationPortalRelay(gentle = false) {
    const group = nextFormationGroup('portal-relay'); const rows = gentle ? 4 : 6;
    for (let i = 0; i < rows; i++) {
      const y = 154 + i * (330 / Math.max(1, rows - 1)); const fromLeft = i % 2 === 0;
      spawnBullet(fromLeft ? 18 : W - 18, y, fromLeft ? 0 : Math.PI, gentle ? 112 : 142, {
        color: fromLeft ? COLORS.blue : COLORS.violet, shape: 'needle', group, linkOrder: i,
        portalCount: gentle ? 1 : 2, delay: .45 + i * .12, phaseFlipAt: 1.9 + i * .08,
        phaseFlip: fromLeft ? .42 : -.42,
      });
    }
  }

  function formationBeatChess(gentle = false) {
    const group = nextFormationGroup('beat-chess'); const cols = gentle ? 5 : 7; const rows = gentle ? 4 : 5;
    let order = 0;
    for (let row = 0; row < rows; row++) for (let col = 0; col < cols; col++) {
      if ((row + col) % 2 !== (game.pattern.specialCount || 0) % 2) continue;
      const x = 56 + col * (W - 112) / Math.max(1, cols - 1); const y = 150 + row * 62;
      const sweepRight = row % 2 === 0;
      spawnBullet(x, y, sweepRight ? 0 : Math.PI, gentle ? 92 : 122, {
        color: row % 2 ? COLORS.gold : COLORS.teal, shape: 'diamond', group, linkOrder: order++,
        delay: 1.05 + row * .18, portalCount: 1, phaseFlipAt: 2.25, phaseFlip: sweepRight ? Math.PI / 2 : -Math.PI / 2,
      });
    }
  }

  function formationSerpent(gentle = false) {
    const group = nextFormationGroup('serpent'); const count = gentle ? 13 : 20;
    const baseX = rand(96, W - 96); const direction = rand(0, 1) > .5 ? 1 : -1;
    for (let i = 0; i < count; i++) spawnBullet(baseX, 90, Math.PI / 2, gentle ? 108 : 136, {
      color: i % 4 === 0 ? COLORS.white : COLORS.coral, shape: i % 4 ? 'diamond' : 'orb',
      group, linkOrder: i, delay: .28 + i * (gentle ? .085 : .065), sway: direction * (gentle ? .72 : 1.02),
      swayFreq: gentle ? 2.1 : 2.65, phaseFlipAt: 2.6, phaseFlip: direction * .72,
    });
  }

  function formationPolarity(gentle = false) {
    const group = nextFormationGroup('polarity'); const count = gentle ? 12 : 18;
    for (let i = 0; i < count; i++) {
      const a = i / count * TAU; const positive = i % 2 === 0;
      spawnBullet(player.x + Math.cos(a) * (gentle ? 150 : 188), player.y + Math.sin(a) * (gentle ? 150 : 188), a + Math.PI, gentle ? 54 : 70, {
        color: positive ? COLORS.coral : COLORS.blue, shape: positive ? 'orb' : 'diamond', group, linkOrder: i,
        delay: .85, magnetStrength: positive ? (gentle ? 18 : 28) : (gentle ? -14 : -22), phaseFlipAt: 3.1,
        phaseFlip: positive ? Math.PI / 2 : -Math.PI / 2,
      });
    }
  }

  function formationEchoTrace(gentle = false) {
    const group = nextFormationGroup('echo-trace'); const waves = gentle ? 3 : 5;
    const base = Math.atan2(player.y - boss.y, player.x - boss.x);
    for (let wave = 0; wave < waves; wave++) for (let side = -1; side <= 1; side++) {
      spawnBullet(boss.x, boss.y + 12, base + side * .14 + Math.sin(wave) * .04, gentle ? 126 : 158, {
        color: wave === 0 ? COLORS.white : wave % 2 ? COLORS.violet : COLORS.teal, shape: 'needle',
        group, linkOrder: wave * 3 + side + 1, delay: .36 + wave * .34, phaseFlipAt: 1.5 + wave * .2,
        phaseFlip: side * .22,
      });
    }
  }

  function formationLaserMaze(gentle = false) {
    const safeLane = Math.floor(rand(1, 4));
    for (let lane = 0; lane < 5; lane++) {
      if (lane === safeLane) continue;
      const x = 44 + lane * (W - 88) / 4;
      spawnLaser(x, 72, x + (lane % 2 ? 38 : -38), H + 30, { color: lane % 2 ? COLORS.violet : COLORS.gold, warning: gentle ? 1.55 : 1.28, duration: .82, width: gentle ? 14 : 18 });
    }
    formationLaneGate(false, true);
  }

  function startChronoSequence(intense = false) {
    if (game.timeEffect.mode !== 'none' || boss.phase !== 'active') return;
    Object.assign(game.timeEffect, { mode: 'freeze', clock: intense ? 1.45 : 1.18, duration: intense ? 1.45 : 1.18, next: 'rewind', serial: game.timeEffect.serial + 1 });
    game.flash = Math.max(game.flash, .42); game.shake = Math.max(game.shake, 4.5); sound.laserWarn();
  }

  function spawnSpecialPattern(pattern, gentle) {
    const pools = [
      ['orbit-cage', 'lane-gate', 'split-core'],
      ['beat-chess', 'rain-wall', 'magnetic-gate'],
      ['prism-bounce', 'comet-chain', 'polygon-collapse'],
      ['terminal-gate', 'laser-maze', 'reverse-ring'],
      ['constellation-fall', 'square-drop', 'magic-seal'],
      ['mirror-swap', 'pendulum-wall', 'portal-relay'],
      ['chrono-lock', 'time-fracture', 'time-dial'],
      ['zenith-act', 'cathedral-lock', 'polarity'],
    ];
    const pool = pools[game.stage]; const id = pool[(game.spell + (pattern.specialCount || 0)) % pool.length];
    pattern.specialCount = (pattern.specialCount || 0) + 1;
    if (QA_MODE) canvas.dataset.qaPattern = id;
    if (id === 'redirect') aimed(gentle ? 3 : 5, .18, gentle ? 92 : 122, { color: COLORS.teal, shape: 'diamond', pauseAt: .58, pauseDuration: .72, redirectToPlayer: true });
    else if (id === 'orbit-cage') formationOrbitCage(gentle, game.stage !== 0);
    else if (id === 'lane-gate') formationLaneGate(pattern.specialCount % 2 === 0, gentle);
    else if (id === 'rain-wall') formationLaneGate(true, gentle);
    else if (id === 'star-collapse') formationStar(gentle ? 56 : 76, gentle ? 88 : 124, { color: COLORS.violet, shape: 'diamond', delay: 1.1, motion: 'collapse' });
    else if (id === 'polygon-collapse') formationPolygon(7, gentle ? 68 : 94, gentle ? 96 : 124, COLORS.gold, pattern.t * .2, 'collapse');
    else if (id === 'polygon-drop') formationPolygon(6 + pattern.specialCount % 3, gentle ? 68 : 96, gentle ? 104 : 136, COLORS.teal, pattern.t * .16, 'drop');
    else if (id === 'split-core') aimed(1, 0, gentle ? 74 : 94, { color: COLORS.coral, radius: 11, splitAt: 1.25, splitCount: gentle ? 5 : 7, splitSpeed: gentle ? 88 : 108, splitRemove: true });
    else if (id === 'magic-seal') formationMagicSeal(gentle);
    else if (id === 'square-drop') formationDropSquare(gentle);
    else if (id === 'constellation') formationConstellation();
    else if (id === 'gravity-grid') formationGravityGrid();
    else if (id === 'reverse-ring') formationRing(gentle ? 14 : 20, gentle ? 64 : 88, gentle ? 92 : 118, { color: COLORS.red, delay: 1.2, pauseAt: 2.05, pauseDuration: .5, reverseAfterPause: true, motion: 'tangent' });
    else if (id === 'mirror-cross' || id === 'pendulum-wall' || id === 'prism-bounce') formationMirrorCross(gentle);
    else if (id === 'portal-relay') formationPortalRelay(gentle);
    else if (id === 'beat-chess') formationBeatChess(gentle);
    else if (id === 'serpent') formationSerpent(gentle);
    else if (id === 'polarity') formationPolarity(gentle);
    else if (id === 'echo-trace') formationEchoTrace(gentle);
    else if (id === 'laser-maze') formationLaserMaze(gentle);
    else if (id === 'time-dial') formationTimeDial(game.stage === 7);
    else if (id === 'time-fracture') { formationTimeDial(true); startChronoSequence(true); }
    else if (id === 'magnetic-gate') {
      formationLaneGate(pattern.specialCount % 2 === 0, gentle);
      aimed(gentle ? 3 : 5, .15, gentle ? 116 : 144, { color: COLORS.blue, shape: 'diamond', magnetStrength: gentle ? 10 : 18 });
    }
    else if (id === 'comet-chain') {
      const base = Math.atan2(player.y - boss.y, player.x - boss.x);
      for (let i = -1; i <= 1; i++) spawnBullet(boss.x + i * 34, boss.y, base + i * .16, gentle ? 72 : 88, { color: i ? COLORS.violet : COLORS.gold, radius: 12, splitAt: 1.25 + (i + 1) * .16, splitCount: gentle ? 5 : 7, splitSpeed: gentle ? 92 : 116, splitRemove: true, bounce: i === 0 ? 1 : 0 });
    }
    else if (id === 'terminal-gate') {
      const lane = 145 + pattern.specialCount % 3 * 150;
      spawnLaser(-20, lane, W + 20, lane + (pattern.specialCount % 2 ? 55 : -55), { color: COLORS.gold, warning: 1.45, width: gentle ? 18 : 23, duration: .72 });
      spawnLaser(W + 20, lane + 125, -20, lane + 85, { color: COLORS.violet, warning: 1.45, width: gentle ? 18 : 23, duration: .72 });
    }
    else if (id === 'constellation-fall') { formationConstellation(); window.setTimeout(() => { if (boss.phase === 'active' && game.stage === 4) formationDropSquare(gentle); }, 760); }
    else if (id === 'mirror-swap') { formationMirrorCross(gentle); formationPortalRelay(true); }
    else if (id === 'chrono-lock') {
      formationTimeDial(false); startChronoSequence(false);
      spawnLaser(boss.x, boss.y, player.x, player.y, { color: COLORS.violet, warning: 1.7, width: gentle ? 20 : 26, duration: .8 });
    }
    else if (id === 'cathedral-lock') {
      formationPolygon(10, gentle ? 74 : 98, gentle ? 104 : 128, COLORS.gold, pattern.t * .24, 'drop');
      spawnLaser(18, 210, W + 20, 390, { color: COLORS.gold, warning: 1.35, width: 21 });
      spawnLaser(W - 18, 210, -20, 390, { color: COLORS.teal, warning: 1.35, width: 21 });
    }
    else if (id === 'zenith-act') {
      const act = pattern.specialCount % 3;
      if (act === 0) { formationMagicSeal(false); formationPolygon(8, 92, 126, COLORS.teal, pattern.t, 'collapse'); }
      else if (act === 1) { formationTimeDial(true); startChronoSequence(false); }
      else { formationMirrorCross(false); formationDropSquare(false); }
    }
    else if (id === 'laser-cross') {
      spawnLaser(12, 190, W + 20, 455, { color: STAGES[game.stage].color, warning: 1.3, width: gentle ? 18 : 23 });
      spawnLaser(W - 12, 190, -20, 455, { color: game.stage % 2 ? COLORS.gold : COLORS.blue, warning: 1.3, width: gentle ? 18 : 23 });
    }
  }

  function tick(pattern, key, interval, dt, callback) {
    pattern.clocks[key] = (pattern.clocks[key] || 0) + dt;
    const rageRate = 1 + boss.rage * 0.55;
    const adjusted = interval / difficulty().rate / rageRate;
    while (pattern.clocks[key] >= adjusted) { pattern.clocks[key] -= adjusted; callback(); }
  }

  function spawnLaser(x = boss.x, y = boss.y, targetX = player.x, targetY = player.y, options = {}) {
    const angle = Math.atan2(targetY - y, targetX - x);
    lasers.push({
      x, y, angle, age: 0, phase: 'warning', warning: options.warning || 1.05,
      duration: options.duration || 0.62, width: options.width || 24,
      color: options.color || STAGES[game.stage].color, fired: false,
    });
    sound.laserWarn();
  }

  function distanceToSegment(px, py, x1, y1, x2, y2) {
    const dx = x2 - x1; const dy = y2 - y1;
    const lengthSq = dx * dx + dy * dy;
    const t = lengthSq ? clamp(((px - x1) * dx + (py - y1) * dy) / lengthSq, 0, 1) : 0;
    return Math.hypot(px - (x1 + dx * t), py - (y1 + dy * t));
  }

  function updatePattern(dt) {
    const p = game.pattern;
    p.t += dt;
    const type = STAGES[game.stage].spells[game.spell].pattern;
    const gentleOpening = game.stage === 0 && game.difficulty === 'normal';
    const calm = game.difficulty === 'normal';
    const specialCadence = [7.4, 6.8, 6.5, 6.9, 7.2, 6.4, 7.8, 6.1][game.stage];
    tick(p, 'special', gentleOpening ? 7.8 : specialCadence, dt, () => spawnSpecialPattern(p, gentleOpening));

    if (type === 'beacon') {
      tick(p, 'ring', gentleOpening ? 1.22 : 0.82, dt, () => { const n = game.difficulty === 'hard' ? 34 : gentleOpening ? 20 : 28; const gap = p.count * 4 % n; const gaps = gentleOpening ? [gap, (gap + 1) % n, (gap + 2) % n, (gap + 3) % n, (gap + 4) % n] : [gap, (gap + 1) % n, (gap + 2) % n]; ring(n, gentleOpening ? 78 + p.count % 3 * 10 : 92 + p.count % 3 * 18, p.count * 0.15, { color: COLORS.gold }, gaps); p.count++; });
      tick(p, 'aim', gentleOpening ? 1.75 : 1.2, dt, () => aimed(gentleOpening ? 3 : 7, gentleOpening ? 0.09 : 0.12, gentleOpening ? 132 : 168, { color: COLORS.coral, shape: 'diamond' }));
    } else if (type === 'pulse') {
      tick(p, 'spiral', gentleOpening ? 0.14 : 0.075, dt, () => { const a = p.t * 2.7; const arms = gentleOpening ? 2 : 3; for (let i = 0; i < arms; i++) spawnBullet(boss.x, boss.y, a + i * TAU / arms, gentleOpening ? 94 + i * 7 : 118 + i * 8, { color: i === 1 ? COLORS.gold : COLORS.coral, shape: 'diamond' }); });
      tick(p, 'fan', gentleOpening ? 1.15 : 0.72, dt, () => aimed(gentleOpening ? 5 : 11, gentleOpening ? 0.1 : 0.115, gentleOpening ? 132 : 155, { color: COLORS.white, shape: 'needle' }));
      tick(p, 'shock', gentleOpening ? 2.8 : 2.2, dt, () => ring(gentleOpening ? 16 : 22, gentleOpening ? 62 : 72, rand(0, TAU), { color: COLORS.teal, radius: 6 }));
    } else if (type === 'crossfire') {
      tick(p, 'side', gentleOpening ? 0.58 : 0.32, dt, () => { const left = p.count++ % 2 === 0; const origin = { x: left ? -8 : W + 8, y: rand(110, 470) }; const a = Math.atan2(player.y - origin.y, player.x - origin.x); const wing = gentleOpening ? 1 : 2; for (let i = -wing; i <= wing; i++) spawnBullet(origin.x, origin.y, a + i * (gentleOpening ? .11 : 0.09), gentleOpening ? 142 : 178, { color: left ? COLORS.coral : COLORS.gold, shape: 'needle' }); });
      tick(p, 'ring', gentleOpening ? 1.38 : 1.05, dt, () => { const n = gentleOpening ? 20 : 26; const gap = p.count % n; ring(n, gentleOpening ? 88 : 105, p.t, { color: COLORS.white }, gentleOpening ? [gap, (gap + 1) % n, (gap + 2) % n, (gap + 3) % n] : [gap, (gap + 1) % n]); });
    } else if (type === 'orbit') {
      tick(p, 'curve', calm ? 1.15 : .82, dt, () => { const n = calm ? 12 : 16; const gap = p.count % n; for (let i = 0; i < n; i++) if (Math.abs(i - gap) > 1) spawnBullet(boss.x, boss.y, p.count * 0.18 + i / n * TAU, calm ? 88 : 102, { color: i % 2 ? COLORS.blue : COLORS.teal, turn: (i % 2 ? 1 : -1) * (calm ? .26 : .38) }); p.count++; });
      tick(p, 'aim', calm ? 2.2 : 1.8, dt, () => aimed(calm ? 3 : 5, 0.17, calm ? 172 : 195, { color: COLORS.white, shape: 'needle' }));
      tick(p, 'laser', calm ? 5.2 : 4.2, dt, () => spawnLaser(boss.x, boss.y + 8, player.x, player.y, { color: COLORS.blue, warning: 1.25, width: 20 }));
    } else if (type === 'rain') {
      tick(p, 'rain', calm ? .22 : .14, dt, () => { const lane = (p.count * 73) % W; if (Math.abs(lane - player.x) > (calm ? 54 : 38) || p.count % 6 === 0) spawnBullet(lane, -14, Math.PI / 2 + Math.sin(p.t * 1.7) * 0.08, calm ? 148 : 178, { color: p.count % 4 ? COLORS.blue : COLORS.gold, shape: 'needle' }); p.count++; });
      tick(p, 'sweep', calm ? 2.1 : 1.45, dt, () => aimed(calm ? 4 : 7, 0.15, calm ? 136 : 154, { color: COLORS.teal }));
      tick(p, 'laser', calm ? 4.8 : 3.9, dt, () => spawnLaser(boss.x, boss.y, player.x, player.y, { color: COLORS.gold, warning: 1.3, width: 21 }));
    } else if (type === 'lattice') {
      tick(p, 'grid', calm ? 1.35 : .95, dt, () => { const offset = p.count++ % 2 ? 45 : 0; for (let x = offset; x < W; x += calm ? 90 : 72) spawnBullet(x, -10, Math.PI / 2, calm ? 132 : 148, { color: COLORS.blue, shape: 'diamond' }); for (let y = 180; y < 510; y += calm ? 108 : 88) spawnBullet(p.count % 2 ? -10 : W + 10, y, p.count % 2 ? 0 : Math.PI, calm ? 112 : 128, { color: COLORS.gold, shape: 'diamond' }); });
      tick(p, 'aim', calm ? 2.3 : 1.8, dt, () => aimed(3, 0.09, calm ? 185 : 210, { color: COLORS.white, shape: 'needle' }));
    } else if (type === 'spiral') {
      tick(p, 'star', calm ? .18 : .11, dt, () => { const base = p.t * 2.4; const arms = calm ? 3 : 4; for (let arm = 0; arm < arms; arm++) spawnBullet(boss.x, boss.y, base + arm / arms * TAU, calm ? 102 + arm * 4 : 118 + arm * 4, { color: arm % 2 ? COLORS.violet : COLORS.gold, shape: arm % 2 ? 'diamond' : 'orb' }); });
      tick(p, 'burst', calm ? 2.3 : 1.65, dt, () => aimed(calm ? 4 : 6, 0.13, calm ? 176 : 202, { color: COLORS.coral, shape: 'needle' }));
    } else if (type === 'prism') {
      tick(p, 'prism', calm ? 1.05 : .7, dt, () => { const sides = calm ? 2 : 3; const count = calm ? 4 : 6; for (let side = 0; side < sides; side++) { const a = p.count * 0.2 + side * TAU / sides; for (let i = 0; i < count; i++) spawnBullet(boss.x, boss.y, a + (i - (count - 1) / 2) * 0.055, 92 + i * 12, { color: [COLORS.gold, COLORS.coral, COLORS.blue][side], shape: 'diamond', bounce: i === 0 ? 1 : 0 }); } p.count++; });
      tick(p, 'aim', calm ? 2.5 : 2, dt, () => aimed(calm ? 5 : 7, 0.09, calm ? 158 : 178, { color: COLORS.white }));
    } else if (type === 'vortex') {
      tick(p, 'edge', calm ? .34 : .22, dt, () => { const side = p.count++ % 4; const x = side < 2 ? (p.count * 83) % W : (side === 2 ? -12 : W + 12); const y = side < 2 ? (side === 0 ? -12 : H + 12) : 120 + (p.count * 67) % 440; const a = Math.atan2(boss.y - y, boss.x - x) + Math.sin(p.t * 2) * 0.16; spawnBullet(x, y, a, calm ? 96 : 122, { color: side % 2 ? COLORS.violet : COLORS.gold, turn: side % 2 ? 0.14 : -0.14 }); });
      tick(p, 'aim', calm ? 1.8 : 1.3, dt, () => aimed(calm ? 4 : 6, 0.16, calm ? 172 : 195, { color: COLORS.coral, shape: 'needle' }));
      tick(p, 'laser', calm ? 5.1 : 4.2, dt, () => spawnLaser(boss.x, boss.y + 8, player.x, player.y, { color: COLORS.gold, warning: 1.25, width: 22 }));
    } else if (type === 'constellation') {
      tick(p, 'constellation', 3.6, dt, formationConstellation);
      tick(p, 'trail', .48, dt, () => aimed(3, .19, 154, { color: COLORS.teal, shape: 'needle', sway: .34, swayFreq: 3.1 }));
      tick(p, 'laser', 5.8, dt, () => spawnLaser(boss.x, boss.y, player.x, player.y, { color: COLORS.teal, warning: 1.22, width: 22 }));
    } else if (type === 'polygon') {
      tick(p, 'polygon', 2.75, dt, () => { formationPolygon(6 + p.count % 3, 72 + p.count % 2 * 18, 116, p.count % 2 ? COLORS.blue : COLORS.gold, p.count++ * .18); });
      tick(p, 'orbit', .34, dt, () => { const a = p.t * 2.5; spawnBullet(boss.x, boss.y, a, 126, { color: COLORS.white, turn: .28, shape: 'diamond' }); spawnBullet(boss.x, boss.y, Math.PI - a, 126, { color: COLORS.violet, turn: -.28, shape: 'diamond' }); });
      tick(p, 'laser', 6.2, dt, () => spawnLaser(boss.x, boss.y, player.x, player.y, { color: COLORS.gold, warning: 1.25, width: 24 }));
    } else if (type === 'magicstorm') {
      tick(p, 'seal', 4.1, dt, () => { if (p.count++ % 2) formationMagicSeal(false); else formationDropSquare(false); });
      tick(p, 'curve', .42, dt, () => aimed(4, .13, 146, { color: COLORS.violet, turn: Math.sin(p.t) * .32, shape: 'diamond' }));
      tick(p, 'split', 5.4, dt, () => aimed(1, 0, 92, { color: COLORS.gold, radius: 12, splitAt: 1.35, splitCount: 8, splitSpeed: 118, splitRemove: true }));
    } else if (type === 'pendulum') {
      tick(p, 'pendulum', .28, dt, () => { const left = p.count++ % 2 === 0; const x = left ? 12 : W - 12; const y = 120 + (p.count * 71) % 350; spawnBullet(x, y, left ? .35 : Math.PI - .35, 148, { color: left ? COLORS.blue : COLORS.coral, shape: 'needle', sway: left ? .72 : -.72, swayFreq: 2.4, bounce: 1 }); });
      tick(p, 'gate', 3.9, dt, () => formationRectangle(150, 78, 128, { color: COLORS.white, shape: 'diamond', delay: 1.25, sway: .28 }));
      tick(p, 'laser', 5.1, dt, () => spawnLaser(boss.x + (p.count % 2 ? -52 : 52), boss.y, player.x, player.y, { color: COLORS.blue, warning: 1.15, width: 23 }));
    } else if (type === 'gravitygrid') {
      tick(p, 'grid', 4.35, dt, formationGravityGrid);
      tick(p, 'aim', 1.45, dt, () => aimed(5, .12, 166, { color: COLORS.white, shape: 'needle' }));
      tick(p, 'laser', 5.6, dt, () => { spawnLaser(18, 170 + p.count % 3 * 120, W + 40, 170 + p.count % 3 * 120, { color: COLORS.violet, warning: 1.3, width: 20 }); p.count++; });
    } else if (type === 'mirrorgrid') {
      tick(p, 'mirror', 3.45, dt, () => formationMirrorCross(false));
      tick(p, 'cage', 5.8, dt, () => formationOrbitCage(false, true));
      tick(p, 'laser', 5.2, dt, () => { spawnLaser(14, 210, player.x + 42, player.y, { color: COLORS.blue, warning: 1.22, width: 20 }); spawnLaser(W - 14, 210, player.x - 42, player.y, { color: COLORS.coral, warning: 1.22, width: 20 }); });
    } else if (type === 'chronogrid') {
      tick(p, 'dial', 4.6, dt, () => formationTimeDial(false));
      tick(p, 'grid', 5.4, dt, formationGravityGrid);
      tick(p, 'time', 8.2, dt, () => startChronoSequence(false));
      tick(p, 'laser', 6.1, dt, () => spawnLaser(boss.x, boss.y, player.x, player.y, { color: COLORS.violet, warning: 1.5, width: 25 }));
    } else if (type === 'kaleidoscope') {
      tick(p, 'poly', 3.15, dt, () => formationPolygon(p.count++ % 2 ? 8 : 6, 84, 132, p.count % 2 ? COLORS.coral : COLORS.blue, p.t));
      tick(p, 'mirror', .55, dt, () => { aimed(3, .18, 158, { color: COLORS.gold, shape: 'diamond', bounce: 2 }); });
      tick(p, 'laser', 5.4, dt, () => { spawnLaser(boss.x - 44, boss.y, player.x + 52, player.y, { color: COLORS.coral, warning: 1.2, width: 19 }); spawnLaser(boss.x + 44, boss.y, player.x - 52, player.y, { color: COLORS.blue, warning: 1.2, width: 19 }); });
    } else if (type === 'singularity') {
      tick(p, 'still', 2.9, dt, () => formationRing(18, 82, 112, { color: COLORS.violet, delay: 1.05, pauseAt: 1.75, pauseDuration: .82, redirectToPlayer: p.count++ % 2 === 0, motion: 'tangent' }));
      tick(p, 'core', 4.7, dt, () => aimed(1, 0, 78, { color: COLORS.red, radius: 13, splitAt: 1.25, splitCount: 10, splitSpeed: 122, splitRemove: true }));
      tick(p, 'dial', 5.4, dt, () => formationTimeDial(false));
      tick(p, 'time', 9.1, dt, () => startChronoSequence(false));
      tick(p, 'laser', 5.8, dt, () => spawnLaser(boss.x, boss.y, player.x, player.y, { color: COLORS.violet, warning: 1.32, width: 27 }));
    } else if (type === 'blackstar') {
      tick(p, 'seal', 3.8, dt, () => formationMagicSeal(false));
      tick(p, 'reverse', 1.7, dt, () => ring(16, 108, p.t, { color: COLORS.red, pauseAt: .72, pauseDuration: .48, reverseAfterPause: true, turn: .16 }, [p.count++ % 16, (p.count + 1) % 16]));
      tick(p, 'time', 7.4, dt, () => startChronoSequence(true));
      tick(p, 'laser', 4.9, dt, () => spawnLaser(boss.x + (p.count % 2 ? -60 : 60), boss.y, player.x, player.y, { color: COLORS.red, warning: 1.18, width: 26 }));
    } else if (type === 'cathedral') {
      tick(p, 'cathedral', 3.25, dt, () => formationPolygon(12, 96, 126, p.count++ % 2 ? COLORS.gold : COLORS.white, p.t * .3));
      tick(p, 'spire', .62, dt, () => { const x = 32 + (p.count * 89) % (W - 64); spawnBullet(x, -10, Math.PI / 2, 174, { color: COLORS.gold, shape: 'needle', sway: .26 }); p.count++; });
      tick(p, 'laser', 5.2, dt, () => { spawnLaser(18, 220, W + 20, 360, { color: COLORS.gold, warning: 1.18, width: 21 }); spawnLaser(W - 18, 220, -20, 360, { color: COLORS.teal, warning: 1.18, width: 21 }); });
    } else if (type === 'apocalypse') {
      tick(p, 'grid', 4.05, dt, formationGravityGrid);
      tick(p, 'square', 3.3, dt, () => formationDropSquare(false));
      tick(p, 'core', 5, dt, () => aimed(1, 0, 92, { color: COLORS.red, radius: 14, splitAt: 1.12, splitCount: 12, splitSpeed: 132, splitRemove: true }));
      tick(p, 'laser', 4.7, dt, () => spawnLaser(boss.x, boss.y, player.x, player.y, { color: COLORS.coral, warning: 1.05, width: 28 }));
    } else if (type === 'zenith') {
      tick(p, 'seal', 3.15, dt, () => { formationMagicSeal(false); if (p.count++ % 2) formationPolygon(8, 104, 134, COLORS.teal, p.t); });
      tick(p, 'wheel', .24, dt, () => { const a = p.t * 3.1; for (let arm = 0; arm < 4; arm++) spawnBullet(boss.x, boss.y, a + arm / 4 * TAU, 138 + arm * 5, { color: [COLORS.teal, COLORS.coral, COLORS.gold, COLORS.violet][arm], turn: arm % 2 ? -.13 : .13, shape: 'diamond' }); });
      tick(p, 'time', 12.6, dt, () => { formationTimeDial(true); startChronoSequence(false); });
      tick(p, 'laser', 4.35, dt, () => { spawnLaser(boss.x - 48, boss.y, player.x + 45, player.y, { color: COLORS.gold, warning: 1.08, width: 24 }); spawnLaser(boss.x + 48, boss.y, player.x - 45, player.y, { color: COLORS.blue, warning: 1.08, width: 24 }); });
    } else if (type === 'eclipse') {
      tick(p, 'arc', calm ? 1.05 : .72, dt, () => { const n = calm ? 18 : 24; const gap = p.count * 4 % n; ring(n, p.count % 2 ? 78 : 106, p.count * 0.12, { color: p.count % 2 ? COLORS.violet : COLORS.white, radius: 5.5 }, [gap, (gap + 1) % n, (gap + 2) % n, (gap + 3) % n, (gap + 4) % n]); p.count++; });
      tick(p, 'dark', calm ? 2.1 : 1.55, dt, () => aimed(calm ? 3 : 5, 0.2, calm ? 142 : 158, { color: COLORS.red, radius: 8 }));
      tick(p, 'laser', calm ? 4.9 : 3.9, dt, () => spawnLaser(boss.x + (p.count % 2 ? -34 : 34), boss.y + 14, player.x, player.y, { color: COLORS.violet, warning: 1.2, width: 24 }));
    } else if (type === 'helix') {
      tick(p, 'helix', calm ? .16 : .1, dt, () => { const a = p.t * 2.8; spawnBullet(boss.x - 34, boss.y, a, calm ? 112 : 132, { color: COLORS.violet, turn: 0.14, shape: 'diamond' }); spawnBullet(boss.x + 34, boss.y, Math.PI - a, calm ? 112 : 132, { color: COLORS.coral, turn: -0.14, shape: 'diamond' }); });
      tick(p, 'fan', calm ? 1.6 : 1.15, dt, () => aimed(calm ? 7 : 9, 0.1, calm ? 152 : 172, { color: COLORS.white, shape: 'needle' }));
      tick(p, 'laser', calm ? 5.2 : 4.2, dt, () => { spawnLaser(boss.x - 42, boss.y, player.x - 34, player.y, { color: COLORS.violet, warning: 1.3, width: 20 }); spawnLaser(boss.x + 42, boss.y, player.x + 34, player.y, { color: COLORS.coral, warning: 1.3, width: 20 }); });
    } else if (type === 'finale') {
      tick(p, 'wheel', calm ? .18 : .12, dt, () => { const base = p.t * 2.6; const arms = calm ? 3 : 4; for (let arm = 0; arm < arms; arm++) spawnBullet(boss.x, boss.y, base + arm / arms * TAU, calm ? 112 + arm * 4 : 132 + arm * 3, { color: [COLORS.teal, COLORS.coral, COLORS.gold, COLORS.blue][arm], turn: arm % 2 ? -.08 : .08, shape: arm % 3 ? 'diamond' : 'orb' }); });
      tick(p, 'ring', calm ? 1.5 : 1.05, dt, () => { const n = calm ? 18 : 24; const gap = p.count * 4 % n; ring(n, p.count % 2 ? 78 : 102, p.count * 0.16, { color: COLORS.white }, [gap, (gap + 1) % n, (gap + 2) % n, (gap + 3) % n, (gap + 4) % n]); p.count++; });
      tick(p, 'aim', calm ? 2.4 : 1.8, dt, () => aimed(calm ? 5 : 7, 0.09, calm ? 185 : 215, { color: COLORS.red, shape: 'needle' }));
      tick(p, 'laser', calm ? 4.5 : 3.5, dt, () => spawnLaser(boss.x + (p.count % 2 ? -48 : 48), boss.y + 4, player.x, player.y, { color: p.count % 2 ? COLORS.coral : COLORS.blue, warning: 1.15, duration: .76, width: 27 }));
    }
  }

  function clearBullets(scoreEach = 0) {
    for (const b of bullets) { if (scoreEach) game.score += scoreEach * game.chain; burstParticles(b.x, b.y, b.color, 1); }
    bullets.length = 0;
  }

  function burstParticles(x, y, color, count = 8, speedScale = 1) {
    for (let i = 0; i < count && particles.length < 800; i++) { const a = rand(0, TAU); const speed = rand(35, 180) * speedScale; particles.push({ x, y, vx: Math.cos(a) * speed, vy: Math.sin(a) * speed, life: rand(0.25, 0.85), max: 0.85, color, size: rand(1.5, 5) }); }
  }

  function createBossDeath() {
    const color = STAGES[game.stage].color;
    for (let i = 0; i < 120; i++) burstParticles(boss.x + rand(-28, 28), boss.y + rand(-34, 34), i % 3 ? color : COLORS.white, 1, 1.8);
    for (let i = 0; i < 4; i++) shockwaves.push({ x: boss.x, y: boss.y, r: 8 + i * 14, speed: 220 + i * 80, life: 1.2, color: i % 2 ? COLORS.white : color });
    game.flash = 1; game.shake = 18;
  }

  function fire() {
    const spread = player.focus ? 30 : 82;
    const speed = player.focus ? -710 : -650;
    const accent = sound.beatPulse > .58;
    shots.push({ x: player.x, y: player.y - 22, vx: 0, vy: speed, damage: player.focus ? 12 : 10, type: 'main', age: 0 });
    shots.push({ x: player.x - 9, y: player.y - 15, vx: -spread, vy: speed + 22, damage: 7, type: 'wing', age: 0 });
    shots.push({ x: player.x + 9, y: player.y - 15, vx: spread, vy: speed + 22, damage: 7, type: 'wing', age: 0 });
    if (player.focus) {
      shots.push({ x: player.x - 6, y: player.y - 19, vx: -14, vy: -690, damage: 5, type: 'needle', age: 0 });
      shots.push({ x: player.x + 6, y: player.y - 19, vx: 14, vy: -690, damage: 5, type: 'needle', age: 0 });
    }
    burstParticles(player.x, player.y - 19, accent ? COLORS.gold : COLORS.teal, accent ? 5 : 2, accent ? .52 : .35);
    if (accent) shockwaves.push({ x: player.x, y: player.y - 18, r: 3, speed: 82, life: .18, color: COLORS.gold });
    player.recoil = accent ? .16 : .1;
    sound.shot(accent);
  }

  function useBurst() {
    if (game.mode !== 'playing' || player.cores <= 0 || boss.phase !== 'active' || game.cinematic?.type === 'burst') return;
    player.cores -= 1; player.invulnerable = 4.2;
    game.cinematic = { type: 'burst', t: 0, duration: 2.6, applied: false };
    game.shake = 8; sound.burst(); updateHud(true);
  }

  function applyBurst() {
    const c = game.cinematic;
    if (!c || c.applied) return;
    c.applied = true; game.flash = .55; game.shake = 18;
    clearBullets(42); lasers.length = 0; burstParticles(boss.x, boss.y, COLORS.gold, 70, 1.7); sound.laserFire();
    boss.hp = Math.max(0, boss.hp - Math.round(boss.maxHp * 0.3)); boss.flash = 1;
    floaters.push({ x: boss.x, y: boss.y - 42, text: 'CORE PIERCE', color: COLORS.gold, life: 1.1, max: 1.1, size: 17 });
    if (boss.hp <= 0) endSpell(true);
  }

  function hitPlayer() {
    if (player.invulnerable > 0 || game.mode !== 'playing') return;
    if (game.invincible) {
      player.invulnerable = .55; game.shake = 1.2; sound.hit();
      burstParticles(player.x, player.y, COLORS.white, 3, .35);
      updateHud(true); return;
    }
    const damage = difficulty().playerDamage;
    player.hp = Math.max(0, player.hp - damage); player.invulnerable = 1.65; game.combo = 0; game.chain = 1; game.comboClock = 0;
    game.damageTaken += damage; game.hitsTaken += 1;
    game.shake = 2.5; sound.hit(); burstParticles(player.x, player.y, COLORS.white, 7, .55);
    for (let i = bullets.length - 1; i >= 0; i--) if (Math.hypot(bullets[i].x - player.x, bullets[i].y - player.y) < 52) bullets.splice(i, 1);
    if (player.hp <= 0) finishRun(false); updateHud(true);
  }

  function registerHit(x, y, damage) {
    game.combo += 1; game.maxCombo = Math.max(game.maxCombo, game.combo); game.comboClock = 1.45;
    game.chain = 1 + Math.min(8, game.combo / 55); game.maxChain = Math.max(game.maxChain, game.chain);
    game.score += damage * 9 * game.chain * difficulty().score;
    boss.flash = 1;
    if (game.combo % 10 === 0) { game.hitstop = 0.028; game.shake = Math.min(6, 1.5 + game.combo / 80); sound.bossHit(); burstParticles(x, y, COLORS.white, 7); ui.combo.classList.remove('punch'); void ui.combo.offsetWidth; ui.combo.classList.add('punch'); }
    if (game.combo % 50 === 0) floaters.push({ x, y: y - 22, text: `${game.combo} COMBO`, color: COLORS.gold, life: 0.9, max: 0.9, size: 15 });
  }

  function updateDialogue(dt) {
    if (!game.dialogue) return;
    const line = game.dialogue.lines[game.dialogue.index];
    game.dialogue.shown = Math.min(line.text.length, game.dialogue.shown + dt * 34);
    ui.dialogueText.textContent = line.text.slice(0, Math.floor(game.dialogue.shown));
  }

  function updateCinematic(dt) {
    if (!game.cinematic) return;
    game.cinematic.t += dt;
    if (game.cinematic.type === 'burst' && game.cinematic.t >= 0.95) applyBurst();
    if (game.cinematic.t >= game.cinematic.duration) game.cinematic = null;
  }

  function updateTimeEffect(dt) {
    const effect = game.timeEffect;
    if (effect.mode === 'none') return;
    effect.clock -= dt;
    if (effect.clock > 0) return;
    if (effect.next === 'rewind') {
      Object.assign(effect, { mode: 'rewind', clock: 1.18, duration: 1.18, next: null });
      game.flash = Math.max(game.flash, .3); game.shake = Math.max(game.shake, 3.2); sound.spell();
      for (const bullet of bullets) bullet.rewindClock = 0;
    } else {
      Object.assign(effect, { mode: 'none', clock: 0, duration: 0, next: null });
      game.flash = Math.max(game.flash, .16);
    }
  }

  function updateCombat(dt) {
    const cinematicSlow = game.cinematic?.type === 'burst' && game.cinematic.t < 1.4 ? 0.08 : 1;
    const stopSlow = game.hitstop > 0 ? 0.08 : 1;
    if (game.hitstop > 0) game.hitstop = Math.max(0, game.hitstop - dt);
    dt *= cinematicSlow * stopSlow;
    updateTimeEffect(dt);
    const timeMode = game.timeEffect.mode;
    const fieldPaused = timeMode !== 'none';

    const dangerDrive = player.hp / player.maxHp < .3 ? .12 : 0;
    sound.updateMusic(dt, game.stage, game.spell, 0.25 + game.stage * 0.16 + boss.rage * 0.38 + dangerDrive);
    if (sound.beatSerial !== game.beatSerial) {
      game.beatSerial = sound.beatSerial;
      shell.dataset.beat = String(sound.beatIndex);
      shell.classList.remove('beat', 'downbeat');
      void shell.offsetWidth;
      shell.classList.add(sound.downbeat ? 'downbeat' : 'beat');
      if (sound.downbeat && boss.phase === 'active') game.shake = Math.max(game.shake, .65 + boss.rage * .55);
    }
    game.banner = Math.max(0, game.banner - dt); boss.flash = Math.max(0, boss.flash - dt * 7); player.invulnerable = Math.max(0, player.invulnerable - dt);
    if (game.comboClock > 0) game.comboClock -= dt; else if (game.combo > 0) { game.combo = Math.max(0, game.combo - Math.ceil(50 * dt)); game.chain = 1 + Math.min(8, game.combo / 55); }

    const focused = Boolean(keys.ShiftLeft || keys.ShiftRight); player.focus = focused;
    const speed = focused ? 150 : 292;
    let dx = (keys.ArrowRight || keys.KeyD ? 1 : 0) - (keys.ArrowLeft || keys.KeyA ? 1 : 0);
    let dy = (keys.ArrowDown || keys.KeyS ? 1 : 0) - (keys.ArrowUp || keys.KeyW ? 1 : 0);
    if (dx || dy) { const len = Math.hypot(dx, dy); player.x += dx / len * speed * dt; player.y += dy / len * speed * dt; }
    player.x = clamp(player.x, 20, W - 20); player.y = clamp(player.y, 72, H - 30);

    const stage = STAGES[game.stage];
    if (!fieldPaused) {
      boss.x = W / 2 + Math.sin(game.time * (0.72 + game.stage * 0.06) + game.stage) * (94 + game.stage * 10);
      boss.y = 158 + Math.sin(game.time * 1.17) * 17;
    }

    if (boss.phase === 'entrance' || boss.phase === 'spellIntro' || boss.phase === 'spellBreak' || boss.phase === 'death') {
      boss.phaseClock -= dt;
      if (boss.phaseClock <= 0) {
        if (boss.phase === 'entrance') beginSpell();
        else if (boss.phase === 'spellIntro') boss.phase = 'active';
        else advanceAfterPhase();
      }
    }

    const active = boss.phase === 'active';
    player.fireClock -= dt;
    const firing = keys.KeyZ || keys.KeyK || keys.Space || game.pointerActive;
    if (active && firing && player.fireClock <= 0) { player.fireClock = focused ? 0.105 : 0.075; fire(); }

    if (active && !fieldPaused) {
      boss.timer -= dt; boss.rage = clamp(1 - boss.hp / boss.maxHp, 0, 1);
      updatePattern(dt);
      if (boss.timer <= 0) endSpell(false);
    }

    for (let i = shots.length - 1; i >= 0; i--) {
      const shot = shots[i];
      if (!fieldPaused) { shot.age += dt; shot.x += shot.vx * dt; shot.y += shot.vy * dt; }
      if (shot.y < -40 || shot.x < -35 || shot.x > W + 35) { shots.splice(i, 1); continue; }
      if (active && Math.hypot(shot.x - boss.x, shot.y - boss.y) < 44) {
        boss.hp -= shot.damage; registerHit(shot.x, shot.y, shot.damage); shots.splice(i, 1);
        if (boss.hp <= 0) endSpell(true);
      }
    }

    for (let i = bullets.length - 1; i >= 0; i--) {
      const b = bullets[i];
      if (timeMode === 'rewind') {
        b.rewindClock -= dt;
        while (b.rewindClock <= 0 && b.history.length) {
          const state = b.history.pop(); [b.x, b.y, b.vx, b.vy, b.age] = state; b.rewindClock += .04;
        }
      } else if (timeMode === 'none') {
        b.historyClock -= dt;
        if (b.historyClock <= 0) {
          b.history.push([b.x, b.y, b.vx, b.vy, b.age]); if (b.history.length > 42) b.history.shift(); b.historyClock += .04;
        }
        b.age += dt;
        if (b.delay > 0) {
          b.delay -= dt;
          if (b.delay <= 0 && b.orbitLeft <= 0) { b.vx = b.releaseVx; b.vy = b.releaseVy; }
        }
        if (b.pauseAt > 0 && !b.pauseDone && b.age >= b.pauseAt) {
          b.pauseDone = true; b.pauseLeft = b.pauseDuration; b.savedSpeed = Math.max(45, Math.hypot(b.vx, b.vy)); b.vx = 0; b.vy = 0;
        }
        if (b.pauseLeft > 0) {
          b.pauseLeft -= dt;
          if (b.pauseLeft <= 0) {
            let angle = b.redirectToPlayer ? Math.atan2(player.y - b.y, player.x - b.x) : Math.atan2(b.releaseVy, b.releaseVx);
            if (b.reverseAfterPause) angle += Math.PI;
            b.vx = Math.cos(angle) * b.savedSpeed; b.vy = Math.sin(angle) * b.savedSpeed; b.releaseVx = b.vx; b.releaseVy = b.vy;
          }
        }
        if (b.splitAt > 0 && !b.splitDone && b.age >= b.splitAt) {
          b.splitDone = true;
          for (let child = 0; child < b.splitCount; child++) spawnBullet(b.x, b.y, child / b.splitCount * TAU + b.age, b.splitSpeed, { color: child % 2 ? b.color : COLORS.white, shape: 'diamond', bounce: child % 3 === 0 ? 1 : 0 });
          burstParticles(b.x, b.y, b.color, 16, .8);
          if (b.splitRemove) { bullets.splice(i, 1); continue; }
        }
        if (b.phaseFlipAt > 0 && !b.phaseFlipped && b.age >= b.phaseFlipAt) {
          b.phaseFlipped = true;
          const speedNow = Math.max(48, Math.hypot(b.vx, b.vy));
          const angle = Math.atan2(b.vy, b.vx) + b.phaseFlip;
          b.vx = Math.cos(angle) * speedNow; b.vy = Math.sin(angle) * speedNow;
          b.releaseVx = b.vx; b.releaseVy = b.vy;
          burstParticles(b.x, b.y, b.color, 4, .35);
        }
        const stopped = b.delay > 0 || b.pauseLeft > 0;
        if (!stopped && b.orbitLeft > 0) {
          b.orbitLeft -= dt; b.orbitAngle += b.orbitSpeed * dt;
          b.x = b.orbitCx + Math.cos(b.orbitAngle) * b.orbitRadius; b.y = b.orbitCy + Math.sin(b.orbitAngle) * b.orbitRadius;
          if (b.orbitLeft <= 0) {
            let releaseAngle = b.orbitRelease === 'tangent' ? b.orbitAngle + Math.sign(b.orbitSpeed) * Math.PI / 2 : b.orbitRelease === 'reverse' ? b.orbitAngle + Math.PI : Math.atan2(player.y - b.y, player.x - b.x);
            b.vx = Math.cos(releaseAngle) * b.orbitReleaseSpeed; b.vy = Math.sin(releaseAngle) * b.orbitReleaseSpeed; b.releaseVx = b.vx; b.releaseVy = b.vy;
          }
        } else {
          if (!stopped && b.magnetStrength) {
            const dx = player.x - b.x; const dy = player.y - b.y; const distance = Math.max(32, Math.hypot(dx, dy));
            b.vx += dx / distance * b.magnetStrength * dt; b.vy += dy / distance * b.magnetStrength * dt;
          }
          if (!stopped && (b.turn || b.sway)) { const speedNow = Math.hypot(b.vx, b.vy); const a = Math.atan2(b.vy, b.vx) + (b.turn + Math.sin(b.age * b.swayFreq) * b.sway) * dt; b.vx = Math.cos(a) * speedNow; b.vy = Math.sin(a) * speedNow; }
          if (!stopped && b.accel) { const factor = Math.max(.72, 1 + b.accel * dt); b.vx *= factor; b.vy *= factor; }
          b.x += b.vx * dt; b.y += b.vy * dt;
          if (b.bounce > 0 && (b.x < 8 || b.x > W - 8)) { b.vx *= -1; b.x = clamp(b.x, 8, W - 8); b.bounce -= 1; }
          if (b.bounce > 0 && (b.y < 62 || b.y > H - 8)) { b.vy *= -1; b.y = clamp(b.y, 62, H - 8); b.bounce -= 1; }
          if (b.portalCount > 0 && b.x < -8) { b.x = W + 8; b.portalCount -= 1; burstParticles(W - 5, b.y, b.color, 5, .35); }
          else if (b.portalCount > 0 && b.x > W + 8) { b.x = -8; b.portalCount -= 1; burstParticles(5, b.y, b.color, 5, .35); }
          if (b.portalCount > 0 && b.y < 54) { b.y = H + 8; b.portalCount -= 1; burstParticles(b.x, H - 5, b.color, 5, .35); }
          else if (b.portalCount > 0 && b.y > H + 8) { b.y = 54; b.portalCount -= 1; burstParticles(b.x, 60, b.color, 5, .35); }
        }
      }
      if (b.x < -60 || b.x > W + 60 || b.y < -75 || b.y > H + 75) { bullets.splice(i, 1); continue; }
      const dist = Math.hypot(b.x - player.x, b.y - player.y);
      if (dist < b.radius + 4) { bullets.splice(i, 1); hitPlayer(); continue; }
      if (!b.grazed && dist < b.radius + 25) {
        b.grazed = true; game.graze += 1; game.score += 120 * game.chain * difficulty().score; burstParticles(b.x, b.y, COLORS.white, 2);
        if (game.graze >= game.nextCoreGraze) { game.nextCoreGraze += 80; grantCore('80 擦弹补给'); }
        if (game.lastGrazeSound <= 0) { sound.graze(); game.lastGrazeSound = 0.065; }
      }
    }

    for (let i = lasers.length - 1; i >= 0; i--) {
      const laser = lasers[i]; if (!fieldPaused) laser.age += dt;
      if (!fieldPaused && laser.phase === 'warning' && laser.age >= laser.warning) {
        laser.phase = 'firing'; laser.age = 0; laser.fired = true; sound.laserFire(); game.shake = Math.max(game.shake, 7);
      } else if (laser.phase === 'firing') {
        const x2 = laser.x + Math.cos(laser.angle) * 1100;
        const y2 = laser.y + Math.sin(laser.angle) * 1100;
        if (distanceToSegment(player.x, player.y, laser.x, laser.y, x2, y2) < laser.width * .5 + 4) hitPlayer();
        if (!fieldPaused && laser.age >= laser.duration) lasers.splice(i, 1);
      }
    }
  }

  function updateEffects(dt) {
    for (const star of stars) { star.y += star.speed * dt; if (star.y > H + 4) { star.y = -4; star.x = rand(0, W); } }
    for (let i = particles.length - 1; i >= 0; i--) { const p = particles[i]; p.life -= dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= 0.985; p.vy *= 0.985; if (p.life <= 0) particles.splice(i, 1); }
    for (let i = floaters.length - 1; i >= 0; i--) { const f = floaters[i]; f.life -= dt; f.y -= 28 * dt; if (f.life <= 0) floaters.splice(i, 1); }
    for (let i = shockwaves.length - 1; i >= 0; i--) { const s = shockwaves[i]; s.life -= dt; s.r += s.speed * dt; if (s.life <= 0) shockwaves.splice(i, 1); }
  }

  function update(dt) {
    game.time += dt; game.flash = Math.max(0, game.flash - dt * 1.9); game.shake = Math.max(0, game.shake - dt * 32); game.lastGrazeSound = Math.max(0, game.lastGrazeSound - dt);
    if (game.mode === 'title') sound.updateTitleMusic(dt);
    if (game.mode === 'paused') { updateHud(); return; }
    if (game.coreToastClock > 0) { game.coreToastClock -= dt; if (game.coreToastClock <= 0) ui.coreToast.classList.add('hidden'); }
    updateCinematic(dt); updateEffects(dt);
    if (game.mode === 'dialogue') updateDialogue(dt);
    else if (game.mode === 'playing') updateCombat(dt);
    updateHud();
  }

  function drawBackground() {
    const gradient = ctx.createLinearGradient(0, 0, 0, H);
    gradient.addColorStop(0, '#081228'); gradient.addColorStop(.55, '#111b42'); gradient.addColorStop(1, '#271638');
    ctx.fillStyle = gradient; ctx.fillRect(0, 0, W, H);
    drawPlanet(game.stage, 48, 470, 300, .13);
    ctx.save(); ctx.globalAlpha = .16; ctx.fillStyle = STAGES[game.stage].color;
    ctx.fillStyle = '#4b5ad2'; ctx.beginPath(); ctx.ellipse(430, 210, 210, 125, .18, 0, TAU); ctx.fill(); ctx.restore();
    for (const star of stars) { ctx.globalAlpha = star.alpha; ctx.fillStyle = star.speed > 30 ? COLORS.teal : COLORS.gold; ctx.fillRect(star.x, star.y, star.size, star.size * 3); }
    ctx.save(); ctx.globalAlpha = .32; ctx.strokeStyle = STAGES[game.stage].color; ctx.lineWidth = 1;
    for (let i = 0; i < 5; i++) { const r = 92 + i * 31 + Math.sin(game.time * .7 + i) * 4; ctx.beginPath(); ctx.arc(370, 268, r, -.9, .78); ctx.stroke(); }
    ctx.restore();
    ctx.save(); ctx.globalAlpha = .15; ctx.strokeStyle = STAGES[game.stage].color; ctx.fillStyle = STAGES[game.stage].color; ctx.lineWidth = 1.2;
    if (game.stage === 0) {
      for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.ellipse(W / 2, 330, 110 + i * 72, 40 + i * 22, game.time * .025 + i * .3, 0, TAU); ctx.stroke(); }
    } else if (game.stage === 1) {
      for (let x = -80; x < W + 100; x += 62) { ctx.beginPath(); ctx.moveTo(x + Math.sin(game.time * 2 + x) * 8, 60); ctx.lineTo(x + 130, H); ctx.stroke(); }
      for (let y = 110; y < H; y += 84) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y + Math.sin(game.time * 2 + y) * 12); ctx.stroke(); }
    } else if (game.stage === 2) {
      ctx.translate(W / 2, 360); ctx.rotate(game.time * .035); for (let i = 0; i < 8; i++) { ctx.rotate(TAU / 8); ctx.beginPath(); ctx.moveTo(28, 0); ctx.lineTo(196, -34); ctx.lineTo(148, 34); ctx.closePath(); ctx.stroke(); }
    } else if (game.stage === 3) {
      for (let i = 0; i < 7; i++) { const x = i * 92 - 40 + Math.sin(game.time * .45) * 28; ctx.fillRect(x, 72, 2, H - 120); }
      ctx.globalAlpha = .08 + Math.sin(game.time * 2) * .025; ctx.fillRect(W / 2 - 62, 60, 124, H - 85);
    } else if (game.stage === 4) {
      const points = Array.from({ length: 11 }, (_, i) => ({ x: 35 + (i * 97) % 430, y: 110 + (i * 137) % 520 }));
      ctx.beginPath(); points.forEach((point, index) => index ? ctx.lineTo(point.x, point.y) : ctx.moveTo(point.x, point.y)); ctx.stroke();
      for (const point of points) { ctx.beginPath(); ctx.arc(point.x, point.y, 3, 0, TAU); ctx.fill(); }
    } else if (game.stage === 5) {
      ctx.beginPath(); ctx.moveTo(W / 2, 60); ctx.lineTo(W / 2, H); ctx.stroke();
      for (let i = 0; i < 5; i++) { const y = 130 + i * 115; ctx.beginPath(); ctx.moveTo(0, y + Math.sin(game.time + i) * 18); ctx.quadraticCurveTo(W / 2, y - 42, W, y + Math.sin(game.time + i) * 18); ctx.stroke(); }
    } else if (game.stage === 6) {
      ctx.translate(W / 2, 370); for (let i = 0; i < 12; i++) { ctx.rotate(TAU / 12); ctx.fillRect(142, -1, i % 3 === 0 ? 30 : 15, 2); }
      ctx.rotate(-game.time * .15); ctx.fillRect(0, -1, 128, 2); ctx.rotate(game.time * .42); ctx.fillRect(0, -1, 86, 2); ctx.beginPath(); ctx.arc(0, 0, 138, 0, TAU); ctx.stroke();
    } else {
      ctx.translate(W / 2, 360); for (let i = 0; i < 16; i++) { ctx.rotate(TAU / 16); ctx.beginPath(); ctx.moveTo(48, 0); ctx.lineTo(220, 0); ctx.stroke(); }
      for (let r = 70; r <= 200; r += 43) { ctx.beginPath(); ctx.arc(0, 0, r + Math.sin(game.time + r) * 4, 0, TAU); ctx.stroke(); }
    }
    ctx.restore(); ctx.globalAlpha = 1;
  }

  function drawAlicePixel(x, y, size, alpha = 1, attacking = false) {
    ctx.save(); ctx.globalAlpha = alpha; ctx.imageSmoothingEnabled = false;
    const sprite = attacking && aliceAttack.complete && aliceAttack.naturalWidth ? aliceAttack : alicePixel;
    if (sprite.complete && sprite.naturalWidth) ctx.drawImage(sprite, x - size * .47, y - size / 2, size * .94, size);
    else { ctx.fillStyle = COLORS.teal; ctx.fillRect(x - 5, y - 12, 10, 24); }
    ctx.restore();
  }

  function drawAliceSkill(x, y, width, alpha = 1) {
    ctx.save(); ctx.globalAlpha = alpha; ctx.imageSmoothingEnabled = true;
    if (aliceSkill.complete && aliceSkill.naturalWidth) {
      const height = width * aliceSkill.naturalHeight / aliceSkill.naturalWidth;
      ctx.drawImage(aliceSkill, x - width / 2, y - height / 2, width, height);
    }
    ctx.restore();
  }

  function drawPlanet(index, x, y, size, alpha = 1) {
    ctx.save(); ctx.globalAlpha = alpha; ctx.imageSmoothingEnabled = true;
    if (planetSheet.complete && planetSheet.naturalWidth) ctx.drawImage(planetSheet, (index % 4) * 256, 0, 256, 256, x - size / 2, y - size / 2, size, size);
    else { ctx.fillStyle = STAGES[index].color; ctx.beginPath(); ctx.arc(x, y, size * .4, 0, TAU); ctx.fill(); }
    ctx.restore();
  }

  function drawGuardian(index, x, y, size, alpha = 1) {
    ctx.save(); ctx.globalAlpha = alpha; ctx.imageSmoothingEnabled = true;
    if (guardianSheet.complete && guardianSheet.naturalWidth) ctx.drawImage(guardianSheet, (index % 4) * 256, 0, 256, 256, x - size / 2, y - size / 2, size, size);
    else { ctx.fillStyle = STAGES[index].color; ctx.beginPath(); ctx.arc(x, y, size * .4, 0, TAU); ctx.fill(); }
    ctx.restore();
  }

  function getBulletSprite(bullet) {
    const key = `${bullet.shape}:${bullet.color}:${Math.round(bullet.radius)}`;
    if (bulletCache.has(key)) return bulletCache.get(key);
    const size = 40; const c = document.createElement('canvas'); c.width = c.height = size; const g = c.getContext('2d'); const r = bullet.radius; g.translate(size / 2, size / 2); g.imageSmoothingEnabled = false; g.fillStyle = '#f5fcff'; g.strokeStyle = '#071020'; g.lineWidth = 2;
    if (bullet.shape === 'needle') {
      g.fillStyle = bullet.color; g.beginPath(); g.moveTo(0, -r * 2.8); g.lineTo(r * .9, r * 1.6); g.lineTo(0, r * 1.1); g.lineTo(-r * .9, r * 1.6); g.closePath(); g.fill(); g.stroke();
      g.fillStyle = '#fff'; g.fillRect(-1.5, -r * 1.45, 3, r * 1.8);
    } else if (bullet.shape === 'diamond') {
      g.fillStyle = bullet.color; g.beginPath(); g.moveTo(0, -r * 1.9); g.lineTo(r * 1.15, 0); g.lineTo(0, r * 1.9); g.lineTo(-r * 1.15, 0); g.closePath(); g.fill(); g.stroke(); g.fillStyle = '#fff'; g.fillRect(-2, -2, 4, 4);
    } else {
      g.fillStyle = bullet.color; g.beginPath(); g.arc(0, 0, r + 1, 0, TAU); g.fill(); g.stroke(); g.fillStyle = '#fff'; g.fillRect(-2, -2, 4, 4);
    }
    bulletCache.set(key, c); return c;
  }

  function drawBoss() {
    if (game.mode === 'title' || boss.phase === 'idle') return;
    const stage = STAGES[game.stage];
    if (boss.phase === 'death') {
      const t = 1 - boss.phaseClock / 2.7; const alpha = clamp(1 - t * 1.15, 0, 1); const scale = 68 + t * 42;
      for (let slice = 0; slice < 7; slice++) { ctx.save(); ctx.beginPath(); ctx.rect(boss.x - scale / 2, boss.y - scale / 2 + slice * scale / 7, scale, scale / 7 + 1); ctx.clip(); drawGuardian(stage.sprite, boss.x + Math.sin(slice * 2.3) * t * 46, boss.y + (slice - 3) * t * 10, scale, alpha); ctx.restore(); }
      return;
    }
    ctx.save(); ctx.translate(boss.x, boss.y); ctx.rotate(game.time * .18); ctx.strokeStyle = stage.color; ctx.globalAlpha = .58; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(0, 0, 37 + Math.sin(game.time * 2.4) * 3, 0, TAU); ctx.stroke(); for (let i = 0; i < 10; i++) { const a = i / 10 * TAU; ctx.fillStyle = i % 2 ? COLORS.white : stage.color; ctx.fillRect(Math.cos(a) * 42 - 2, Math.sin(a) * 42 - 2, 4, 4); } ctx.restore();
    drawGuardian(stage.sprite, boss.x, boss.y, 82);
    if (boss.flash > 0) { ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = boss.flash * .36; ctx.fillStyle = COLORS.white; ctx.beginPath(); ctx.arc(boss.x, boss.y, 33, 0, TAU); ctx.fill(); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over'; }
  }

  function getPlayerShotSprite(type) {
    if (playerShotCache.has(type)) return playerShotCache.get(type);
    const sprite = document.createElement('canvas'); sprite.width = 36; sprite.height = 68;
    const g = sprite.getContext('2d'); g.translate(18, 34); g.imageSmoothingEnabled = false;
    const wing = type === 'wing'; const needle = type === 'needle';
    const half = needle ? 2 : wing ? 4 : 6;
    g.fillStyle = wing ? '#5cc8ff' : '#57f0e4'; g.strokeStyle = '#071020'; g.lineWidth = 2;
    g.beginPath(); g.moveTo(0, -31); g.lineTo(half, -12); g.lineTo(half, 22); g.lineTo(0, 29); g.lineTo(-half, 22); g.lineTo(-half, -12); g.closePath(); g.fill(); g.stroke();
    g.fillStyle = '#fff'; g.fillRect(-1.5, -23, 3, 28);
    g.fillStyle = '#ffd56a'; g.fillRect(-half, 9, half * 2, 4);
    playerShotCache.set(type, sprite); return sprite;
  }

  function drawShots() {
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    for (const s of shots) {
      const sprite = getPlayerShotSprite(s.type);
      const angle = Math.atan2(s.vy, s.vx) + Math.PI / 2;
      ctx.save(); ctx.translate(s.x, s.y); ctx.rotate(angle); ctx.globalAlpha = clamp(s.age * 18, 0, 1); ctx.drawImage(sprite, -18, -34); ctx.restore();
    }
    ctx.restore();
  }

  function drawBullets() {
    const formations = new Map();
    for (const b of bullets) if (b.group && (b.delay > 0 || b.pauseLeft > 0 || b.orbitLeft > 0 || game.timeEffect.mode !== 'none')) {
      if (!formations.has(b.group)) formations.set(b.group, []);
      formations.get(b.group).push(b);
    }
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    for (const [id, formation] of formations) {
      if (formation.length < 2) continue;
      formation.sort((a, b) => a.linkOrder - b.linkOrder);
      const pulse = .38 + Math.sin(game.time * 8 + formation.length) * .12;
      ctx.globalAlpha = pulse; ctx.strokeStyle = formation[0].color; ctx.lineWidth = 1.6;
      ctx.beginPath(); ctx.moveTo(formation[0].x, formation[0].y);
      for (let i = 1; i < formation.length; i++) ctx.lineTo(formation[i].x, formation[i].y);
      if (/ring|poly|seal/.test(id)) ctx.closePath(); ctx.stroke();
      ctx.globalAlpha = pulse * .32; ctx.lineWidth = 7; ctx.stroke();
    }
    ctx.restore();
    for (const b of bullets) {
      if (game.timeEffect.mode === 'rewind' && b.history.length > 2) {
        ctx.save(); ctx.globalAlpha = .24; ctx.strokeStyle = b.color; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(b.x, b.y);
        for (let i = b.history.length - 1; i >= Math.max(0, b.history.length - 8); i--) ctx.lineTo(b.history[i][0], b.history[i][1]);
        ctx.stroke(); ctx.restore();
      }
      const sprite = getBulletSprite(b); ctx.save(); ctx.translate(b.x, b.y);
      if (b.delay > 0 || b.pauseLeft > 0) { ctx.globalAlpha = .48 + Math.sin(game.time * 16) * .22; ctx.strokeStyle = b.color; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(0, 0, b.radius + 7, 0, TAU); ctx.stroke(); }
      if (b.radius >= 9) { ctx.globalAlpha = .8; ctx.strokeStyle = COLORS.white; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(0, 0, b.radius + 5 + Math.sin(game.time * 9) * 2, 0, TAU); ctx.stroke(); }
      ctx.rotate(Math.atan2(b.vy, b.vx) + Math.PI / 2); ctx.drawImage(sprite, -20, -20); ctx.restore();
    }
  }

  function drawCannon(laser, pulse) {
    ctx.save(); ctx.translate(laser.x, laser.y); ctx.rotate(laser.angle);
    ctx.fillStyle = '#0b1632'; ctx.strokeStyle = COLORS.white; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(0, 0, 23, 0, TAU); ctx.fill(); ctx.stroke();
    ctx.strokeStyle = laser.color; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(0, 0, 17, -.85, .85); ctx.arc(0, 0, 17, Math.PI - .85, Math.PI + .85); ctx.stroke();
    for (let i = 0; i < 6; i++) { const a = i / 6 * TAU; ctx.save(); ctx.rotate(a); ctx.fillStyle = i % 2 ? COLORS.white : laser.color; ctx.fillRect(18, -2, 9, 4); ctx.restore(); }
    ctx.fillStyle = '#050916'; ctx.fillRect(-9, -7, 26, 14); ctx.strokeStyle = laser.color; ctx.strokeRect(-8, -6, 24, 12);
    ctx.globalAlpha = .72 + pulse * .28; ctx.fillStyle = COLORS.white; ctx.beginPath(); ctx.arc(18, 0, 5 + pulse * 2, 0, TAU); ctx.fill();
    ctx.strokeStyle = laser.color; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(18, 0, 10 + pulse * 3, 0, TAU); ctx.stroke();
    ctx.restore();
  }

  function drawLasers() {
    for (const laser of lasers) {
      const pulse = .5 + .5 * Math.sin(game.time * 22);
      const x2 = laser.x + Math.cos(laser.angle) * 1100;
      const y2 = laser.y + Math.sin(laser.angle) * 1100;
      if (laser.phase === 'warning') {
        const charge = clamp(laser.age / laser.warning, 0, 1);
        ctx.save(); ctx.setLineDash([8, 7]); ctx.lineDashOffset = -game.time * 55; ctx.strokeStyle = laser.color; ctx.globalAlpha = .28 + charge * .55; ctx.lineWidth = 2 + charge * 2; ctx.beginPath(); ctx.moveTo(laser.x, laser.y); ctx.lineTo(x2, y2); ctx.stroke(); ctx.setLineDash([]);
        ctx.globalAlpha = .88; ctx.fillStyle = '#17365f'; ctx.font = '900 9px Consolas, monospace'; ctx.fillText('LASER LOCK', clamp(laser.x + 18, 8, W - 82), clamp(laser.y - 24, 72, H - 20)); ctx.restore();
        drawCannon(laser, pulse * charge);
      } else {
        const life = clamp(1 - laser.age / laser.duration, 0, 1);
        ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.lineCap = 'round';
        ctx.globalAlpha = .42 * life; ctx.strokeStyle = laser.color; ctx.lineWidth = laser.width * 2.35; ctx.beginPath(); ctx.moveTo(laser.x, laser.y); ctx.lineTo(x2, y2); ctx.stroke();
        ctx.globalAlpha = .92; ctx.strokeStyle = laser.color; ctx.lineWidth = laser.width; ctx.beginPath(); ctx.moveTo(laser.x, laser.y); ctx.lineTo(x2, y2); ctx.stroke();
        ctx.strokeStyle = COLORS.white; ctx.lineWidth = laser.width * .32; ctx.beginPath(); ctx.moveTo(laser.x, laser.y); ctx.lineTo(x2, y2); ctx.stroke(); ctx.restore();
        drawCannon(laser, pulse);
      }
    }
  }

  function drawPlayer() {
    const blink = player.invulnerable > 0 && Math.floor(player.invulnerable * 14) % 2 === 0;
    player.recoil = Math.max(0, player.recoil - 1 / 120);
    const recoilOffset = player.recoil > 0 ? Math.sin(player.recoil * 48) * 3 : 0;
    if (!blink) drawAlicePixel(player.x, player.y + recoilOffset, 66, 1, player.recoil > 0);
    if (player.recoil > 0) {
      ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = Math.min(1, player.recoil * 10); ctx.strokeStyle = player.focus ? COLORS.gold : COLORS.teal; ctx.lineWidth = player.focus ? 4 : 2;
      ctx.beginPath(); ctx.arc(player.x, player.y - 29, player.focus ? 19 : 13, Math.PI * 1.12, Math.PI * 1.88); ctx.stroke(); ctx.restore();
    }
    if (player.focus || game.pointerType === 'touch') { ctx.strokeStyle = COLORS.teal; ctx.lineWidth = 1; ctx.globalAlpha = .8; ctx.beginPath(); ctx.arc(player.x, player.y, 11 + Math.sin(game.time * 6) * 1.5, 0, TAU); ctx.stroke(); ctx.fillStyle = COLORS.white; ctx.beginPath(); ctx.arc(player.x, player.y, 3, 0, TAU); ctx.fill(); ctx.globalAlpha = 1; }
  }

  function drawEffects() {
    for (const p of particles) { ctx.globalAlpha = clamp(p.life / p.max, 0, 1); ctx.fillStyle = p.color; ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size); }
    ctx.globalAlpha = 1;
    for (const s of shockwaves) { ctx.globalAlpha = clamp(s.life, 0, 1); ctx.strokeStyle = s.color; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, TAU); ctx.stroke(); }
    ctx.globalAlpha = 1;
    for (const f of floaters) { ctx.globalAlpha = clamp(f.life / f.max, 0, 1); ctx.fillStyle = f.color; ctx.font = `900 ${f.size}px Consolas, monospace`; ctx.textAlign = 'center'; ctx.fillText(f.text, f.x, f.y); }
    ctx.globalAlpha = 1; ctx.textAlign = 'left';
  }

  function drawTimeEffect() {
    const effect = game.timeEffect;
    if (effect.mode === 'none') return;
    const progress = clamp(1 - effect.clock / Math.max(.01, effect.duration), 0, 1);
    const rewind = effect.mode === 'rewind'; const color = rewind ? COLORS.coral : COLORS.violet;
    ctx.save(); ctx.fillStyle = rewind ? 'rgba(32,5,28,.24)' : 'rgba(5,7,35,.38)'; ctx.fillRect(0, 0, W, H);
    ctx.globalCompositeOperation = 'lighter'; ctx.strokeStyle = color;
    for (let ringIndex = 0; ringIndex < 4; ringIndex++) {
      const radius = 72 + ringIndex * 42 + Math.sin(game.time * 5 + ringIndex) * 5;
      ctx.globalAlpha = .22 + ringIndex * .06; ctx.lineWidth = ringIndex === 0 ? 3 : 1;
      ctx.beginPath(); ctx.arc(W / 2, H / 2, radius, rewind ? progress * TAU : -Math.PI / 2, rewind ? -Math.PI / 2 : progress * TAU - Math.PI / 2, rewind); ctx.stroke();
    }
    ctx.globalAlpha = .38; ctx.setLineDash([3, 9]); ctx.lineDashOffset = rewind ? game.time * 95 : -game.time * 65;
    for (let x = 16; x < W; x += 32) { ctx.beginPath(); ctx.moveTo(x, 58); ctx.lineTo(rewind ? W - x : x, H); ctx.stroke(); }
    ctx.setLineDash([]); ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = 'rgba(3,6,22,.88)'; ctx.fillRect(48, 302, W - 96, 116); ctx.strokeStyle = color; ctx.lineWidth = 2; ctx.strokeRect(48.5, 302.5, W - 97, 115);
    ctx.textAlign = 'center'; ctx.fillStyle = color; ctx.font = '900 10px Consolas, monospace'; ctx.fillText(rewind ? 'UMBRA PROTOCOL // REWIND' : 'UMBRA PROTOCOL // TIME LOCK', W / 2, 332);
    ctx.fillStyle = COLORS.white; ctx.font = '900 30px "Microsoft YaHei", sans-serif'; ctx.fillText(rewind ? '轨迹回溯' : '时间冻结', W / 2, 374);
    ctx.fillStyle = rewind ? COLORS.gold : COLORS.blue; ctx.font = '900 12px Consolas, monospace'; ctx.fillText(rewind ? '<<  HISTORY RESTORE' : '00 : 00 : 00', W / 2, 399);
    ctx.restore();
  }

  function drawBossHud() {
    if (game.mode === 'title' || game.mode === 'result' || boss.phase === 'idle') return;
    const stage = STAGES[game.stage]; const spell = stage.spells[game.spell]; const hp = clamp(boss.hp / boss.maxHp, 0, 1);
    ctx.save(); ctx.fillStyle = 'rgba(235,248,251,.94)'; ctx.fillRect(170, 68, 300, 54); ctx.strokeStyle = 'rgba(86,174,199,.78)'; ctx.strokeRect(170.5, 68.5, 299, 53); ctx.fillStyle = '#17445e'; ctx.font = '800 9px "Segoe UI", sans-serif'; ctx.textAlign = 'left'; ctx.fillText(stage.name, 183, 87); ctx.textAlign = 'right'; ctx.fillStyle = boss.rage > .7 ? COLORS.red : '#a36b16'; ctx.font = '900 12px Consolas, monospace'; ctx.fillText(Math.max(0, Math.ceil(boss.timer)).toString().padStart(2, '0'), 457, 88);
    ctx.fillStyle = 'rgba(34,87,112,.18)'; ctx.fillRect(183, 96, 274, 9); ctx.fillStyle = stage.color; ctx.fillRect(183, 96, 274 * hp, 9); if (boss.rage > .5) { ctx.globalAlpha = (boss.rage - .5) * 1.5; ctx.fillStyle = COLORS.red; ctx.fillRect(183, 96, 274 * hp, 9); ctx.globalAlpha = 1; }
    for (let i = 0; i < stage.spells.length; i++) { ctx.fillStyle = i < game.spell ? '#5a6670' : i === game.spell ? stage.color : 'rgba(255,255,255,.2)'; ctx.fillRect(183 + i * 18, 111, 12, 3); }
    ctx.restore();

    if (game.banner > 0 && boss.phase !== 'active') {
      const alpha = Math.min(1, game.banner * 1.5, (2.6 - game.banner) * 2.8); ctx.save(); ctx.globalAlpha = clamp(alpha, 0, 1); ctx.fillStyle = 'rgba(5,6,17,.93)'; ctx.fillRect(42, 286, W - 84, 92); ctx.strokeStyle = stage.color; ctx.lineWidth = 1.5; ctx.strokeRect(42.5, 286.5, W - 85, 91); ctx.textAlign = 'center'; ctx.fillStyle = stage.color; ctx.font = '900 10px Consolas, monospace'; ctx.fillText(`${stage.short} // SPELL ${game.spell + 1}`, W / 2, 314); ctx.fillStyle = COLORS.white; ctx.font = '800 20px "Microsoft YaHei", sans-serif'; ctx.fillText(spell.name, W / 2, 347); ctx.restore();
    }
  }

  function drawBurstBeam(t) {
    const charge = clamp(t / .28, 0, 1);
    const fire = clamp((t - .27) / .1, 0, 1) * clamp((.94 - t) / .13, 0, 1);
    const x1 = player.x; const y1 = player.y - 32; const x2 = boss.x; const y2 = boss.y;
    const dx = x2 - x1; const dy = y2 - y1; const length = Math.max(1, Math.hypot(dx, dy)); const nx = -dy / length; const ny = dx / length;
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.lineCap = 'round';
    if (fire <= 0) {
      ctx.globalAlpha = .25 + charge * .6; ctx.setLineDash([9, 6]); ctx.lineDashOffset = -game.time * 110; ctx.strokeStyle = COLORS.teal; ctx.lineWidth = 2 + charge * 3;
      ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke(); ctx.setLineDash([]);
    } else {
      ctx.globalAlpha = fire * .18; ctx.strokeStyle = COLORS.blue; ctx.lineWidth = 108; ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
      ctx.globalAlpha = fire * .42; ctx.strokeStyle = '#2d7dff'; ctx.lineWidth = 76; ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
      ctx.globalAlpha = fire * .94; ctx.strokeStyle = COLORS.teal; ctx.lineWidth = 46; ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
      ctx.strokeStyle = COLORS.white; ctx.lineWidth = 16 + Math.sin(game.time * 44) * 3; ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
      for (const side of [-1, 1]) { ctx.globalAlpha = fire * .72; ctx.strokeStyle = side < 0 ? COLORS.gold : COLORS.blue; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(x1 + nx * side * 32, y1 + ny * side * 32); ctx.lineTo(x2 + nx * side * 17, y2 + ny * side * 17); ctx.stroke(); }
      ctx.globalAlpha = fire; ctx.fillStyle = COLORS.white; ctx.beginPath(); ctx.arc(x2, y2, 28 + Math.sin(game.time * 34) * 7, 0, TAU); ctx.fill();
      for (let ring = 0; ring < 3; ring++) { ctx.globalAlpha = fire * (1 - ring * .22); ctx.strokeStyle = ring % 2 ? COLORS.gold : COLORS.teal; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(x2, y2, 34 + ring * 15 + Math.sin(game.time * 14 + ring) * 5, 0, TAU); ctx.stroke(); }
      for (let i = 0; i < 14; i++) { const a = i / 14 * TAU + game.time * (i % 2 ? 2.7 : -2.2); const radius = 42 + i % 3 * 11; ctx.globalAlpha = fire * .85; ctx.fillStyle = i % 3 ? COLORS.white : COLORS.gold; ctx.fillRect(x2 + Math.cos(a) * radius - 2, y2 + Math.sin(a) * radius - 2, 4, 4); }
    }
    ctx.globalAlpha = .7 + charge * .3; ctx.strokeStyle = COLORS.gold; ctx.lineWidth = 5; ctx.beginPath(); ctx.arc(x1, y1, 14 + charge * 13, 0, TAU); ctx.stroke();
    ctx.strokeStyle = COLORS.teal; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(x1, y1, 32 + Math.sin(game.time * 17) * 3, 0, TAU); ctx.stroke();
    for (let i = 0; i < 8; i++) { const a = i / 8 * TAU + game.time * 3; ctx.fillStyle = i % 2 ? COLORS.white : COLORS.teal; ctx.fillRect(x1 + Math.cos(a) * 29 - 2, y1 + Math.sin(a) * 29 - 2, 4, 4); }
    ctx.restore();
  }

  function drawCinematic() {
    const c = game.cinematic;
    if (!c) return;
    const stage = STAGES[game.stage]; const t = c.t / c.duration;
    if (c.type === 'entrance') {
      const e = easeOut(t * 1.4); ctx.save(); ctx.fillStyle = `rgba(8,12,35,${.82 * Math.sin(Math.PI * clamp(t, 0, 1))})`; ctx.fillRect(0, 0, W, H); ctx.strokeStyle = stage.color; ctx.globalAlpha = .75; for (let i = 0; i < 8; i++) { const y = 120 + i * 58; ctx.beginPath(); ctx.moveTo(-40 + e * 90, y); ctx.lineTo(W + 40 - e * 60, y - 80); ctx.stroke(); } drawGuardian(stage.sprite, lerp(W + 150, 335, e), 430, 500, Math.min(1, t * 3)); ctx.globalAlpha = clamp(t * 4, 0, 1); ctx.fillStyle = stage.color; ctx.font = '900 11px Consolas, monospace'; ctx.fillText(`WORLD 0${game.stage + 1} // GUARD LINK`, 30, 245); ctx.fillStyle = COLORS.white; ctx.font = '900 27px "Microsoft YaHei", sans-serif'; const parts = stage.name.split(' · '); ctx.fillText(parts[0], 30, 282); ctx.font = '900 38px "Microsoft YaHei", sans-serif'; ctx.fillText(parts[1] || stage.name, 30, 328); ctx.restore();
    } else if (c.type === 'burst') {
      const intro = clamp(1 - t * 1.55, 0, 1); const e = easeOut(t * 1.65);
      if (intro > 0) { ctx.save(); ctx.fillStyle = `rgba(8,12,35,${.74 * intro})`; ctx.fillRect(0, 0, W, H); ctx.translate(lerp(-180, 120, e), 405); ctx.rotate(-.04); drawAliceSkill(0, 0, 470, intro); ctx.restore(); }
      drawBurstBeam(t);
      ctx.save(); ctx.globalAlpha = clamp(1 - t * 1.18, 0, 1); ctx.fillStyle = 'rgba(15,20,52,.94)'; ctx.fillRect(120, 292, 350, 76); ctx.fillStyle = COLORS.gold; ctx.font = '900 11px Consolas, monospace'; ctx.fillText('ALICE // TARGET LOCK', 145, 318); ctx.fillStyle = COLORS.white; ctx.font = '900 27px "Microsoft YaHei", sans-serif'; ctx.fillText('轨道轰击「跨界回声」', 145, 350); ctx.restore();
    } else if (c.type === 'break') {
      ctx.save(); ctx.globalAlpha = clamp(1 - t, 0, 1); ctx.fillStyle = COLORS.white; ctx.fillRect(0, 0, W, H); ctx.globalAlpha = clamp(1 - Math.abs(t - .45) * 2.2, 0, 1); ctx.textAlign = 'center'; ctx.fillStyle = stage.color; ctx.font = '900 28px Consolas, monospace'; ctx.fillText('SPELL BREAK', W / 2, H / 2); ctx.restore();
    } else if (c.type === 'death') {
      ctx.save(); ctx.globalAlpha = clamp((t - .55) * 2.4, 0, .9); ctx.fillStyle = COLORS.white; ctx.fillRect(0, 0, W, H); ctx.globalAlpha = clamp((t - .25) * 2, 0, 1) * clamp((1 - t) * 4, 0, 1); ctx.textAlign = 'center'; ctx.fillStyle = stage.color; ctx.font = '900 12px Consolas, monospace'; ctx.fillText('ORBIT PATH RESTORED', W / 2, 330); ctx.fillStyle = COLORS.white; ctx.font = '900 30px "Microsoft YaHei", sans-serif'; ctx.fillText('星区通路已开启', W / 2, 372); ctx.restore();
    }
  }

  function draw() {
    resizeCanvas(); const sx = canvas.width / W; const sy = canvas.height / H; ctx.setTransform(sx, 0, 0, sy, 0, 0); ctx.clearRect(0, 0, W, H); drawBackground();
    ctx.save(); if (settings.shake && game.shake > 0) ctx.translate(rand(-game.shake, game.shake) * .4, rand(-game.shake, game.shake) * .4); drawBoss(); drawLasers(); drawShots(); drawBullets(); drawEffects(); if (!['title', 'result', 'dialogue'].includes(game.mode)) drawPlayer(); ctx.restore();
    drawTimeEffect(); drawBossHud(); drawCinematic();
    if (game.flash > 0) { ctx.fillStyle = `rgba(255,245,220,${game.flash * .42})`; ctx.fillRect(0, 0, W, H); }
  }

  let hudClock = 0;
  function updateHud(force = false) {
    const now = performance.now(); if (!force && now - hudClock < 60) return; hudClock = now;
    ui.score.textContent = Math.round(game.score).toString().padStart(7, '0'); ui.best.textContent = Math.max(game.best, Math.round(game.score)).toString().padStart(7, '0'); ui.graze.textContent = String(game.graze); ui.chain.textContent = `x${game.chain.toFixed(1)}`; ui.stage.textContent = game.mode === 'title' ? '星区 00' : `星区 0${game.stage + 1} // ${game.spell + 1}`;
    ui.comboHits.textContent = String(game.combo); ui.combo.classList.toggle('on', game.combo > 2 && ['playing', 'paused'].includes(game.mode));
    const hpRatio = clamp(player.hp / player.maxHp, 0, 1);
    ui.hp.textContent = String(Math.ceil(player.hp)); ui.maxHp.textContent = String(player.maxHp);
    ui.hpFill.style.width = `${hpRatio * 100}%`; ui.hpLag.style.width = `${hpRatio * 100}%`;
    ui.hpTrack.classList.toggle('low', hpRatio <= .3);
    ui.hpState.textContent = hpRatio <= .3 ? '耐久警告' : hpRatio <= .65 ? '系统受损' : '系统正常';
    ui.hpState.classList.toggle('danger', hpRatio <= .3);
    ui.invincibleToggle.checked = game.invincible;
    ui.debugStatus.textContent = game.invincible ? '已启用：受击仅闪烁' : '受到攻击时扣除耐久';
    const sig = `${player.hp}:${player.cores}`;
    if (sig !== game.hudSignature) {
      game.hudSignature = sig;
      ui.core.replaceChildren(...Array.from({ length: Math.max(0, player.cores) }, () => { const p = document.createElement('span'); p.className = 'pip'; return p; }));
    }
    ui.bombBtn.disabled = player.cores <= 0 || game.mode !== 'playing' || boss.phase !== 'active' || game.cinematic?.type === 'burst';
    canvas.dataset.mode = game.mode; canvas.dataset.stage = String(game.stage); canvas.dataset.spell = String(game.spell); canvas.dataset.phase = boss.phase; canvas.dataset.bullets = String(bullets.length); canvas.dataset.combo = String(game.combo); canvas.dataset.cores = String(player.cores); canvas.dataset.hp = String(player.hp); canvas.dataset.invincible = String(game.invincible); canvas.dataset.lasers = String(lasers.length);
    canvas.dataset.titleStep = String(sound.titleStep); canvas.dataset.rankingEligible = String(game.rankingEligible && !game.debugUsed);
    canvas.dataset.timeEffect = game.timeEffect.mode;
    if (!shell.dataset.beat) shell.dataset.beat = '0';
  }

  function pointerPosition(event) { const rect = canvas.getBoundingClientRect(); return { x: (event.clientX - rect.left) / rect.width * W, y: (event.clientY - rect.top) / rect.height * H }; }

  function qaAdvance() {
    if (!QA_MODE) return;
    if (game.mode === 'dialogue') { advanceDialogue(); return; }
    if (game.mode === 'paused') {
      if (boss.phase === 'entrance') { beginSpell(); game.banner = 2; if (game.cinematic) game.cinematic.t = .35; updateHud(true); }
      else if (boss.phase === 'spellIntro') { boss.phase = 'active'; game.cinematic = null; togglePause(false); }
      else if (boss.phase === 'active') { togglePause(false); }
      else if (boss.phase === 'spellBreak' || boss.phase === 'death') { game.mode = 'playing'; ui.pause.classList.add('hidden'); advanceAfterPhase(); if (game.mode === 'playing') togglePause(true); }
      return;
    }
    if (game.mode === 'playing' && boss.phase === 'active') {
      endSpell(true);
      if (game.cinematic) {
        game.cinematic.t = game.cinematic.type === 'death' ? 1.35 : .48;
        if (game.cinematic.type === 'death') boss.phaseClock = 1.35;
      }
      togglePause(true); ui.pause.classList.add('hidden');
    }
  }
  canvas.addEventListener('pointerdown', (event) => { if (game.mode !== 'playing') return; game.pointerActive = true; game.pointerType = event.pointerType; canvas.setPointerCapture(event.pointerId); const p = pointerPosition(event); player.x = clamp(p.x, 20, W - 20); player.y = clamp(p.y, 72, H - 30); });
  canvas.addEventListener('pointermove', (event) => { if (!game.pointerActive || game.mode !== 'playing') return; const p = pointerPosition(event); player.x = clamp(p.x, 20, W - 20); player.y = clamp(p.y, 72, H - 30); });
  function releasePointer(event) { game.pointerActive = false; if (canvas.hasPointerCapture?.(event.pointerId)) canvas.releasePointerCapture(event.pointerId); }
  canvas.addEventListener('pointerup', releasePointer); canvas.addEventListener('pointercancel', releasePointer);

  window.addEventListener('keydown', (event) => {
    keys[event.code] = true;
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(event.code)) event.preventDefault();
    if (!ui.galaxy.classList.contains('hidden') && !event.repeat) {
      if (event.code === 'ArrowLeft') selectGalaxy(game.selectedGalaxy - 1);
      if (event.code === 'ArrowRight') selectGalaxy(game.selectedGalaxy + 1);
      if (event.code === 'Enter' || event.code === 'Space') deployGalaxy();
    }
    if ((event.code === 'Escape' || event.code === 'KeyP') && !event.repeat) togglePause();
    if (event.code === 'KeyX' && !event.repeat) useBurst();
    if (QA_MODE && event.code === 'KeyN' && !event.repeat) qaAdvance();
    if (QA_MODE && event.code === 'KeyB' && !event.repeat && game.mode === 'playing' && boss.phase === 'active') { useBurst(); if (game.cinematic) game.cinematic.t = 1.02; togglePause(true); ui.pause.classList.add('hidden'); }
    if (QA_MODE && event.code === 'KeyC' && !event.repeat) { game.combo = 128; game.maxCombo = Math.max(game.maxCombo, game.combo); game.comboClock = 99; game.chain = 3.3; updateHud(true); }
    if (QA_MODE && event.code === 'KeyH' && !event.repeat) { player.invulnerable = 0; hitPlayer(); }
    if (QA_MODE && event.code === 'KeyV' && !event.repeat && game.mode === 'playing' && boss.phase === 'active') { fire(); for (const shot of shots.slice(-5)) shot.age = .08; togglePause(true); ui.pause.classList.add('hidden'); }
    if (QA_MODE && event.code === 'KeyI' && !event.repeat) { game.invincible = !game.invincible; if (game.invincible) enableDebugRun(); updateHud(true); }
    if (QA_MODE && event.code === 'KeyL' && !event.repeat && game.mode === 'playing' && boss.phase === 'active') spawnLaser(boss.x, boss.y + 8, player.x, player.y, { warning: .9, duration: 1.1, width: 28, color: COLORS.coral });
    if (QA_MODE && event.code === 'KeyM' && !event.repeat && game.mode === 'playing' && boss.phase === 'active') { spawnSpecialPattern(game.pattern, false); togglePause(true); ui.pause.classList.add('hidden'); }
    if (QA_MODE && event.code === 'KeyT' && !event.repeat && game.mode === 'playing' && boss.phase === 'active') { startChronoSequence(true); togglePause(true); ui.pause.classList.add('hidden'); }
  });
  window.addEventListener('keyup', (event) => { keys[event.code] = false; });
  window.addEventListener('blur', () => { if (game.mode === 'playing') togglePause(true); });
  window.addEventListener('resize', () => {
    resizeCanvas();
    if (!ui.galaxy.classList.contains('hidden')) {
      if (ui.galaxy.classList.contains('inspecting')) {
        if (game.selectedCommunity) {
          const node = document.querySelector(`.community-node[data-level-id="${CSS.escape(game.selectedCommunity.id)}"]`); if (node) selectCommunityLevel(game.selectedCommunity, node, true);
        } else focusGalaxy(game.selectedGalaxy, false);
      }
      else resetGalaxyOverview(false);
    }
  });

  document.querySelectorAll('[data-hub]').forEach((button) => button.addEventListener('click', () => { sound.unlock(); sound.startTitle(); switchHub(button.dataset.hub); }));
  $('startBtn').addEventListener('click', showGalaxyMap); $('resumeBtn').addEventListener('click', () => togglePause(false)); $('restartBtn').addEventListener('click', startRun); $('titleBtn').addEventListener('click', showTitle); $('againBtn').addEventListener('click', startRun); $('resultTitleBtn').addEventListener('click', showTitle);
  $('profileChip').addEventListener('click', openProfile);
  ui.homeMailBtn.addEventListener('click', () => loadHomeMail(true));
  $('homeMailClose').addEventListener('click', () => ui.homeMailPanel.classList.add('hidden'));
  $('profileReset').addEventListener('click', () => {
    profile.name = ''; profile.shareRanking = true; profile.privacyAcceptedAt = ''; profile.privacyVersion = ''; saveProfile(); applySettings();
    $('playerNameInput').value = ''; $('profileShare').checked = true; $('privacyConsent').checked = false; $('playerNameInput').focus();
  });
  ui.profileForm.addEventListener('submit', (event) => {
    event.preventDefault();
    const name = $('playerNameInput').value.trim().replace(/[<>]/g, '').slice(0, 14);
    if (name.length < 2) { $('profileError').textContent = '昵称至少需要 2 个字符'; $('profileError').classList.remove('hidden'); return; }
    if (containsBlockedNickname(name)) { $('profileError').textContent = '昵称包含不适合公开展示的内容，请修改'; $('profileError').classList.remove('hidden'); return; }
    if (!$('privacyConsent').checked) { $('profileError').textContent = '请先阅读并同意隐私政策与用户协议'; $('profileError').classList.remove('hidden'); return; }
    profile.name = name; profile.shareRanking = $('profileShare').checked; profile.privacyAcceptedAt = new Date().toISOString(); profile.privacyVersion = LEGAL_VERSION; saveProfile();
    ui.profileGate.classList.add('hidden'); window.scrollTo(0, 0); shell.scrollTop = 0; shell.scrollLeft = 0; applySettings(); sound.unlock(); sound.startTitle(); if (OPEN_CHART) showGalaxyMap();
  });
  $('refreshRanking').addEventListener('click', () => loadRankings(ui.rankingGalaxy.value));
  ui.rankingGalaxy.addEventListener('change', () => loadRankings(ui.rankingGalaxy.value));
  for (const [id, key] of [['masterVolume', 'master'], ['musicVolume', 'music'], ['sfxVolume', 'sfx']]) {
    $(id).addEventListener('input', () => { settings[key] = Number($(id).value); $(`${id}Value`).value = settings[key]; saveSettings(); applySettings(); });
  }
  $('shakeToggle').addEventListener('change', () => { settings.shake = $('shakeToggle').checked; saveSettings(); applySettings(); });
  $('beatToggle').addEventListener('change', () => { settings.beat = $('beatToggle').checked; saveSettings(); applySettings(); });
  $('shareRankingToggle').addEventListener('change', () => { profile.shareRanking = $('shareRankingToggle').checked; saveProfile(); $('profileShare').checked = profile.shareRanking; });
  $('galaxyBack').addEventListener('click', showTitle);
  $('galaxyInfoClose').addEventListener('click', () => resetGalaxyOverview());
  $('galaxyPrev').addEventListener('click', () => selectGalaxy(game.selectedGalaxy - 1));
  $('galaxyNext').addEventListener('click', () => selectGalaxy(game.selectedGalaxy + 1));
  $('deployBtn').addEventListener('click', deployGalaxy);
  document.querySelectorAll('.galaxy-node').forEach((node) => node.addEventListener('click', () => selectGalaxy(Number(node.dataset.galaxy))));
  ui.galaxyStage.addEventListener('pointerdown', (event) => {
    if (!ui.galaxy.classList.contains('overview') || event.target.closest('.galaxy-node, button')) return;
    event.preventDefault();
    const rect = ui.galaxyStage.getBoundingClientRect(); chartPointers.set(event.pointerId, { x: event.clientX - rect.left, y: event.clientY - rect.top });
    chartCamera.dragging = true; chartCamera.startX = event.clientX; chartCamera.startY = event.clientY; chartCamera.originX = chartCamera.x; chartCamera.originY = chartCamera.y;
    if (chartPointers.size === 2) {
      const [a, b] = [...chartPointers.values()]; const midX = (a.x + b.x) / 2; const midY = (a.y + b.y) / 2;
      chartCamera.pinchDistance = Math.max(1, Math.hypot(a.x - b.x, a.y - b.y)); chartCamera.pinchScale = chartCamera.scale;
      chartCamera.pinchWorldX = (midX - chartCamera.x) / chartCamera.scale; chartCamera.pinchWorldY = (midY - chartCamera.y) / chartCamera.scale;
    }
    ui.galaxyStage.classList.add('dragging'); ui.galaxyStage.setPointerCapture?.(event.pointerId);
  });
  ui.galaxyStage.addEventListener('pointermove', (event) => {
    if (!chartCamera.dragging || !chartPointers.has(event.pointerId)) return;
    event.preventDefault();
    const rect = ui.galaxyStage.getBoundingClientRect(); chartPointers.set(event.pointerId, { x: event.clientX - rect.left, y: event.clientY - rect.top });
    if (chartPointers.size >= 2) {
      const [a, b] = [...chartPointers.values()]; const midX = (a.x + b.x) / 2; const midY = (a.y + b.y) / 2;
      const distance = Math.max(1, Math.hypot(a.x - b.x, a.y - b.y)); const next = clamp(chartCamera.pinchScale * distance / chartCamera.pinchDistance, chartMinimumScale(), 1.5);
      chartCamera.scale = next; chartCamera.x = midX - chartCamera.pinchWorldX * next; chartCamera.y = midY - chartCamera.pinchWorldY * next;
    } else {
      chartCamera.x = chartCamera.originX + event.clientX - chartCamera.startX; chartCamera.y = chartCamera.originY + event.clientY - chartCamera.startY;
    }
    applyChartTransform(false);
  });
  const releaseChartPointer = (event) => {
    chartPointers.delete(event.pointerId);
    if (chartPointers.size === 1) {
      const point = [...chartPointers.values()][0]; const rect = ui.galaxyStage.getBoundingClientRect();
      chartCamera.startX = point.x + rect.left; chartCamera.startY = point.y + rect.top; chartCamera.originX = chartCamera.x; chartCamera.originY = chartCamera.y;
    } else if (!chartPointers.size) { chartCamera.dragging = false; ui.galaxyStage.classList.remove('dragging'); }
    if (ui.galaxyStage.hasPointerCapture?.(event.pointerId)) ui.galaxyStage.releasePointerCapture(event.pointerId);
  };
  ui.galaxyStage.addEventListener('pointerup', releaseChartPointer); ui.galaxyStage.addEventListener('pointercancel', releaseChartPointer);
  ui.galaxyStage.addEventListener('dragstart', (event) => event.preventDefault());
  ui.galaxyStage.addEventListener('selectstart', (event) => event.preventDefault());
  ui.galaxyStage.addEventListener('wheel', (event) => {
    if (!ui.galaxy.classList.contains('overview')) return;
    event.preventDefault();
    const rect = ui.galaxyStage.getBoundingClientRect(); const px = event.clientX - rect.left; const py = event.clientY - rect.top;
    const next = clamp(chartCamera.scale * (event.deltaY > 0 ? .9 : 1.1), chartMinimumScale(), 1.5);
    const worldX = (px - chartCamera.x) / chartCamera.scale; const worldY = (py - chartCamera.y) / chartCamera.scale;
    chartCamera.x = px - worldX * next; chartCamera.y = py - worldY * next; chartCamera.scale = next; applyChartTransform(false);
  }, { passive: false });
  ui.dialogueBox.addEventListener('click', advanceDialogue); ui.bombBtn.addEventListener('pointerdown', (event) => { event.stopPropagation(); useBurst(); }); ui.pauseBtn.addEventListener('click', () => togglePause());
  ui.muteBtn.addEventListener('click', () => { sound.setMuted(!sound.muted); ui.muteBtn.textContent = sound.muted ? '×' : '♪'; ui.muteBtn.title = sound.muted ? '取消静音' : '静音'; });
  $('fullBtn').addEventListener('click', () => { if (!document.fullscreenElement) $('app').requestFullscreen?.(); else document.exitFullscreen?.(); });
  ui.debugTab.addEventListener('click', () => ui.debugDrawer.classList.toggle('open'));
  ui.debugClose.addEventListener('click', () => ui.debugDrawer.classList.remove('open'));
  ui.invincibleToggle.addEventListener('change', () => { game.invincible = ui.invincibleToggle.checked; if (game.invincible) enableDebugRun(); player.invulnerable = Math.max(player.invulnerable, .35); updateHud(true); });
  ui.teaseClose?.addEventListener('click', () => hideDebugTease());
  document.addEventListener('contextmenu', (event) => event.preventDefault());

  sound.startTitle();
  sound.unlock();
  const unlockInitialAudio = () => {
    sound.unlock();
    if (game.mode === 'title') sound.startTitle();
    document.removeEventListener('pointerdown', unlockInitialAudio, true);
    document.removeEventListener('keydown', unlockInitialAudio, true);
  };
  document.addEventListener('pointerdown', unlockInitialAudio, true);
  document.addEventListener('keydown', unlockInitialAudio, true);

  let previous = performance.now(); let accumulator = 0;
  function frame(now) {
    const elapsed = Math.min(.1, Math.max(0, (now - previous) / 1000)); previous = now; accumulator = Math.min(.2, accumulator + elapsed); let steps = 0;
    while (accumulator >= STEP && steps < 12) { update(STEP); accumulator -= STEP; steps++; }
    draw(); requestAnimationFrame(frame);
  }

  applySettings();
  loadHomeMail(false);
  if (!profile.name || profile.privacyVersion !== LEGAL_VERSION) openProfile();
  else if (OPEN_CHART) setTimeout(showGalaxyMap, 0);
  selectGalaxy(0, false);
  updateHud(true); resizeCanvas(); requestAnimationFrame(frame);
})();
