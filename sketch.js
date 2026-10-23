const NAMES_STORAGE_KEY = 'classroom-lottery-names';
const MAX_ROSTER_SIZE = 10000;

let participants = [];
let drawnIds = new Set();
let drawHistory = [];
let isDrawing = false;
let confettiParticles = [];
let lastPoolSignature = '';
let audioContext;
let appMode = 'draw';
let currentGroups = [];
const avatarImageCache = new Map();

function setup() {
  const canvas = createCanvas(windowWidth, windowHeight);
  canvas.addClass('confetti-canvas');
  pixelDensity(1);
  noLoop();
  buildApp();
}

function draw() {
  clear();

  for (let index = confettiParticles.length - 1; index >= 0; index -= 1) {
    const particle = confettiParticles[index];
    particle.x += particle.vx;
    particle.y += particle.vy;
    particle.vy += 0.12;
    particle.rotation += particle.rotationSpeed;
    particle.life -= 1;

    push();
    translate(particle.x, particle.y);
    rotate(particle.rotation);
    noStroke();
    fill(particle.color);
    rectMode(CENTER);
    rect(0, 0, particle.size, particle.size * 0.62, 2);
    pop();

    if (particle.life <= 0 || particle.y > height + 24) {
      confettiParticles.splice(index, 1);
    }
  }

  if (confettiParticles.length === 0) {
    noLoop();
  }
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
}

