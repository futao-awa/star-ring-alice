'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { URL } = require('url');

const ROOT = __dirname;
const HOST = process.env.HOST || '127.0.0.1';
const PORT = Number(process.env.PORT || 4174);
const DATA_DIR = path.resolve(process.env.DATA_DIR || ROOT);
const IS_PRODUCTION = process.env.NODE_ENV === 'production';
const FILES = {
  rankings: path.join(DATA_DIR, 'rankings.json'),
  levels: path.join(DATA_DIR, 'levels.json'),
  shares: path.join(DATA_DIR, 'shares.json'),
  users: path.join(DATA_DIR, 'users.json'),
  reviews: path.join(DATA_DIR, 'reviews.json'),
  announcements: path.join(DATA_DIR, 'announcements.json'),
  mail: path.join(DATA_DIR, 'mail.json'),
};
const GALAXIES = new Set(['atlas', 'lumen', 'vesper', 'null', 'aether', 'mirage', 'umbra', 'zenith']);
const PATTERNS = new Set(['safe-ring', 'beat-chess', 'portal-relay', 'serpent', 'laser-maze', 'polarity', 'time-rewind', 'split-comet', 'echo-aim', 'mirror-wall', 'constellation-drop', 'orbit-cage', 'custom-emitter']);
const SHAPES = new Set(['orb', 'diamond', 'shard', 'star', 'ring']);
const MOTIONS = new Set(['straight', 'curve-left', 'curve-right', 'wave', 'homing', 'bounce', 'orbit', 'stop-go']);
const FORMATIONS = new Set(['radial', 'fan', 'line', 'polygon', 'path']);
const TRANSITIONS = new Set(['scan', 'break', 'warp', 'rewind', 'blackout']);
const MUSIC_TRACKS = new Set(['starlight-idle', 'anime-flight', 'pixel-rush', 'neon-beat', 'heroic-orbit', 'chrono-abyss']);
const BOSS_MOTION_MODES = new Set(['hover', 'horizontal', 'figure-eight', 'orbit', 'path']);
const BLOCKED_PUBLIC_TERMS = [
  '管理员', '官方', '系统消息', '客服', 'admin', 'administrator', 'system', 'official',
  '操你妈', '草泥马', '傻逼', '煞笔', '妈逼', '死妈', '杂种',
  '色情', '成人视频', '黄色网站', '约炮', '强奸', '赌博', '赌场', '博彩',
  '加微信', '微信号', 'qq群', '代练', '外挂', '刷单',
];
const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp',
  '.ogg': 'audio/ogg', '.opus': 'audio/ogg',
};
const sessions = new Map();

