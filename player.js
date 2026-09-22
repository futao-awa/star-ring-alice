(function () {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const params = new URLSearchParams(location.search);
  const isPublishedLevel = params.get('type') === 'level';
  let level = null;
  let engine = null;
  let dialogueIndex = 0;
  let monitor = 0;
  let invincible = false;
  const musicPlayer = new window.OrbitMusic.OrbitMusicPlayer();

  function configureBackLinks() {
    const href = isPublishedLevel ? '/?chart=1' : '/editor.html'; const label = isPublishedLevel ? '返回星图' : '返回工坊';
    for (const id of ['headerBackLink', 'resultBackLink', 'errorBackLink']) { const link = $(id); link.href = href; link.textContent = id === 'headerBackLink' ? '←' : label; link.setAttribute('aria-label', label); }
  }

  async function load() {
    try {
      if (params.get('draft') === '1') level = JSON.parse(localStorage.getItem('orbit-lab-draft-v2') || localStorage.getItem('orbit-lab-draft') || 'null');
      else {
        const id = params.get('id'); const type = params.get('type') === 'share' ? 'shares' : 'levels';
        if (!id) throw new Error('缺少关卡编号');
        const response = await fetch(`/api/${type}/${encodeURIComponent(id)}`); const result = await response.json();
        if (!response.ok) throw new Error(result.message || '这个关卡不存在或链接已经失效');
        level = result.level;
      }
      const hasTimeline = Array.isArray(level?.phases) && level.phases.some((phase) => phase.tracks?.some((track) => track.clips?.length));
      const hasLegacySkills = Array.isArray(level?.skills) && level.skills.length;
      if (!level || (!hasTimeline && !hasLegacySkills)) throw new Error('关卡数据不完整');
      applyLevel();
    } catch (error) {
      $('missionBrief').classList.add('hidden'); $('errorPanel').classList.remove('hidden'); $('errorText').textContent = error.message || '无法载入关卡';
    }
  }

  function applyLevel() {
    document.documentElement.style.setProperty('--accent', level.accent || '#57f0e4');
    document.title = `${level.planetName} // ${isPublishedLevel ? '玩家星图' : '星环工坊'}`;
    $('headerTitle').textContent = level.planetName;
    $('authorLabel').textContent = `CREATOR // ${level.author || '匿名指挥官'}`;
    $('threatLabel').textContent = `DANGER // ${String(level.difficulty || 1).padStart(2, '0')}`;
    $('planetTitle').textContent = level.planetName;
    $('planetDescription').textContent = level.description;
    $('bossLabel').textContent = level.bossName;
    const clipCount = Array.isArray(level.phases) ? level.phases.reduce((sum, phase) => sum + (phase.tracks || []).reduce((trackSum, track) => trackSum + (track.clips || []).length, 0), 0) : (level.skills || []).length;
    $('skillLabel').textContent = `${level.phases?.length || 1} 阶段 · ${clipCount} 个片段`;
    $('cheatLabel').textContent = level.allowCheat === false ? '作者已禁用' : '允许调试';
    musicPlayer.configure(level.music || { mode: 'built-in', track: 'anime-flight' });
    $('beginBtn').disabled = false;
  }

  function showDialogue() {
    const lines = Array.isArray(level.dialogue) ? level.dialogue : [];
    if (dialogueIndex >= lines.length) { $('dialogueLayer').classList.add('hidden'); startBattle(); return; }
    $('dialogueSpeaker').textContent = lines[dialogueIndex].speaker || '旁白'; $('dialogueText').textContent = lines[dialogueIndex].text || '';
  }

  function startBattle() {
    $('battleLayer').classList.remove('hidden');
    engine?.stop(); engine = new window.BarrageLab.BarrageEngine($('battleCanvas'), { preview: false, config: level }); engine.start();
    $('cheatBtn').classList.toggle('hidden', level.allowCheat === false);
    clearInterval(monitor); monitor = setInterval(() => {
      if (!engine) return;
      if (invincible) engine.player.hp = engine.player.maxHp;
      if (engine.status === 'CLEAR') finish(true);
      else if (engine.status === 'FAILED') finish(false);
    }, 120);
  }

  function finish(won) {
    clearInterval(monitor); engine?.stop(); musicPlayer.stop(); $('resultLayer').classList.remove('hidden');
    $('resultKicker').textContent = won ? 'MISSION COMPLETE' : 'MISSION FAILED';
    $('resultTitle').textContent = won ? '星门已恢复' : '航路同步失败';
    $('resultQuote').textContent = won ? (level.clearQuote || '自制星球攻略完成。') : '再观察一次技能顺序，规则型弹幕总会留下可以利用的安全窗口。';
  }

  $('beginBtn').addEventListener('click', () => { musicPlayer.start(); $('missionBrief').classList.add('hidden'); $('dialogueLayer').classList.remove('hidden'); dialogueIndex = 0; showDialogue(); });
  $('dialogueBox').addEventListener('click', () => { dialogueIndex += 1; showDialogue(); });
  $('cheatBtn').addEventListener('click', () => { invincible = !invincible; $('cheatBtn').classList.toggle('active', invincible); $('cheatBtn').textContent = `调试无敌：${invincible ? '开' : '关'}`; });
  $('retryBtn').addEventListener('click', () => { $('resultLayer').classList.add('hidden'); startBattle(); });
  configureBackLinks(); load();
})();