function buildApp() {
  const savedNames = loadSavedNames();
  document.body.innerHTML = `
    <main class="app-shell">
      <header class="topbar">
        <a class="brand" href="#" aria-label="班級抽籤機首頁">
          <span class="brand-icon" aria-hidden="true">✦</span>
          <span>班級抽籤機</span>
        </a>
        <span class="topbar-note"><span class="live-dot"></span> CLASSROOM MODE</span>
      </header>

      <section class="intro" aria-labelledby="page-title">
        <p class="eyebrow">公平・簡單・有趣</p>
        <h1 id="page-title">班級抽籤機</h1>
        <p class="intro-copy">準備好名單，讓好運決定今天的主角。</p>
      </section>

      <div class="activity-switch" role="tablist" aria-label="功能模式">
        <button class="activity-tab is-active" type="button" role="tab" aria-selected="true" data-activity="draw">🎯 個人抽籤</button>
        <button class="activity-tab" type="button" role="tab" aria-selected="false" data-activity="group">👥 隨機分組</button>
      </div>

      <div class="main-grid">
        <section class="panel setup-panel" aria-labelledby="setup-title">
          <div class="panel-heading">
            <div>
              <p class="section-kicker">STEP 01</p>
              <h2 id="setup-title">準備抽籤名單</h2>
            </div>
            <span class="heading-icon" aria-hidden="true">☷</span>
          </div>

          <div class="mode-switch" role="tablist" aria-label="抽籤模式">
            <button class="mode-tab is-active" type="button" role="tab" aria-selected="true" data-mode="number">
              <span aria-hidden="true">#</span> 號碼模式
            </button>
            <button class="mode-tab" type="button" role="tab" aria-selected="false" data-mode="name">
              <span aria-hidden="true">☻</span> 姓名模式
            </button>
          </div>

          <div class="mode-content" id="number-mode">
            <div class="range-inputs">
              <label class="field">
                <span>起始號碼</span>
                <input id="range-start" type="number" value="1" step="1" inputmode="numeric" aria-label="起始號碼">
              </label>
              <span class="range-dash" aria-hidden="true">—</span>
              <label class="field">
                <span>結束號碼</span>
                <input id="range-end" type="number" value="30" step="1" inputmode="numeric" aria-label="結束號碼">
              </label>
            </div>
            <p class="field-hint">設定班級座號範圍，例如 1 到 30 號。</p>
          </div>

          <div class="mode-content" id="name-mode" hidden>
            <label class="field" for="names-list">
              <span>貼上學生名單</span>
              <textarea id="names-list" rows="7" placeholder="王小明,images/01.jpg&#10;陳小美,images/02.jpg&#10;林同學" spellcheck="false"></textarea>
            </label>
            <p class="field-hint">每行一位學生；可用「姓名,圖片路徑」加入大頭貼，例如 王小明,images/01.jpg。名單會自動記住在這台裝置。</p>
          </div>

          <div id="draw-controls">
            <div class="divider"></div>

            <div class="controls-row">
              <label class="field count-field" for="draw-count">
                <span>一次抽出</span>
                <div class="count-control">
                  <input id="draw-count" type="number" value="1" min="1" max="100" step="1" inputmode="numeric">
                  <span>位</span>
                </div>
              </label>

              <label class="toggle-card" for="no-repeat">
                <span class="toggle-copy">
                  <strong>不重複抽籤</strong>
                  <small>抽過就不再抽到</small>
                </span>
                <input id="no-repeat" type="checkbox" role="switch" checked>
                <span class="toggle-track" aria-hidden="true"></span>
              </label>
            </div>

            <div class="remaining-card" id="remaining-card">
              <span class="remaining-icon" aria-hidden="true">◎</span>
              <span id="remaining-label">剩餘可抽人數</span>
              <strong id="remaining-count" aria-live="polite">30</strong>
              <span class="remaining-unit">位</span>
            </div>
          </div>

          <div class="sound-toggle-row">
            <label class="toggle-card sound-toggle-card" for="sound-enabled">
              <span class="toggle-copy">
                <strong>抽籤音效</strong>
                <small id="sound-status">播放抽籤提示音與揭曉音效</small>
              </span>
              <input id="sound-enabled" type="checkbox" role="switch" checked aria-label="開啟抽籤音效">
              <span class="toggle-track" aria-hidden="true"></span>
            </label>
          </div>

          <div id="group-controls" hidden>
            <div class="divider"></div>
            <label class="field group-size-field" for="group-size">
              <span>每組人數</span>
              <div class="count-control">
                <input id="group-size" type="number" value="4" min="1" step="1" inputmode="numeric">
                <span>人／組</span>
              </div>
            </label>
            <label class="field group-strategy-field" for="group-strategy">
              <span>分組方式</span>
              <select id="group-strategy">
                <option value="random">純隨機</option>
                <option value="mixed">男女混合（平均分配）</option>
                <option value="separated">男女分開</option>
              </select>
            </label>
            <p class="field-hint group-format-hint" hidden>男女分組請在姓名後標示性別，例如：王小明 (男)。</p>
          </div>

          <label class="field exclude-field" for="exclude-list">
            <span>排除對象 <span class="optional-label">（選填）</span></span>
            <input id="exclude-list" type="text" placeholder="輸入號碼或姓名，以逗號分隔" autocomplete="off">
            <small class="field-hint">例如：5, 12，或請假學生的姓名</small>
          </label>

          <div class="message-box" id="message-box" role="status" aria-live="polite" hidden></div>

          <button class="draw-button" id="draw-button" type="button">
            <span class="draw-button-icon" aria-hidden="true">✦</span>
            <span id="draw-button-label">開始抽籤</span>
            <span class="draw-button-arrow" aria-hidden="true">→</span>
          </button>
          <p class="keyboard-hint" id="draw-hint">準備好後，按下按鈕或空白鍵開始抽籤</p>
          <button class="draw-button group-start-button" id="group-button" type="button" hidden>
            <span class="draw-button-icon" aria-hidden="true">✦</span>
            <span>開始隨機分組</span>
            <span class="draw-button-arrow" aria-hidden="true">→</span>
          </button>
          <button class="leader-batch-button" id="leaders-button" type="button" disabled hidden>
            <span aria-hidden="true">★</span> 每組各抽一位組長
          </button>
        </section>

        <section class="panel result-panel" aria-labelledby="result-title">
          <div class="panel-heading result-heading">
            <div>
              <p class="section-kicker">STEP 02</p>
              <h2 id="result-title">幸運名單</h2>
            </div>
            <button class="reset-button" id="reset-button" type="button" title="重置抽籤狀態與紀錄">
              <span aria-hidden="true">↻</span> 重置
            </button>
          </div>

          <div class="result-stage" id="result-stage">
            <div class="empty-state" id="empty-state">
              <div class="lottery-drum" aria-hidden="true"><span>?</span></div>
              <p class="empty-title">幸運兒會是誰呢？</p>
              <p class="empty-copy">按下「開始抽籤」，揭曉今天的主角</p>
            </div>
            <div class="results-list" id="results-list" aria-live="polite" aria-atomic="true" hidden></div>
            <div class="groups-list" id="groups-list" aria-live="polite" hidden></div>
          </div>

          <div class="history-heading">
            <div>
              <h3>抽籤紀錄</h3>
              <span id="history-count">尚無紀錄</span>
            </div>
            <span class="history-icon" aria-hidden="true">◷</span>
          </div>
          <ol class="history-list" id="history-list" aria-label="抽籤紀錄"></ol>
        </section>
      </div>

      <footer class="page-footer">
        <span>每一次抽籤，都是新的開始。</span>
        <span>CLASSROOM LOTTERY <span aria-hidden="true">✦</span></span>
      </footer>
    </main>
  `;

  document.getElementById('names-list').value = savedNames;
  bindEvents();
  refreshRoster();
  renderHistory();
}