function send(res, status, body, type = 'application/json; charset=utf-8') {
  res.writeHead(status, { 'Content-Type': type, 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
  res.end(typeof body === 'string' ? body : JSON.stringify(body));
}

function readRows(file) {
  try { const rows = JSON.parse(fs.readFileSync(file, 'utf8')); return Array.isArray(rows) ? rows : []; }
  catch { return []; }
}

function saveRows(file, rows) {
  const temp = `${file}.tmp`;
  fs.writeFileSync(temp, JSON.stringify(rows, null, 2));
  fs.renameSync(temp, file);
}

function ensureData() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  for (const file of Object.values(FILES)) if (!fs.existsSync(file)) fs.writeFileSync(file, '[]\n');
  if (!readRows(FILES.users).length) {
    const now = new Date().toISOString();
    const admin = IS_PRODUCTION
      ? makeUser(process.env.ADMIN_ACCOUNT, process.env.ADMIN_DISPLAY_NAME, 'admin', process.env.ADMIN_PASSWORD, now)
      : makeUser('admin', 'Admin', 'admin', 'Admin@123456', now);
    const initialUsers = [admin];
    if (!IS_PRODUCTION) initialUsers.push(makeUser('creator_test', 'Test Creator', 'creator', 'Creator@123456', now));
    saveRows(FILES.users, initialUsers);
  }
  const levels = readRows(FILES.levels); let chartChanged = false; const placed = [];
  for (const row of levels) { if (!row.chart) { row.chart = chartPlacement(placed, row.id); chartChanged = true; } placed.push(row); }
  if (chartChanged) saveRows(FILES.levels, levels);
}

function validateConfiguration() {
  if (!Number.isInteger(PORT) || PORT < 1 || PORT > 65535) throw new Error('PORT must be an integer between 1 and 65535.');
  if (!IS_PRODUCTION) return;
  const account = String(process.env.ADMIN_ACCOUNT || '');
  const displayName = String(process.env.ADMIN_DISPLAY_NAME || '').trim();
  const password = String(process.env.ADMIN_PASSWORD || '');
  if (!/^[a-z0-9_.-]{4,32}$/i.test(account)) throw new Error('ADMIN_ACCOUNT must be 4-32 letters, numbers, dots, underscores, or hyphens.');
  if (displayName.length < 2 || displayName.length > 20) throw new Error('ADMIN_DISPLAY_NAME must be 2-20 characters.');
  if (password.length < 12) throw new Error('ADMIN_PASSWORD must contain at least 12 characters.');
}

function hashPassword(password, salt = crypto.randomBytes(16).toString('hex')) {
  return { salt, hash: crypto.scryptSync(String(password), salt, 32).toString('hex') };
}

function makeUser(account, displayName, role, password, createdAt = new Date().toISOString()) {
  return { id: crypto.randomBytes(7).toString('base64url'), account, displayName, role, password: hashPassword(password), active: true, createdAt };
}

function passwordMatches(input, record) {
  if (!record?.salt || !record?.hash) return false;
  const actual = Buffer.from(crypto.scryptSync(String(input), record.salt, 32).toString('hex'));
  const expected = Buffer.from(record.hash);
  return actual.length === expected.length && crypto.timingSafeEqual(actual, expected);
}

function readBody(req, limit = 6200000) {
  return new Promise((resolve, reject) => {
    let raw = ''; let exceeded = false;
    req.on('data', (chunk) => {
      raw += chunk;
      if (raw.length > limit) { exceeded = true; reject(new Error('payload_too_large')); req.destroy(); }
    });
    req.on('end', () => {
      if (exceeded) return;
      try { resolve(JSON.parse(raw || '{}')); } catch { reject(new Error('invalid_json')); }
    });
    req.on('error', reject);
  });
}

function cleanText(value, max) {
  return String(value || '').replace(/[<>\u0000-\u001f]/g, '').trim().slice(0, max);
}

function normalizedPublicText(value) {
  return String(value || '').normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '');
}

function containsBlockedTerm(value) {
  const normalized = normalizedPublicText(value);
  return BLOCKED_PUBLIC_TERMS.some((term) => normalized.includes(normalizedPublicText(term)))
    || /(?:vx|v信|微.{0,2}信|q群|扣扣)[a-z0-9]{4,}/i.test(String(value || ''));
}

function number(value, min, max, fallback) {
  const parsed = Number(value);
  return Math.max(min, Math.min(max, Number.isFinite(parsed) ? parsed : fallback));
}

function safeId(value, prefix) {
  const cleaned = String(value || '').replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 36);
  return cleaned || `${prefix}-${crypto.randomBytes(4).toString('hex')}`;
}

function validateBossMotion(input) {
  const source = input && typeof input === 'object' ? input : {};
  const pathPoints = Array.isArray(source.path) ? source.path.slice(0, 40).map((point) => ({
    x: number(point?.x, 8, 92, 50), y: number(point?.y, 6, 58, 18),
  })) : [];
  return {
    mode: BOSS_MOTION_MODES.has(source.mode) ? source.mode : 'hover',
    speed: number(source.speed, .2, 3, .8),
    rangeX: number(source.rangeX, 0, 42, 18),
    rangeY: number(source.rangeY, 0, 28, 5),
    path: pathPoints,
  };
}

const BUILTIN_CHART_POINTS = [[900, 1100], [1250, 700], [1600, 1050], [2050, 680], [1150, 1500], [1650, 1450], [2100, 1420], [2500, 1080]];

function chartPlacement(levels, id) {
  const occupied = [...BUILTIN_CHART_POINTS, ...levels.map((row) => row.chart).filter(Boolean).map((point) => [point.x, point.y])];
  const digest = crypto.createHash('sha256').update(String(id)).digest();
  for (let attempt = 0; attempt < 48; attempt++) {
    const x = 470 + ((digest[(attempt * 2) % digest.length] * 37 + attempt * 173) % 2460);
    const y = 360 + ((digest[(attempt * 2 + 1) % digest.length] * 29 + attempt * 127) % 1480);
    if (occupied.every(([ox, oy]) => Math.hypot(x - ox, y - oy) >= 245)) return { x, y, variant: digest[2] % 5 };
  }
  return { x: 520 + digest[0] / 255 * 2360, y: 390 + digest[1] / 255 * 1420, variant: digest[2] % 5 };
}

