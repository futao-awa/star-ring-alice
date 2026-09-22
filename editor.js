(function () {
  'use strict';

  const $ = (id) => document.getElementById(id);
  const { BarrageEngine, PATTERNS, DEFAULT_PARAMS } = window.BarrageLab;
  const palette = ['#57F0E4', '#FF6D9E', '#FFD56A', '#D7A6FF', '#54CFFF'];
  const tokenKey = 'orbit-creator-token';
  const creatorLegalKey = 'orbit-creator-legal-version';
  const creatorLegalAcceptedKey = 'orbit-creator-legal-accepted-at';
  const creatorLegalVersion = 'ORBIT-LEGAL-2026.08';
  const authNoticeKey = 'orbit-creator-auth-notice';
  const draftKey = 'orbit-lab-draft-v2';
  const legacyDraftKey = 'orbit-lab-draft';
  let token = localStorage.getItem(tokenKey) || '';
  let creator = null;
  let engine = null;
  let state = null;
  let phaseIndex = 0;
  let selectedTrackId = '';
  let selectedClipId = '';
  let paused = false;
  let initialized = false;
  let toastTimer = 0;
  let saveTimer = 0;
  let pathDrawing = false;
  let bossPathDrawing = false;
  let uiFrame = 0;
  let sessionWatch = 0;
  let musicPreviewing = false;
  const musicPlayer = new window.OrbitMusic.OrbitMusicPlayer();

  const uid = (prefix) => `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
  const round = (value, places = 1) => Number(Number(value).toFixed(places));
  const escapeText = (value) => String(value || '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);

  const fallback = {
    version: 2,
    planetName: '雾海回声星', description: '潮汐引力在星门之间反复折叠，守卫会把多层弹幕送入不同轨道并重新编排。', difficulty: 5,
    accent: '#57F0E4', allowCheat: true, bossName: 'ECHO-G9 / 潮汐记录者', bossImage: '', author: '测试创作者',
    bossMotion: { mode: 'figure-eight', speed: .8, rangeX: 18, rangeY: 5, path: [] },
    music: { mode: 'built-in', track: 'anime-flight', name: '晴空航线', data: '' },
    dialogue: [
      { speaker: '爱丽丝', text: '三组武装信号正在同一时间轴上重叠。' },
      { speaker: 'ECHO-G9', text: '轨道既定。任何偏离都会被重新校正。' },
      { speaker: '爱丽丝', text: '那我就把整条时间轴一起改写。' },
    ],
    clearQuote: '多轨协议解除。被折叠的航路已经重新展开。',
    phases: [
      {
        id: 'phase-intro', name: '第一阶段 · 潮汐接入', hp: 9000, duration: 24, transition: 'scan',
        tracks: [
          { id: 'track-main', name: '主弹幕', clips: [makeClip('safe-ring', 0, 10, { color: '#57F0E4', rate: 1.15, count: 22 })] },
          { id: 'track-space', name: '空间干扰', clips: [makeClip('portal-relay', 4, 12, { color: '#D7A6FF', rate: 1.8, count: 18, speed: 135 })] },
          { id: 'track-accent', name: '节奏强化', clips: [makeClip('echo-aim', 11, 9, { color: '#FF6D9E', rate: 2.1, count: 12, aim: true })] },
        ],
      },
      {
        id: 'phase-core', name: '第二阶段 · 回声过载', hp: 13500, duration: 30, transition: 'break',
        tracks: [
          { id: 'track-core-a', name: '时间核心', clips: [makeClip('time-rewind', 0, 14, { color: '#FFD56A', rate: 1.4, count: 26, motion: 'curve-right' })] },
          { id: 'track-core-b', name: '激光封锁', clips: [makeClip('laser-maze', 6, 18, { color: '#FF6D9E', rate: 4.2, count: 20, size: 9 })] },
          { id: 'track-core-c', name: '自由轨迹', clips: [makeClip('custom-emitter', 15, 11, { color: '#54CFFF', rate: .8, count: 9, formation: 'fan', spread: 75, motion: 'wave', path: [{ x: 20, y: 18 }, { x: 50, y: 30 }, { x: 80, y: 18 }] })] },
        ],
      },
    ],
  };

  function makeClip(patternId, start = 0, duration = 6, overrides = {}) {
    const meta = PATTERNS.find((item) => item.id === patternId);
    return { id: uid('clip'), patternId, name: meta?.name || '自由发射器', start, duration, params: { ...DEFAULT_PARAMS, ...overrides, path: Array.isArray(overrides.path) ? overrides.path : [] } };
  }

  function migrate(input) {
    if (!input || typeof input !== 'object') return structuredClone(fallback);
    if (Array.isArray(input.phases) && input.phases.length) {
      const merged = { ...structuredClone(fallback), ...input };
      merged.music = { ...fallback.music, ...(input.music || {}) };
      merged.bossMotion = { ...fallback.bossMotion, ...(input.bossMotion || {}), path: Array.isArray(input.bossMotion?.path) ? input.bossMotion.path : [] };
      merged.phases = input.phases.map((phase, pi) => ({
        id: phase.id || uid('phase'), name: phase.name || `阶段 ${pi + 1}`, hp: Number(phase.hp) || 8000,
        duration: clamp(Number(phase.duration) || 24, 6, 120), transition: phase.transition || 'scan',
        tracks: (Array.isArray(phase.tracks) && phase.tracks.length ? phase.tracks : [{ id: uid('track'), name: '主弹幕', clips: [] }]).map((track, ti) => ({
          id: track.id || uid('track'), name: track.name || `轨道 ${ti + 1}`,
          clips: (Array.isArray(track.clips) ? track.clips : []).map((clip) => ({ ...makeClip(clip.patternId || 'custom-emitter'), ...clip, params: { ...DEFAULT_PARAMS, ...(clip.params || {}), path: Array.isArray(clip.params?.path) ? clip.params.path : [] } })),
        })),
      }));
      return merged;
    }
    if (Array.isArray(input.skills)) {
      const merged = structuredClone(fallback); Object.assign(merged, input); merged.version = 2;
      merged.phases = [{ id: uid('phase'), name: '第一阶段', hp: Number(input.bossHp) || 12000, duration: Math.max(18, input.skills.length * 7), transition: 'scan', tracks: [{ id: uid('track'), name: '主弹幕', clips: input.skills.map((patternId, index) => makeClip(patternId, index * 7, 7, { color: input.accent || '#57F0E4' })) }] }];
      return merged;
    }
    return structuredClone(fallback);
  }

  function loadDraft() {
    try { return migrate(JSON.parse(localStorage.getItem(draftKey) || localStorage.getItem(legacyDraftKey) || 'null')); }
    catch { return structuredClone(fallback); }
  }

  async function api(url, options = {}) {
    const headers = { ...(options.headers || {}) };
    if (token) headers.Authorization = `Bearer ${token}`;
    const response = await fetch(url, { ...options, headers });
    let result = {}; try { result = await response.json(); } catch { /* empty response */ }
    if (response.status === 401 || result.error === 'account_disabled') {
      if (result.error === 'account_disabled') sessionStorage.setItem(authNoticeKey, result.message || '该创作者账号已被管理员停用');
      token = ''; localStorage.removeItem(tokenKey); engine?.stop(); musicPlayer.stop(); clearInterval(sessionWatch); $('authGate').classList.remove('hidden');
      setTimeout(() => location.reload(), 0);
    }
    if (!response.ok) throw new Error(result.message || result.error || '请求失败');
    return result;
  }

  function currentPhase() { return state.phases[phaseIndex]; }
  function currentTrack() { return currentPhase().tracks.find((track) => track.id === selectedTrackId) || currentPhase().tracks[0]; }
  function selectedClip() { for (const track of currentPhase().tracks) { const clip = track.clips.find((item) => item.id === selectedClipId); if (clip) return { clip, track }; } return null; }
  function allClips() { return state.phases.flatMap((phase) => phase.tracks.flatMap((track) => track.clips)); }

  function parseDialogue(value) {
    return String(value || '').split(/\r?\n/).map((line) => line.trim()).filter(Boolean).slice(0, 20).map((line) => {
      const split = line.indexOf('|'); return split < 0 ? { speaker: '旁白', text: line.slice(0, 180) } : { speaker: line.slice(0, split).trim().slice(0, 24) || '旁白', text: line.slice(split + 1).trim().slice(0, 180) };
    }).filter((line) => line.text);
  }
  function serializeDialogue(lines) { return (lines || []).map((line) => `${line.speaker} | ${line.text}`).join('\n'); }

  function showToast(message) {
    clearTimeout(toastTimer); $('studioToast').textContent = message; $('studioToast').classList.remove('hidden');
    toastTimer = setTimeout(() => $('studioToast').classList.add('hidden'), 3000);
  }

  function scheduleSave() {
    clearTimeout(saveTimer); $('saveState').textContent = '正在保存草稿...';
    saveTimer = setTimeout(() => {
      readProjectForm();
      try { localStorage.setItem(draftKey, JSON.stringify(state)); $('saveState').textContent = '多轨草稿已自动保存'; }
      catch { $('saveState').textContent = '浏览器存储空间不足'; }
    }, 260);
  }

  function readProjectForm() {
    if (!$('planetName').value) return state;
    state.planetName = $('planetName').value.trim().slice(0, 24) || '未命名星球'; state.description = $('description').value.trim().slice(0, 240);
    state.difficulty = clamp(Number($('difficulty').value) || 1, 1, 10); state.accent = $('accent').value.toUpperCase(); state.allowCheat = $('allowCheat').checked;
    state.music = { ...(state.music || fallback.music), track: $('musicTrack').value, mode: state.music?.data ? 'custom' : 'built-in' };
    state.bossName = $('bossName').value.trim().slice(0, 30) || 'UNNAMED GUARDIAN';
    state.bossMotion = { ...(state.bossMotion || fallback.bossMotion), mode: $('bossMotionMode').value, speed: clamp(Number($('bossMotionSpeed').value) || .8, .2, 3), rangeX: clamp(Number($('bossMotionRangeX').value) || 0, 0, 42), rangeY: clamp(Number($('bossMotionRangeY').value) || 0, 0, 28) };
    state.dialogue = parseDialogue($('dialogue').value); state.clearQuote = $('clearQuote').value.trim().slice(0, 100); state.author = creator?.displayName || state.author; state.version = 2;
    return state;
  }

  function fillProjectForm() {
    $('planetName').value = state.planetName; $('description').value = state.description; $('difficulty').value = state.difficulty; $('accent').value = state.accent; $('allowCheat').checked = state.allowCheat;
    $('musicTrack').value = window.OrbitMusic.THEMES[state.music?.track] ? state.music.track : 'anime-flight';
    $('musicFileState').textContent = state.music?.data ? `自定义：${state.music.name || '已上传音频'}` : `内置：${window.OrbitMusic.THEMES[$('musicTrack').value].name}`;
    $('bossName').value = state.bossName; $('dialogue').value = serializeDialogue(state.dialogue); $('clearQuote').value = state.clearQuote; $('bossImageState').textContent = state.bossImage ? '已载入自定义 Boss 贴图' : '使用默认机械守卫模型';
    $('bossMotionMode').value = state.bossMotion.mode; $('bossMotionSpeed').value = state.bossMotion.speed; $('bossMotionRangeX').value = state.bossMotion.rangeX; $('bossMotionRangeY').value = state.bossMotion.rangeY;
    $('bossPathWrap').classList.toggle('hidden', state.bossMotion.mode !== 'path'); drawBossPath();
  }

  function refreshEngine(reset = false) {
    readProjectForm(); engine.configure(state); engine.phaseIndex = phaseIndex;
    if (reset) engine.setPhase(phaseIndex);
    $('previewTitle').textContent = state.planetName; updatePhaseReadout();
  }

  function updatePhaseReadout() {
    $('phaseReadout').textContent = `PHASE ${String(phaseIndex + 1).padStart(2, '0')} / ${String(state.phases.length).padStart(2, '0')}`;
  }

  function uiLoop() {
    if (engine) {
      const t = engine.phaseTime || 0; $('timeReadout').textContent = `00:${t.toFixed(1).padStart(4, '0')}`;
      document.documentElement.style.setProperty('--playhead-x', `${t * timelinePps()}px`);
      const names = engine.activeClips().map((clip) => clip.name); $('activePatternName').textContent = names.length ? names.join(' + ') : '安全窗口';
    }
    uiFrame = requestAnimationFrame(uiLoop);
  }

  function timelinePps() { return Number($('timelineZoom').value) || 18; }

  function renderPatterns(query = '') {
    const keyword = query.trim().toLocaleLowerCase('zh-CN');
    $('patternList').replaceChildren(...PATTERNS.filter((item) => item.id !== 'custom-emitter').filter((item) => !keyword || `${item.name}${item.tag}${item.desc}`.toLocaleLowerCase('zh-CN').includes(keyword)).map((item, index) => {
      const button = document.createElement('button'); button.type = 'button'; button.className = 'pattern-item'; button.style.setProperty('--pattern-color', palette[index % palette.length]);
      button.innerHTML = `<i>${String(index + 1).padStart(2, '0')}</i><div><b>${item.name}</b><small>${item.tag} · ${item.desc}</small></div><span>+</span>`;
      button.addEventListener('click', () => addClip(item.id)); return button;
    }));
  }

  function addClip(patternId) {
    const phase = currentPhase(); const track = currentTrack(); if (!track) return;
    if (allClips().length >= 60) return showToast('一个关卡最多 60 个弹幕片段');
    const start = clamp(round(engine?.phaseTime || 0), 0, phase.duration - .5); const duration = round(Math.min(6, phase.duration - start));
    const presets = {
      'laser-maze': { rate: 4, count: 20, size: 9 }, 'split-comet': { rate: 2.2, count: 16, size: 12, aim: true },
      'echo-aim': { rate: 1.8, count: 15, aim: true, spread: 70 }, 'constellation-drop': { formation: 'polygon', count: 20, sides: 7, rate: 2 },
      'custom-emitter': { formation: 'fan', spread: 70, count: 9, rate: .8, path: [{ x: 25, y: 18 }, { x: 50, y: 28 }, { x: 75, y: 18 }] },
    };
    const clip = makeClip(patternId, start, duration, { color: palette[allClips().length % palette.length], ...(presets[patternId] || {}) });
    track.clips.push(clip); selectedClipId = clip.id; renderTimeline(); renderClipInspector(); refreshEngine(); scheduleSave(); showToast(`已加入 ${clip.name}，可与其他轨道同时播放`);
  }

  function renderPhaseStrip() {
    $('phaseStrip').replaceChildren(...state.phases.map((phase, index) => {
      const button = document.createElement('button'); button.type = 'button'; button.className = `phase-tab${index === phaseIndex ? ' active' : ''}`;
      button.innerHTML = `<i>${String(index + 1).padStart(2, '0')}</i><b>${escapeText(phase.name)}</b>`;
      button.addEventListener('click', () => selectPhase(index)); return button;
    }));
  }

  function selectPhase(index) {
    phaseIndex = clamp(index, 0, state.phases.length - 1); selectedTrackId = currentPhase().tracks[0]?.id || ''; selectedClipId = ''; refreshEngine(true); renderPhaseStrip(); renderTimeline(); fillPhaseForm(); renderClipInspector(); updatePhaseReadout(); scheduleSave();
  }

  function renderTimeline() {
    const phase = currentPhase(); const pps = timelinePps(); document.documentElement.style.setProperty('--timeline-pps', `${pps}px`); document.documentElement.style.setProperty('--phase-width', `${Math.max(phase.duration * pps, 420)}px`);
    const ruler = $('timelineRuler'); ruler.replaceChildren();
    for (let second = 0; second <= phase.duration; second += 5) { const mark = document.createElement('span'); mark.className = 'ruler-mark'; mark.style.left = `${second * pps}px`; mark.textContent = `${second}s`; ruler.append(mark); }
    ruler.onclick = (event) => { const rect = ruler.getBoundingClientRect(); engine.seek(clamp((event.clientX - rect.left) / pps, 0, phase.duration)); };
    $('timelineTracks').replaceChildren(...phase.tracks.map((track, trackIndex) => renderTrack(track, trackIndex, pps)));
    renderPhaseStrip(); fillPhaseForm(); renderClipInspector();
  }

  function renderTrack(track, trackIndex, pps) {
    const row = document.createElement('div'); row.className = 'track-row'; row.dataset.track = track.id;
    const label = document.createElement('div'); label.className = 'track-label'; label.style.setProperty('--track-color', palette[trackIndex % palette.length]);
    label.innerHTML = `<span>${String(trackIndex + 1).padStart(2, '0')}</span><input value="${escapeText(track.name)}" maxlength="20" aria-label="轨道名称"><button type="button" title="删除轨道" aria-label="删除轨道">×</button>`;
    label.querySelector('input').addEventListener('input', (event) => { track.name = event.target.value.slice(0, 20); scheduleSave(); });
    label.querySelector('button').addEventListener('click', () => deleteTrack(track.id));
    const lane = document.createElement('div'); lane.className = 'track-lane'; lane.dataset.track = track.id;
    lane.addEventListener('dblclick', () => { selectedTrackId = track.id; addClip('custom-emitter'); });
    track.clips.forEach((clip) => lane.append(renderClip(clip, track, pps)));
    row.append(label, lane); return row;
  }

  function renderClip(clip, track, pps) {
    const meta = PATTERNS.find((item) => item.id === clip.patternId); const node = document.createElement('div'); node.className = `timeline-clip${clip.id === selectedClipId ? ' selected' : ''}`; node.dataset.clip = clip.id; node.style.left = `${clip.start * pps}px`; node.style.width = `${Math.max(16, clip.duration * pps)}px`; node.style.setProperty('--clip-color', clip.params.color || state.accent);
    node.innerHTML = `<i></i><div><b>${escapeText(clip.name)}</b><small>${escapeText(meta?.tag || '自由')} · ${clip.duration.toFixed(1)}s</small></div><span class="clip-resize"></span>`;
    node.addEventListener('pointerdown', (event) => beginClipDrag(event, clip, track, node, event.target.classList.contains('clip-resize'))); node.addEventListener('click', () => { selectedClipId = clip.id; selectedTrackId = track.id; renderTimeline(); });
    return node;
  }

  function beginClipDrag(event, clip, track, node, resizing) {
    event.preventDefault(); event.stopPropagation(); selectedClipId = clip.id; selectedTrackId = track.id; const phase = currentPhase(); const pps = timelinePps(); const startX = event.clientX; const originalStart = clip.start; const originalDuration = clip.duration;
    node.setPointerCapture?.(event.pointerId);
    const move = (moveEvent) => {
      const delta = round((moveEvent.clientX - startX) / pps);
      if (resizing) { clip.duration = clamp(originalDuration + delta, .5, phase.duration - clip.start); node.style.width = `${clip.duration * pps}px`; }
      else { clip.start = clamp(originalStart + delta, 0, phase.duration - clip.duration); node.style.left = `${clip.start * pps}px`; }
    };
    const end = (upEvent) => {
      window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', end);
      if (!resizing) {
        const lane = document.elementFromPoint(upEvent.clientX, upEvent.clientY)?.closest('.track-lane');
        if (lane && lane.dataset.track !== track.id) { const target = phase.tracks.find((item) => item.id === lane.dataset.track); if (target) { track.clips = track.clips.filter((item) => item.id !== clip.id); target.clips.push(clip); selectedTrackId = target.id; } }
      }
      renderTimeline(); refreshEngine(); scheduleSave();
    };
    window.addEventListener('pointermove', move); window.addEventListener('pointerup', end, { once: true });
  }

  function deleteTrack(id) {
    const phase = currentPhase(); if (phase.tracks.length <= 1) return showToast('每个阶段至少保留一条轨道'); const track = phase.tracks.find((item) => item.id === id); if (track?.clips.length && !confirm(`轨道“${track.name}”包含 ${track.clips.length} 个片段，确认删除？`)) return;
    phase.tracks = phase.tracks.filter((item) => item.id !== id); selectedTrackId = phase.tracks[0].id; selectedClipId = ''; renderTimeline(); refreshEngine(true); scheduleSave();
  }

  function renderClipInspector() {
    const selected = selectedClip(); $('clipEmpty').classList.toggle('hidden', Boolean(selected)); $('clipFields').classList.toggle('hidden', !selected); if (!selected) { drawPath(); return; }
    const { clip } = selected; $('clipName').value = clip.name; $('clipStart').value = round(clip.start); $('clipDuration').value = round(clip.duration); $('paramX').value = clip.params.x; $('paramY').value = clip.params.y; $('paramAngle').value = clip.params.angle; $('paramSize').value = clip.params.size; $('paramSpeed').value = clip.params.speed; $('paramCount').value = clip.params.count; $('paramSpread').value = clip.params.spread; $('paramRate').value = clip.params.rate; $('paramShape').value = clip.params.shape; $('paramColor').value = clip.params.color; $('paramFormation').value = clip.params.formation; $('paramMotion').value = clip.params.motion; $('paramSides').value = clip.params.sides; $('paramAim').checked = clip.params.aim; drawPath();
  }

  function updateSelectedClip() {
    const selected = selectedClip(); if (!selected) return; const { clip } = selected; const phase = currentPhase();
    clip.name = $('clipName').value.trim().slice(0, 28) || '未命名弹幕片段'; clip.start = clamp(Number($('clipStart').value) || 0, 0, phase.duration - .5); clip.duration = clamp(Number($('clipDuration').value) || .5, .5, phase.duration - clip.start);
    Object.assign(clip.params, { x: clamp(Number($('paramX').value), 0, 100), y: clamp(Number($('paramY').value), 0, 100), angle: clamp(Number($('paramAngle').value), -360, 360), size: clamp(Number($('paramSize').value), 2, 24), speed: clamp(Number($('paramSpeed').value), 20, 420), count: clamp(Math.round(Number($('paramCount').value)), 1, 80), spread: clamp(Number($('paramSpread').value), 0, 360), rate: clamp(Number($('paramRate').value), .08, 8), shape: $('paramShape').value, color: $('paramColor').value.toUpperCase(), formation: $('paramFormation').value, motion: $('paramMotion').value, sides: clamp(Math.round(Number($('paramSides').value)), 3, 12), aim: $('paramAim').checked });
    renderTimeline(); refreshEngine(); scheduleSave();
  }

  function drawPath() {
    const canvas = $('pathCanvas'); const ctx = canvas.getContext('2d'); const selected = selectedClip(); ctx.clearRect(0, 0, canvas.width, canvas.height); ctx.fillStyle = '#050816'; ctx.fillRect(0, 0, canvas.width, canvas.height); ctx.strokeStyle = 'rgba(84,207,255,.12)'; ctx.lineWidth = 1; for (let x = 0; x <= canvas.width; x += 60) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, canvas.height); ctx.stroke(); } for (let y = 0; y <= canvas.height; y += 52) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(canvas.width, y); ctx.stroke(); }
    const path = selected?.clip.params.path || []; if (!path.length) { ctx.fillStyle = '#557990'; ctx.font = '18px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('拖动画出发射器运动轨迹', canvas.width / 2, canvas.height / 2); return; }
    ctx.strokeStyle = selected.clip.params.color; ctx.lineWidth = 4; ctx.beginPath(); path.forEach((point, index) => { const x = point.x / 100 * canvas.width; const y = point.y / 100 * canvas.height; if (!index) ctx.moveTo(x, y); else ctx.lineTo(x, y); }); ctx.stroke();
    path.forEach((point, index) => { ctx.fillStyle = index === 0 ? '#FFD56A' : index === path.length - 1 ? '#FF6D9E' : '#FFFFFF'; ctx.beginPath(); ctx.arc(point.x / 100 * canvas.width, point.y / 100 * canvas.height, 5, 0, Math.PI * 2); ctx.fill(); });
  }

  function addPathPoint(event) {
    const selected = selectedClip(); if (!selected) return; const canvas = $('pathCanvas'); const rect = canvas.getBoundingClientRect(); const point = { x: round(clamp((event.clientX - rect.left) / rect.width * 100, 0, 100)), y: round(clamp((event.clientY - rect.top) / rect.height * 100, 0, 100)) }; const path = selected.clip.params.path;
    const last = path[path.length - 1]; if (!last || Math.hypot(point.x - last.x, point.y - last.y) > 2.5) path.push(point); if (path.length > 32) path.shift(); drawPath(); refreshEngine(); scheduleSave();
  }

  function drawBossPath() {
    const canvas = $('bossPathCanvas'); if (!canvas || !state?.bossMotion) return; const ctx = canvas.getContext('2d'); const path = state.bossMotion.path || [];
    ctx.clearRect(0, 0, canvas.width, canvas.height); ctx.fillStyle = '#050816'; ctx.fillRect(0, 0, canvas.width, canvas.height); ctx.fillStyle = 'rgba(255,109,158,.055)'; ctx.fillRect(0, canvas.height * .58, canvas.width, canvas.height * .42);
    ctx.strokeStyle = 'rgba(84,207,255,.13)'; ctx.lineWidth = 1; for (let x = 0; x <= canvas.width; x += 60) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, canvas.height); ctx.stroke(); } for (let y = 0; y <= canvas.height; y += 50) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(canvas.width, y); ctx.stroke(); }
    if (!path.length) { ctx.fillStyle = '#7394aa'; ctx.font = '17px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('拖动绘制 Boss 巡航路线', canvas.width / 2, canvas.height * .36); return; }
    ctx.strokeStyle = state.accent; ctx.lineWidth = 4; ctx.beginPath(); path.forEach((point, index) => { const x = point.x / 100 * canvas.width; const y = point.y / 100 * canvas.height; if (!index) ctx.moveTo(x, y); else ctx.lineTo(x, y); }); if (path.length > 2) ctx.lineTo(path[0].x / 100 * canvas.width, path[0].y / 100 * canvas.height); ctx.stroke();
    path.forEach((point, index) => { ctx.fillStyle = index ? '#FFFFFF' : '#FFD56A'; ctx.beginPath(); ctx.arc(point.x / 100 * canvas.width, point.y / 100 * canvas.height, 5, 0, Math.PI * 2); ctx.fill(); });
  }

  function addBossPathPoint(event) {
    const canvas = $('bossPathCanvas'); const rect = canvas.getBoundingClientRect(); const point = { x: round(clamp((event.clientX - rect.left) / rect.width * 100, 8, 92)), y: round(clamp((event.clientY - rect.top) / rect.height * 100, 6, 58)) }; const path = state.bossMotion.path;
    const last = path[path.length - 1]; if (!last || Math.hypot(point.x - last.x, point.y - last.y) > 2.2) path.push(point); if (path.length > 40) path.shift(); drawBossPath(); refreshEngine(); scheduleSave();
  }

  function fillPhaseForm() {
    const phase = currentPhase(); $('phaseName').value = phase.name; $('phaseHp').value = phase.hp; $('phaseDuration').value = phase.duration; $('phaseTransition').value = phase.transition;
    const clips = phase.tracks.reduce((sum, track) => sum + track.clips.length, 0); $('phaseSummary').innerHTML = `<b>${phase.tracks.length} 条轨道 · ${clips} 个片段</b><span>阶段总血量 ${Number(phase.hp).toLocaleString('zh-CN')}，时间轴 ${phase.duration} 秒循环。重叠片段将在同一时间内并行结算。</span>`;
  }

  function updatePhase() {
    const phase = currentPhase(); const oldDuration = phase.duration; phase.name = $('phaseName').value.trim().slice(0, 30) || `阶段 ${phaseIndex + 1}`; phase.hp = clamp(Math.round(Number($('phaseHp').value) || 1000), 1000, 500000); phase.duration = clamp(Number($('phaseDuration').value) || 6, 6, 120); phase.transition = $('phaseTransition').value;
    if (phase.duration < oldDuration) phase.tracks.forEach((track) => track.clips.forEach((clip) => { clip.start = Math.min(clip.start, phase.duration - .5); clip.duration = Math.min(clip.duration, phase.duration - clip.start); }));
    renderTimeline(); refreshEngine(); scheduleSave();
  }

  function addPhase(copy = false) {
    if (state.phases.length >= 8) return showToast('最多创建 8 个 Boss 阶段');
    const source = currentPhase(); const phase = copy ? structuredClone(source) : { id: uid('phase'), name: `阶段 ${state.phases.length + 1} · 未命名协议`, hp: 10000, duration: 24, transition: 'scan', tracks: [{ id: uid('track'), name: '主弹幕', clips: [] }, { id: uid('track'), name: '辅助弹幕', clips: [] }] };
    phase.id = uid('phase'); phase.name = copy ? `${source.name} · 复制` : phase.name; phase.tracks.forEach((track) => { track.id = uid('track'); track.clips.forEach((clip) => { clip.id = uid('clip'); }); }); state.phases.push(phase); selectPhase(state.phases.length - 1); showToast(copy ? '阶段已复制' : '新阶段已创建');
  }

  function deletePhase() {
    if (state.phases.length <= 1) return showToast('Boss 至少需要一个阶段'); if (!confirm(`确认删除“${currentPhase().name}”？`)) return; state.phases.splice(phaseIndex, 1); selectPhase(Math.max(0, phaseIndex - 1));
  }

  function validateLevel() {
    readProjectForm(); if (state.planetName.length < 2) throw new Error('星球名称至少需要 2 个字符'); if (state.description.length < 8) throw new Error('请补充关卡简介'); if (!state.dialogue.length) throw new Error('至少需要一段剧情对话'); if (!allClips().length) throw new Error('至少需要一个弹幕片段'); return state;
  }

  async function publish(mode) {
    try {
      const level = validateLevel(); const endpoint = mode === 'review' ? '/api/reviews' : '/api/shares'; const body = mode === 'review' ? { level } : { level, expiresInHours: Number($('shareExpiry').value) };
      const result = await api(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      if (mode === 'review') { showToast('已发送，请等待审核'); await Promise.all([loadReviews(), loadMail()]); }
      else { const url = new URL(result.playUrl, location.href).href; $('shareResult').classList.remove('hidden'); $('shareUrl').value = url; $('shareLabel').textContent = `临时链接已生成 · ${new Date(result.expiresAt).toLocaleString('zh-CN')} 失效`; showToast('临时试玩链接已生成'); }
    } catch (error) { showToast(error.message || '提交失败'); }
  }

  async function loadReviews() {
    try {
      const result = await api('/api/reviews/mine'); const list = $('reviewList'); if (!result.reviews.length) { list.innerHTML = '<p>还没有提交过审核申请。</p>'; return; }
      list.replaceChildren(...result.reviews.map((review) => { const item = document.createElement('article'); item.className = 'submission-item'; const status = { pending: '审核中', approved: '已通过', rejected: '需修改' }[review.status] || review.status; item.innerHTML = `<b>${escapeText(review.planetName)}</b><em class="${review.status}">${status}</em><small>${review.reason ? escapeText(review.reason) : new Date(review.createdAt).toLocaleString('zh-CN')}</small>`; return item; }));
    } catch (error) { $('reviewList').innerHTML = `<p>${escapeText(error.message)}</p>`; }
  }

  async function loadCommunity() {
    try {
      const response = await fetch('/api/levels'); const result = await response.json(); const list = $('communityList'); if (!result.levels.length) { list.innerHTML = '<p>公开玩家星图暂时为空。</p>'; return; }
      list.replaceChildren(...result.levels.map((level) => { const item = document.createElement('article'); item.className = 'public-level'; item.innerHTML = `<b>${escapeText(level.planetName)}</b><a href="${level.playUrl}" target="_blank" rel="noopener">试玩</a><small>${escapeText(level.author)} · ${level.phaseCount || 1} 阶段 · ${level.skillCount} 个片段</small>`; return item; }));
    } catch { $('communityList').innerHTML = '<p>玩家星图暂时无法连接。</p>'; }
  }

  async function loadMail() {
    try {
      const result = await api('/api/inbox');
      const readAnnouncements = new Set(JSON.parse(localStorage.getItem('orbit-read-announcements') || '[]'));
      const rows = [...result.messages, ...result.announcements.map((item) => ({ ...item, type: 'announcement', readAt: readAnnouncements.has(item.id) ? 'local' : null }))].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      const list = $('mailList'); $('mailDot').classList.toggle('active', rows.some((item) => !item.readAt));
      if (!rows.length) { list.innerHTML = '<p>邮箱里暂时没有新消息。</p>'; return; }
      list.replaceChildren(...rows.map((mail) => {
        const item = document.createElement('article'); item.className = `mail-item${mail.readAt ? '' : ' unread'}`; item.tabIndex = 0;
        item.innerHTML = `<span>${mail.type === 'announcement' ? 'SYSTEM ANNOUNCEMENT' : 'PRIVATE MESSAGE'}${mail.readAt ? '' : ' · NEW'}</span><b>${escapeText(mail.title)}</b><p>${escapeText(mail.body)}</p><time>${new Date(mail.createdAt).toLocaleString('zh-CN')}</time>`;
        const expand = async () => {
          item.classList.toggle('open');
          if (!item.classList.contains('open') || !item.classList.contains('unread')) return;
          item.classList.remove('unread'); mail.readAt = new Date().toISOString();
          if (mail.type === 'announcement') {
            readAnnouncements.add(mail.id); localStorage.setItem('orbit-read-announcements', JSON.stringify([...readAnnouncements].slice(-200)));
          } else {
            try { await api('/api/inbox/read', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: mail.id }) }); } catch { /* retry on next open */ }
          }
          $('mailDot').classList.toggle('active', rows.some((row) => !row.readAt));
        };
        item.addEventListener('click', expand); item.addEventListener('keydown', (event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); expand(); } }); return item;
      }));
    } catch { $('mailList').innerHTML = '<p>邮箱暂时无法连接。</p>'; }
  }

  function exportLevel() {
    try { const blob = new Blob([JSON.stringify(validateLevel(), null, 2)], { type: 'application/json' }); const link = document.createElement('a'); link.href = URL.createObjectURL(blob); link.download = `${state.planetName.replace(/[\\/:*?"<>|]/g, '_') || 'orbit-level'}.json`; link.click(); URL.revokeObjectURL(link.href); showToast('多轨关卡 JSON 已导出'); } catch (error) { showToast(error.message); }
  }

  function bindEvents() {
    document.querySelectorAll('.inspector-tabs button').forEach((button) => button.addEventListener('click', () => { document.querySelectorAll('.inspector-tabs button').forEach((item) => item.classList.toggle('active', item === button)); document.querySelectorAll('.inspector-panel').forEach((panel) => panel.classList.toggle('active', panel.dataset.panel === button.dataset.tab)); if (button.dataset.tab === 'publish') { loadReviews(); loadCommunity(); } }));
    $('patternSearch').addEventListener('input', () => renderPatterns($('patternSearch').value)); $('createEmitter').addEventListener('click', () => addClip('custom-emitter'));
    $('timelineZoom').addEventListener('input', renderTimeline); $('addTrack').addEventListener('click', () => { const phase = currentPhase(); if (phase.tracks.length >= 6) return showToast('每个阶段最多 6 条轨道'); const track = { id: uid('track'), name: `轨道 ${phase.tracks.length + 1}`, clips: [] }; phase.tracks.push(track); selectedTrackId = track.id; renderTimeline(); scheduleSave(); });
    $('addPhase').addEventListener('click', () => addPhase(false)); $('duplicatePhase').addEventListener('click', () => addPhase(true)); $('deletePhase').addEventListener('click', deletePhase);
    ['phaseName', 'phaseHp', 'phaseDuration', 'phaseTransition'].forEach((id) => $(id).addEventListener('change', updatePhase));
    ['clipName', 'clipStart', 'clipDuration', 'paramX', 'paramY', 'paramAngle', 'paramSize', 'paramSpeed', 'paramCount', 'paramSpread', 'paramRate', 'paramShape', 'paramColor', 'paramFormation', 'paramMotion', 'paramSides', 'paramAim'].forEach((id) => {
      $(id).addEventListener('change', updateSelectedClip); $(id).addEventListener('blur', updateSelectedClip);
    });
    $('deleteClip').addEventListener('click', () => { const selected = selectedClip(); if (!selected) return; selected.track.clips = selected.track.clips.filter((item) => item.id !== selected.clip.id); selectedClipId = ''; renderTimeline(); refreshEngine(true); scheduleSave(); });
    const pathCanvas = $('pathCanvas'); pathCanvas.addEventListener('pointerdown', (event) => { const selected = selectedClip(); if (!selected) return; selected.clip.params.path = []; pathDrawing = true; pathCanvas.setPointerCapture?.(event.pointerId); addPathPoint(event); }); pathCanvas.addEventListener('pointermove', (event) => { if (pathDrawing) addPathPoint(event); }); pathCanvas.addEventListener('pointerup', () => { pathDrawing = false; renderTimeline(); }); pathCanvas.addEventListener('pointercancel', () => { pathDrawing = false; }); $('clearPath').addEventListener('click', () => { const selected = selectedClip(); if (!selected) return; selected.clip.params.path = []; drawPath(); refreshEngine(); scheduleSave(); });
    const bossPathCanvas = $('bossPathCanvas'); bossPathCanvas.addEventListener('pointerdown', (event) => { state.bossMotion.path = []; bossPathDrawing = true; bossPathCanvas.setPointerCapture?.(event.pointerId); addBossPathPoint(event); }); bossPathCanvas.addEventListener('pointermove', (event) => { if (bossPathDrawing) addBossPathPoint(event); }); bossPathCanvas.addEventListener('pointerup', () => { bossPathDrawing = false; }); bossPathCanvas.addEventListener('pointercancel', () => { bossPathDrawing = false; });
    $('clearBossPath').addEventListener('click', () => { state.bossMotion.path = []; drawBossPath(); refreshEngine(); scheduleSave(); });
    $('bossMotionMode').addEventListener('change', () => { readProjectForm(); $('bossPathWrap').classList.toggle('hidden', state.bossMotion.mode !== 'path'); drawBossPath(); refreshEngine(); scheduleSave(); });
    ['bossMotionSpeed', 'bossMotionRangeX', 'bossMotionRangeY'].forEach((id) => $(id).addEventListener('input', () => { readProjectForm(); refreshEngine(); scheduleSave(); }));
    ['planetName', 'description', 'difficulty', 'accent', 'bossName', 'allowCheat', 'dialogue', 'clearQuote'].forEach((id) => $(id).addEventListener('input', () => { readProjectForm(); refreshEngine(); scheduleSave(); }));
    $('musicTrack').addEventListener('change', () => {
      state.music = { mode: 'built-in', track: $('musicTrack').value, name: window.OrbitMusic.THEMES[$('musicTrack').value].name, data: '' };
      $('musicFile').value = ''; $('musicFileState').textContent = `内置：${state.music.name}`;
      if (musicPreviewing) musicPlayer.configure(state.music); scheduleSave();
    });
    $('musicFile').addEventListener('change', () => {
      const file = $('musicFile').files[0]; if (!file) return;
      if (file.size > 1.6 * 1024 * 1024) { $('musicFile').value = ''; return showToast('自定义音乐不能超过 1.6MB'); }
      if (!/^audio\/(ogg|mpeg|wav|webm)$/i.test(file.type)) { $('musicFile').value = ''; return showToast('请选择 OGG、MP3、WAV 或 WEBM 音频'); }
      const reader = new FileReader(); reader.onload = () => {
        state.music = { mode: 'custom', track: $('musicTrack').value, name: file.name.slice(0, 80), data: String(reader.result) };
        $('musicFileState').textContent = `自定义：${file.name}`; if (musicPreviewing) musicPlayer.configure(state.music); scheduleSave();
      }; reader.readAsDataURL(file);
    });
    $('musicPreview').addEventListener('click', () => {
      musicPreviewing = !musicPreviewing; readProjectForm(); musicPlayer.configure(state.music);
      if (musicPreviewing) musicPlayer.start(); else musicPlayer.stop();
      $('musicPreview').textContent = musicPreviewing ? '■ 停止' : '▶ 试听';
    });
    $('clearMusic').addEventListener('click', () => {
      state.music = { mode: 'built-in', track: $('musicTrack').value, name: window.OrbitMusic.THEMES[$('musicTrack').value].name, data: '' };
      $('musicFile').value = ''; $('musicFileState').textContent = `内置：${state.music.name}`; if (musicPreviewing) musicPlayer.configure(state.music); scheduleSave();
    });
    $('bossImage').addEventListener('change', () => { const file = $('bossImage').files[0]; if (!file) return; if (file.size > 1.2 * 1024 * 1024) { $('bossImage').value = ''; return showToast('Boss 贴图不能超过 1.2MB'); } const reader = new FileReader(); reader.onload = () => { state.bossImage = String(reader.result); $('bossImageState').textContent = `已载入：${file.name}`; refreshEngine(true); scheduleSave(); }; reader.readAsDataURL(file); });
    $('clearBossImage').addEventListener('click', () => { state.bossImage = ''; $('bossImage').value = ''; $('bossImageState').textContent = '使用默认机械守卫模型'; refreshEngine(true); scheduleSave(); });
    $('restartPreview').addEventListener('click', () => engine.setPhase(phaseIndex)); $('pausePreview').addEventListener('click', () => { paused = !paused; if (paused) engine.stop(); else engine.start(); $('pausePreview').textContent = paused ? '▶' : 'Ⅱ'; $('pausePreview').title = paused ? '继续预览' : '暂停预览'; });
    $('testBtn').addEventListener('click', () => { try { validateLevel(); localStorage.setItem(draftKey, JSON.stringify(state)); window.open('/play.html?draft=1', '_blank', 'noopener'); } catch (error) { showToast(error.message); } });
    $('creatorLogoutBtn').addEventListener('click', async () => { try { await api('/api/auth/logout', { method: 'POST' }); } catch { /* local sign-out still applies */ } token = ''; localStorage.removeItem(tokenKey); engine?.stop(); musicPlayer.stop(); location.reload(); });
    $('publishBtn').addEventListener('click', () => publish('review')); $('shareBtn').addEventListener('click', () => publish('temporary')); $('refreshReviews').addEventListener('click', loadReviews); $('refreshLevels').addEventListener('click', loadCommunity);
    $('copyShare').addEventListener('click', async () => { try { await navigator.clipboard.writeText($('shareUrl').value); showToast('链接已复制'); } catch { $('shareUrl').select(); showToast('已选中链接，请手动复制'); } });
    $('exportBtn').addEventListener('click', exportLevel); $('importBtn').addEventListener('click', () => $('importFile').click()); $('importFile').addEventListener('change', async () => { const file = $('importFile').files[0]; if (!file) return; try { state = migrate(JSON.parse(await file.text())); phaseIndex = 0; selectedTrackId = state.phases[0].tracks[0].id; selectedClipId = ''; fillProjectForm(); renderTimeline(); refreshEngine(true); scheduleSave(); showToast('多轨关卡文件已导入'); } catch { showToast('无法读取这个关卡文件'); } $('importFile').value = ''; });
    $('mailBtn').addEventListener('click', async () => { $('mailDrawer').classList.remove('hidden'); await loadMail(); }); $('mailClose').addEventListener('click', () => $('mailDrawer').classList.add('hidden'));
  }

  function initEditor() {
    if (initialized) return; initialized = true; state = loadDraft(); state.author = creator.displayName; phaseIndex = 0; selectedTrackId = state.phases[0].tracks[0].id; selectedClipId = state.phases[0].tracks[0].clips[0]?.id || '';
    $('creatorName').textContent = creator.displayName; $('saveState').textContent = '创作者已验证'; fillProjectForm(); engine = new BarrageEngine($('previewCanvas'), { preview: true, config: state }); engine.start(); bindEvents(); renderPatterns(); renderTimeline(); refreshEngine(true); loadMail(); loadReviews(); loadCommunity(); cancelAnimationFrame(uiFrame); uiLoop();
    clearInterval(sessionWatch); sessionWatch = setInterval(() => api('/api/auth/me').catch(() => {}), 8000);
  }

  async function checkSession() {
    if (!token || localStorage.getItem(creatorLegalKey) !== creatorLegalVersion) return $('authGate').classList.remove('hidden');
    try { const result = await api('/api/auth/me'); if (!['creator', 'admin'].includes(result.user.role)) throw new Error('该账号没有创作者权限'); creator = result.user; $('authGate').classList.add('hidden'); initEditor(); }
    catch { token = ''; localStorage.removeItem(tokenKey); $('authGate').classList.remove('hidden'); }
  }

  $('creatorLogin').addEventListener('submit', async (event) => {
    event.preventDefault(); $('authError').classList.add('hidden');
    if (!$('creatorPrivacyConsent').checked) { $('authError').textContent = '请先阅读并同意工坊隐私与创作者协议'; $('authError').classList.remove('hidden'); return; }
    try { const response = await fetch('/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ account: $('creatorAccount').value.trim(), password: $('creatorPassword').value }) }); const result = await response.json(); if (!response.ok) throw new Error(result.message || '验证失败'); if (!['creator', 'admin'].includes(result.user.role)) throw new Error('该账号没有创作者权限'); token = result.token; creator = result.user; localStorage.setItem(tokenKey, token); localStorage.setItem(creatorLegalKey, creatorLegalVersion); localStorage.setItem(creatorLegalAcceptedKey, new Date().toISOString()); $('authGate').classList.add('hidden'); initEditor(); }
    catch (error) { $('authError').textContent = error.message; $('authError').classList.remove('hidden'); }
  });

  const authNotice = sessionStorage.getItem(authNoticeKey); if (authNotice) { sessionStorage.removeItem(authNoticeKey); $('authError').textContent = authNotice; $('authError').classList.remove('hidden'); }
  checkSession();
})();