function bindEvents() {
  document.querySelectorAll('.activity-tab').forEach((tab) => {
    tab.addEventListener('click', () => setActivityMode(tab.dataset.activity));
  });
  document.querySelectorAll('.mode-tab').forEach((tab) => {
    tab.addEventListener('click', () => {
      if (isDrawing) return;
      clearGroupResults();
      document.querySelectorAll('.mode-tab').forEach((item) => {
        const isActive = item === tab;
        item.classList.toggle('is-active', isActive);
        item.setAttribute('aria-selected', String(isActive));
      });
      document.querySelectorAll('.mode-content').forEach((content) => {
        content.hidden = content.id !== `${tab.dataset.mode}-mode`;
      });
      clearMessage();
      refreshRoster();
    });
  });

  ['range-start', 'range-end', 'names-list', 'exclude-list'].forEach((id) => {
    const input = document.getElementById(id);
    input.addEventListener('input', () => {
      clearMessage();
      clearGroupResults();
      if (id === 'names-list') {
        saveNames(input.value);
      }
      refreshRoster();
    });
  });

  document.getElementById('draw-count').addEventListener('input', clearMessage);
  document.getElementById('group-size').addEventListener('input', () => {
    clearMessage();
    clearGroupResults();
  });
  document.getElementById('group-strategy').addEventListener('change', (event) => {
    clearMessage();
    clearGroupResults();
    document.querySelector('.group-format-hint').hidden = event.currentTarget.value === 'random';
  });
  document.getElementById('no-repeat').addEventListener('change', () => {
    drawnIds.clear();
    clearMessage();
    showMessage('抽籤設定已更新，抽過的名單已重新計算。', 'info');
    refreshRoster();
  });
  document.getElementById('sound-enabled').addEventListener('change', (event) => {
    const enabled = event.currentTarget.checked;
    document.getElementById('sound-status').textContent = enabled
      ? '播放抽籤提示音與揭曉音效'
      : '已關閉抽籤音效';
  });
  document.getElementById('draw-button').addEventListener('click', startDraw);
  document.getElementById('group-button').addEventListener('click', startGrouping);
  document.getElementById('leaders-button').addEventListener('click', chooseAllLeaders);
  document.getElementById('reset-button').addEventListener('click', resetDraw);
  document.addEventListener('keydown', (event) => {
    if (event.code !== 'Space' || event.repeat || appMode !== 'draw' || isDrawing) return;
    const target = event.target;
    if (target instanceof HTMLElement && (
      target.isContentEditable ||
      target.matches('input, textarea, select, button, a[href], [role="switch"], [role="tab"]')
    )) {
      return;
    }
    event.preventDefault();
    startDraw();
  });
}

function setActivityMode(mode) {
  if (isDrawing || !['draw', 'group'].includes(mode)) return;
  appMode = mode;

  document.querySelectorAll('.activity-tab').forEach((tab) => {
    const active = tab.dataset.activity === mode;
    tab.classList.toggle('is-active', active);
    tab.setAttribute('aria-selected', String(active));
  });
  document.getElementById('draw-controls').hidden = mode !== 'draw';
  document.getElementById('group-controls').hidden = mode !== 'group';
  document.querySelector('.group-format-hint').hidden =
    mode !== 'group' || document.getElementById('group-strategy').value === 'random';
  document.getElementById('draw-button').hidden = mode !== 'draw';
  document.getElementById('draw-hint').hidden = mode !== 'draw';
  document.getElementById('group-button').hidden = mode !== 'group';
  document.getElementById('leaders-button').hidden = mode !== 'group';
  document.getElementById('remaining-card').hidden = mode !== 'draw';
  document.getElementById('setup-title').textContent = mode === 'draw' ? '準備抽籤名單' : '準備分組名單';
  document.getElementById('result-title').textContent = mode === 'draw' ? '幸運名單' : '分組結果';
  document.querySelector('.empty-title').textContent = mode === 'draw' ? '幸運兒會是誰呢？' : '準備好開始分組了嗎？';
  document.querySelector('.empty-copy').textContent = mode === 'draw'
    ? '按下「開始抽籤」，揭曉今天的主角'
    : '設定每組人數與分組方式，開始建立小組';

  document.getElementById('results-list').hidden = mode !== 'draw' || document.getElementById('results-list').childElementCount === 0;
  document.getElementById('groups-list').hidden = mode !== 'group' || currentGroups.length === 0;
  document.getElementById('empty-state').hidden = mode === 'draw'
    ? document.getElementById('results-list').childElementCount > 0
    : currentGroups.length > 0;
  document.getElementById('leaders-button').disabled = currentGroups.length === 0;
  clearMessage();
  refreshRoster();
}