function validateParams(input, accent) {
  const p = input && typeof input === 'object' ? input : {};
  const color = /^#[0-9a-f]{6}$/i.test(p.color || '') ? p.color.toUpperCase() : accent;
  const pathPoints = Array.isArray(p.path) ? p.path.slice(0, 32).map((point) => ({
    x: number(point?.x, 0, 100, 50), y: number(point?.y, 0, 100, 20),
  })) : [];
  return {
    x: number(p.x, 0, 100, 50), y: number(p.y, 0, 100, 18),
    size: number(p.size, 2, 24, 6), angle: number(p.angle, -360, 360, 90),
    speed: number(p.speed, 20, 420, 120), count: Math.round(number(p.count, 1, 80, 18)),
    spread: number(p.spread, 0, 360, 360), rate: number(p.rate, .08, 8, 1.2),
    color, shape: SHAPES.has(p.shape) ? p.shape : 'orb',
    motion: MOTIONS.has(p.motion) ? p.motion : 'straight',
    formation: FORMATIONS.has(p.formation) ? p.formation : 'radial',
    sides: Math.round(number(p.sides, 3, 12, 5)), aim: p.aim === true, path: pathPoints,
  };
}

function validateClip(input, accent, index) {
  const clip = input && typeof input === 'object' ? input : {};
  const patternId = PATTERNS.has(String(clip.patternId)) ? String(clip.patternId) : 'custom-emitter';
  return {
    id: safeId(clip.id, `clip${index}`), patternId,
    name: cleanText(clip.name, 28) || '未命名弹幕片段',
    start: number(clip.start, 0, 119.5, 0), duration: number(clip.duration, .5, 120, 4),
    params: validateParams(clip.params, accent),
  };
}

function legacyPhases(source, accent) {
  const ids = Array.isArray(source.skills) ? source.skills.map(String).filter((id) => PATTERNS.has(id)).slice(0, 12) : [];
  const clips = ids.map((patternId, index) => validateClip({ patternId, name: patternId, start: index * 6, duration: 6, params: { color: accent } }, accent, index));
  return [{ id: 'phase-1', name: '第一阶段', hp: number(source.bossHp, 1000, 999999, 12000), duration: Math.max(12, clips.length * 6), transition: 'scan', tracks: [{ id: 'track-1', name: '主弹幕', clips }] }];
}

