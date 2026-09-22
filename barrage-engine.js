(function (global) {
  'use strict';

  const TAU = Math.PI * 2;
  const PATTERNS = [
    { id: 'safe-ring', name: '缺口星环', tag: '引导', desc: '旋转圆环保留周期移动的安全缺口。' },
    { id: 'beat-chess', name: '节拍棋盘', tag: '节奏', desc: '棋盘节点预警后按行列交替释放。' },
    { id: 'portal-relay', name: '折跃接力', tag: '空间', desc: '弹体穿越边界并从另一侧重新入场。' },
    { id: 'serpent', name: '星蛇编队', tag: '轨迹', desc: '连续弹体沿摆动曲线保持队形穿场。' },
    { id: 'laser-maze', name: '激光迷宫', tag: '预警', desc: '多束激光交错封锁并留下安全走廊。' },
    { id: 'polarity', name: '磁极翻转', tag: '引力', desc: '红蓝弹体以相反磁力牵引玩家。' },
    { id: 'time-rewind', name: '时序回溯', tag: '时间', desc: '全场冻结后沿历史轨迹回放。' },
    { id: 'split-comet', name: '分裂彗核', tag: '变体', desc: '大型弹核飞行后裂解为定向碎片。' },
    { id: 'echo-aim', name: '追迹残响', tag: '记忆', desc: '分批复现对玩家位置的延迟锁定。' },
    { id: 'mirror-wall', name: '镜面回廊', tag: '反射', desc: '镜像弹墙在边界反弹形成周期走廊。' },
    { id: 'constellation-drop', name: '星座坠阵', tag: '构型', desc: '弹体保持完整连线构型向下坠落。' },
    { id: 'orbit-cage', name: '轨道囚笼', tag: '环绕', desc: '弹体先围绕目标旋转再沿切线释放。' },
    { id: 'custom-emitter', name: '自定义发射器', tag: '自由', desc: '完全由参数、弹型和自绘轨迹驱动。' },
  ];
  const DEFAULT_PARAMS = { x: 50, y: 18, size: 6, angle: 90, speed: 120, count: 18, spread: 360, rate: 1.2, color: '#57F0E4', shape: 'orb', motion: 'straight', formation: 'radial', sides: 5, aim: false, path: [] };
  const DEFAULT_BOSS_MOTION = { mode: 'hover', speed: .8, rangeX: 18, rangeY: 5, path: [] };
  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
  const rand = (min, max) => min + Math.random() * (max - min);

  function normalizeConfig(input = {}) {
    const accent = /^#[0-9a-f]{6}$/i.test(input.accent || '') ? input.accent.toUpperCase() : '#57F0E4';
    let phases = Array.isArray(input.phases) ? input.phases : [];
    if (!phases.length) {
      const skills = Array.isArray(input.skills) && input.skills.length ? input.skills : ['safe-ring', 'beat-chess', 'split-comet'];
      phases = [{ id: 'phase-1', name: '第一阶段', hp: Number(input.bossHp) || 12000, duration: Math.max(18, skills.length * 8), transition: 'scan', tracks: [{ id: 'track-1', name: '主弹幕', clips: skills.map((patternId, index) => ({ id: `legacy-${index}`, name: PATTERNS.find((item) => item.id === patternId)?.name || patternId, patternId, start: index * 8, duration: 8, params: { ...DEFAULT_PARAMS, color: accent } })) }] }];
    }
    phases = phases.map((phase, phaseIndex) => ({
      id: String(phase.id || `phase-${phaseIndex}`), name: String(phase.name || `阶段 ${phaseIndex + 1}`),
      hp: clamp(Number(phase.hp) || 8000, 1000, 500000), duration: clamp(Number(phase.duration) || 24, 6, 120), transition: String(phase.transition || 'scan'),
      tracks: (Array.isArray(phase.tracks) ? phase.tracks : []).map((track, trackIndex) => ({
        id: String(track.id || `track-${trackIndex}`), name: String(track.name || `轨道 ${trackIndex + 1}`),
        clips: (Array.isArray(track.clips) ? track.clips : []).map((clip, clipIndex) => ({
          id: String(clip.id || `clip-${phaseIndex}-${trackIndex}-${clipIndex}`), name: String(clip.name || '弹幕片段'),
          patternId: PATTERNS.some((item) => item.id === clip.patternId) ? clip.patternId : 'custom-emitter',
          start: clamp(Number(clip.start) || 0, 0, 119.5), duration: clamp(Number(clip.duration) || 4, .5, 120),
          params: { ...DEFAULT_PARAMS, ...(clip.params || {}), color: /^#[0-9a-f]{6}$/i.test(clip.params?.color || '') ? clip.params.color.toUpperCase() : accent, path: Array.isArray(clip.params?.path) ? clip.params.path : [] },
        })),
      })),
    }));
    phases.forEach((phase) => { if (!phase.tracks.length) phase.tracks.push({ id: `${phase.id}-track`, name: '主弹幕', clips: [] }); });
    const motionInput = input.bossMotion && typeof input.bossMotion === 'object' ? input.bossMotion : {};
    const bossMotion = {
      ...DEFAULT_BOSS_MOTION, ...motionInput,
      mode: ['hover', 'horizontal', 'figure-eight', 'orbit', 'path'].includes(motionInput.mode) ? motionInput.mode : 'hover',
      speed: clamp(Number.isFinite(Number(motionInput.speed)) ? Number(motionInput.speed) : DEFAULT_BOSS_MOTION.speed, .2, 3),
      rangeX: clamp(Number.isFinite(Number(motionInput.rangeX)) ? Number(motionInput.rangeX) : DEFAULT_BOSS_MOTION.rangeX, 0, 42),
      rangeY: clamp(Number.isFinite(Number(motionInput.rangeY)) ? Number(motionInput.rangeY) : DEFAULT_BOSS_MOTION.rangeY, 0, 28),
      path: Array.isArray(motionInput.path) ? motionInput.path.slice(0, 40).map((point) => ({ x: clamp(Number(point.x) || 50, 8, 92), y: clamp(Number(point.y) || 18, 6, 58) })) : [],
    };
    return {
      planetName: String(input.planetName || '未命名星球'), bossName: String(input.bossName || 'ORBIT-G0'),
      difficulty: clamp(Number(input.difficulty) || 4, 1, 10), allowCheat: input.allowCheat !== false,
      accent, bossImage: typeof input.bossImage === 'string' ? input.bossImage : '', bossMotion, phases,
      bossHp: phases.reduce((sum, phase) => sum + phase.hp, 0),
    };
  }

  class BarrageEngine {
    constructor(canvas, options = {}) {
      this.canvas = canvas; this.ctx = canvas.getContext('2d'); this.preview = Boolean(options.preview);
      this.running = false; this.frame = 0; this.last = 0; this.keys = Object.create(null); this.image = new Image();
      this.configure(options.config || {}); this.bindControls(); this.reset();
    }

    configure(input = {}) {
      const oldPhase = this.phaseIndex || 0; this.config = normalizeConfig(input);
      if (this.config.bossImage) this.image.src = this.config.bossImage;
      if (this.boss) { this.phaseIndex = clamp(oldPhase, 0, this.config.phases.length - 1); this.applyPhase(false); }
    }

    bindControls() {
      if (this.bound) return; this.bound = true;
      window.addEventListener('keydown', (event) => { this.keys[event.code] = true; });
      window.addEventListener('keyup', (event) => { this.keys[event.code] = false; });
      const point = (event) => { const rect = this.canvas.getBoundingClientRect(); this.player.x = (event.clientX - rect.left) / rect.width * this.canvas.width; this.player.y = (event.clientY - rect.top) / rect.height * this.canvas.height; };
      this.canvas.addEventListener('pointerdown', (event) => { this.pointer = true; point(event); });
      this.canvas.addEventListener('pointermove', (event) => { if (this.pointer) point(event); });
      window.addEventListener('pointerup', () => { this.pointer = false; });
    }

    reset() {
      this.bullets = []; this.lasers = []; this.shots = []; this.player = { x: this.canvas.width / 2, y: this.canvas.height - 82, hp: 300, maxHp: 300, invulnerable: 0 };
      this.boss = { x: this.canvas.width / 2, y: 128, hp: 1, maxHp: 1 }; this.elapsed = 0; this.phaseIndex = 0; this.phaseTime = 0; this.clipRuntime = new Map(); this.timeMode = 'none'; this.timeClock = 0; this.transition = null; this.status = 'RUNNING'; this.applyPhase(true);
    }

    applyPhase(resetTime = true) {
      const phase = this.config.phases[this.phaseIndex] || this.config.phases[0];
      if (resetTime) this.phaseTime = 0;
      this.clipRuntime = new Map(); this.bullets.length = 0; this.lasers.length = 0;
      this.boss.hp = phase.hp; this.boss.maxHp = phase.hp;
    }

    setPhase(index) { this.phaseIndex = (Number(index) + this.config.phases.length) % this.config.phases.length; this.applyPhase(true); this.transition = null; this.status = 'RUNNING'; }
    seek(time) { this.phaseTime = clamp(Number(time) || 0, 0, this.currentPhase().duration); this.clipRuntime.clear(); this.bullets.length = 0; this.lasers.length = 0; }
    currentPhase() { return this.config.phases[this.phaseIndex] || this.config.phases[0]; }
    activeClips() { const t = this.phaseTime; return this.currentPhase().tracks.flatMap((track) => track.clips).filter((clip) => t >= clip.start && t < clip.start + clip.duration); }

    updateBossMotion() {
      const motion = this.config.bossMotion; const time = this.phaseTime * motion.speed; const centerX = this.canvas.width / 2; const baseY = 128;
      const rangeX = this.canvas.width * motion.rangeX / 100; const rangeY = this.canvas.height * motion.rangeY / 100;
      if (motion.mode === 'path' && motion.path.length > 1) {
        const progress = time % motion.path.length; const index = Math.floor(progress); const mix = progress - index; const a = motion.path[index]; const b = motion.path[(index + 1) % motion.path.length];
        this.boss.x = (a.x + (b.x - a.x) * mix) / 100 * this.canvas.width; this.boss.y = (a.y + (b.y - a.y) * mix) / 100 * this.canvas.height; return;
      }
      if (motion.mode === 'horizontal') { this.boss.x = centerX + Math.sin(time) * rangeX; this.boss.y = baseY; return; }
      if (motion.mode === 'figure-eight') { this.boss.x = centerX + Math.sin(time) * rangeX; this.boss.y = baseY + Math.sin(time * 2) * rangeY; return; }
      if (motion.mode === 'orbit') { this.boss.x = centerX + Math.cos(time) * rangeX; this.boss.y = baseY + Math.sin(time) * rangeY; return; }
      this.boss.x = centerX + Math.sin(time * .72) * rangeX; this.boss.y = baseY + Math.cos(time) * rangeY;
    }

    start() {
      if (this.running) return; this.running = true; this.last = performance.now();
      const loop = (now) => { if (!this.running) return; const dt = Math.min(.034, Math.max(0, (now - this.last) / 1000)); this.last = now; this.update(dt); this.draw(); this.frame = requestAnimationFrame(loop); };
      this.frame = requestAnimationFrame(loop);
    }
    stop() { this.running = false; cancelAnimationFrame(this.frame); }

    emit(x, y, angle, speed, options = {}) {
      if (this.bullets.length > 1600) return;
      this.bullets.push({
        x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, angle, speed, radius: options.radius || 5,
        color: options.color || this.config.accent, shape: options.shape || 'orb', rotation: options.rotation || angle, spin: options.spin || 0,
        age: 0, delay: options.delay || 0, turn: options.turn || 0, wave: options.wave || 0, waveFreq: options.waveFreq || 2.4,
        bounce: options.bounce || 0, portal: options.portal || 0, magnet: options.magnet || 0, splitAt: options.splitAt || 0, split: options.split || 0,
        orbit: options.orbit || 0, orbitAngle: options.orbitAngle || 0, orbitRadius: options.orbitRadius || 0, orbitSpeed: options.orbitSpeed || 1,
        orbitX: options.orbitX || x, orbitY: options.orbitY || y, stopAt: options.stopAt || 0, stopFor: options.stopFor || 0, stopped: false,
        group: options.group || '', order: options.order || 0, history: [], historyClock: 0,
      });
    }

    emitterPoint(clip, local) {
      const p = clip.params; const path = Array.isArray(p.path) ? p.path : [];
      if (path.length > 1) {
        const progress = clamp(local / clip.duration, 0, .9999) * (path.length - 1); const index = Math.floor(progress); const mix = progress - index; const a = path[index]; const b = path[Math.min(path.length - 1, index + 1)];
        return { x: (a.x + (b.x - a.x) * mix) / 100 * this.canvas.width, y: (a.y + (b.y - a.y) * mix) / 100 * this.canvas.height };
      }
      return { x: p.x / 100 * this.canvas.width, y: p.y / 100 * this.canvas.height };
    }

    motionOptions(p, baseAngle) {
      const options = { radius: p.size, color: p.color, shape: p.shape, spin: p.shape === 'star' ? 2.2 : .7 };
      if (p.motion === 'curve-left') options.turn = -.72;
      if (p.motion === 'curve-right') options.turn = .72;
      if (p.motion === 'wave') { options.wave = 1.05; options.waveFreq = 3.2; }
      if (p.motion === 'homing') options.magnet = 48;
      if (p.motion === 'bounce') options.bounce = 4;
      if (p.motion === 'orbit') { options.orbit = 2.2; options.orbitRadius = 74; options.orbitAngle = baseAngle; options.orbitSpeed = 1.2; }
      if (p.motion === 'stop-go') { options.stopAt = .65; options.stopFor = .75; }
      return options;
    }

    spawnGeneric(clip, local, serial) {
      const p = clip.params; const origin = this.emitterPoint(clip, local); const base = p.aim ? Math.atan2(this.player.y - origin.y, this.player.x - origin.x) : Number(p.angle) / 180 * Math.PI;
      const count = clamp(Math.round(Number(p.count) || 1), 1, 80); const spread = Number(p.spread) / 180 * Math.PI; const speed = Number(p.speed) * (.88 + this.config.difficulty * .026); const group = `${clip.id}-${serial}`;
      const launch = (x, y, angle, index, delay = 0) => this.emit(x, y, angle, speed, { ...this.motionOptions(p, angle), delay, group, order: index });
      if (p.formation === 'line') {
        for (let i = 0; i < count; i++) { const offset = (i - (count - 1) / 2) * (p.size * 2.7); launch(origin.x + Math.cos(base + Math.PI / 2) * offset, origin.y + Math.sin(base + Math.PI / 2) * offset, base, i); }
      } else if (p.formation === 'polygon') {
        const sides = clamp(Math.round(Number(p.sides) || 5), 3, 12); const radius = 36 + count * 1.4;
        for (let i = 0; i < count; i++) { const edge = i / count * sides; const side = Math.floor(edge); const mix = edge - side; const a = base + side / sides * TAU; const b = base + (side + 1) / sides * TAU; const x = origin.x + (Math.cos(a) + (Math.cos(b) - Math.cos(a)) * mix) * radius; const y = origin.y + (Math.sin(a) + (Math.sin(b) - Math.sin(a)) * mix) * radius; launch(x, y, base + Math.PI / 2, i, .55); }
      } else if (p.formation === 'path' && p.path.length > 1) {
        p.path.slice(0, count).forEach((point, index) => launch(point.x / 100 * this.canvas.width, point.y / 100 * this.canvas.height, base, index, .4));
      } else {
        for (let i = 0; i < count; i++) { const ratio = count === 1 ? .5 : i / (count - 1); const angle = p.formation === 'radial' ? base + i / count * TAU : base - spread / 2 + ratio * spread; launch(origin.x, origin.y, angle, i); }
      }
    }

    spawnClip(clip, local, serial) {
      const p = clip.params; const origin = this.emitterPoint(clip, local); const speed = p.speed * (.88 + this.config.difficulty * .026); const aim = Math.atan2(this.player.y - origin.y, this.player.x - origin.x); const group = `${clip.id}-${serial}`;
      if (clip.patternId === 'laser-maze') {
        const vertical = serial % 2 === 0; const lanes = clamp(Math.round(p.count / 4), 2, 7); const safe = serial % lanes;
        for (let i = 0; i < lanes; i++) if (i !== safe) this.lasers.push(vertical ? { x1: 52 + i * (this.canvas.width - 104) / (lanes - 1), y1: 70, x2: 52 + i * (this.canvas.width - 104) / (lanes - 1), y2: this.canvas.height, warning: 1.05, fire: .72, age: 0, width: Math.max(10, p.size * 2), color: p.color } : { x1: 0, y1: 150 + i * (this.canvas.height - 220) / (lanes - 1), x2: this.canvas.width, y2: 150 + i * (this.canvas.height - 220) / (lanes - 1), warning: 1.05, fire: .72, age: 0, width: Math.max(10, p.size * 2), color: p.color });
      } else if (clip.patternId === 'safe-ring') {
        const count = clamp(Math.round(p.count), 8, 60); const gap = serial * 5 % count; for (let i = 0; i < count; i++) if (Math.min((i - gap + count) % count, (gap - i + count) % count) > 1) this.emit(origin.x, origin.y, i / count * TAU + local * .22, speed, { ...this.motionOptions(p, i / count * TAU), group, order: i });
      } else if (clip.patternId === 'beat-chess') {
        const cols = clamp(Math.round(Math.sqrt(p.count) + 2), 4, 9); const rows = Math.max(3, Math.ceil(p.count / cols)); let order = 0;
        for (let row = 0; row < rows; row++) for (let col = 0; col < cols; col++) if ((row + col + serial) % 2 === 0) this.emit(70 + col * (this.canvas.width - 140) / (cols - 1), 160 + row * 52, row % 2 ? Math.PI : 0, speed * .75, { ...this.motionOptions(p, 0), delay: .6 + row * .12, portal: 1, group, order: order++ });
      } else if (clip.patternId === 'portal-relay') {
        const count = clamp(Math.round(p.count / 2), 4, 14); for (let i = 0; i < count; i++) { const left = (i + serial) % 2 === 0; this.emit(left ? 8 : this.canvas.width - 8, 145 + i * (this.canvas.height - 220) / count, left ? 0 : Math.PI, speed, { ...this.motionOptions(p, 0), portal: 3, group, order: i }); }
      } else if (clip.patternId === 'serpent') {
        for (let i = 0; i < clamp(Math.round(p.count), 6, 48); i++) this.emit(origin.x, origin.y, Number(p.angle) / 180 * Math.PI, speed, { ...this.motionOptions({ ...p, motion: 'wave' }, 0), delay: i * .055, wave: serial % 2 ? 1.2 : -1.2, group, order: i });
      } else if (clip.patternId === 'polarity') {
        const count = clamp(Math.round(p.count), 8, 50); for (let i = 0; i < count; i++) { const angle = i / count * TAU; this.emit(this.player.x + Math.cos(angle) * 190, this.player.y + Math.sin(angle) * 190, angle + Math.PI, speed * .48, { ...this.motionOptions(p, angle), magnet: i % 2 ? -30 : 40, color: i % 2 ? '#54CFFF' : p.color, group, order: i }); }
      } else if (clip.patternId === 'time-rewind') {
        this.spawnGeneric({ ...clip, params: { ...p, formation: 'radial', motion: 'curve-right' } }, local, serial); if (serial % 3 === 0) { this.timeMode = 'freeze'; this.timeClock = 1; }
      } else if (clip.patternId === 'split-comet') {
        this.emit(origin.x, origin.y, p.aim ? aim : p.angle / 180 * Math.PI, speed * .65, { ...this.motionOptions(p, aim), radius: Math.max(12, p.size * 1.8), splitAt: 1.25, split: clamp(Math.round(p.count / 2), 6, 20), color: p.color });
      } else if (clip.patternId === 'echo-aim') {
        for (let echo = 0; echo < 5; echo++) for (let side = -1; side <= 1; side++) this.emit(origin.x, origin.y, aim + side * (p.spread / 180 * Math.PI / 12), speed, { ...this.motionOptions(p, aim), delay: echo * .28, group, order: echo * 3 + side + 1 });
      } else if (clip.patternId === 'mirror-wall') {
        const count = clamp(Math.round(p.count / 2), 5, 16); for (let i = 0; i < count; i++) { const left = (i + serial) % 2 === 0; this.emit(left ? 8 : this.canvas.width - 8, 140 + i * (this.canvas.height - 210) / count, left ? .06 : Math.PI - .06, speed, { ...this.motionOptions(p, 0), bounce: 5, group, order: i }); }
      } else if (clip.patternId === 'constellation-drop') {
        this.spawnGeneric({ ...clip, params: { ...p, formation: 'polygon', angle: 90, motion: 'straight' } }, local, serial);
      } else if (clip.patternId === 'orbit-cage') {
        const count = clamp(Math.round(p.count), 8, 42); for (let i = 0; i < count; i++) { const angle = i / count * TAU; this.emit(this.player.x + Math.cos(angle) * 120, this.player.y + Math.sin(angle) * 120, angle, speed, { ...this.motionOptions(p, angle), orbit: 2.1, orbitAngle: angle, orbitRadius: 120, orbitSpeed: i % 2 ? -1.05 : 1.05, orbitX: this.player.x, orbitY: this.player.y, group, order: i }); }
      } else this.spawnGeneric(clip, local, serial);
    }

    update(dt) {
      this.elapsed += dt; this.player.invulnerable = Math.max(0, this.player.invulnerable - dt);
      if (this.transition) {
        this.transition.time -= dt;
        if (this.transition.time <= 0) { this.transition = null; this.status = 'RUNNING'; this.applyPhase(true); }
        return;
      }
      this.phaseTime += dt; const phase = this.currentPhase();
      if (this.preview && this.phaseTime >= phase.duration) this.seek(0);
      else if (!this.preview && this.phaseTime >= phase.duration) { this.phaseTime = 0; this.clipRuntime.clear(); }
      this.updateBossMotion();
      const move = (this.keys.ShiftLeft || this.keys.ShiftRight) ? 120 : 220;
      if (!this.preview) { this.player.x += ((this.keys.ArrowRight || this.keys.KeyD ? 1 : 0) - (this.keys.ArrowLeft || this.keys.KeyA ? 1 : 0)) * move * dt; this.player.y += ((this.keys.ArrowDown || this.keys.KeyS ? 1 : 0) - (this.keys.ArrowUp || this.keys.KeyW ? 1 : 0)) * move * dt; }
      this.player.x = clamp(this.player.x, 18, this.canvas.width - 18); this.player.y = clamp(this.player.y, 70, this.canvas.height - 18);
      this.fireClock = (this.fireClock || 0) - dt;
      if (!this.preview && this.status === 'RUNNING' && (this.keys.KeyZ || this.keys.KeyK || this.keys.Space || this.pointer) && this.fireClock <= 0) { this.fireClock = .085; this.shots.push({ x: this.player.x - 7, y: this.player.y - 14, vy: -520 }, { x: this.player.x + 7, y: this.player.y - 14, vy: -520 }); }
      for (const clip of this.activeClips()) {
        const local = this.phaseTime - clip.start; let runtime = this.clipRuntime.get(clip.id);
        if (!runtime) { runtime = { next: local, serial: 0 }; this.clipRuntime.set(clip.id, runtime); }
        if (local + .001 >= runtime.next) { this.spawnClip(clip, local, runtime.serial++); runtime.next = local + clamp(Number(clip.params.rate) || 1.2, .08, 8); }
      }
      if (this.timeMode !== 'none') { this.timeClock -= dt; if (this.timeClock <= 0) { if (this.timeMode === 'freeze') { this.timeMode = 'rewind'; this.timeClock = 1.2; } else this.timeMode = 'none'; } }
      this.updateBullets(dt); this.updateLasers(dt); this.updateShots(dt);
    }

    updateBullets(dt) {
      for (let i = this.bullets.length - 1; i >= 0; i--) {
        const b = this.bullets[i]; b.rotation += b.spin * dt;
        if (this.timeMode === 'rewind' && b.history.length) { const state = b.history.pop(); b.x = state[0]; b.y = state[1]; b.age = state[2]; }
        else if (this.timeMode !== 'freeze') {
          b.historyClock -= dt; if (b.historyClock <= 0) { b.history.push([b.x, b.y, b.age]); if (b.history.length > 52) b.history.shift(); b.historyClock = .035; }
          b.age += dt;
          if (b.delay > 0) b.delay -= dt;
          else if (b.stopAt && b.age >= b.stopAt && b.age < b.stopAt + b.stopFor) b.stopped = true;
          else if (b.orbit > 0) { b.orbit -= dt; b.orbitAngle += b.orbitSpeed * dt; b.x = b.orbitX + Math.cos(b.orbitAngle) * b.orbitRadius; b.y = b.orbitY + Math.sin(b.orbitAngle) * b.orbitRadius; if (b.orbit <= 0) { b.vx = Math.cos(b.orbitAngle + Math.sign(b.orbitSpeed) * Math.PI / 2) * b.speed; b.vy = Math.sin(b.orbitAngle + Math.sign(b.orbitSpeed) * Math.PI / 2) * b.speed; } }
          else {
            b.stopped = false; if (b.turn || b.wave) { const angle = Math.atan2(b.vy, b.vx) + (b.turn + Math.sin(b.age * b.waveFreq) * b.wave) * dt; const speed = Math.hypot(b.vx, b.vy); b.vx = Math.cos(angle) * speed; b.vy = Math.sin(angle) * speed; }
            if (b.magnet) { const dx = this.player.x - b.x; const dy = this.player.y - b.y; const len = Math.max(30, Math.hypot(dx, dy)); b.vx += dx / len * b.magnet * dt; b.vy += dy / len * b.magnet * dt; }
            b.x += b.vx * dt; b.y += b.vy * dt;
            if (b.bounce > 0 && (b.x < 8 || b.x > this.canvas.width - 8)) { b.vx *= -1; b.x = clamp(b.x, 8, this.canvas.width - 8); b.bounce--; }
            if (b.bounce > 0 && (b.y < 75 || b.y > this.canvas.height - 8)) { b.vy *= -1; b.y = clamp(b.y, 75, this.canvas.height - 8); b.bounce--; }
            if (b.portal > 0 && b.x < -8) { b.x = this.canvas.width + 8; b.portal--; } else if (b.portal > 0 && b.x > this.canvas.width + 8) { b.x = -8; b.portal--; }
          }
          if (b.splitAt && b.age >= b.splitAt) { for (let child = 0; child < b.split; child++) this.emit(b.x, b.y, child / b.split * TAU, 92 + this.config.difficulty * 5, { color: child % 2 ? b.color : '#FFFFFF', shape: child % 3 ? 'shard' : 'diamond' }); this.bullets.splice(i, 1); continue; }
        }
        if (b.x < -90 || b.x > this.canvas.width + 90 || b.y < -90 || b.y > this.canvas.height + 90) { this.bullets.splice(i, 1); continue; }
        if (!this.preview && this.player.invulnerable <= 0 && Math.hypot(b.x - this.player.x, b.y - this.player.y) < b.radius + 6) { this.player.hp = Math.max(0, this.player.hp - 18); this.player.invulnerable = .65; this.bullets.splice(i, 1); if (this.player.hp <= 0) this.status = 'FAILED'; }
      }
    }

    updateLasers(dt) {
      for (let i = this.lasers.length - 1; i >= 0; i--) {
        const laser = this.lasers[i]; laser.age += dt;
        if (!this.preview && laser.age > laser.warning && laser.age < laser.warning + laser.fire && this.distanceToSegment(this.player.x, this.player.y, laser) < laser.width && this.player.invulnerable <= 0) { this.player.hp = Math.max(0, this.player.hp - 30); this.player.invulnerable = .65; }
        if (laser.age > laser.warning + laser.fire) this.lasers.splice(i, 1);
      }
    }

    distanceToSegment(px, py, line) { const dx = line.x2 - line.x1; const dy = line.y2 - line.y1; const len = dx * dx + dy * dy || 1; const t = clamp(((px - line.x1) * dx + (py - line.y1) * dy) / len, 0, 1); return Math.hypot(px - (line.x1 + dx * t), py - (line.y1 + dy * t)); }

    updateShots(dt) {
      for (let i = this.shots.length - 1; i >= 0; i--) {
        const shot = this.shots[i]; shot.y += shot.vy * dt;
        if (Math.hypot(shot.x - this.boss.x, shot.y - this.boss.y) < 52) {
          this.boss.hp = Math.max(0, this.boss.hp - 92); this.shots.splice(i, 1);
          if (this.boss.hp <= 0) {
            if (this.phaseIndex < this.config.phases.length - 1) { this.phaseIndex++; this.transition = { type: this.currentPhase().transition, time: 1.8, max: 1.8 }; this.status = 'TRANSITION'; this.bullets.length = 0; this.lasers.length = 0; }
            else this.status = 'CLEAR';
          }
        } else if (shot.y < -20) this.shots.splice(i, 1);
      }
    }

    drawBullet(ctx, bullet) {
      ctx.save(); ctx.translate(bullet.x, bullet.y); ctx.rotate(bullet.rotation); const r = bullet.radius; ctx.beginPath();
      if (bullet.shape === 'diamond') { ctx.moveTo(0, -r * 1.5); ctx.lineTo(r, 0); ctx.lineTo(0, r * 1.5); ctx.lineTo(-r, 0); ctx.closePath(); }
      else if (bullet.shape === 'shard') { ctx.moveTo(0, -r * 1.8); ctx.lineTo(r * .75, r); ctx.lineTo(0, r * .55); ctx.lineTo(-r * .75, r); ctx.closePath(); }
      else if (bullet.shape === 'star') { for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i / 10 * TAU; const d = i % 2 ? r * .45 : r * 1.45; if (!i) ctx.moveTo(Math.cos(a) * d, Math.sin(a) * d); else ctx.lineTo(Math.cos(a) * d, Math.sin(a) * d); } ctx.closePath(); }
      else { ctx.arc(0, 0, r, 0, TAU); }
      if (bullet.shape === 'ring') { ctx.strokeStyle = bullet.color; ctx.lineWidth = Math.max(2, r * .35); ctx.stroke(); } else { ctx.fillStyle = bullet.color; ctx.fill(); ctx.strokeStyle = '#FFFFFF'; ctx.lineWidth = 1; if (r > 8 || bullet.shape !== 'orb') ctx.stroke(); }
      ctx.restore();
    }

    drawGrid(ctx, w, h) { ctx.fillStyle = '#050816'; ctx.fillRect(0, 0, w, h); ctx.strokeStyle = 'rgba(84,207,255,.08)'; ctx.lineWidth = 1; for (let x = 0; x < w; x += 36) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke(); } for (let y = 0; y < h; y += 36) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke(); } }

    draw() {
      const ctx = this.ctx; const w = this.canvas.width; const h = this.canvas.height; this.drawGrid(ctx, w, h);
      ctx.save(); ctx.globalAlpha = .14; ctx.fillStyle = this.config.accent; ctx.beginPath(); ctx.arc(this.boss.x, this.boss.y, 180, 0, TAU); ctx.fill(); ctx.restore();
      const groups = new Map(); for (const bullet of this.bullets) if (bullet.group && bullet.delay > 0) { if (!groups.has(bullet.group)) groups.set(bullet.group, []); groups.get(bullet.group).push(bullet); }
      for (const list of groups.values()) { if (list.length < 2) continue; list.sort((a, b) => a.order - b.order); ctx.save(); ctx.globalAlpha = .3; ctx.strokeStyle = list[0].color; ctx.beginPath(); ctx.moveTo(list[0].x, list[0].y); list.slice(1).forEach((b) => ctx.lineTo(b.x, b.y)); ctx.stroke(); ctx.restore(); }
      for (const laser of this.lasers) { const warning = laser.age < laser.warning; ctx.save(); ctx.strokeStyle = laser.color; ctx.globalAlpha = warning ? .35 + Math.sin(this.elapsed * 20) * .16 : .92; ctx.lineWidth = warning ? 3 : laser.width * 2; if (warning) ctx.setLineDash([10, 8]); ctx.beginPath(); ctx.moveTo(laser.x1, laser.y1); ctx.lineTo(laser.x2, laser.y2); ctx.stroke(); ctx.restore(); }
      ctx.save(); ctx.globalCompositeOperation = 'lighter'; for (const bullet of this.bullets) { ctx.globalAlpha = bullet.delay > 0 ? .45 : 1; this.drawBullet(ctx, bullet); } ctx.restore();
      ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = '#FFFFFF'; for (const shot of this.shots) { ctx.fillRect(shot.x - 2, shot.y - 11, 4, 18); ctx.fillStyle = this.config.accent; ctx.fillRect(shot.x - 1, shot.y - 13, 2, 22); ctx.fillStyle = '#FFFFFF'; } ctx.restore();
      this.drawBoss(ctx); ctx.save(); ctx.translate(this.player.x, this.player.y); ctx.globalAlpha = this.player.invulnerable > 0 && Math.floor(this.elapsed * 16) % 2 ? .2 : 1; ctx.fillStyle = '#FFFFFF'; ctx.strokeStyle = this.config.accent; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(0, -12); ctx.lineTo(9, 11); ctx.lineTo(0, 6); ctx.lineTo(-9, 11); ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.restore();
      const active = this.activeClips(); ctx.fillStyle = 'rgba(5,8,22,.84)'; ctx.fillRect(14, 14, 315, 58); ctx.fillStyle = '#8FAEC5'; ctx.font = '700 11px sans-serif'; ctx.fillText(`${this.config.planetName} // ${this.currentPhase().name}`, 26, 35); ctx.fillStyle = '#FFFFFF'; ctx.font = '900 14px sans-serif'; ctx.fillText(active.length ? active.slice(0, 3).map((clip) => clip.name).join(' + ') : '安全窗口', 26, 58);
      ctx.fillStyle = 'rgba(255,255,255,.12)'; ctx.fillRect(w - 188, 22, 164, 8); ctx.fillStyle = this.config.accent; ctx.fillRect(w - 188, 22, 164 * this.player.hp / this.player.maxHp, 8);
      ctx.fillStyle = 'rgba(255,255,255,.12)'; ctx.fillRect(w / 2 - 150, 82, 300, 7); ctx.fillStyle = '#FF6D9E'; ctx.fillRect(w / 2 - 150, 82, 300 * this.boss.hp / this.boss.maxHp, 7);
      if (this.timeMode !== 'none') { ctx.fillStyle = 'rgba(5,8,22,.72)'; ctx.fillRect(0, h / 2 - 42, w, 84); ctx.textAlign = 'center'; ctx.fillStyle = '#FFFFFF'; ctx.font = '900 29px sans-serif'; ctx.fillText(this.timeMode === 'freeze' ? '时间冻结' : '轨迹回溯', w / 2, h / 2 + 10); ctx.textAlign = 'left'; }
      if (this.transition) this.drawTransition(ctx, w, h);
    }

    drawTransition(ctx, w, h) {
      const progress = 1 - this.transition.time / this.transition.max; ctx.save();
      if (this.transition.type === 'blackout') { ctx.fillStyle = `rgba(0,0,0,${Math.sin(progress * Math.PI)})`; ctx.fillRect(0, 0, w, h); }
      else if (this.transition.type === 'break') { ctx.strokeStyle = '#FFFFFF'; ctx.globalAlpha = Math.sin(progress * Math.PI); for (let i = 0; i < 14; i++) { ctx.beginPath(); ctx.moveTo(w / 2, h / 2); ctx.lineTo(w / 2 + Math.cos(i / 14 * TAU) * w, h / 2 + Math.sin(i / 14 * TAU) * h); ctx.stroke(); } }
      else { ctx.fillStyle = `rgba(5,8,22,${.45 + Math.sin(progress * Math.PI) * .45})`; ctx.fillRect(0, 0, w, h); ctx.strokeStyle = this.config.accent; ctx.lineWidth = 5; ctx.beginPath(); ctx.arc(w / 2, h / 2, 20 + progress * 300, 0, TAU); ctx.stroke(); }
      ctx.textAlign = 'center'; ctx.fillStyle = '#FFFFFF'; ctx.font = '900 26px sans-serif'; ctx.fillText(this.currentPhase().name, w / 2, h / 2); ctx.fillStyle = this.config.accent; ctx.font = '900 10px Consolas'; ctx.fillText(`PHASE ${String(this.phaseIndex + 1).padStart(2, '0')} // SHIFT`, w / 2, h / 2 + 24); ctx.restore();
    }

    drawBoss(ctx) {
      if (this.config.bossImage && this.image.complete && this.image.naturalWidth) { const size = 112; ctx.drawImage(this.image, this.boss.x - size / 2, this.boss.y - size / 2, size, size); return; }
      ctx.save(); ctx.translate(this.boss.x, this.boss.y); ctx.rotate(this.elapsed * .24); ctx.strokeStyle = this.config.accent; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(0, 0, 42, 0, TAU); ctx.stroke(); for (let i = 0; i < 8; i++) { ctx.rotate(TAU / 8); ctx.fillStyle = i % 2 ? '#D7A6FF' : '#FFD05A'; ctx.fillRect(38, -4, 18, 8); } ctx.rotate(-this.elapsed * .48); ctx.fillStyle = '#111D42'; ctx.strokeStyle = '#FFFFFF'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(0, 0, 27, 0, TAU); ctx.fill(); ctx.stroke(); ctx.fillStyle = this.config.accent; ctx.beginPath(); ctx.arc(0, 0, 9, 0, TAU); ctx.fill(); ctx.restore();
    }
  }

  global.BarrageLab = { BarrageEngine, PATTERNS, DEFAULT_PARAMS, normalizeConfig };
})(window);