function getCurrentMode() {
  return document.querySelector('.mode-tab.is-active').dataset.mode;
}

function getRoster() {
  if (getCurrentMode() === 'name') {
    const lines = document.getElementById('names-list').value
      .split(/\r?\n/)
      .map((name) => name.trim())
      .filter(Boolean);

    if (lines.length > MAX_ROSTER_SIZE) {
      return { entries: [], error: `名單最多可輸入 ${MAX_ROSTER_SIZE.toLocaleString()} 位，請縮小名單。` };
    }

    const names = lines.map((line) => {
      const separator = line.indexOf(',');
      const name = (separator === -1 ? line : line.slice(0, separator)).trim();
      const imageUrl = separator === -1 ? '' : line.slice(separator + 1).trim();
      return { name, imageUrl };
    }).filter((entry) => entry.name);

    return {
      entries: names.map((name, index) => ({
        id: `name:${index}`,
        value: name.name,
        displayName: getDisplayName(name.name),
        gender: getGender(name.name),
        imageUrl: name.imageUrl,
      })),
      error: names.length === 0 ? '請先貼上學生名單，每行一個姓名。' : '',
    };
  }

  const startValue = document.getElementById('range-start').value.trim();
  const endValue = document.getElementById('range-end').value.trim();
  if (!startValue || !endValue) {
    return { entries: [], error: '請輸入有效的起始與結束整數號碼。' };
  }
  const start = Number(startValue);
  const end = Number(endValue);
  if (!Number.isInteger(start) || !Number.isInteger(end)) {
    return { entries: [], error: '請輸入有效的起始與結束整數號碼。' };
  }
  if (end < start) {
    return { entries: [], error: '結束號碼不能小於起始號碼，請檢查號碼範圍。' };
  }
  if (end - start + 1 > MAX_ROSTER_SIZE) {
    return { entries: [], error: `號碼範圍最多 ${MAX_ROSTER_SIZE.toLocaleString()} 位，請縮小範圍。` };
  }

  const entries = [];
  for (let number = start; number <= end; number += 1) {
    entries.push({ id: `number:${number}`, value: String(number) });
  }
  return { entries, error: '' };
}

function getExcludedValues() {
  return document.getElementById('exclude-list').value
    .split(/[,\，、\n\r]+/)
    .map((value) => value.trim())
    .filter(Boolean);
}

function getEligibleEntries(entries) {
  const excluded = new Set(getExcludedValues());
  return entries.filter((entry) => !excluded.has(entry.value) && !excluded.has(entry.displayName));
}

function getGender(value) {
  const match = value.match(/[（(]\s*(男|女)\s*[）)]$/);
  return match ? match[1] : null;
}

function getDisplayName(value) {
  return value.replace(/\s*[（(]\s*(男|女)\s*[）)]$/, '').trim();
}

function displayEntry(entry) {
  return entry.displayName || entry.value;
}

function createAvatar(entry, className) {
  const avatar = document.createElement('div');
  avatar.className = className;
  avatar.setAttribute('aria-label', `${displayEntry(entry)}的大頭貼`);

  const fallback = document.createElement('span');
  fallback.className = 'avatar-fallback';
  fallback.textContent = Array.from(displayEntry(entry))[0] || '？';
  avatar.append(fallback);

  if (entry.imageUrl) attachAvatarImage(avatar, entry);

  return avatar;
}

function attachAvatarImage(avatar, entry) {
  const imageUrl = entry.imageUrl;
  let cachedImage = avatarImageCache.get(imageUrl);
  if (cachedImage?.status === 'failed') return;
  if (cachedImage?.status === 'loaded') {
    appendAvatarImage(avatar, cachedImage.image, entry);
    return;
  }

  if (!cachedImage) {
    cachedImage = { status: 'loading', image: new Image(), avatars: new Set() };
    avatarImageCache.set(imageUrl, cachedImage);
    cachedImage.image.addEventListener('load', () => {
      cachedImage.status = 'loaded';
      cachedImage.avatars.forEach((waitingAvatar) => {
        if (waitingAvatar.isConnected) {
          appendAvatarImage(waitingAvatar, cachedImage.image, waitingAvatar.dataset.avatarName);
        }
      });
      cachedImage.avatars.clear();
    }, { once: true });
    cachedImage.image.addEventListener('error', () => {
      cachedImage.status = 'failed';
      cachedImage.avatars.clear();
    }, { once: true });
    cachedImage.image.src = imageUrl;
  }

  avatar.dataset.avatarName = displayEntry(entry);
  cachedImage.avatars.add(avatar);
}