function validateLevel(input) {
  const source = input && typeof input === 'object' ? input : {};
  const planetName = cleanText(source.planetName, 24);
  const description = cleanText(source.description, 240);
  const bossName = cleanText(source.bossName, 30);
  const clearQuote = cleanText(source.clearQuote, 100);
  const difficulty = Math.round(number(source.difficulty, 1, 10, 1));
  const accent = /^#[0-9a-f]{6}$/i.test(source.accent || '') ? source.accent.toUpperCase() : '#57F0E4';
  const rawPhases = Array.isArray(source.phases) && source.phases.length ? source.phases.slice(0, 8) : legacyPhases(source, accent);
  let clipCount = 0;
  const phases = rawPhases.map((phase, phaseIndex) => {
    const duration = number(phase?.duration, 6, 120, 24);
    const rawTracks = Array.isArray(phase?.tracks) ? phase.tracks.slice(0, 6) : [];
    const tracks = rawTracks.map((track, trackIndex) => {
      const clips = Array.isArray(track?.clips) ? track.clips.slice(0, Math.max(0, 60 - clipCount)).map((clip, clipIndex) => validateClip(clip, accent, clipIndex)) : [];
      clips.forEach((clip) => { clip.start = Math.min(clip.start, duration - .25); clip.duration = Math.min(clip.duration, duration - clip.start); });
      clipCount += clips.length;
      return { id: safeId(track?.id, `track${trackIndex}`), name: cleanText(track?.name, 20) || `轨道 ${trackIndex + 1}`, clips };
    }).filter((track) => track.clips.length || rawTracks.length <= 3);
    return {
      id: safeId(phase?.id, `phase${phaseIndex}`), name: cleanText(phase?.name, 30) || `阶段 ${phaseIndex + 1}`,
      hp: Math.round(number(phase?.hp, 1000, 500000, 8000)), duration,
      transition: TRANSITIONS.has(phase?.transition) ? phase.transition : 'scan',
      tracks: tracks.length ? tracks : [{ id: `track-${phaseIndex}-1`, name: '主弹幕', clips: [] }],
    };
  });
  const dialogue = Array.isArray(source.dialogue) ? source.dialogue.slice(0, 20).map((line) => ({
    speaker: cleanText(line?.speaker, 24) || '旁白', text: cleanText(line?.text, 180),
  })).filter((line) => line.text) : [];
  let bossImage = typeof source.bossImage === 'string' ? source.bossImage : '';
  if (bossImage && (!/^data:image\/(?:png|jpeg|webp);base64,/i.test(bossImage) || bossImage.length > 1750000)) bossImage = '';
  const musicSource = source.music && typeof source.music === 'object' ? source.music : {};
  const musicTrack = MUSIC_TRACKS.has(musicSource.track) ? musicSource.track : 'anime-flight';
  let musicData = typeof musicSource.data === 'string' ? musicSource.data : '';
  if (musicData && (!/^data:audio\/(?:ogg|mpeg|wav|webm);base64,/i.test(musicData) || musicData.length > 2300000)) musicData = '';
  const music = { mode: musicData ? 'custom' : 'built-in', track: musicTrack, name: cleanText(musicSource.name, 80) || musicTrack, data: musicData };
  if (planetName.length < 2 || description.length < 8 || bossName.length < 2 || !dialogue.length || !clipCount) throw new Error('invalid_level');
  const skills = [...new Set(phases.flatMap((phase) => phase.tracks.flatMap((track) => track.clips.map((clip) => clip.patternId))))];
  return {
    version: 2, planetName, description, difficulty, accent, allowCheat: source.allowCheat !== false,
    bossName, bossHp: phases.reduce((sum, phase) => sum + phase.hp, 0), bossImage, bossMotion: validateBossMotion(source.bossMotion), phases, skills,
    dialogue, clearQuote, music, author: cleanText(source.author, 20) || '匿名创作者',
  };
}

function levelSummary(row) {
  const clips = row.level.phases?.flatMap((phase) => phase.tracks.flatMap((track) => track.clips)) || [];
  return {
    id: row.id, planetName: row.level.planetName, description: row.level.description,
    difficulty: row.level.difficulty, accent: row.level.accent, author: row.level.author,
    skillCount: clips.length, phaseCount: row.level.phases?.length || 1, createdAt: row.createdAt,
    chart: row.chart || chartPlacement([], row.id),
    playUrl: `/play.html?type=level&id=${encodeURIComponent(row.id)}`,
  };
}

function bearer(req) {
  const value = String(req.headers.authorization || '');
  return value.startsWith('Bearer ') ? value.slice(7) : '';
}

function currentUser(req) {
  const token = bearer(req); const session = sessions.get(token);
  if (!session || session.expiresAt < Date.now()) { if (token) sessions.delete(token); return null; }
  if (session.revokedReason) { sessions.delete(token); return null; }
  const user = readRows(FILES.users).find((item) => item.id === session.userId && item.active);
  if (!user) sessions.delete(token);
  return user || null;
}

function revokeUserSessions(userId) {
  for (const session of sessions.values()) if (session.userId === userId) session.revokedReason = 'account_disabled';
}

function rejectRevokedSession(req, res) {
  const token = bearer(req); const session = sessions.get(token);
  if (session?.revokedReason !== 'account_disabled') return false;
  sessions.delete(token); send(res, 403, { error: 'account_disabled', message: '该创作者账号已被管理员停用，当前工坊会话已结束' }); return true;
}

function requireUser(req, res, roles) {
  if (rejectRevokedSession(req, res)) return null;
  const user = currentUser(req);
  if (!user || (roles && !roles.includes(user.role))) { send(res, 401, { error: 'unauthorized', message: '账号验证已失效，请重新登录' }); return null; }
  return user;
}

function publicUser(user) {
  return { id: user.id, account: user.account, displayName: user.displayName, role: user.role, active: user.active, disabledAt: user.disabledAt || null, createdAt: user.createdAt };
}

function addMail(userId, title, body, type = 'system') {
  const rows = readRows(FILES.mail);
  rows.push({ id: crypto.randomBytes(7).toString('base64url'), userId, title: cleanText(title, 60), body: cleanText(body, 360), type, createdAt: new Date().toISOString(), readAt: null });
  saveRows(FILES.mail, rows.slice(-1000));
}

async function handleAuth(req, res, url) {
  if (url.pathname === '/api/auth/me' && req.method === 'GET') {
    if (rejectRevokedSession(req, res)) return;
    const user = currentUser(req); return user ? send(res, 200, { user: publicUser(user) }) : send(res, 401, { error: 'unauthorized' });
  }
  if (url.pathname === '/api/auth/logout' && req.method === 'POST') { sessions.delete(bearer(req)); return send(res, 200, { ok: true }); }
  if (url.pathname !== '/api/auth/login' || req.method !== 'POST') return send(res, 405, { error: 'method_not_allowed' });
  try {
    const input = await readBody(req, 20000); const account = cleanText(input.account, 32).toLowerCase();
    const user = readRows(FILES.users).find((item) => item.account.toLowerCase() === account);
    if (!user || !passwordMatches(input.password, user.password)) return send(res, 401, { error: 'invalid_credentials', message: '账号或密码不正确' });
    if (!user.active) return send(res, 403, { error: 'account_disabled', message: '该创作者账号已被管理员停用，无法进入工坊' });
    const token = crypto.randomBytes(28).toString('base64url'); sessions.set(token, { userId: user.id, expiresAt: Date.now() + 7 * 86400000 });
    return send(res, 200, { token, user: publicUser(user) });
  } catch { return send(res, 400, { error: 'invalid_request' }); }
}

async function handleLevels(req, res, url) {
  const id = url.pathname.match(/^\/api\/levels\/([a-zA-Z0-9_-]+)$/)?.[1];
  if (req.method === 'GET' && id) {
    const row = readRows(FILES.levels).find((item) => item.id === id);
    return row ? send(res, 200, { level: row.level, id: row.id, createdAt: row.createdAt }) : send(res, 404, { error: 'level_not_found', message: '这个玩家关卡不存在' });
  }
  if (req.method === 'GET') {
    const levels = readRows(FILES.levels).sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 100).map(levelSummary);
    return send(res, 200, { levels });
  }
  return send(res, 403, { error: 'review_required', message: '公开关卡必须通过创作者工坊提交审核' });
}

async function handleShares(req, res, url) {
  const id = url.pathname.match(/^\/api\/shares\/([a-zA-Z0-9_-]+)$/)?.[1];
  if (req.method === 'GET' && id) {
    const now = Date.now(); const rows = readRows(FILES.shares); const active = rows.filter((item) => Date.parse(item.expiresAt) > now);
    if (active.length !== rows.length) saveRows(FILES.shares, active);
    const row = active.find((item) => item.id === id);
    return row ? send(res, 200, { level: row.level, id: row.id, expiresAt: row.expiresAt }) : send(res, 404, { error: 'share_expired', message: '这个临时链接不存在或已经失效' });
  }
  if (req.method !== 'POST') return send(res, 405, { error: 'method_not_allowed' });
  const user = requireUser(req, res, ['creator', 'admin']); if (!user) return;
  try {
    const input = await readBody(req); const level = validateLevel(input.level); level.author = user.displayName;
    const hours = Math.round(number(input.expiresInHours, 1, 720, 24));
    const rows = readRows(FILES.shares).filter((item) => Date.parse(item.expiresAt) > Date.now()); const idValue = crypto.randomBytes(8).toString('base64url');
    const expiresAt = new Date(Date.now() + hours * 3600000).toISOString(); rows.push({ id: idValue, level, creatorId: user.id, createdAt: new Date().toISOString(), expiresAt });
    saveRows(FILES.shares, rows.slice(-500));
    return send(res, 201, { ok: true, id: idValue, expiresAt, playUrl: `/play.html?type=share&id=${idValue}` });
  } catch (error) { return send(res, error.message === 'payload_too_large' ? 413 : 400, { error: error.message, message: '关卡资料不完整或格式无效' }); }
}