function appendAvatarImage(avatar, sourceImage, name) {
  if (avatar.querySelector('img')) return;
  const image = document.createElement('img');
  image.src = sourceImage.src;
  image.alt = name;
  image.loading = 'lazy';
  image.addEventListener('load', () => {
    avatar.classList.add('has-image');
  }, { once: true });
  image.addEventListener('error', () => {
    image.remove();
    avatar.classList.remove('has-image');
  }, { once: true });
  avatar.append(image);
}

function shuffleEntries(entries) {
  const shuffled = [...entries];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
  }
  return shuffled;
}

function startGrouping() {
  const { entries, error } = getRoster();
  if (error) {
    showMessage(error, 'error');
    return;
  }

  const eligible = getEligibleEntries(entries);
  const groupSize = Number(document.getElementById('group-size').value);
  if (!Number.isInteger(groupSize) || groupSize < 1 || groupSize > MAX_ROSTER_SIZE) {
    showMessage(`請輸入 1 到 ${MAX_ROSTER_SIZE.toLocaleString()} 之間的每組人數。`, 'error');
    return;
  }
  if (eligible.length === 0) {
    showMessage('目前沒有可分組的學生，請檢查名單與排除對象。', 'error');
    return;
  }

  const strategy = document.getElementById('group-strategy').value;
  document.querySelector('.group-format-hint').hidden = strategy === 'random';
  let memberGroups;
  if (strategy === 'random') {
    const shuffled = shuffleEntries(eligible);
    memberGroups = sliceIntoGroups(shuffled, groupSize);
  } else {
    const unclassified = eligible.filter((entry) => !entry.gender);
    if (unclassified.length > 0) {
      showMessage(`有 ${unclassified.length} 位學生尚未標示性別。請使用「姓名 (男)」或「姓名 (女)」格式，或改選純隨機。`, 'error');
      return;
    }

    const males = shuffleEntries(eligible.filter((entry) => entry.gender === '男'));
    const females = shuffleEntries(eligible.filter((entry) => entry.gender === '女'));
    memberGroups = strategy === 'mixed'
      ? createMixedGroups(males, females, groupSize)
      : [...sliceIntoGroups(males, groupSize), ...sliceIntoGroups(females, groupSize)];
  }

  currentGroups = memberGroups.map((members, index) => ({
    id: `group:${index}`,
    members: shuffleEntries(members),
    leaderId: null,
    label: strategy === 'separated'
      ? `${members[0]?.gender === '男' ? '男生組' : '女生組'} ${index + 1}`
      : `第 ${index + 1} 組`,
  }));
  renderGroups();
  document.getElementById('empty-state').hidden = true;
  document.getElementById('results-list').hidden = true;
  document.getElementById('groups-list').hidden = false;
  document.getElementById('leaders-button').disabled = false;
  addHistoryRecord(currentGroups.map((group, index) =>
    `第 ${index + 1} 組：${group.members.map(displayEntry).join('、')}`,
  ));
  showMessage(`完成分組！共 ${currentGroups.length} 組，${eligible.length} 位學生。`, 'success');
  triggerConfetti();
  playResultSound();
}

function sliceIntoGroups(entries, groupSize) {
  const groups = [];
  for (let index = 0; index < entries.length; index += groupSize) {
    groups.push(entries.slice(index, index + groupSize));
  }
  return groups;
}

function createMixedGroups(males, females, groupSize) {
  const total = males.length + females.length;
  const capacities = [];
  for (let left = total; left > 0; left -= groupSize) {
    capacities.push(Math.min(left, groupSize));
  }

  let assignedFemales = 0;
  let assignedMales = 0;
  let assignedSeats = 0;
  return capacities.map((capacity) => {
    const remainingMales = males.length - assignedMales;
    const remainingFemales = females.length - assignedFemales;
    const expectedFemales = Math.round((assignedSeats + capacity) * females.length / total) - assignedFemales;
    const minimumFemales = Math.max(0, capacity - remainingMales);
    const maximumFemales = Math.min(capacity, remainingFemales);
    const femaleCount = Math.max(minimumFemales, Math.min(maximumFemales, expectedFemales));
    const maleCount = capacity - femaleCount;
    const group = [
      ...females.slice(assignedFemales, assignedFemales + femaleCount),
      ...males.slice(assignedMales, assignedMales + maleCount),
    ];
    assignedFemales += femaleCount;
    assignedMales += maleCount;
    assignedSeats += capacity;
    return group;
  });
}