async function handleReviews(req, res, url) {
  const user = requireUser(req, res, ['creator', 'admin']); if (!user) return;
  if (url.pathname === '/api/reviews/mine' && req.method === 'GET') {
    const reviews = readRows(FILES.reviews).filter((row) => row.creatorId === user.id).sort((a, b) => b.createdAt.localeCompare(a.createdAt)).map((row) => ({ id: row.id, planetName: row.level.planetName, status: row.status, reason: row.reason || '', createdAt: row.createdAt, updatedAt: row.updatedAt, publishedLevelId: row.publishedLevelId || '' }));
    return send(res, 200, { reviews });
  }
  if (url.pathname !== '/api/reviews' || req.method !== 'POST') return send(res, 405, { error: 'method_not_allowed' });
  try {
    const input = await readBody(req); const level = validateLevel(input.level); level.author = user.displayName;
    const rows = readRows(FILES.reviews); const now = new Date().toISOString(); const id = crypto.randomBytes(7).toString('base64url');
    rows.push({ id, creatorId: user.id, creatorAccount: user.account, level, status: 'pending', reason: '', createdAt: now, updatedAt: now });
    saveRows(FILES.reviews, rows.slice(-500));
    addMail(user.id, `《${level.planetName}》已进入审核`, '关卡已经发送给管理员。审核完成后，结果会自动投递到这里。', 'review');
    return send(res, 201, { ok: true, id, message: '已发送，请等待审核' });
  } catch (error) { return send(res, error.message === 'payload_too_large' ? 413 : 400, { error: error.message, message: '关卡资料不完整或格式无效' }); }
}

async function handleInbox(req, res) {
  if (req.method === 'POST' && req.url.startsWith('/api/inbox/read')) {
    const user = requireUser(req, res, ['creator', 'admin']); if (!user) return;
    try {
      const input = await readBody(req, 10000); const id = cleanText(input.id, 32); const rows = readRows(FILES.mail);
      const mail = rows.find((item) => item.id === id && item.userId === user.id);
      if (!mail) return send(res, 404, { error: 'not_found', message: '邮件不存在' });
      mail.readAt = mail.readAt || new Date().toISOString(); saveRows(FILES.mail, rows); return send(res, 200, { ok: true, readAt: mail.readAt });
    } catch { return send(res, 400, { error: 'invalid_request', message: '无法更新邮件状态' }); }
  }
  if (req.method !== 'GET') return send(res, 405, { error: 'method_not_allowed' });
  const announcements = readRows(FILES.announcements).sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 30);
  const user = currentUser(req);
  const messages = user ? readRows(FILES.mail).filter((item) => item.userId === user.id).sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 50) : [];
  return send(res, 200, { announcements, messages, user: user ? publicUser(user) : null });
}

async function handleAdmin(req, res, url) {
  const admin = requireUser(req, res, ['admin']); if (!admin) return;
  if (url.pathname === '/api/admin/dashboard' && req.method === 'GET') {
    return send(res, 200, {
      users: readRows(FILES.users).map(publicUser), reviews: readRows(FILES.reviews).sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
      announcements: readRows(FILES.announcements).sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
      levels: readRows(FILES.levels).sort((a, b) => b.createdAt.localeCompare(a.createdAt)).map(levelSummary),
    });
  }
  if (url.pathname === '/api/admin/users' && req.method === 'POST') {
    try {
      const input = await readBody(req, 30000); const account = cleanText(input.account, 32).toLowerCase(); const password = String(input.password || ''); const displayName = cleanText(input.displayName, 20);
      const rows = readRows(FILES.users);
      if (!/^[a-z0-9_.-]{4,32}$/.test(account) || password.length < 8 || displayName.length < 2 || containsBlockedTerm(displayName) || rows.some((item) => item.account.toLowerCase() === account)) return send(res, 400, { error: 'invalid_user', message: '账号或显示名称不符合公开展示规则，请修改后重试' });
      const user = makeUser(account, displayName, 'creator', password); rows.push(user); saveRows(FILES.users, rows); addMail(user.id, '创作者资格已开通', '你的创作者账号已经开通，可以登录星环工坊开始制作关卡。', 'account');
      return send(res, 201, { ok: true, user: publicUser(user) });
    } catch { return send(res, 400, { error: 'invalid_request' }); }
  }
  const userId = url.pathname.match(/^\/api\/admin\/users\/([a-zA-Z0-9_-]+)$/)?.[1];
  if (userId && req.method === 'PATCH') {
    try {
      const input = await readBody(req, 30000); const rows = readRows(FILES.users); const user = rows.find((item) => item.id === userId && item.role === 'creator');
      if (!user) return send(res, 404, { error: 'user_not_found' });
      if (typeof input.active === 'boolean') { user.active = input.active; user.disabledAt = user.active ? null : new Date().toISOString(); if (!user.active) revokeUserSessions(user.id); }
      if (cleanText(input.displayName, 20).length >= 2) {
        if (containsBlockedTerm(input.displayName)) return send(res, 400, { error: 'blocked_name', message: '显示名称包含不适合公开展示的内容' });
        user.displayName = cleanText(input.displayName, 20);
      }
      if (String(input.newPassword || '').length >= 8) user.password = hashPassword(input.newPassword);
      saveRows(FILES.users, rows); return send(res, 200, { ok: true, user: publicUser(user) });
    } catch { return send(res, 400, { error: 'invalid_request' }); }
  }
  const reviewAction = url.pathname.match(/^\/api\/admin\/reviews\/([a-zA-Z0-9_-]+)\/(approve|reject|preview)$/);
  if (reviewAction && req.method === 'POST') {
    const [, id, action] = reviewAction; const rows = readRows(FILES.reviews); const review = rows.find((item) => item.id === id);
    if (!review) return send(res, 404, { error: 'review_not_found' });
    if (action === 'preview') {
      const shares = readRows(FILES.shares).filter((item) => Date.parse(item.expiresAt) > Date.now()); const shareId = crypto.randomBytes(8).toString('base64url'); const expiresAt = new Date(Date.now() + 2 * 3600000).toISOString();
      shares.push({ id: shareId, level: review.level, creatorId: review.creatorId, createdAt: new Date().toISOString(), expiresAt, reviewId: review.id }); saveRows(FILES.shares, shares.slice(-500));
      return send(res, 201, { ok: true, playUrl: `/play.html?type=share&id=${shareId}` });
    }
    const input = await readBody(req, 30000); const now = new Date().toISOString(); review.updatedAt = now;
    if (action === 'approve') {
      if (!review.publishedLevelId) {
        const levels = readRows(FILES.levels); const levelId = crypto.randomBytes(6).toString('base64url');
        levels.push({ id: levelId, level: review.level, reviewId: review.id, chart: chartPlacement(levels, levelId), createdAt: now }); saveRows(FILES.levels, levels.slice(-300)); review.publishedLevelId = levelId;
      }
      review.status = 'approved'; review.reason = cleanText(input.note, 240);
      addMail(review.creatorId, `《${review.level.planetName}》审核通过`, `关卡已公开到玩家星图。${review.reason || '感谢你的创作。'}`, 'approved');
    } else {
      review.status = 'rejected'; review.reason = cleanText(input.reason, 240) || '关卡仍需要调整，请修改后重新提交。';
      addMail(review.creatorId, `《${review.level.planetName}》审核未通过`, review.reason, 'rejected');
    }
    saveRows(FILES.reviews, rows); return send(res, 200, { ok: true, status: review.status, publishedLevelId: review.publishedLevelId || '' });
  }
  if (url.pathname === '/api/admin/announcements' && req.method === 'POST') {
    const input = await readBody(req, 50000); const title = cleanText(input.title, 60); const body = cleanText(input.body, 500);
    if (title.length < 2 || body.length < 4) return send(res, 400, { error: 'invalid_announcement' });
    const rows = readRows(FILES.announcements); const row = { id: crypto.randomBytes(7).toString('base64url'), title, body, author: admin.displayName, createdAt: new Date().toISOString() };
    rows.push(row); saveRows(FILES.announcements, rows.slice(-100)); return send(res, 201, { ok: true, announcement: row });
  }
  const announcementId = url.pathname.match(/^\/api\/admin\/announcements\/([a-zA-Z0-9_-]+)$/)?.[1];
  if (announcementId && req.method === 'DELETE') { saveRows(FILES.announcements, readRows(FILES.announcements).filter((item) => item.id !== announcementId)); return send(res, 200, { ok: true }); }
  const levelId = url.pathname.match(/^\/api\/admin\/levels\/([a-zA-Z0-9_-]+)$/)?.[1];
  if (levelId && req.method === 'DELETE') { saveRows(FILES.levels, readRows(FILES.levels).filter((item) => item.id !== levelId)); return send(res, 200, { ok: true }); }
  return send(res, 404, { error: 'admin_route_not_found' });
}