function renderGroups() {
  const groupsList = document.getElementById('groups-list');
  groupsList.replaceChildren();

  currentGroups.forEach((group, groupIndex) => {
    const card = document.createElement('section');
    card.className = 'group-card';
    const heading = document.createElement('div');
    heading.className = 'group-card-heading';
    const title = document.createElement('h3');
    title.textContent = group.label || `第 ${groupIndex + 1} 組`;
    const size = document.createElement('span');
    size.textContent = `${group.members.length} 人`;
    heading.append(title, size);

    const members = document.createElement('ul');
    members.className = 'group-members';
    group.members.forEach((member) => {
      const item = document.createElement('li');
      item.className = 'group-member';
      const name = document.createElement('span');
      name.className = 'group-member-name';
      name.textContent = displayEntry(member);
      item.append(createAvatar(member, 'group-avatar'), name);

      if (group.leaderId === member.id) {
        const leaderBadge = document.createElement('span');
        leaderBadge.className = 'leader-badge';
        leaderBadge.textContent = '★ 組長';
        item.classList.add('is-leader');
        item.append(leaderBadge);
      }
      members.append(item);
    });

    const chooseButton = document.createElement('button');
    chooseButton.className = 'group-leader-button';
    chooseButton.type = 'button';
    chooseButton.textContent = group.leaderId ? '重新抽組長' : '抽一位組長';
    chooseButton.setAttribute('aria-label', `第 ${groupIndex + 1} 組抽一位組長`);
    chooseButton.addEventListener('click', () => chooseGroupLeader(group.id));
    card.append(heading, members, chooseButton);
    groupsList.append(card);
  });
}

function chooseGroupLeader(groupId) {
  const group = currentGroups.find((item) => item.id === groupId);
  if (!group || group.members.length === 0) return;
  const leader = group.members[Math.floor(Math.random() * group.members.length)];
  group.leaderId = leader.id;
  renderGroups();
  const groupNumber = currentGroups.indexOf(group) + 1;
  addHistoryRecord([`第 ${groupNumber} 組組長：${displayEntry(leader)}`]);
  playResultSound();
  showMessage(`第 ${groupNumber} 組組長是 ${displayEntry(leader)}！`, 'success');
}

function chooseAllLeaders() {
  if (currentGroups.length === 0) return;
  currentGroups.forEach((group) => {
    const leader = group.members[Math.floor(Math.random() * group.members.length)];
    group.leaderId = leader.id;
  });
  renderGroups();
  addHistoryRecord(currentGroups.map((group, index) => {
    const leader = group.members.find((member) => member.id === group.leaderId);
    return `第 ${index + 1} 組組長：${displayEntry(leader)}`;
  }));
  playResultSound();
  showMessage('已為每一組抽出一位組長！', 'success');
}

function addHistoryRecord(values) {
  drawHistory.unshift({ values, time: new Date(), mode: appMode });
  renderHistory();
}

function clearGroupResults() {
  if (currentGroups.length === 0) return;
  currentGroups = [];
  document.getElementById('groups-list').replaceChildren();
  document.getElementById('groups-list').hidden = true;
  document.getElementById('leaders-button').disabled = true;
  if (appMode === 'group') {
    document.getElementById('empty-state').hidden = false;
  }
}

function refreshRoster() {
  const { entries, error } = getRoster();
  const eligible = getEligibleEntries(entries);
  const signature = `${getCurrentMode()}|${entries.map((entry) => `${entry.id}:${entry.value}`).join('|')}|${[...getExcludedValues()].sort().join('|')}`;

  if (signature !== lastPoolSignature) {
    drawnIds.clear();
    lastPoolSignature = signature;
  }

  participants = entries;
  const availableCount = document.getElementById('no-repeat').checked
    ? eligible.filter((entry) => !drawnIds.has(entry.id)).length
    : eligible.length;

  document.getElementById('remaining-count').textContent = availableCount.toLocaleString();
  document.getElementById('remaining-label').textContent = document.getElementById('no-repeat').checked
    ? '剩餘可抽人數'
    : '目前可抽人數';
  document.getElementById('draw-button').disabled = isDrawing;

  if (error) {
    showMessage(error, 'error');
  }
}