function handleRankings(req, res, url) {
  if (req.method === 'GET') {
    const galaxy = url.searchParams.get('galaxy') || 'all';
    const rows = readRows(FILES.rankings).filter((row) => !containsBlockedTerm(row.name) && (galaxy === 'all' || row.galaxy === galaxy)).sort((a, b) => b.score - a.score || a.createdAt.localeCompare(b.createdAt)).slice(0, 50).map(({ name, score, galaxy: target, maxCombo, createdAt }) => ({ name, score, galaxy: target, maxCombo, createdAt }));
    return send(res, 200, { rankings: rows, galaxy });
  }
  if (req.method !== 'POST') return send(res, 405, { error: 'method_not_allowed' });
  let raw = '';
  req.on('data', (chunk) => { raw += chunk; if (raw.length > 8192) req.destroy(); });
  req.on('end', () => {
    try {
      const input = JSON.parse(raw || '{}'); const name = cleanText(input.name, 14); const galaxy = String(input.galaxy || '');
      const score = Math.round(number(input.score, 0, 999999999, 0)); const maxCombo = Math.round(number(input.maxCombo, 0, 999999, 0));
      if (name.length < 2 || containsBlockedTerm(name)) return send(res, 400, { error: 'blocked_name', message: '昵称包含不适合公开展示的内容，请修改' });
      if (!GALAXIES.has(galaxy) || !score || input.visible !== true || input.eligible !== true || input.debugUsed === true) return send(res, 400, { error: 'invalid_ranking' });
      const rows = readRows(FILES.rankings); const key = `${name.toLocaleLowerCase('zh-CN')}::${galaxy}`; const existing = rows.find((row) => `${row.name.toLocaleLowerCase('zh-CN')}::${row.galaxy}` === key);
      if (existing) { if (score > existing.score) Object.assign(existing, { score, maxCombo, createdAt: new Date().toISOString() }); }
      else rows.push({ name, galaxy, score, maxCombo, createdAt: new Date().toISOString() });
      saveRows(FILES.rankings, rows); return send(res, 201, { ok: true });
    } catch { return send(res, 400, { error: 'invalid_json' }); }
  });
}

function serveStatic(req, res, url) {
  const requested = decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname);
  const file = path.resolve(ROOT, `.${requested}`);
  if (file !== ROOT && !file.startsWith(`${ROOT}${path.sep}`)) return send(res, 403, 'Forbidden', 'text/plain; charset=utf-8');
  fs.stat(file, (error, stat) => {
    if (error || !stat.isFile()) return send(res, 404, 'Not found', 'text/plain; charset=utf-8');
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
    fs.createReadStream(file).pipe(res);
  });
}

validateConfiguration();
ensureData();
const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  if (url.pathname === '/api/health' && req.method === 'GET') {
    return send(res, 200, { ok: true, uptime: Math.round(process.uptime()), timestamp: new Date().toISOString() });
  }
  if (url.pathname.startsWith('/api/auth/')) return handleAuth(req, res, url);
  if (url.pathname === '/api/inbox' || url.pathname === '/api/inbox/read') return handleInbox(req, res);
  if (url.pathname === '/api/rankings') return handleRankings(req, res, url);
  if (url.pathname === '/api/levels' || url.pathname.startsWith('/api/levels/')) return handleLevels(req, res, url);
  if (url.pathname === '/api/shares' || url.pathname.startsWith('/api/shares/')) return handleShares(req, res, url);
  if (url.pathname === '/api/reviews' || url.pathname === '/api/reviews/mine') return handleReviews(req, res, url);
  if (url.pathname.startsWith('/api/admin/')) return handleAdmin(req, res, url);
  return serveStatic(req, res, url);
});

server.listen(PORT, HOST, () => console.log(`Star Ring server running at http://${HOST}:${PORT}/ (data: ${DATA_DIR})`));

function shutdown(signal) {
  console.log(`${signal} received, closing server...`);
  server.close((error) => {
    if (error) { console.error(error); process.exit(1); }
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 10000).unref();
}

process.once('SIGTERM', () => shutdown('SIGTERM'));
process.once('SIGINT', () => shutdown('SIGINT'));