function startDraw() {
  if (isDrawing) return;

  const { entries, error } = getRoster();
  if (error) {
    showMessage(error, 'error');
    return;
  }

  const eligible = getEligibleEntries(entries);
  const available = document.getElementById('no-repeat').checked
    ? eligible.filter((entry) => !drawnIds.has(entry.id))
    : eligible;
  const requested = Number(document.getElementById('draw-count').value);

  if (!Number.isInteger(requested) || requested < 1) {
    showMessage('請輸入至少 1 位要抽出的學生人數。', 'error');
    return;
  }
  if (requested > available.length) {
    showMessage(
      available.length === 0
        ? '目前沒有可抽的學生，請檢查名單與排除對象，或按「重置」重新抽籤。'
        : `可抽人數不足：你要抽 ${requested} 位，但目前只有 ${available.length} 位可抽。請減少抽出人數或調整名單／排除對象。`,
      'error',
    );
    return;
  }

  clearMessage();
  isDrawing = true;
  setDrawingState(true);
  if (document.getElementById('sound-enabled').checked) {
    startRollingSound();
  }

  const pool = [...available];
  const winners = [];
  for (let index = 0; index < requested; index += 1) {
    winners.push(pool.splice(Math.floor(Math.random() * pool.length), 1)[0]);
  }

  showResultSlots(requested);
  const startedAt = Date.now();
  const animation = window.setInterval(() => {
    const elapsed = Date.now() - startedAt;
    if (elapsed >= 2000) {
      window.clearInterval(animation);
      finishDraw(winners);
      return;
    }

    const temporaryWinners = winners.map(() => available[Math.floor(Math.random() * available.length)]);
    updateResultSlots(temporaryWinners, true);
  }, 75);
}

function showResultSlots(count) {
  document.getElementById('empty-state').hidden = true;
  const resultsList = document.getElementById('results-list');
  resultsList.hidden = false;
  resultsList.replaceChildren();

  for (let index = 0; index < count; index += 1) {
    const card = document.createElement('div');
    card.className = 'result-card is-rolling';
    card.innerHTML = `<span class="result-card-label">幸運兒 ${String(index + 1).padStart(2, '0')}</span><strong class="result-card-value"></strong>`;
    const avatarSlot = document.createElement('div');
    avatarSlot.className = 'result-avatar-slot';
    card.insertBefore(avatarSlot, card.querySelector('.result-card-value'));
    resultsList.append(card);
  }
}

function updateResultSlots(entries, rolling) {
  const cards = document.querySelectorAll('.result-card');
  cards.forEach((card, index) => {
    card.classList.toggle('is-rolling', rolling);
    const entry = entries[index];
    if (!entry) return;
    card.querySelector('.result-card-value').textContent = displayEntry(entry);
    if (!rolling && card.dataset.entryId !== entry.id) {
      const avatarSlot = card.querySelector('.result-avatar-slot');
      avatarSlot.replaceChildren(createAvatar(entry, 'result-avatar'));
      card.dataset.entryId = entry.id;
    }
  });
}

function finishDraw(winners) {
  updateResultSlots(winners, false);
  const noRepeat = document.getElementById('no-repeat').checked;
  if (noRepeat) {
    winners.forEach((winner) => drawnIds.add(winner.id));
  }

  drawHistory.unshift({
    values: winners.map(displayEntry),
    time: new Date(),
    mode: 'draw',
  });
  renderHistory();
  triggerConfetti();
  playResultSound();
  isDrawing = false;
  setDrawingState(false);
  refreshRoster();

  const allEligibleDrawn = getEligibleEntries(participants).every((entry) => drawnIds.has(entry.id));
  if (noRepeat && allEligibleDrawn) {
    showMessage('名單已全部抽完！按「重置」即可重新開始。', 'info');
  } else {
    showMessage(`抽出 ${winners.length} 位，恭喜：${winners.map(displayEntry).join('、')}`, 'success');
  }
}

function setDrawingState(drawing) {
  const button = document.getElementById('draw-button');
  button.disabled = drawing;
  button.classList.toggle('is-drawing', drawing);
  document.getElementById('draw-button-label').textContent = drawing ? '幸運降臨中…' : '開始抽籤';
  document.querySelectorAll('.activity-tab').forEach((tab) => {
    tab.disabled = drawing;
  });
}

function renderHistory() {
  const historyList = document.getElementById('history-list');
  const historyCount = document.getElementById('history-count');
  historyList.replaceChildren();
  historyCount.textContent = drawHistory.length === 0
    ? '尚無紀錄'
    : `共 ${drawHistory.length} 次`;

  drawHistory.forEach((record, index) => {
    const item = document.createElement('li');
    item.className = 'history-item';

    const number = document.createElement('span');
    number.className = 'history-index';
    number.textContent = String(drawHistory.length - index).padStart(2, '0');

    const names = document.createElement('span');
    names.className = 'history-names';
    names.textContent = record.values.join('、');

    const time = document.createElement('time');
    time.className = 'history-time';
    time.dateTime = record.time.toISOString();
    time.textContent = record.time.toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit' });

    item.append(number, names, time);
    historyList.append(item);
  });
}

function resetDraw() {
  if (isDrawing) return;
  drawnIds.clear();
  drawHistory = [];
  currentGroups = [];
  document.getElementById('results-list').replaceChildren();
  document.getElementById('results-list').hidden = true;
  document.getElementById('groups-list').replaceChildren();
  document.getElementById('groups-list').hidden = true;
  document.getElementById('leaders-button').disabled = true;
  document.getElementById('empty-state').hidden = false;
  clearMessage();
  renderHistory();
  refreshRoster();
  showMessage('抽籤紀錄與不重複狀態已重置，可以重新開始。', 'info');
}

function showMessage(message, type) {
  const box = document.getElementById('message-box');
  box.textContent = message;
  box.className = `message-box is-${type}`;
  box.hidden = false;
}

function clearMessage() {
  const box = document.getElementById('message-box');
  if (!box) return;
  box.hidden = true;
  box.textContent = '';
}

function loadSavedNames() {
  try {
    return localStorage.getItem(NAMES_STORAGE_KEY) || '';
  } catch (error) {
    console.error('讀取本機名單失敗：', error);
    return '';
  }
}

function saveNames(names) {
  try {
    localStorage.setItem(NAMES_STORAGE_KEY, names);
  } catch (error) {
    console.error('儲存本機名單失敗：', error);
    showMessage('名單無法儲存到此瀏覽器，請確認瀏覽器的本機儲存空間設定。', 'error');
  }
}

function getAudioContext() {
  if (!audioContext) {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) {
      showMessage('此瀏覽器不支援 Web Audio API，抽籤仍可使用，但無法播放音效。', 'info');
      return null;
    }
    audioContext = new AudioContextClass();
  }
  if (audioContext.state === 'suspended') {
    audioContext.resume();
  }
  return audioContext;
}

function playTone(frequency, startTime, duration, volume, type = 'sine') {
  const context = getAudioContext();
  if (!context) return;

  const oscillator = context.createOscillator();
  const gain = context.createGain();
  oscillator.type = type;
  oscillator.frequency.setValueAtTime(frequency, startTime);
  gain.gain.setValueAtTime(0.0001, startTime);
  gain.gain.exponentialRampToValueAtTime(volume, startTime + 0.012);
  gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);
  oscillator.connect(gain);
  gain.connect(context.destination);
  oscillator.start(startTime);
  oscillator.stop(startTime + duration + 0.02);
}

function startRollingSound() {
  const context = getAudioContext();
  if (!context) return;

  for (let index = 0; index < 10; index += 1) {
    playTone(460 + (index % 3) * 80, context.currentTime + index * 0.19, 0.045, 0.035, 'square');
  }
}

function playResultSound() {
  if (!document.getElementById('sound-enabled').checked) return;
  const context = getAudioContext();
  if (!context) return;

  const notes = [523.25, 659.25, 783.99, 1046.5];
  notes.forEach((note, index) => {
    playTone(note, context.currentTime + index * 0.13, 0.32, 0.12, 'sine');
  });
}

function triggerConfetti() {
  const colors = ['#ffca55', '#ff6f91', '#62d6c7', '#9c8cff', '#ffffff'];
  for (let index = 0; index < 150; index += 1) {
    confettiParticles.push({
      x: Math.random() * width,
      y: -Math.random() * height * 0.4,
      vx: (Math.random() - 0.5) * 5,
      vy: Math.random() * -2 - 1,
      size: Math.random() * 8 + 5,
      rotation: Math.random() * Math.PI,
      rotationSpeed: (Math.random() - 0.5) * 0.18,
      life: 150 + Math.random() * 80,
      color: colors[Math.floor(Math.random() * colors.length)],
    });
  }
  loop();
}
