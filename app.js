
// --------------------------------------------------------------------------
// ÇOKLU MASA (SALON) YÖNETİMİ & MASA STATE DEĞİŞKENLERİ
// --------------------------------------------------------------------------
let currentTableId = '1';
let activeTableCount = 1;
let tablesList = [
  { id: '1', name: 'Masa 1' },
  { id: '2', name: 'Masa 2' },
  { id: '3', name: 'Masa 3' },
  { id: '4', name: 'Masa 4' }
];
let activeSetupTableId = '1'; // Sayfa 0'da oyuncuları düzenlenen masa
let salonRefreshTimer = null;

function ensureTablesList() {
  const count = Math.max(1, activeTableCount || 1);
  while (tablesList.length < count) {
    const nextId = String(tablesList.length + 1);
    tablesList.push({ id: nextId, name: `Masa ${nextId}` });
  }
}

// Masa bazlı varsayılan isimler (Masa 1: Oyuncu 1..4, Masa 2: Oyuncu 5..8, vb.)
function getDefaultPlayerName(tableId, playerIdx) {
  const tid = parseInt(tableId, 10) || 1;
  const startNum = (tid - 1) * 4 + 1;
  return `Oyuncu ${startNum + playerIdx}`;
}

function isDefaultPlayerName(name) {
  if (!name) return true;
  const s = String(name).trim();
  return /^Oyuncu\s+\d+$/i.test(s) || /^test\s*\d*$/i.test(s);
}

function cleanDuplicatePlayersAcrossTables() {
  // Masa 1 en öncelikli masadır. Masa 1'deki gerçek isimleri topla.
  let t1Players = [];
  try {
    const raw1 = localStorage.getItem(getGameStorageKey('1'));
    if (raw1) {
      const p1 = JSON.parse(raw1);
      if (p1 && Array.isArray(p1.players)) {
        t1Players = p1.players
          .map(p => (p && p.name ? p.name.trim() : ''))
          .filter(n => n && !isDefaultPlayerName(n));
      }
    }
  } catch (e) {}

  if (String(currentTableId) === '1' && typeof state !== 'undefined' && state && Array.isArray(state.players)) {
    const curNames = state.players
      .map(p => (p && p.name ? p.name.trim() : ''))
      .filter(n => n && !isDefaultPlayerName(n));
    curNames.forEach(nm => {
      if (!t1Players.includes(nm)) t1Players.push(nm);
    });
  }

  const t1Lower = t1Players.map(n => n.toLocaleLowerCase('tr-TR'));

  // Masalar 2, 3, 4'teki eski veya kirli çakışan kalıntıları temizle
  for (let tid = 2; tid <= 4; tid++) {
    const key = getGameStorageKey(String(tid));
    try {
      const raw = localStorage.getItem(key);
      if (!raw) continue;
      const parsed = JSON.parse(raw);
      if (!parsed || !Array.isArray(parsed.players)) continue;

      let changed = false;
      parsed.players.forEach((p, idx) => {
        const pName = (p && p.name ? p.name.trim().toLocaleLowerCase('tr-TR') : '');
        if (pName && (t1Lower.includes(pName) || pName.startsWith('test'))) {
          parsed.players[idx] = {
            id: idx,
            name: getDefaultPlayerName(String(tid), idx),
            score: 0,
            kozCount: 0,
            cezaCount: 0
          };
          changed = true;
        }
      });

      if (changed) {
        localStorage.setItem(key, JSON.stringify(parsed));
      }
    } catch (e) {}
  }

  // Ayrıca mevcut state'te "test" içeren isim kalmışsa temizle
  if (typeof state !== 'undefined' && state && Array.isArray(state.players)) {
    let stateChanged = false;
    state.players.forEach((p, idx) => {
      if (p && p.name && (p.name.toLocaleLowerCase('tr-TR').startsWith('test') || /^test\d*$/i.test(p.name.trim()))) {
        p.name = getDefaultPlayerName(currentTableId, idx);
        stateChanged = true;
      }
    });
    if (stateChanged) {
      saveStateToStorage();
      pushStateToServer();
      updateSetupInputFields();
    }
  }
}

// Tüm aktif masalarda oturmakta olan gerçek oyuncu isimlerini toplar (çakışma kontrolü)
function getTakenPlayerNamesAcrossAllTables(currentTid = currentTableId, excludePlayerIdx = null) {
  const taken = new Set();
  const maxTables = Math.max(1, activeTableCount || 1);
  const curTidNum = parseInt(currentTid, 10) || 1;

  // 1. Mevcut masanın diğer koltuklarında oturan oyuncuları ekle (aynı masada çift seçimi önle)
  if (typeof state !== 'undefined' && state && Array.isArray(state.players)) {
    state.players.forEach((p, idx) => {
      if (excludePlayerIdx !== null && idx === excludePlayerIdx) return;
      const name = (p && p.name ? p.name.trim() : '');
      if (name && !isDefaultPlayerName(name)) {
        taken.add(name.toLocaleLowerCase('tr-TR'));
      }
    });
  }

  // Ayrıca form kutularında şu an yazılı olan isimleri de ekle
  if (typeof document !== 'undefined') {
    ['inputPlayer1', 'inputPlayer2', 'inputPlayer3', 'inputPlayer4'].forEach((id, idx) => {
      if (excludePlayerIdx !== null && idx === excludePlayerIdx) return;
      const el = document.getElementById(id);
      if (el && el.value) {
        const v = el.value.trim();
        if (v && !isDefaultPlayerName(v)) {
          taken.add(v.toLocaleLowerCase('tr-TR'));
        }
      }
    });
  }

  // Eğer tek masa modundaysak veya şu an Masa 1 düzenleniyorsa:
  // Masa 1 en öncelikli masadır; diğer pasif/ikinci masalar Masa 1'i KESİNLİKLE KISITLAYAMAZ!
  if (maxTables <= 1 || curTidNum === 1) {
    return taken;
  }

  // Masa 2, 3, 4 için: Kendisinden önceki masalarda (örn. Masa 1'de) oturan oyuncuları topla
  for (let i = 1; i < curTidNum; i++) {
    const tid = String(i);
    let tPlayers = null;
    try {
      const raw = localStorage.getItem(getGameStorageKey(tid));
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && Array.isArray(parsed.players)) {
          tPlayers = parsed.players;
        }
      }
    } catch (e) {}

    if (!tPlayers && typeof tablesList !== 'undefined' && Array.isArray(tablesList)) {
      const tObj = tablesList.find(t => String(t.id) === tid);
      if (tObj && Array.isArray(tObj.players)) {
        tPlayers = tObj.players;
      }
    }

    if (tPlayers && Array.isArray(tPlayers)) {
      tPlayers.forEach(p => {
        const name = (p && p.name ? p.name.trim() : '');
        if (name && !isDefaultPlayerName(name)) {
          taken.add(name.toLocaleLowerCase('tr-TR'));
        }
      });
    }
  }

  return taken;
}

function getAllOccupiedPlayers(excludeTableId = null, excludePlayerIdx = null) {
  const occupied = new Map();
  const maxTables = Math.max(1, activeTableCount || 1);
  if (maxTables <= 1) {
    return occupied;
  }

  for (let i = 1; i <= maxTables; i++) {
    const tid = String(i);

    if (excludeTableId && String(excludeTableId) === tid) {
      continue;
    }

    let tState = null;
    if (tid === String(currentTableId) && typeof state !== 'undefined' && state) {
      tState = state;
    } else {
      try {
        const raw = localStorage.getItem(getGameStorageKey(tid));
        if (raw) tState = JSON.parse(raw);
      } catch (e) {}
    }

    let players = (tState && Array.isArray(tState.players)) ? tState.players : null;
    if (!players || players.length === 0) {
      const tObj = (tablesList && tablesList.find(t => String(t.id) === tid));
      if (tObj && Array.isArray(tObj.players)) {
        players = tObj.players;
      }
    }

    if (players && Array.isArray(players)) {
      players.forEach((p, idx) => {
        const pName = (p && p.name ? p.name.trim() : '');
        if (pName && !isDefaultPlayerName(pName)) {
          const tObj = (tablesList && tablesList.find(t => String(t.id) === tid)) || { name: `Masa ${tid}` };
          occupied.set(pName.toLocaleLowerCase('tr-TR'), {
            rawName: pName,
            tableId: tid,
            tableName: tObj.name || `Masa ${tid}`,
            playerIdx: idx
          });
        }
      });
    }
  }
  return occupied;
}

function getRoleStorageKey(tableId = currentTableId) {
  return (String(tableId) === '1') ? 'king_my_player_role_v1' : `king_my_player_role_table_${tableId}`;
}

function getGameStorageKey(tableId = currentTableId) {
  return (String(tableId) === '1') ? 'king_score_game_v1' : `king_score_game_table_${tableId}`;
}

// --------------------------------------------------------------------------
// CANLI YAYIN, OYUNCU TELEFON KİMLİĞİ & SEYİRCİ (İZLEYİCİ) MODU YÖNETİMİ
// --------------------------------------------------------------------------
let isSpectatorMode = false;
let myPlayerRole = 'all'; // 'all' | '0' | '1' | '2' | '3' | 'spectator'

function loadRoleForTable(tableId = currentTableId) {
  try {
    const roleKey = getRoleStorageKey(tableId);
    const savedRole = localStorage.getItem(roleKey);
    if (savedRole && ['all', '0', '1', '2', '3', 'spectator'].includes(savedRole)) {
      setMyPlayerRole(savedRole, false);
    } else {
      setMyPlayerRole('all', false);
    }
  } catch (e) {
    setMyPlayerRole('all', false);
  }
}

function initSpectatorMode() {
  const urlParams = new URLSearchParams(window.location.search);
  const modParam = urlParams.get('mod');
  const oyuncuParam = urlParams.get('oyuncu');
  const tableParam = urlParams.get('masa') || urlParams.get('table');

  if (tableParam) {
    currentTableId = String(tableParam);
    try {
      localStorage.setItem('king_active_table_id', currentTableId);
    } catch (e) {}
  } else {
    try {
      const savedTable = localStorage.getItem('king_active_table_id');
      if (savedTable) currentTableId = String(savedTable);
    } catch (e) {}
  }

  try {
    const savedCount = localStorage.getItem('king_salon_table_count');
    if (savedCount) {
      activeTableCount = Math.max(1, Math.min(8, parseInt(savedCount, 10)));
      ensureTablesList();
    }
  } catch (e) {}

  activeSetupTableId = currentTableId;

  if (modParam === 'izle' || urlParams.get('spectator') === '1') {
    setMyPlayerRole('spectator', false);
  } else if (oyuncuParam && ['1', '2', '3', '4'].includes(oyuncuParam)) {
    setMyPlayerRole(String(parseInt(oyuncuParam, 10) - 1), false);
  } else {
    loadRoleForTable(currentTableId);
  }

  document.getElementById('btnShareLiveGame')?.addEventListener('click', shareLiveGameLink);
  document.getElementById('btnToggleSpectator')?.addEventListener('click', toggleSpectatorMode);
}

function setMyPlayerRole(role, showToastMsg = true) {
  myPlayerRole = role;
  try {
    const roleKey = getRoleStorageKey(currentTableId);
    localStorage.setItem(roleKey, role);
  } catch (e) {}

  if (role === 'spectator') {
    enableSpectatorMode(showToastMsg);
  } else {
    isSpectatorMode = false;
    document.body.classList.remove('spectator-mode');
    const btn = document.getElementById('btnToggleSpectator');
    if (btn) {
      btn.classList.remove('active');
      btn.innerHTML = '👀 Seyirci Modu';
    }
    if (showToastMsg) {
      if (role === 'all') {
        showToast('👥 Tüm Masa Modu: Tüm oyuncuların koz ve ceza puanlarını girebilirsiniz.', 'emerald');
      } else {
        const pIdx = parseInt(role, 10);
        const pName = (state && state.players && state.players[pIdx]) ? state.players[pIdx].name : `Oyuncu ${pIdx + 1}`;
        showToast(`📱 Telefon Modu: ${pName} seçildi! Kendi koz ve ceza puanını tek dokunuşla girebilirsin.`, 'emerald');
        const targetScreen = (state.activeHandType === 'koz' && state.rounds && state.rounds.length >= 4) ? 2 : 1;
        if (currentScreenIndex !== targetScreen) {
          goToScreen(targetScreen, true);
        }
      }
    }
  }
  if (typeof renderAll === 'function' && state && state.players) {
    renderAll();
  }
}

function shareLiveGameLink() {
  triggerHaptic(15);
  const liveUrl = (currentTableId && String(currentTableId) !== '1')
    ? `${window.location.origin}/?masa=${currentTableId}`
    : `${window.location.origin}`;
  const tName = (tablesList.find(t => String(t.id) === String(currentTableId)) || {}).name || `Masa ${currentTableId}`;
  if (navigator.share) {
    navigator.share({
      title: `King Canlı Çetele — ${tName}`,
      text: `${tName} King masasına bağlanın: Canlı izleyin veya kendi koz/ceza puanınızı telefonunuzdan girin!`,
      url: liveUrl
    }).catch(() => {});
    return;
  }
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(liveUrl).then(() => {
      showToast(`🔗 ${tName} bağlantı linki kopyalandı! Oyunculara gönderebilirsiniz.`, 'emerald');
    }).catch(() => {
      prompt('Masa linkini kopyalayın:', liveUrl);
    });
  } else {
    prompt('Masa linkini kopyalayın:', liveUrl);
  }
}

function toggleSpectatorMode() {
  triggerHaptic(20);
  if (isSpectatorMode) {
    setMyPlayerRole('all', true);
  } else {
    setMyPlayerRole('spectator', true);
  }
}

function enableSpectatorMode(showToastMsg = true) {
  isSpectatorMode = true;
  myPlayerRole = 'spectator';
  document.body.classList.add('spectator-mode');
  const btn = document.getElementById('btnToggleSpectator');
  if (btn) {
    btn.classList.add('active');
    btn.innerHTML = '✏️ Oyuncu Moduna Geç';
  }
  goToScreen(3, true); // Doğrudan canlı sonuçlar / çete ekranına geç
  if (showToastMsg) {
    showToast('👀 Canlı Seyirci Modu aktif: Cezalar, kozlar ve skorlar anlık güncellenir.', 'sky');
  }
}

function disableSpectatorMode() {
  setMyPlayerRole('all', true);
}

function renderPlayerRightsSymbols(player, extraClass = '') {
  if (!player) return '';
  const cezaCount = Math.min(3, Math.max(0, player.cezaCount || 0));
  const kozCount = Math.min(2, Math.max(0, player.kozCount || 0));

  let cezaSyms = '';
  for (let i = 0; i < 3; i++) {
    const isPlayed = i < cezaCount;
    cezaSyms += `<span class="prb-sym prb-tri ${isPlayed ? 'filled' : 'empty'}">${isPlayed ? '▲' : '△'}</span>`;
  }

  let kozSyms = '';
  for (let i = 0; i < 2; i++) {
    const isPlayed = i < kozCount;
    kozSyms += `<span class="prb-sym prb-cir ${isPlayed ? 'filled' : 'empty'}">${isPlayed ? '●' : '○'}</span>`;
  }

  return `<span class="player-rights-badges ${extraClass}" title="Ceza: ${cezaCount}/3 (▲) • Koz: ${kozCount}/2 (●)"><span class="prb-group prb-ceza">${cezaSyms}</span><span class="prb-group prb-koz">${kozSyms}</span></span>`;
}

function renderLivePlayerBar(currentHand, callerIdx, isGameOver) {
  const summaryEl = document.getElementById('lblLiveBarSummary');
  const pillsContainer = document.getElementById('playerRolePills');
  const caller = (state.players && state.players[callerIdx]) ? state.players[callerIdx] : { name: 'Oyuncu 1' };

  if (summaryEl) {
    if (isGameOver) {
      if (hasKingWinner()) {
        summaryEl.innerHTML = `🏆 <b>KING ZAFERİ:</b> 👑 ${escapeHtml(state.kingWinnerName)} (${state.kingWinnerTricks || 11} El) Oyunu Kazandı!`;
      } else {
        summaryEl.textContent = '20/20 El Tamamlandı 🏆';
      }
    } else {
      const isKozActive = state.activeHandType === 'koz' && state.rounds.length >= 4;
      const activeGameTitle = isKozActive
        ? `Koz (${({ karo: '♦ Karo', kupa: '♥️ Kupa', maca: '♠ Maça', sinek: '♣ Sinek' })[state.selectedKozSuit] || '♦ Karo'})`
        : ((GAME_DEFS[state.selectedCezaKey] && GAME_DEFS[state.selectedCezaKey].shortTitle) || 'Ceza');
      summaryEl.innerHTML = `<b>${currentHand}. El</b> • 👑 ${escapeHtml(caller.name)} • ${escapeHtml(activeGameTitle)}`;
    }
  }

  if (pillsContainer && state.players) {
    pillsContainer.innerHTML = '';

    // 1. Tüm Masa (Hakem) Butonu (En başta görünür)
    const btnAll = document.createElement('button');
    btnAll.type = 'button';
    btnAll.className = `role-pill ${myPlayerRole === 'all' ? 'active' : ''}`;
    btnAll.innerHTML = '👥 Tüm Masa';
    btnAll.addEventListener('click', () => {
      triggerHaptic(15);
      setMyPlayerRole('all', true);
    });
    pillsContainer.appendChild(btnAll);

    // 2. 4 Oyuncu Kimlik Butonları (Yanında ▲▲▲ Ceza ve ●● Koz Sembolleriyle)
    state.players.forEach((p, idx) => {
      const roleVal = String(idx);
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = `role-pill player-role-pill ${myPlayerRole === roleVal ? 'active' : ''}`;
      btn.innerHTML = `<span>👤 ${escapeHtml(p.name)}</span> ${renderPlayerRightsSymbols(p, 'prb-inline')}`;
      btn.addEventListener('click', () => {
        triggerHaptic(15);
        setMyPlayerRole(roleVal, true);
      });
      pillsContainer.appendChild(btn);
    });

    // 3. Canlı İzle (Seyirci) Butonu
    const btnSpec = document.createElement('button');
    btnSpec.type = 'button';
    btnSpec.className = `role-pill spectator-pill ${myPlayerRole === 'spectator' ? 'active' : ''}`;
    btnSpec.innerHTML = '👀 İzle';
    btnSpec.addEventListener('click', () => {
      triggerHaptic(15);
      setMyPlayerRole('spectator', true);
    });
    pillsContainer.appendChild(btnSpec);

    // 4. Paylaş Butonu (Mobil tek satırda kolay erişim için)
    const btnShareInline = document.createElement('button');
    btnShareInline.type = 'button';
    btnShareInline.className = 'role-pill share-pill';
    btnShareInline.innerHTML = '🔗 Paylaş';
    btnShareInline.addEventListener('click', shareLiveGameLink);
    pillsContainer.appendChild(btnShareInline);
  }

  // Güvenlik: Masayı sıfırlama (Yeni Oyun) düğmesini yalnızca ana masa yöneticisi ('all') görebilir.
  // Oyuncuların veya izleyicilerin telefonlarında bu buton gizlenir.
  const btnNewGame = document.getElementById('btnNewGame');
  if (btnNewGame) {
    btnNewGame.style.display = (myPlayerRole === 'all') ? '' : 'none';
  }
}

// --------------------------------------------------------------------------
// ÇOKLU MASA & SALON YÖNETİMİ
// --------------------------------------------------------------------------
function renderTableBar() {
  const container = document.getElementById('tablePillsContainer');
  if (!container) return;
  container.innerHTML = '';

  const activeTables = tablesList.slice(0, Math.max(1, activeTableCount));
  activeTables.forEach((t) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    const isActive = String(t.id) === String(currentTableId);
    btn.className = `table-pill ${isActive ? 'active' : ''}`;
    btn.innerHTML = `<span class="tp-dot"></span> 🪑 ${escapeHtml(t.name || ('Masa ' + t.id))}`;
    btn.addEventListener('click', () => {
      triggerHaptic(15);
      switchTable(t.id);
    });
    container.appendChild(btn);
  });
}

function renderTableSetupUI() {
  // Masa sayısı seçim butonları
  const countButtons = document.querySelectorAll('#tableCountSelector .btn-count-opt');
  countButtons.forEach(btn => {
    const cnt = parseInt(btn.getAttribute('data-count'), 10);
    btn.classList.toggle('active', cnt === activeTableCount);
  });

  const badge = document.getElementById('multiTableBadge');
  if (badge) {
    badge.textContent = `${activeTableCount} Masa (${activeTableCount * 4} Kişi)`;
  }

  // Masalar arası kurulum sekmeleri
  const tabsRow = document.getElementById('tableSetupTabsRow');
  const tabsContainer = document.getElementById('tableSetupTabsContainer');
  if (tabsRow && tabsContainer) {
    if (activeTableCount > 1) {
      tabsRow.style.display = 'flex';
      tabsContainer.innerHTML = '';
      const activeTables = tablesList.slice(0, activeTableCount);
      activeTables.forEach(t => {
        const tabBtn = document.createElement('button');
        tabBtn.type = 'button';
        const isActive = String(t.id) === String(currentTableId);
        tabBtn.className = `btn-setup-tab ${isActive ? 'active' : ''}`;
        tabBtn.innerHTML = (isActive ? '📍 ' : '🪑 ') + escapeHtml(t.name || ('Masa ' + t.id)) + (isActive ? ' <span style="font-size:10px; background:rgba(255,255,255,0.25); padding:1px 6px; border-radius:10px; margin-left:4px;">Seçili</span>' : '');
        tabBtn.addEventListener('click', () => {
          triggerHaptic(15);
          switchSetupTable(t.id);
        });
        tabsContainer.appendChild(tabBtn);
      });
    } else {
      tabsRow.style.display = 'none';
    }
  }

  const titleEl = document.getElementById('lblPlayerNamesTitle');
  if (titleEl) {
    const curName = (tablesList.find(t => String(t.id) === String(currentTableId)) || {}).name || `Masa ${currentTableId}`;
    titleEl.innerHTML = `Oyuncu İsimleri: <span style="display:inline-flex; align-items:center; background: linear-gradient(135deg, #2563eb, #1d4ed8); color: #fff; font-size: 13px; padding: 4px 12px; border-radius: 999px; margin-left: 8px; font-weight: 800; box-shadow: 0 0 12px rgba(37,99,235,0.6); border: 1px solid rgba(255,255,255,0.3);">${escapeHtml(curName)}</span>`;
  }
}

async function switchSetupTable(tableId) {
  const tid = String(tableId);
  if (tid === String(currentTableId)) return;
  // Mevcut formdaki isimleri kaydet ve kalıcı depola
  syncSetupInputsToState();
  saveStateToStorage();
  try {
    pushStateToServer();
  } catch (e) {}
  await switchTable(tid);
}

async function switchTable(tableId) {
  const tid = String(tableId);
  if (tid === String(currentTableId)) return;

  // Mevcut masayı kaydet
  saveStateToStorage();
  if (typeof tableServerVersions !== 'undefined') {
    tableServerVersions[currentTableId] = serverVersion;
  }

  // Önceki masanın geçici düzenleme bayraklarını ve hafızasını tamamen sıfırla
  hasUserEditedSetupInputs = false;
  lastLocalSetupEditAt = 0;
  lastLocalEditTableId = null;

  currentTableId = tid;
  activeSetupTableId = tid;
  serverVersion = (typeof tableServerVersions !== 'undefined' && tableServerVersions[tid]) ? tableServerVersions[tid] : 0;
  try {
    localStorage.setItem('king_active_table_id', currentTableId);
    // URL'deki masa parametresini de senkronize et (sayfa yenilense de Masa 2'de kalsın)
    const url = new URL(window.location);
    if (tid !== '1') {
      url.searchParams.set('masa', tid);
    } else {
      url.searchParams.delete('masa');
    }
    window.history.replaceState({}, '', url);
  } catch (e) {}

  // O masaya ait rolü yükle
  loadRoleForTable(currentTableId);

  // O masaya ait yerel state'i yükle
  loadStateFromStorage();

  // Input alanlarını bu masanın kendi oyuncularıyla doldur
  updateSetupInputFields();

  renderTableBar();
  renderTableSetupUI();
  renderAll();

  // Sunucudan o masanın canlı durumunu al (initial = true)
  await fetchServerState(true);

  const tName = (tablesList.find(t => String(t.id) === tid) || {}).name || `Masa ${tid}`;
  showToast(`🪑 ${tName} seçildi.`, 'emerald');
}

async function setTableCount(newCount) {
  triggerHaptic(15);
  const count = Math.max(1, Math.min(8, parseInt(newCount, 10)));
  activeTableCount = count;
  try {
    localStorage.setItem('king_salon_table_count', String(count));
  } catch (e) {}
  ensureTablesList();

  try {
    const res = await fetch('/api/tables', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'set_count', count: count })
    });
    if (res.ok) {
      const data = await res.json();
      activeTableCount = data.activeCount || count;
      tablesList = data.tables || tablesList;
    }
  } catch (e) {}

  // Eğer mevcut masa yeni masa sayısının dışındaysa Masa 1'e geç
  if (parseInt(currentTableId, 10) > activeTableCount) {
    await switchTable('1');
  }

  renderTableBar();
  renderTableSetupUI();
  showToast(`🏢 Salon ayarlandı: ${activeTableCount} Masa (${activeTableCount * 4} Oyuncu)`, 'cyan');
}

async function loadTablesList() {
  ensureTablesList();
  try {
    const res = await fetch(`/api/tables?t=${Date.now()}`, { cache: 'no-store' });
    if (res.ok) {
      const data = await res.json();
      activeTableCount = data.activeCount || activeTableCount;
      tablesList = data.tables || tablesList;
      try {
        localStorage.setItem('king_salon_table_count', String(activeTableCount));
      } catch (e) {}
    }
  } catch (e) {}
  renderTableBar();
  renderTableSetupUI();
}

async function openSalonOverview() {
  triggerHaptic(20);
  const modal = document.getElementById('modalSalonOverview');
  if (!modal) return;
  modal.classList.add('active');

  await renderSalonTables();

  if (salonRefreshTimer) clearInterval(salonRefreshTimer);
  salonRefreshTimer = setInterval(renderSalonTables, 3500);
}

function closeSalonOverview() {
  const modal = document.getElementById('modalSalonOverview');
  if (modal) modal.classList.remove('active');
  if (salonRefreshTimer) {
    clearInterval(salonRefreshTimer);
    salonRefreshTimer = null;
  }
}

async function renderSalonTables() {
  const grid = document.getElementById('salonTablesGrid');
  const bannerCount = document.getElementById('lblSalonActiveCount');
  if (!grid) return;

  ensureTablesList();
  let tablesData = [];

  try {
    const res = await fetch(`/api/tables?t=${Date.now()}`, { cache: 'no-store' });
    if (res.ok) {
      const data = await res.json();
      tablesData = data.tables || [];
      activeTableCount = data.activeCount || tablesData.length || activeTableCount;
    }
  } catch (e) {}

  // Eğer API henüz aktif değilse yerel storage verilerinden tabloları oluştur
  if (!tablesData || tablesData.length === 0) {
    const activeTables = tablesList.slice(0, activeTableCount);
    tablesData = activeTables.map(t => {
      let tState = null;
      if (String(t.id) === String(currentTableId)) {
        tState = state;
      } else {
        try {
          const raw = localStorage.getItem(getGameStorageKey(t.id));
          if (raw) tState = JSON.parse(raw);
        } catch (e) {}
      }

      const pList = (tState && Array.isArray(tState.players)) ? tState.players : [
        { id: 0, name: 'Oyuncu 1', score: 0 },
        { id: 1, name: 'Oyuncu 2', score: 0 },
        { id: 2, name: 'Oyuncu 3', score: 0 },
        { id: 3, name: 'Oyuncu 4', score: 0 }
      ];

      const rList = (tState && Array.isArray(tState.rounds)) ? tState.rounds : [];
      const sortedP = pList.slice().sort((a, b) => (b.score || 0) - (a.score || 0));

      return {
        id: String(t.id),
        name: t.name || `Masa ${t.id}`,
        roundsCount: rList.length,
        isGameOver: rList.length >= 20 || Boolean(tState && tState.kingWinnerName),
        kingWinnerName: tState && tState.kingWinnerName,
        activeHandType: (tState && tState.activeHandType) || 'ceza',
        selectedCezaKey: (tState && tState.selectedCezaKey) || 'el_almaz',
        selectedKozSuit: (tState && tState.selectedKozSuit) || 'karo',
        leader: sortedP[0] ? sortedP[0].name : null,
        players: pList
      };
    });
  }

    if (bannerCount) {
    bannerCount.innerHTML = `Toplam Aktif Masa: <b>${activeTableCount} Masa (${activeTableCount * 4} Oyuncu)</b>`;
  }

  grid.innerHTML = '';
  tablesData.forEach((t) => {
    const isCurrent = String(t.id) === String(currentTableId);
    const card = document.createElement('div');
    card.className = `salon-table-card ${isCurrent ? 'active-table' : ''}`;

    let gameStatusDesc = '';
    if (t.kingWinnerName) {
      gameStatusDesc = `🏆 👑 KING: ${escapeHtml(t.kingWinnerName)}`;
    } else if (t.isGameOver) {
      gameStatusDesc = '🏁 20/20 El Tamamlandı';
    } else {
      const isKoz = t.activeHandType === 'koz';
      const suitName = ({ karo: '♦ Karo', kupa: '♥️ Kupa', maca: '♠ Maça', sinek: '♣ Sinek' })[t.selectedKozSuit] || '♦ Karo';
      const cezaName = (GAME_DEFS[t.selectedCezaKey] && GAME_DEFS[t.selectedCezaKey].shortTitle) || 'Ceza';
      gameStatusDesc = isKoz ? `👑 Koz: ${suitName}` : `⚡ Ceza: ${cezaName}`;
    }

    // En yüksek puanlı oyuncuyu bul
    const highestScore = (t.players && t.players.length > 0)
      ? Math.max(...t.players.map(p => p.score || 0))
      : 0;

    const scoresHtml = (t.players || []).map(p => {
      const isLeader = p.score === highestScore && p.score !== 0;
      return `
        <div class="stc-score-item ${isLeader ? 'leader' : ''}">
          <span class="stc-player-name">${escapeHtml(p.name)}</span>
          <span class="stc-player-pts">${p.score > 0 ? '+' : ''}${p.score}</span>
        </div>
      `;
    }).join('');

    card.innerHTML = `
      <div class="stc-header">
        <div class="stc-title-wrap">
          <span class="stc-name">🪑 ${escapeHtml(t.name)}</span>
          ${isCurrent ? '<span class="stc-active-badge">BURADASINIZ</span>' : ''}
        </div>
        <span class="stc-hand-badge">${t.roundsCount}/20 El</span>
      </div>
      <div class="stc-current-game">
        <span>${gameStatusDesc}</span>
        ${t.leader ? `<span style="font-size: 11px; color: #34d399;">Lider: <b>${escapeHtml(t.leader)}</b></span>` : ''}
      </div>
      <div class="stc-scores-grid">
        ${scoresHtml}
      </div>
      <div class="stc-actions">
        <button type="button" class="btn-stc-switch" data-table-id="${t.id}">
          ${isCurrent ? '✓ Bu Masadasınız' : 'Bu Masaya Geç ➔'}
        </button>
        <button type="button" class="btn-stc-qr" data-qr-id="${t.id}" title="Bu Masanın QR Kodunu Göster">
          📱 QR
        </button>
      </div>
    `;

    card.querySelector('.btn-stc-switch')?.addEventListener('click', async () => {
      triggerHaptic(15);
      await switchTable(t.id);
      closeSalonOverview();
    });

    card.querySelector('.btn-stc-qr')?.addEventListener('click', () => {
      triggerHaptic(15);
      closeSalonOverview();
      openMobileConnectModal(t.id);
    });

    grid.appendChild(card);
  });
}


// --------------------------------------------------------------------------
// OYUNCU VERİ TABANI & LİSTEDEN SEÇİM YÖNETİMİ
// --------------------------------------------------------------------------
let targetPlayerSelectIdx = 0;
let cachedPlayerDatabase = [];

async function openPlayerDatabaseModal(playerIdx) {
  triggerHaptic(15);
  targetPlayerSelectIdx = playerIdx;
  const modal = document.getElementById('modalPlayerDatabase');
  const title = document.getElementById('modalPlayerDbTitle');
  if (title) title.textContent = `${playerIdx + 1}. Oyuncuyu Seç`;
  if (modal) modal.classList.add('active');

  const searchInput = document.getElementById('inputSearchPlayerDb');
  if (searchInput) {
    searchInput.value = '';
    setTimeout(() => searchInput.focus(), 150);
  }

  await loadPlayerDatabaseList();
}

function closePlayerDatabaseModal() {
  const modal = document.getElementById('modalPlayerDatabase');
  if (modal) modal.classList.remove('active');
}

async function loadPlayerDatabaseList() {
  const container = document.getElementById('playerDbListContainer');
  if (!container) return;

  container.innerHTML = '<div style="color: #94a3b8; text-align: center; padding: 15px;">Oyuncular yükleniyor...</div>';

  try {
    const res = await fetch('/api/players');
    if (res.ok) {
      const data = await res.json();
      cachedPlayerDatabase = Array.isArray(data.players) ? data.players : [];
    }
  } catch (e) {
    // Local fallback
  }

  // Eğer sunucu listesi boşsa local state ve arşivden topla
  if (!cachedPlayerDatabase || cachedPlayerDatabase.length === 0) {
    const defaults = ['Selim', 'Alp', 'Berkay', 'Mesut', 'Barış'];
    cachedPlayerDatabase = defaults;
  }

  renderPlayerDbItems();
}

function renderPlayerDbItems() {
  const container = document.getElementById('playerDbListContainer');
  const searchInput = document.getElementById('inputSearchPlayerDb');
  if (!container) return;

  const query = (searchInput?.value || '').trim().toLocaleLowerCase('tr-TR');
  const rawFiltered = cachedPlayerDatabase.filter(name => {
    return !query || name.toLocaleLowerCase('tr-TR').includes(query);
  });

  // KULLANICI KURALI: Tüm masalarda (Masa 1, 2, 3, 4) oturmakta olan veya bu masanın diğer koltuklarında
  // oturan oyuncuların TAMAMI toplanır.
  const takenNames = getTakenPlayerNamesAcrossAllTables(currentTableId, targetPlayerSelectIdx);

  // Oturmuş olan oyuncular listeden KESİNLİKLE VE ASLA GÖRÜNMEZ! Sadece boşta olanlar listelenir.
  const availablePlayers = rawFiltered.filter(name => {
    if (!name || isDefaultPlayerName(name)) return false;
    const lower = name.trim().toLocaleLowerCase('tr-TR');
    return !takenNames.has(lower);
  });

  if (availablePlayers.length === 0) {
    const hasAnyInDb = cachedPlayerDatabase.length > 0;
    container.innerHTML = `
      <div style="background: rgba(255,255,255,0.03); border: 1px dashed rgba(255,255,255,0.15); border-radius: 10px; padding: 18px; text-align: center; color: #94a3b8; font-size: 13px;">
        ${hasAnyInDb 
          ? '👥 Kayıtlı oyuncuların tümü masalara yerleştirildi (Boşta oyuncu kalmadı).<br><span style="font-size: 11.5px; color: #64748b;">Yeni bir oyuncu eklemek için yukarıdaki kutuyu kullanabilirsiniz.</span>'
          : '🔍 Henüz kayıtlı oyuncu yok.<br><span style="font-size: 11.5px; color: #64748b;">Yukarıdaki kutudan hemen ekleyebilirsiniz.</span>'}
      </div>
    `;
    return;
  }

  let html = `
    <div style="font-size: 11px; color: #10b981; font-weight: 700; margin-bottom: 6px; padding: 2px 4px; display: flex; align-items: center; justify-content: space-between;">
      <span>🟢 Seçilebilir Boşta Oyuncular (${availablePlayers.length})</span>
      <span style="font-size: 10px; color: #64748b;">(Masalara atanmış oyuncular gizlendi)</span>
    </div>
  `;

  availablePlayers.forEach(name => {
    html += `
      <div class="player-db-item" onclick="selectPlayerFromDb('${escapeHtml(name)}')">
        <div class="player-db-name">
          <span style="font-size: 16px;">👤</span>
          <span style="font-weight: 700;">${escapeHtml(name)}</span>
        </div>
        <div class="player-db-actions">
          <button type="button" class="btn btn-primary btn-sm" style="padding: 4px 12px; font-size: 12px;">
            Seç ✓
          </button>
          <button type="button" class="btn-delete-db-player" onclick="event.stopPropagation(); deletePlayerFromDb('${escapeHtml(name)}')" title="Listeden Sil">🗑️</button>
        </div>
      </div>
    `;
  });

  container.innerHTML = html;
}

function selectPlayerFromDb(selectedName) {
  triggerHaptic(20);
  const lower = selectedName.trim().toLocaleLowerCase('tr-TR');

  // Güvenlik: Bir kişi aynı anda birden fazla masada oturamaz!
  const takenNames = getTakenPlayerNamesAcrossAllTables(currentTableId, targetPlayerSelectIdx);
  if (takenNames.has(lower)) {
    showToast(`⛔ "${selectedName}" zaten başka bir koltukta veya masada oturuyor!`, 'rose');
    return;
  }

  if (String(currentTableId) === '1') {
    cleanDuplicatePlayersAcrossTables();
  }

  const inputEl = document.getElementById(`inputPlayer${targetPlayerSelectIdx + 1}`);
  if (inputEl) {
    inputEl.value = selectedName;
  }
  if (state.players && state.players[targetPlayerSelectIdx]) {
    state.players[targetPlayerSelectIdx].name = selectedName;
    hasUserEditedSetupInputs = true;
    lastLocalEditTableId = currentTableId;
    lastLocalSetupEditAt = Date.now();
    saveStateToStorage();
    pushStateToServer();
    if (String(currentTableId) === '1') {
      cleanDuplicatePlayersAcrossTables();
    }
    try { loadTablesList(); } catch (e) {}
  }
  renderAll();
  closePlayerDatabaseModal();
  showToast(`✓ ${targetPlayerSelectIdx + 1}. Oyuncu "${selectedName}" olarak seçildi`, 'emerald');
}

async function addNewPlayerToDb() {
  const newNameInput = document.getElementById('inputNewDbPlayerName');
  if (!newNameInput) return;
  const rawName = newNameInput.value.trim();
  if (!rawName) {
    showToast('Lütfen bir isim yazın!', 'rose');
    return;
  }
  const cleanName = capitalizeWords(rawName);
  triggerHaptic(15);

  try {
    const res = await fetch('/api/players', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'add', name: cleanName })
    });
    if (res.ok) {
      const data = await res.json();
      if (data.players) cachedPlayerDatabase = data.players;
    }
  } catch (e) {
    if (!cachedPlayerDatabase.includes(cleanName)) {
      cachedPlayerDatabase.push(cleanName);
      cachedPlayerDatabase.sort();
    }
  }

  newNameInput.value = '';
  renderPlayerDbItems();
  showToast(`✓ "${cleanName}" oyuncu listesine eklendi!`, 'emerald');
}

async function deletePlayerFromDb(nameToDelete) {
  if (!confirm(`"${nameToDelete}" oyuncu listesinden silinsin mi?`)) return;
  triggerHaptic(15);

  try {
    const res = await fetch('/api/players', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'delete', name: nameToDelete })
    });
    if (res.ok) {
      const data = await res.json();
      if (data.players) cachedPlayerDatabase = data.players;
    }
  } catch (e) {
    cachedPlayerDatabase = cachedPlayerDatabase.filter(p => p !== nameToDelete);
  }

  renderPlayerDbItems();
  showToast(`"${nameToDelete}" listeden silindi.`, 'amber');
}

// --------------------------------------------------------------------------
// GEÇMİŞ OYUNLAR ARŞİVİ & TOPLU ÇIKTI YÖNETİMİ
// --------------------------------------------------------------------------
async function openArchivesModal() {
  triggerHaptic(15);
  const modal = document.getElementById('modalArchives');
  if (!modal) return;
  modal.classList.add('active');
  await loadArchivesList();
}

function closeArchivesModal() {
  const modal = document.getElementById('modalArchives');
  if (modal) modal.classList.remove('active');
}

async function loadArchivesList() {
  const container = document.getElementById('archivesListContainer');
  if (!container) return;

  container.innerHTML = '<div style="color: #94a3b8; text-align: center; padding: 20px;">Arşivler yükleniyor...</div>';

  try {
    const res = await fetch('/api/archives');
    const data = await res.json();
    if (!data.ok || !data.archives || data.archives.length === 0) {
      container.innerHTML = `
        <div style="background: rgba(255,255,255,0.03); border: 1px dashed rgba(255,255,255,0.15); border-radius: 12px; padding: 24px; text-align: center; color: #94a3b8;">
          📂 Henüz arşivlenmiş tamamlanmış oyun bulunmuyor.<br>
          <span style="font-size: 12px; color: #64748b;">Mevcut oyunu kaydetmek için yukarıdaki "Aktif Oyunu Arşive Kaydet" butonuna basabilirsiniz.</span>
        </div>
      `;
      return;
    }

    let html = '';
    data.archives.forEach((arc) => {
      const playersHtml = arc.players.map(p => `
        <span style="background: rgba(255,255,255,0.05); padding: 3px 8px; border-radius: 6px; font-size: 12px;">
          ${escapeHtml(p.name)}: <b style="color: ${p.score > 0 ? '#34d399' : (p.score === 0 ? '#fde047' : '#f87171')};">${p.score > 0 ? '+' : ''}${p.score}</b>
        </span>
      `).join(' ');

      html += `
        <div style="background: rgba(15, 23, 42, 0.85); border: 1px solid rgba(255,255,255,0.12); border-radius: 12px; padding: 14px; display: flex; flex-direction: column; gap: 8px;">
          <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 6px;">
            <div style="display: flex; align-items: center; gap: 8px;">
              <span style="font-size: 18px;">👑</span>
              <span style="font-weight: 800; font-size: 15px; color: #fff;">${escapeHtml(arc.title || 'King Oyunu')}</span>
              <span style="font-size: 11px; background: rgba(234, 179, 8, 0.2); color: #fde047; padding: 2px 6px; border-radius: 4px;">${arc.roundsCount}/20 El</span>
            </div>
            <span style="font-size: 12px; color: #94a3b8;">📅 ${arc.date || ''}</span>
          </div>
          <div style="display: flex; flex-wrap: wrap; gap: 6px; margin: 4px 0;">
            ${playersHtml}
          </div>
          <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 4px; padding-top: 6px; border-top: 1px solid rgba(255,255,255,0.06);">
            <span style="font-size: 12px; color: #a7f3d0;">🏆 Kazanan: <b>${escapeHtml(arc.winner || 'Belirsiz')}</b></span>
            <div style="display: flex; gap: 8px; flex-wrap: wrap;">
              <button type="button" class="btn btn-primary btn-sm" onclick="restoreGameFromArchive(${arc.id}, '${escapeHtml(arc.title || 'King Oyunu').replace(/'/g, "\\'")}')" style="padding: 4px 10px; font-size: 12px;">
                🔄 Masaya Yükle
              </button>
              <a href="/api/export-csv?id=${arc.id}" class="btn btn-secondary btn-sm" style="text-decoration: none; padding: 4px 10px; font-size: 12px;" download>
                📊 Excel İndir
              </a>
            </div>
          </div>
        </div>
      `;
    });

    container.innerHTML = html;
  } catch (err) {
    container.innerHTML = '<div style="color: #f87171; text-align: center; padding: 15px;">Arşivler yüklenirken hata oluştu.</div>';
  }
}


async function restoreGameFromArchive(archiveId, title) {
  triggerHaptic(20);
  const ok = confirm(`"${title}" adlı kayıtlı oyunu masaya yüklemek istiyor musunuz?\n\nMevcut masadaki bilgilerin yerine bu oyunun tüm oyuncu isimleri, oynanmış elleri ve puanları gelecektir.`);
  if (!ok) return;

  try {
    const res = await fetch('/api/restore-archive', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: archiveId })
    });
    const data = await res.json();
    if (data.ok && data.state) {
      state = data.state;
      saveStateToStorage();
      renderAll();
      closeArchivesModal();
      goToScreen(3, true); // Sonuçlar / Çete ekranına git
      showToast(`📂 "${title}" tüm bilgileriyle masaya yüklendi!`, 'emerald');
    } else {
      showToast('Oyun masaya yüklenemedi.', 'rose');
    }
  } catch (err) {
    showToast('Sunucuya bağlanılamadı.', 'rose');
  }
}

async function archiveCurrentGameManual() {
  triggerHaptic(20);
  if (!state.rounds || state.rounds.length === 0) {
    showToast('Henüz oynanmış el bulunmuyor.', 'amber');
    return;
  }
  const now = new Date();
  const timeStr = now.toLocaleDateString('tr-TR') + ' ' + now.toLocaleTimeString('tr-TR');
  const title = prompt('Bu oyun için bir isim veya not girin:', `King Maçı (${state.rounds.length}/20 El - ${timeStr})`);
  if (title === null) return;

  try {
    const res = await fetch('/api/archive-current', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: title.trim() || undefined })
    });
    const data = await res.json();
    if (data.ok) {
      showToast('💾 Oyun arşive başarıyla kaydedildi!', 'emerald');
      await loadArchivesList();
    } else {
      showToast(data.message || 'Kayıt başarısız.', 'rose');
    }
  } catch (err) {
    showToast('Sunucuya bağlanılamadı.', 'rose');
  }
}

/**
 * KING PUAN & CEZA HESAPLAMA SİSTEMİ
 * 4 Bağımsız Ekran (Oyuncular, Koz, Ceza, Sonuçlar) & Yatay Kaydırma (Swipe) Motoru
 */

// Sabit King Oyun Türleri ve Kural Parametreleri
const GAME_DEFS = {
  koz: {
    key: 'koz',
    title: 'Koz Oyunu',
    shortTitle: 'Koz',
    icon: '👑',
    isKoz: true,
    totalUnits: 13,
    unitName: 'El',
    baseUnitPoint: 50,
    desc: 'Alınan her el +50 puan kazandırır. Toplam 13 el dağıtılmalıdır.'
  },
  el_almaz: {
    key: 'el_almaz',
    title: 'El Almaz',
    shortTitle: 'El Almaz',
    icon: '✋',
    isKoz: false,
    totalUnits: 13,
    unitName: 'El',
    baseUnitPoint: -50,
    desc: 'Alınan her el -50 puan ceza verir. Toplam 13 el dağıtılmalıdır.'
  },
  kupa_almaz: {
    key: 'kupa_almaz',
    title: 'Kupa Almaz',
    shortTitle: 'Kupa',
    icon: '♥️',
    isKoz: false,
    totalUnits: 13,
    unitName: 'Kupa',
    baseUnitPoint: -30,
    desc: 'Alınan her kupa kağıdı -30 puan ceza verir. Toplam 13 kupa dağıtılmalıdır.'
  },
  kiz_almaz: {
    key: 'kiz_almaz',
    title: 'Kız Almaz',
    shortTitle: 'Kız',
    icon: '👸',
    isKoz: false,
    totalUnits: 4,
    unitName: 'Kız',
    baseUnitPoint: -100,
    desc: 'Alınan her Kız (Q) -100 puan ceza verir. Toplam 4 kız dağıtılmalıdır.'
  },
  erkek_almaz: {
    key: 'erkek_almaz',
    title: 'Erkek Almaz',
    shortTitle: 'Erkek',
    icon: '🤴',
    isKoz: false,
    totalUnits: 8,
    unitName: 'Erkek',
    baseUnitPoint: -60,
    desc: 'Alınan her Vale (J) ve Papaz (K) -60 puan ceza verir. Toplam 8 erkek dağıtılmalıdır.'
  },
  rifki: {
    key: 'rifki',
    title: 'Rıfkı (Kupa Papazı)',
    shortTitle: 'Rıfkı',
    icon: '🗡️',
    isKoz: false,
    totalUnits: 1,
    unitName: 'Kupa Papazı',
    baseUnitPoint: -320,
    desc: 'Kupa Papazını (K♥️) alan oyuncu tek seferde -320 puan ceza yer.'
  },
  son_iki: {
    key: 'son_iki',
    title: 'Son İki El Almaz',
    shortTitle: 'Son İki',
    icon: '⏳',
    isKoz: false,
    totalUnits: 2,
    unitName: 'El',
    baseUnitPoint: -180,
    desc: 'Son iki eli (12. ve 13. el) alan oyuncular el başı -180 puan ceza yer.'
  }
};

const STORAGE_KEY = 'king_score_game_v1';

// Varsayılan State
let state = {
  players: [
    { id: 0, name: 'Oyuncu 1', score: 0, kozCount: 0, cezaCount: 0 },
    { id: 1, name: 'Oyuncu 2', score: 0, kozCount: 0, cezaCount: 0 },
    { id: 2, name: 'Oyuncu 3', score: 0, kozCount: 0, cezaCount: 0 },
    { id: 3, name: 'Oyuncu 4', score: 0, kozCount: 0, cezaCount: 0 },
  ],
  initialDealer: 0,
  scoringMode: 'standard', // 'standard' | 'zero_sum' | 'bloody'
  rounds: [],
  activeHandType: 'ceza',
  selectedCezaKey: 'el_almaz',
  selectedKozSuit: 'karo',
  kozInputs: [0, 0, 0, 0],
  cezaInputs: [0, 0, 0, 0],
  kozConfirmed: [false, false, false, false],
  cezaConfirmed: [false, false, false, false]
};

// Çoklu Cihaz Senkronizasyonu & Haptic
let serverVersion = 0;
let tableServerVersions = { '1': 0, '2': 0, '3': 0, '4': 0 };
let isServerOnline = false;
let isSyncing = false;
let serverNetworkUrl = '';
let syncIntervalId = null;
let currentScreenIndex = 0;
let lastLocalSetupEditAt = 0;
let lastLocalEditTableId = null;
let hasUserEditedSetupInputs = false;
let setupSyncTimer = null;

// İsim ve Soyisimlerin Baş Harflerini Otomatik Büyütme (Türkçe karakter duyarlı: i->İ, ı->I)
function capitalizeWords(str) {
  if (!str) return '';
  return str.split(' ').map(word => {
    if (!word) return '';
    let first = word.charAt(0);
    if (first === 'i') first = 'İ';
    else if (first === 'ı') first = 'I';
    else first = first.toLocaleUpperCase('tr-TR');
    return first + word.slice(1);
  }).join(' ');
}

function syncSetupInputsToState(silent = true) {
  ['inputPlayer1', 'inputPlayer2', 'inputPlayer3', 'inputPlayer4'].forEach((id, idx) => {
    const el = document.getElementById(id);
    if (!el || !state.players || !state.players[idx]) return;

    const trimmed = capitalizeWords(el.value.trim());
    const defaultName = getDefaultPlayerName(currentTableId, idx);

    if (!trimmed) {
      // Eğer kutu boş bırakılmışsa masanın kendi varsayılan ismi verilir
      if (!state.players[idx].name || isDefaultPlayerName(state.players[idx].name)) {
        state.players[idx].name = defaultName;
      }
      return;
    }

    if (trimmed !== defaultName) {
      const lower = trimmed.toLocaleLowerCase('tr-TR');
      // Çapraz masa çakışma kontrolü (mevcut masa hariç)
      const occupied = getAllOccupiedPlayers(currentTableId, idx);
      const otherOccupied = occupied.get(lower);

      if (otherOccupied) {
        if (!silent) showToast(`⛔ "${trimmed}" zaten ${otherOccupied.tableName}'de oynuyor! Bir kişi aynı anda 2 masada bulunamaz.`, 'rose');
        el.value = isDefaultPlayerName(state.players[idx].name) ? '' : state.players[idx].name;
        el.classList.add('input-error-flash');
        setTimeout(() => el.classList.remove('input-error-flash'), 800);
        return;
      }

      // Aynı masada çift yazılma kontrolü
      const isDuplicateInCurrent = state.players.some((p, pIdx) =>
        pIdx !== idx && (p.name || '').trim().toLocaleLowerCase('tr-TR') === lower
      );
      if (isDuplicateInCurrent) {
        if (!silent) showToast(`⚠️ "${trimmed}" bu masada zaten başka bir koltuğa yazılmış!`, 'amber');
        return;
      }

      state.players[idx].name = trimmed;
    }
  });
}

function validateAndSyncPlayerInput(idx) {
  const el = document.getElementById(`inputPlayer${idx + 1}`);
  if (!el || !state.players || !state.players[idx]) return;

  const rawVal = el.value.trim();
  const defaultName = getDefaultPlayerName(currentTableId, idx);

  if (!rawVal) {
    state.players[idx].name = defaultName;
    saveStateToStorage();
    pushStateToServer();
    renderAll();
    return;
  }

  const cleanName = capitalizeWords(rawVal);
  const lower = cleanName.toLocaleLowerCase('tr-TR');

  // Başka masada oynuyor mu kontrolü
  const occupied = getAllOccupiedPlayers(currentTableId, idx);
  const otherOccupied = occupied.get(lower);

  if (otherOccupied) {
    showToast(`⛔ "${cleanName}" zaten ${otherOccupied.tableName}'de oynuyor! Bir kişi aynı anda 2 masada bulunamaz.`, 'rose');
    el.value = isDefaultPlayerName(state.players[idx].name) ? '' : state.players[idx].name;
    el.classList.add('input-error-flash');
    setTimeout(() => el.classList.remove('input-error-flash'), 800);
    return;
  }

  // Bu masanın başka bir koltuğunda var mı?
  const isDuplicateInCurrent = state.players.some((p, pIdx) =>
    pIdx !== idx && (p.name || '').trim().toLocaleLowerCase('tr-TR') === lower
  );
  if (isDuplicateInCurrent) {
    showToast(`⚠️ "${cleanName}" bu masada zaten başka bir koltuğa yazılmış!`, 'amber');
    el.value = isDefaultPlayerName(state.players[idx].name) ? '' : state.players[idx].name;
    el.classList.add('input-error-flash');
    setTimeout(() => el.classList.remove('input-error-flash'), 800);
    return;
  }

  state.players[idx].name = cleanName;
  saveStateToStorage();
  pushStateToServer();
  renderAll();
}

function ensureStateArrays(st) {
  if (!st) return;
  if (!Array.isArray(st.kozInputs) || st.kozInputs.length !== 4) st.kozInputs = [0, 0, 0, 0];
  if (!Array.isArray(st.cezaInputs) || st.cezaInputs.length !== 4) st.cezaInputs = [0, 0, 0, 0];
  if (!Array.isArray(st.kozConfirmed) || st.kozConfirmed.length !== 4) st.kozConfirmed = [false, false, false, false];
  if (!Array.isArray(st.cezaConfirmed) || st.cezaConfirmed.length !== 4) st.cezaConfirmed = [false, false, false, false];
  if (!st.activeHandType) st.activeHandType = 'ceza';
  if (!st.selectedCezaKey) st.selectedCezaKey = 'el_almaz';
  if (!st.selectedKozSuit) st.selectedKozSuit = 'karo';
}

function triggerHaptic(duration = 20) {
  try {
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate(duration);
    }
  } catch (e) {}
}

// ==========================================================================
// UYGULAMA BAŞLATMA
// ==========================================================================
document.addEventListener('DOMContentLoaded', async () => {
  initSpectatorMode();
  cleanDuplicatePlayersAcrossTables();
  loadStateFromStorage();
  cleanDuplicatePlayersAcrossTables();
  initSliderNavigation();
  initEventListeners();
  renderAll();
  renderTableBar();
  renderTableSetupUI();

  // Çoklu masaları sunucudan yükle
  await loadTablesList();

  // Eğer oyun devam ediyorsa (1-19 el) ilgili oyun ekranına git,
  // ama oyun bitmişse (20/20) veya henüz başlamamışsa her zaman temiz Kurulum/Oyuncular (Sayfa 0) açılır
  const isFinished = (state.rounds && state.rounds.length >= 20) || hasKingWinner();
  const isInProgress = state.rounds && state.rounds.length > 0 && !isFinished;

  if (isInProgress) {
    const targetScreen = (state.activeHandType === 'koz' && state.rounds.length >= 4) ? 2 : 1;
    goToScreen(targetScreen, false);
  } else {
    goToScreen(0, false); // Boş / Kurulum (Oyuncular) sayfası
  }

  // Sunucu ve ağ kontrolü
  await fetchNetworkInfo();
  await fetchServerState(true);

  // Yüksek Hızlı Canlı Senkronizasyon (her 400 ms - anlık tepki)
  syncIntervalId = setInterval(() => {
    fetchServerState(false);
  }, 400);

  // Telefon ekranı kilitlenip açıldığında veya sekmeye dönüldüğünde anında senkronize et
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      fetchServerState(false);
    }
  });

  window.addEventListener('focus', () => {
    fetchServerState(false);
  });
});

// ==========================================================================
// SWIPE SLIDER & EKRAN KAYDIRMA YÖNETİMİ
// ==========================================================================
function initSliderNavigation() {
  const slider = document.getElementById('screensSlider');
  const tabs = document.querySelectorAll('.swipe-tab');
  const indicator = document.getElementById('swipeIndicator');
  const maxIndex = Math.max(0, tabs.length - 1);

  // Sekmelere tıklama
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      const idx = parseInt(tab.dataset.index, 10);
      triggerHaptic(15);
      goToScreen(idx, true);
    });
  });

  // Dokunmatik kaydırma sırasında sarı çizgiyi anlık takip ettir ve aktif sekmeyi güncelle
  let scrollTimeout = null;
  slider.addEventListener('scroll', () => {
    const screenWidth = slider.clientWidth;
    if (screenWidth <= 0) return;

    const progress = Math.max(0, Math.min(maxIndex, slider.scrollLeft / screenWidth));
    if (indicator && tabs.length > 0) {
      const tabWidth = 100 / tabs.length;
      indicator.style.transition = 'none';
      indicator.style.width = `${tabWidth}%`;
      indicator.style.left = `${progress * tabWidth}%`;
      indicator.style.transform = 'none';
    }

    const nearestIndex = Math.round(progress);
    if (nearestIndex !== currentScreenIndex && nearestIndex >= 0 && nearestIndex <= maxIndex) {
      currentScreenIndex = nearestIndex;
      tabs.forEach((tab, i) => {
        tab.classList.toggle('active', i === currentScreenIndex);
      });
    }

    clearTimeout(scrollTimeout);
    scrollTimeout = setTimeout(() => {
      const finalIndex = Math.round(slider.scrollLeft / screenWidth);
      if (finalIndex >= 0 && finalIndex <= maxIndex) {
        currentScreenIndex = finalIndex;
      }
      updateSwipeTabs(currentScreenIndex);
    }, 60);
  }, { passive: true });

  window.addEventListener('resize', () => {
    if (slider.clientWidth > 0) {
      slider.scrollTo({
        left: currentScreenIndex * slider.clientWidth,
        behavior: 'auto'
      });
    }
    updateSwipeTabs(currentScreenIndex);
  });
}

// --------------------------------------------------------------------------
// KAYDEDİLMEMİŞ PUAN GİRİŞİ KORUMASI & GÜVENLİ SAYFA GEÇİŞİ
// --------------------------------------------------------------------------
function checkUnsavedBeforeNavigate(targetIndex, onProceed) {
  // Yalnızca dağıtım TAMAMLANMIŞ (13/13 el girilmiş) ama kaydedilmeden çıkılıyorsa uyar ve kaydetme fırsatı ver
  if (currentScreenIndex === 1 && targetIndex !== 1) {
    const cezaSum = (state.cezaInputs || []).reduce((a, b) => a + (b || 0), 0);
    const activeKey = state.selectedCezaKey || 'el_almaz';
    const def = GAME_DEFS[activeKey] || GAME_DEFS.el_almaz;
    if (cezaSum === def.totalUnits) {
      openUnsavedWarningModal('ceza', true, cezaSum, def.totalUnits, onProceed);
      return false;
    }
  }

  // Koz ekranından (2) tam el girilmişken çıkılıyorsa
  if (currentScreenIndex === 2 && targetIndex !== 2) {
    const kozSum = (state.kozInputs || []).reduce((a, b) => a + (b || 0), 0);
    if (kozSum === 13) {
      openUnsavedWarningModal('koz', true, kozSum, 13, onProceed);
      return false;
    }
  }

  // Dağıtım henüz tamamlanmamışsa veya boşsa hiçbir engelleme yapmadan akıcı geç
  if (onProceed) onProceed();
  return true;
}

function openUnsavedWarningModal(type, isValid, currentSum, totalUnits, onProceed) {
  const modal = document.getElementById('modalUnsavedWarning');
  const lblTitle = document.getElementById('lblUnsavedModalTitle');
  const lblDesc = document.getElementById('lblUnsavedModalDesc');
  const btnSave = document.getElementById('btnUnsavedSaveAndLeave');
  const btnDiscard = document.getElementById('btnUnsavedDiscardAndLeave');
  const btnStay = document.getElementById('btnUnsavedStay');
  const btnClose = document.getElementById('btnCloseUnsavedModal');

  if (!modal) {
    if (onProceed) onProceed();
    return;
  }

  triggerHaptic(25);
  const typeText = (type === 'koz') ? 'Koz' : 'Ceza';

  if (isValid) {
    if (lblTitle) lblTitle.textContent = `💾 ${typeText} Eli Dağıtıldı Ama Henüz Kaydedilmedi!`;
    if (lblDesc) lblDesc.textContent = `Toplam ${totalUnits} ${type === 'koz' ? 'el' : 'adet'} eksiksiz dağıtılmış durumda. Sayfadan ayrılmadan önce bu eli çeteye işlemek ister misiniz?`;
    if (btnSave) {
      btnSave.style.display = 'flex';
      btnSave.textContent = `💾 Bu ${typeText} Elini Kaydet ve Devam Et ✓`;
    }
  } else {
    const diff = totalUnits - currentSum;
    if (lblTitle) lblTitle.textContent = `⚠️ Tamamlanmamış ${typeText} Dağıtımı Var!`;
    if (lblDesc) {
      if (diff > 0) {
        lblDesc.textContent = `Henüz ${diff} adet eksik dağıtım var (${currentSum}/${totalUnits}). Sayfadan çıkarsanız girilen sayılar silinecektir.`;
      } else {
        lblDesc.textContent = `Toplam ${totalUnits} olması gerekirken +${Math.abs(diff)} adet fazla girildi. Sayfadan çıkarsanız girilen sayılar silinecektir.`;
      }
    }
    if (btnSave) {
      btnSave.style.display = 'none';
    }
  }

  const closeModal = () => {
    modal.classList.remove('active');
  };

  if (btnSave) {
    btnSave.onclick = () => {
      triggerHaptic(30);
      closeModal();
      if (type === 'koz') {
        saveKozHand();
      } else {
        saveCezaHand();
      }
      if (onProceed) onProceed();
    };
  }

  if (btnDiscard) {
    btnDiscard.onclick = () => {
      triggerHaptic(20);
      closeModal();
      if (type === 'koz') {
        state.kozInputs = [0, 0, 0, 0];
        state.kozConfirmed = [false, false, false, false];
      } else {
        state.cezaInputs = [0, 0, 0, 0];
        state.cezaConfirmed = [false, false, false, false];
      }
      renderAll();
      if (onProceed) onProceed();
    };
  }

  if (btnStay) {
    btnStay.onclick = () => {
      triggerHaptic(15);
      closeModal();
    };
  }

  if (btnClose) {
    btnClose.onclick = () => {
      closeModal();
    };
  }

  modal.classList.add('active');
}

function goToScreen(index, smooth = true, force = false) {
  if (!force) {
    const canNavigate = checkUnsavedBeforeNavigate(index, () => {
      goToScreen(index, smooth, true);
    });
    if (!canNavigate) return;
  }

  const slider = document.getElementById('screensSlider');
  const tabs = document.querySelectorAll('.swipe-tab');
  const maxIndex = Math.max(0, (tabs.length || 5) - 1);
  currentScreenIndex = Math.max(0, Math.min(maxIndex, index));
  const screenWidth = slider.clientWidth;
  
  slider.scrollTo({
    left: currentScreenIndex * screenWidth,
    behavior: smooth ? 'smooth' : 'auto'
  });

  updateSwipeTabs(currentScreenIndex);
}

function updateSwipeTabs(index) {
  const tabs = document.querySelectorAll('.swipe-tab');
  const indicator = document.getElementById('swipeIndicator');
  const count = tabs.length || 5;

  tabs.forEach((tab, i) => {
    tab.classList.toggle('active', i === index);
  });

  if (indicator) {
    const tabWidth = 100 / count;
    indicator.style.transition = 'left 0.24s cubic-bezier(0.2, 0.8, 0.2, 1), width 0.24s ease';
    indicator.style.width = `${tabWidth}%`;
    indicator.style.left = `${index * tabWidth}%`;
    indicator.style.transform = 'none';
  }
}

// ==========================================================================
// SUNUCU & STORAGE SENKRONİZASYONU (ÇOKLU MASA DESTEKLİ)
// ==========================================================================
async function fetchNetworkInfo(targetTid = currentTableId) {
  try {
    const res = await fetch(`/api/network-info?table=${targetTid}&t=${Date.now()}`, { cache: 'no-store' });
    if (res.ok) {
      const data = await res.json();
      // Docker, ters vekil veya port yönlendirme arkasında sunucunun yerel
      // adresi dışarıdan erişilemez olabilir. Telefon bağlantısı için
      // tarayıcının gerçekten açtığı adres her zaman doğru kaynaktır.
      const origin = window.location.origin;
      serverNetworkUrl = (targetTid && String(targetTid) !== '1')
        ? `${origin}/?masa=${targetTid}`
        : (origin || data.url || serverNetworkUrl);
      return data;
    }
  } catch (e) {}
  return null;
}

let isFetchingState = false;

async function fetchServerState(initial = false) {
  if (isFetchingState) return;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 2500);
  isFetchingState = true;
  try {
    const fetchUrl = (String(currentTableId) === '1')
      ? `/api/state?t=${Date.now()}`
      : `/api/state?table=${currentTableId}&t=${Date.now()}`;
    const res = await fetch(fetchUrl, {
      cache: 'no-store',
      headers: { 'X-Table-Id': String(currentTableId) },
      signal: controller.signal
    });
    clearTimeout(timeoutId);
    if (res.ok) {
      const data = await res.json();
      updateSyncBadge(true);

      // Sunucudan gelen verinin bu masaya ait olup olmadığını doğrula (farklı masaların ezilmesini önle)
      const isTargetTableData = data.tableId
        ? (String(data.tableId) === String(currentTableId))
        : (String(currentTableId) === '1');

      if (!isTargetTableData) {
        // Bu veri başka masaya ait (eski tek masalı sunucu yanıtı veya farklı masa).
        // Mevcut masanın üzerine asla yazma!
        return;
      }

      if (data.version && data.version > serverVersion) {
        const prevRoundsLen = state.rounds ? state.rounds.length : 0;
        if (!initial) syncSetupInputsToState();
        const localNamesSnapshot = state.players ? state.players.map(p => p.name) : [];
        const localDealerSnapshot = state.initialDealer;
        const isEditingSetup = !initial && (lastLocalEditTableId === currentTableId) && (
          hasUserEditedSetupInputs ||
          ['inputPlayer1', 'inputPlayer2', 'inputPlayer3', 'inputPlayer4'].some(
            id => document.activeElement && document.activeElement.id === id
          ) ||
          (Date.now() - lastLocalSetupEditAt < 15000)
        );

        serverVersion = data.version;
        if (typeof tableServerVersions !== 'undefined') {
          tableServerVersions[currentTableId] = data.version;
        }

        if (data.state && Array.isArray(data.state.players)) {
          // KORUMA: Eğer yerelde girilmiş gerçek oyuncu isimleri varsa ve sunucuda oyun henüz başlamamışsa (rounds.length == 0)
          // ve sunucudaki isimler varsayılan ("Oyuncu 1..4") ise, yereldeki gerçek isimleri ASLA ezme!
          const hasLocalRealPlayers = localNamesSnapshot.some(n => n && !isDefaultPlayerName(n));
          const isServerDefaultOnly = data.state.players.every(p => !p || !p.name || isDefaultPlayerName(p.name));
          const hasServerRounds = Array.isArray(data.state.rounds) && data.state.rounds.length > 0;

          state = data.state;
          ensureStateArrays(state);
          if (isEditingSetup || (hasLocalRealPlayers && isServerDefaultOnly && !hasServerRounds)) {
            state.players.forEach((p, idx) => {
              const localName = localNamesSnapshot[idx];
              if (localName && !isDefaultPlayerName(localName)) {
                p.name = localName;
              }
            });
            state.initialDealer = localDealerSnapshot;
            pushStateToServer();
          } else {
            updateSetupInputFields();
          }
          recalculateAllScores();
          saveStateToStorage();
          renderAll();
          if (!initial && state.rounds.length !== prevRoundsLen) {
            showToast('🔄 Yeni el kaydedildi, çetele güncellendi!', 'cyan');
          }
        }
      }
    } else {
      updateSyncBadge(false);
    }
  } catch (e) {
    clearTimeout(timeoutId);
    updateSyncBadge(false);
  } finally {
    isFetchingState = false;
  }
}

async function pushStateToServer() {
  ensureStateArrays(state);
  saveStateToStorage();
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 5000);
  try {
    isSyncing = true;
    const postUrl = (String(currentTableId) === '1') ? '/api/state' : `/api/state?table=${currentTableId}`;
    const res = await fetch(postUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Table-Id': String(currentTableId)
      },
      body: JSON.stringify({ state: state, version: serverVersion, tableId: currentTableId }),
      signal: controller.signal
    });
    clearTimeout(timeoutId);
    if (res.ok) {
      const data = await res.json();
      if (data.version) {
        serverVersion = data.version;
        if (typeof tableServerVersions !== 'undefined') {
          tableServerVersions[currentTableId] = data.version;
        }
      }
      updateSyncBadge(true);
    } else {
      updateSyncBadge(false);
    }
  } catch (e) {
    clearTimeout(timeoutId);
    updateSyncBadge(false);
  } finally {
    isSyncing = false;
  }
}

async function sendPlayerInputToServer(payload) {
  ensureStateArrays(state);
  saveStateToStorage();
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 4000);
  try {
    isSyncing = true;
    const mergedPayload = Object.assign({}, payload, { tableId: currentTableId });
    const res = await fetch('/api/player-input', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Table-Id': String(currentTableId)
      },
      body: JSON.stringify(mergedPayload),
      signal: controller.signal
    });
    clearTimeout(timeoutId);
    if (res.ok) {
      const data = await res.json();
      if (data.version) {
        serverVersion = data.version;
        if (typeof tableServerVersions !== 'undefined') {
          tableServerVersions[currentTableId] = data.version;
        }
      }
      if (data.state && Array.isArray(data.state.players)) {
        state = data.state;
        ensureStateArrays(state);
        recalculateAllScores();
        saveStateToStorage();
        renderAll();
      }
      updateSyncBadge(true);
      return;
    }
  } catch (e) {
    clearTimeout(timeoutId);
    // Fallback
  } finally {
    isSyncing = false;
  }
  await pushStateToServer();
}

function updateSyncBadge(online) {
  isServerOnline = online;
  const badge = document.getElementById('syncBadge');
  const dot = badge?.querySelector('.sync-dot');
  const text = document.getElementById('syncText');
  if (!badge) return;

  const isCloud = window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1' && window.location.protocol.startsWith('http');
  if (online) {
    badge.className = 'sync-badge';
    if (dot) dot.className = 'sync-dot online';
    if (text) text.textContent = 'Canlı Senkronize';
  } else if (isCloud) {
    badge.className = 'sync-badge';
    if (dot) dot.className = 'sync-dot online';
    if (text) text.textContent = 'Bulut Modu (Aktif)';
  } else {
    badge.className = 'sync-badge offline';
    if (dot) dot.className = 'sync-dot offline';
    if (text) text.textContent = 'Yerel Mod';
  }
}

function saveStateToStorage() {
  try {
    const key = getGameStorageKey(currentTableId);
    localStorage.setItem(key, JSON.stringify(state));
  } catch (e) {}
}

function updateSetupInputFields() {
  const tid = currentTableId;
  ['inputPlayer1', 'inputPlayer2', 'inputPlayer3', 'inputPlayer4'].forEach((id, idx) => {
    const el = document.getElementById(id);
    if (!el) return;
    const defaultName = getDefaultPlayerName(tid, idx);
    el.placeholder = `${idx + 1}. Oyuncu Adı (${defaultName})`;
    const currentName = (state.players && state.players[idx]) ? state.players[idx].name : '';
    if (isDefaultPlayerName(currentName)) {
      el.value = '';
    } else {
      el.value = currentName;
    }
  });
}

function loadStateFromStorage() {
  try {
    const key = getGameStorageKey(currentTableId);
    const raw = localStorage.getItem(key);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && Array.isArray(parsed.players) && parsed.players.length === 4) {
        // Kontrol: Eğer bu masa Masa 1 değilse ve içindeki isimler Masa 1 ile kopyalanmışsa (eski hatadan kalma):
        if (String(currentTableId) !== '1') {
          const t1Raw = localStorage.getItem(getGameStorageKey('1'));
          if (t1Raw) {
            try {
              const t1Parsed = JSON.parse(t1Raw);
              if (t1Parsed && Array.isArray(t1Parsed.players)) {
                const t1Names = t1Parsed.players
                  .map(p => (p && p.name ? p.name.trim().toLocaleLowerCase('tr-TR') : ''))
                  .filter(nm => nm && !isDefaultPlayerName(nm));

                let hasChanges = false;
                parsed.players.forEach((p, idx) => {
                  const pName = (p && p.name ? p.name.trim().toLocaleLowerCase('tr-TR') : '');
                  if (pName && t1Names.includes(pName)) {
                    // Masa 1'de oturan bu oyuncuyu Masa 2'den temizle
                    parsed.players[idx] = {
                      id: idx,
                      name: getDefaultPlayerName(currentTableId, idx),
                      score: 0,
                      kozCount: 0,
                      cezaCount: 0
                    };
                    hasChanges = true;
                  }
                });
                if (hasChanges) {
                  localStorage.setItem(key, JSON.stringify(parsed));
                }
              }
            } catch (e) {}
          }
        }

        state = parsed;
        ensureStateArrays(state);
        recalculateAllScores();
        updateSetupInputFields();
        return;
      }
    }
  } catch (e) {}

  // O masaya ait yerel kayıt yoksa o masaya özel bağımsız varsayılan state oluştur
  state = createDefaultTableState(currentTableId);
  ensureStateArrays(state);
  recalculateAllScores();
  saveStateToStorage();
  updateSetupInputFields();
}

// ==========================================================================
// PUAN VE HAK HESAPLAMA MOTORU
// ==========================================================================
function hasKingWinner() {
  return typeof state.kingWinnerIdx === 'number' && state.kingWinnerIdx >= 0 && state.kingWinnerIdx < 4;
}

function recalculateAllScores() {
  state.players.forEach(p => {
    p.score = 0;
    p.kozCount = 0;
    p.cezaCount = 0;
  });
  state.kingWinnerIdx = null;
  state.kingWinnerName = null;
  state.kingWinnerTricks = null;

  state.rounds.forEach(round => {
    const caller = state.players[round.callerIdx];
    if (caller) {
      if (round.isKoz) {
        caller.kozCount++;
      } else {
        caller.cezaCount++;
      }
      round.callerName = caller.name;
    }

    round.points.forEach((pt, pIdx) => {
      if (state.players[pIdx]) {
        state.players[pIdx].score += pt;
      }
    });

    const callerTricks = (round.isKoz && Array.isArray(round.distribution)) ? (round.distribution[round.callerIdx] || 0) : 0;
    if (round.isKingWin || (round.isKoz && callerTricks >= 11)) {
      round.isKingWin = true;
      round.kingTricks = round.kingTricks || callerTricks || 11;
      state.kingWinnerIdx = round.callerIdx;
      state.kingWinnerName = caller ? caller.name : round.callerName;
      state.kingWinnerTricks = round.kingTricks;
    }
  });
}

function calculateHandPoints(gameKey, callerIdx, distribution) {
  const def = GAME_DEFS[gameKey];
  if (!def) return [0, 0, 0, 0];

  let unitPoint = def.baseUnitPoint;
  if (state.scoringMode === 'zero_sum' && !def.isKoz) {
    unitPoint = def.baseUnitPoint * 2;
  }

  const points = distribution.map((count, pIdx) => {
    let p = count * unitPoint;
    if (state.scoringMode === 'bloody' && !def.isKoz && pIdx === callerIdx && p < 0) {
      p = p * 2;
    }
    return p;
  });

  return points;
}

function getCurrentHandNumber() {
  return state.rounds.length + 1;
}

function getCurrentCallerIndex() {
  const handIdx = state.rounds.length;
  return (state.initialDealer + handIdx) % 4;
}

function getGlobalGameUsageCount(gameKey) {
  return state.rounds.filter(r => r.gameKey === gameKey).length;
}

function getPlayerGameUsageCount(playerIdx, gameKey) {
  return state.rounds.filter(r => r.callerIdx === playerIdx && r.gameKey === gameKey).length;
}

function isGameAvailableForCaller(callerIdx, gameKey) {
  const caller = state.players[callerIdx];
  const def = GAME_DEFS[gameKey];
  if (!def) return false;

  // King Kuralı: İlk 4 el kesinlikle ceza oynanır, koz oynanamaz!
  if (def.isKoz && state.rounds.length < 4) {
    return false;
  }

  if (def.isKoz) {
    return caller.kozCount < 2;
  }

  if (caller.cezaCount >= 3) {
    return false;
  }

  if (getGlobalGameUsageCount(gameKey) >= 2) {
    return false;
  }

  return true;
}

// ==========================================================================
// RENDER MOTORU (TÜM SAYFALAR)
// ==========================================================================
function renderAll() {
  ensureStateArrays(state);
  const currentHand = getCurrentHandNumber();
  const callerIdx = getCurrentCallerIndex();
  const isGameOver = currentHand > 20 || hasKingWinner();

  renderLivePlayerBar(currentHand, callerIdx, isGameOver);
  renderSetupScreen();
  renderCezaScreen(currentHand, callerIdx, isGameOver);
  renderKozScreen(currentHand, callerIdx, isGameOver);
  renderResultsScreen(currentHand, callerIdx, isGameOver);
  renderTargetScreen(currentHand, callerIdx, isGameOver);
}

// --------------------------------------------------------------------------
// 1. OYUNCULAR SAYFASI
// --------------------------------------------------------------------------
function renderSetupScreen() {
  const isGameFinished = (state.rounds && state.rounds.length >= 20) || hasKingWinner();
  const isGameInProgress = state.rounds && state.rounds.length > 0 && !isGameFinished;

  ['inputPlayer1', 'inputPlayer2', 'inputPlayer3', 'inputPlayer4'].forEach((id, idx) => {
    const el = document.getElementById(id);
    if (!el) return;
    const defaultName = getDefaultPlayerName(currentTableId, idx);
    el.placeholder = `${idx + 1}. Oyuncu Adını Yazın (${defaultName})`;

    // Kullanıcı bu kutuda aktif olarak yazı yazmıyorsa mevcut masanın değerini göster
    if (document.activeElement !== el) {
      const pName = (state.players && state.players[idx]) ? state.players[idx].name : '';
      if (isDefaultPlayerName(pName)) {
        el.value = '';
      } else {
        el.value = pName;
      }
    }
  });

  const startBtnText = document.getElementById('btnStartGameText');
  const startBtnTopText = document.getElementById('btnStartGameTopText');
  const dealerGroup = document.getElementById('dealerFormGroup');

  if (dealerGroup) {
    dealerGroup.style.opacity = '1';
    dealerGroup.style.pointerEvents = 'auto';
    dealerGroup.title = '';
  }

  if (isGameFinished) {
    if (startBtnText) startBtnText.textContent = '🏁 Önceki Oyun Bitti (20/20) • Yeni Oyunu Başlat ➔';
    if (startBtnTopText) startBtnTopText.textContent = '🏁 Yeni Oyunu Başlat ➔';
  } else if (isGameInProgress) {
    if (startBtnText) startBtnText.textContent = '✓ Değişiklikleri Kaydet ve Masaya Dön';
    if (startBtnTopText) startBtnTopText.textContent = '✓ Değişiklikleri Kaydet ve Masaya Dön';
  } else {
    if (startBtnText) startBtnText.textContent = '🚀 Oyunu Başlat ve Ceza Sayfasına Geç ➔';
    if (startBtnTopText) startBtnTopText.textContent = '🚀 Oyunu Başlat ve Ceza Sayfasına Geç ➔';
  }

  const dealerRow = document.getElementById('dealerPickRow');
  dealerRow.innerHTML = '';
  state.players.forEach((p, idx) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = `btn-dealer-pick ${state.initialDealer === idx ? 'selected' : ''}`;
    btn.innerHTML = `<span class="bdp-name">♣2 ${idx + 1}. ${escapeHtml(p.name)}</span> ${renderPlayerRightsSymbols(p, 'prb-inline')}`;
    btn.addEventListener('click', () => {
      triggerHaptic(15);
      // Önce input kutularında yazılmış olan güncel oyuncu isimlerini state'e kaydet (isimler asla silinmesin!)
      syncSetupInputsToState();
      hasUserEditedSetupInputs = true;
      lastLocalEditTableId = currentTableId;
      lastLocalSetupEditAt = Date.now();
      state.initialDealer = idx;
      saveStateToStorage();
      pushStateToServer();
      renderAll();
      showToast(`♣2 Sinek 2'li sahibi (Başlangıç oyuncusu): ${state.players[idx].name} seçildi!`, 'emerald');
    });
    dealerRow.appendChild(btn);
  });

  const selRadio = document.querySelector(`input[name="scoringMode"][value="${state.scoringMode}"]`);
  if (selRadio) selRadio.checked = true;
}

// --------------------------------------------------------------------------
// 2. CEZA SAYFASI (1. OYUN SAYFASI) — İLK 4 EL CEZADIR
// --------------------------------------------------------------------------
// (renderCezaScreen aşağıda tanımlıdır)

// --------------------------------------------------------------------------
// 3. KOZ SAYFASI (5. ELDEN İTİBAREN AÇILIR)
// --------------------------------------------------------------------------
function renderKozScreen(currentHand, callerIdx, isGameOver) {
  const remainingHands = 20 - state.rounds.length;
  const bannerKoz = document.getElementById('bannerLastHandKoz');
  if (bannerKoz) {
    bannerKoz.style.display = (remainingHands === 1 && !isGameOver) ? 'flex' : 'none';
  }
  const caller = state.players[callerIdx] || state.players[0];
  const handNoEl = document.getElementById('lblKozHandNo');
  const callerEl = document.getElementById('lblKozCaller');
  const rightsEl = document.getElementById('lblKozCallerRights');
  const lockedAlert = document.getElementById('kozLockedAlert');
  const lockedTitle = document.getElementById('kozLockedTitle');
  const lockedMsg = document.getElementById('kozLockedMsg');
  const btnGoCeza = document.getElementById('btnGoCezaFromKoz');
  const entryBox = document.getElementById('kozEntryBox');
  const playedKozCount = state.rounds.filter(r => r.isKoz).length;

  document.getElementById('tabBadgeKoz').textContent = `${playedKozCount}/8`;
  const kozKingBar = document.getElementById('kozKingCallBar');

  if (isGameOver) {
    handNoEl.textContent = hasKingWinner() ? '🏆 KING İLE BİTTİ' : 'Oyun Bitti (20/20)';
    callerEl.innerHTML = hasKingWinner()
      ? `👑 KING ŞAMPİYONU: <span class="caller-highlight">${escapeHtml(state.kingWinnerName)}</span> (${state.kingWinnerTricks || 11} El)`
      : 'Sonuçları İnceleyin';
    entryBox.style.display = 'none';
    lockedAlert.style.display = 'none';
    if (kozKingBar) kozKingBar.style.display = 'none';
    return;
  }
  if (kozKingBar) kozKingBar.style.display = isSpectatorMode ? 'none' : 'flex';

  handNoEl.textContent = `${currentHand}. El (${currentHand} / 20)`;
  
  if (!state.selectedKozSuit) {
    state.selectedKozSuit = 'karo'; // Varsayılan: Karo
  }

  const suitsDef = {
    karo: { symbol: '♦', name: 'Karo', cssClass: 'suit-karo' },
    kupa: { symbol: '♥️', name: 'Kupa', cssClass: 'suit-kupa' },
    maca: { symbol: '♠', name: 'Maça', cssClass: 'suit-maca' },
    sinek: { symbol: '♣', name: 'Sinek', cssClass: 'suit-sinek' }
  };
  const activeSuit = suitsDef[state.selectedKozSuit] || suitsDef.karo;

  callerEl.innerHTML = `
    <div class="caller-title-row">
      <span class="caller-prefix">👑 SÖYLEYEN:</span>
      <span class="caller-highlight">${escapeHtml(caller.name)}</span>
      <span class="caller-koz-suit ${activeSuit.cssClass}" title="Koz: ${activeSuit.name}">${activeSuit.symbol}</span>
    </div>
    <div class="meta-rights" id="lblKozCallerRights">
      Koz: <b>${caller.kozCount}/2</b> • Ceza: <b>${caller.cezaCount}/3</b> ${renderPlayerRightsSymbols(caller, 'prb-inline')}
    </div>
  `;

  // Koz Türü Butonlarını (Karo, Kupa, Maça, Sinek) Yönet
  const suitButtons = document.querySelectorAll('.btn-koz-suit');
  suitButtons.forEach(btn => {
    const s = btn.dataset.suit;
    if (s === state.selectedKozSuit) {
      btn.classList.add('active');
    } else {
      btn.classList.remove('active');
    }
    btn.onclick = () => {
      if (isSpectatorMode) return;
      triggerHaptic(15);
      state.activeHandType = 'koz';
      state.selectedKozSuit = s;
      saveStateToStorage();
      renderKozScreen(currentHand, callerIdx, isGameOver);
      sendPlayerInputToServer({ action: 'select_game', type: 'koz', gameKey: s });
    };
  });

  // King Kuralı: İlk 4 el yalnızca ceza oynanır, koz 5. elden itibaren açılır!
  if (state.rounds.length < 4) {
    lockedAlert.style.display = 'flex';
    entryBox.style.display = 'none';
    if (lockedTitle) lockedTitle.textContent = 'İlk 4 El Ceza Oynanmalıdır!';
    if (lockedMsg) lockedMsg.textContent = `Geleneksel King kurallarına göre ilk 4 el yalnızca Ceza oynanabilir. Koz oyunları 5. elden itibaren açılacaktır (Şu an ${currentHand}. eldesiniz).`;
    if (btnGoCeza) btnGoCeza.textContent = '⬅ 2. Ceza Sayfasına Git';
    return;
  }

  const canPlayKoz = caller.kozCount < 2;

  if (!canPlayKoz) {
    lockedAlert.style.display = 'flex';
    entryBox.style.display = 'none';
    if (lockedTitle) lockedTitle.textContent = 'Koz Hakkı Tükendi!';
    if (lockedMsg) lockedMsg.textContent = `${caller.name} oyuncusunun 2 Koz hakkı da bitti. Bu elde Ceza seçilmelidir.`;
    if (btnGoCeza) btnGoCeza.textContent = '⬅ 2. Ceza Sayfasına Git';
    return;
  }

  lockedAlert.style.display = 'none';
  entryBox.style.display = 'flex';

  renderDistributionList('koz', 13, state.kozInputs, 'kozPlayersList', 'kozQuickButtons', 'kozRemainingBadge', 'kozValidationMsg', 'btnSaveKoz');
}

// --------------------------------------------------------------------------
// 3. CEZA SAYFASI
// --------------------------------------------------------------------------
function renderCezaScreen(currentHand, callerIdx, isGameOver) {
  const remainingHands = 20 - state.rounds.length;
  const bannerCeza = document.getElementById('bannerLastHandCeza');
  if (bannerCeza) {
    bannerCeza.style.display = (remainingHands === 1 && !isGameOver) ? 'flex' : 'none';
  }
  const caller = state.players[callerIdx] || state.players[0];
  const handNoEl = document.getElementById('lblCezaHandNo');
  const callerEl = document.getElementById('lblCezaCaller');
  const rightsEl = document.getElementById('lblCezaCallerRights');
  const lockedAlert = document.getElementById('cezaLockedAlert');
  const entryBox = document.getElementById('cezaEntryBox');
  const grid = document.getElementById('cezaTypesGrid');
  const playedCezaCount = state.rounds.filter(r => !r.isKoz).length;

  document.getElementById('tabBadgeCeza').textContent = `${playedCezaCount}/12`;
  const cezaKingBar = document.getElementById('cezaKingCallBar');

  if (isGameOver) {
    handNoEl.textContent = hasKingWinner() ? '🏆 KING İLE BİTTİ' : 'Oyun Bitti (20/20)';
    callerEl.innerHTML = hasKingWinner()
      ? `👑 KING ŞAMPİYONU: <span class="caller-highlight">${escapeHtml(state.kingWinnerName)}</span> (${state.kingWinnerTricks || 11} El)`
      : 'Sonuçları İnceleyin';
    entryBox.style.display = 'none';
    lockedAlert.style.display = 'none';
    grid.style.display = 'none';
    if (cezaKingBar) cezaKingBar.style.display = 'none';
    return;
  }
  if (cezaKingBar) cezaKingBar.style.display = isSpectatorMode ? 'none' : 'flex';

  handNoEl.textContent = `${currentHand}. El (${currentHand} / 20)`;
  callerEl.innerHTML = `
    <div class="caller-title-row">
      <span class="caller-prefix">👑 SÖYLEYEN:</span>
      <span class="caller-highlight">${escapeHtml(caller.name)}</span>
    </div>
    <div class="meta-rights" id="lblCezaCallerRights">
      Ceza: <b>${caller.cezaCount}/3</b> • Koz: <b>${caller.kozCount}/2</b> ${renderPlayerRightsSymbols(caller, 'prb-inline')}
    </div>
  `;

  // 1. Elde (henüz el kaydedilmemişken) Sinek 2'li kimde çıktıysa doğrudan buradan da seçilebilsin
  const firstHandDealerBar = document.getElementById('firstHandDealerBar');
  if (firstHandDealerBar) {
    if (state.rounds.length === 0 && !isGameOver && !isSpectatorMode) {
      firstHandDealerBar.style.display = 'flex';
      let buttonsHtml = '';
      state.players.forEach((p, idx) => {
        const isSel = state.initialDealer === idx;
        buttonsHtml += `
          <button type="button" class="btn-fh-dealer ${isSel ? 'active' : ''}" data-d="${idx}">
            ♣2 ${escapeHtml(p.name)}
          </button>
        `;
      });
      firstHandDealerBar.innerHTML = `
        <span class="fhd-label">♣2 Sinek 2'li Kimde? (Başlayanı Seç):</span>
        <div class="fhd-btns">${buttonsHtml}</div>
      `;
      firstHandDealerBar.querySelectorAll('.btn-fh-dealer').forEach(b => {
        b.addEventListener('click', () => {
          const dIdx = parseInt(b.dataset.d, 10);
          if (isNaN(dIdx)) return;
          triggerHaptic(15);
          state.initialDealer = dIdx;
          saveStateToStorage();
          pushStateToServer();
          renderAll();
          showToast(`♣2 Sinek 2'li sahibi: ${state.players[dIdx].name}! Oyun ${state.players[dIdx].name} ile başlıyor.`, 'emerald');
        });
      });
    } else {
      firstHandDealerBar.style.display = 'none';
    }
  }

  const canPlayCeza = caller.cezaCount < 3;

  if (!canPlayCeza) {
    lockedAlert.style.display = 'flex';
    entryBox.style.display = 'none';
    grid.style.display = 'none';
    document.getElementById('cezaLockedMsg').textContent = `${caller.name} oyuncusunun 3 Ceza hakkı da tükendi. Bu elde Koz seçilmelidir.`;
    return;
  }

  lockedAlert.style.display = 'none';
  entryBox.style.display = 'flex';
  grid.style.display = 'grid';

  // 6 Ceza Oyun Kartlarını Render Et
  grid.innerHTML = '';
  const cezaKeys = ['el_almaz', 'kupa_almaz', 'kiz_almaz', 'erkek_almaz', 'rifki', 'son_iki'];

  // Seçili oyun hakkı uygun değilse uygun olan ilk cezayı otomatik seç
  if (!isGameAvailableForCaller(callerIdx, state.selectedCezaKey)) {
    const firstAvail = cezaKeys.find(k => isGameAvailableForCaller(callerIdx, k));
    if (firstAvail) state.selectedCezaKey = firstAvail;
  }

  cezaKeys.forEach(k => {
    const def = GAME_DEFS[k];
    const isAvail = isGameAvailableForCaller(callerIdx, k);
    const isSelected = k === state.selectedCezaKey;
    const globalCount = getGlobalGameUsageCount(k);

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = `btn-ceza-card ${isSelected ? 'selected' : ''}`;
    btn.disabled = !isAvail;

    let ptsText = `${def.baseUnitPoint} P`;
    if (state.scoringMode === 'zero_sum') ptsText = `${def.baseUnitPoint * 2} P`;

    btn.innerHTML = `
      <span class="ceza-card-icon">${def.icon}</span>
      <span class="ceza-card-name">${def.shortTitle}</span>
      <span class="ceza-card-pts">${ptsText}</span>
      <span class="ceza-card-count">${globalCount}/2 Oynandı</span>
    `;

    btn.addEventListener('click', () => {
      if (isSpectatorMode) return;
      triggerHaptic(15);
      state.activeHandType = 'ceza';
      state.selectedCezaKey = k;
      state.cezaInputs = [0, 0, 0, 0];
      state.cezaConfirmed = [false, false, false, false];
      inputHistories.ceza = [];
      saveStateToStorage();
      renderAll();
      sendPlayerInputToServer({ action: 'select_game', type: 'ceza', gameKey: k });
    });

    grid.appendChild(btn);
  });

  // Seçilen Ceza Tanımı
  const activeDef = GAME_DEFS[state.selectedCezaKey] || GAME_DEFS.el_almaz;
  const bannerIcon = document.getElementById('cezaBannerIcon');
  if (bannerIcon) bannerIcon.textContent = activeDef.icon;
  const bannerTitle = document.getElementById('cezaBannerTitle');
  if (bannerTitle) bannerTitle.textContent = activeDef.title;
  const bannerDesc = document.getElementById('cezaBannerDesc');
  if (bannerDesc) bannerDesc.textContent = activeDef.desc;
  const bannerPts = document.getElementById('cezaBannerPts');
  if (bannerPts) {
    let unitPts = (state.scoringMode === 'zero_sum') ? (activeDef.baseUnitPoint * 2) : activeDef.baseUnitPoint;
    bannerPts.textContent = `${unitPts} P / ${activeDef.unitName}`;
  }

  // Ceza Dağıtım Listesi (Rıfkı dahil tüm cezalar standart stepper ve hızlı atama kullanır)
  const cezaList = document.getElementById('cezaPlayersList');
  if (cezaList) cezaList.style.display = 'flex';
  const cezaQuickRow = document.getElementById('cezaQuickFillRow');
  if (cezaQuickRow) cezaQuickRow.style.display = 'flex';

  renderDistributionList('ceza', activeDef.totalUnits, state.cezaInputs, 'cezaPlayersList', 'cezaQuickButtons', 'cezaRemainingBadge', 'cezaValidationMsg', 'btnSaveCeza');
}

// Girdi Geçmişi ve Düzeltme Yardımcıları (Geri Al & Temizle)
const inputHistories = {
  ceza: [],
  koz: []
};

function pushInputHistory(type, inputsArray) {
  if (!inputHistories[type]) inputHistories[type] = [];
  inputHistories[type].push([...inputsArray]);
  if (inputHistories[type].length > 30) inputHistories[type].shift();
}

function undoInput(type, inputsArray) {
  if (isSpectatorMode) return;
  const confirmedArray = type === 'koz' ? state.kozConfirmed : state.cezaConfirmed;
  if (inputHistories[type] && inputHistories[type].length > 0) {
    const prev = inputHistories[type].pop();
    for (let i = 0; i < inputsArray.length; i++) {
      inputsArray[i] = prev[i];
      confirmedArray[i] = prev[i] > 0;
    }
    state.activeHandType = type;
    saveStateToStorage();
    renderAll();
    sendPlayerInputToServer({ action: 'set_all_units', type, inputs: inputsArray, confirmed: confirmedArray });
    showToast('↩️ Son işlem geri alındı.', 'cyan');
  } else {
    showToast('Geri alınacak bir önceki işlem yok.', 'rose');
  }
}

function clearInputs(type, inputsArray) {
  if (isSpectatorMode) return;
  const confirmedArray = type === 'koz' ? state.kozConfirmed : state.cezaConfirmed;
  const hasValues = inputsArray.some(v => v > 0) || confirmedArray.some(Boolean);
  if (!hasValues) {
    showToast('Girişler zaten sıfır.', 'cyan');
    return;
  }
  pushInputHistory(type, inputsArray);
  for (let i = 0; i < inputsArray.length; i++) {
    inputsArray[i] = 0;
    confirmedArray[i] = false;
  }
  state.activeHandType = type;
  saveStateToStorage();
  renderAll();
  sendPlayerInputToServer({ action: 'set_all_units', type, inputs: inputsArray, confirmed: confirmedArray });
  showToast('🗑️ Tüm girişler temizlendi (sıfırlandı).', 'amber');
}

function renderMyQuickEntryCard(type, totalUnits, inputsArray) {
  const cardId = type === 'ceza' ? 'myCezaQuickCard' : 'myKozQuickCard';
  const cardEl = document.getElementById(cardId);
  if (!cardEl) return;

  if (isSpectatorMode) {
    cardEl.style.display = 'none';
    return;
  }

  const confirmedArray = type === 'koz' ? state.kozConfirmed : state.cezaConfirmed;
  const callerIdx = getCurrentCallerIndex();
  const activeGameKey = type === 'koz' ? 'koz' : (state.selectedCezaKey || 'el_almaz');
  const activeDef = GAME_DEFS[activeGameKey] || GAME_DEFS.koz;

  if (myPlayerRole === 'all') {
    cardEl.style.display = 'flex';
    cardEl.className = `my-quick-entry-card ${type}-quick-theme compact-hint`;
    cardEl.innerHTML = `
      <div class="mqc-hint-row">
        <span>📱 <b>Kendi Telefonundan Girmek İçin:</b> Üstteki çubuktan kendi adını seçersen tek dokunuşlu kişisel puan kartın açılır.</span>
      </div>
    `;
    return;
  }

  const myIdx = parseInt(myPlayerRole, 10);
  if (isNaN(myIdx) || myIdx < 0 || myIdx > 3 || !state.players[myIdx]) {
    cardEl.style.display = 'none';
    return;
  }

  const me = state.players[myIdx];
  const myVal = inputsArray[myIdx] || 0;
  const isConfirmed = Boolean(confirmedArray[myIdx]);
  const isCaller = callerIdx === myIdx;

  const tempDist = [0, 0, 0, 0];
  tempDist[myIdx] = myVal;
  const previewPts = calculateHandPoints(activeGameKey, callerIdx, tempDist)[myIdx];
  const ptsFormatted = previewPts > 0 ? `+${previewPts} P` : `${previewPts} P`;

  const otherSum = inputsArray.reduce((acc, v, i) => (i === myIdx ? acc : acc + (v || 0)), 0);
  const maxAllowedForMe = Math.max(0, totalUnits - otherSum);

  let numberPillsHtml = '';
  for (let n = 0; n <= totalUnits; n++) {
    const isCurrent = myVal === n && (n > 0 || isConfirmed);
    const isOverLimit = n > maxAllowedForMe;
    const label = n === 0 ? '0 (Almadım)' : String(n);
    numberPillsHtml += `
      <button type="button" class="btn-my-num-pill ${isCurrent ? 'selected' : ''}" data-val="${n}" ${isOverLimit ? 'disabled' : ''}>
        ${label}
      </button>
    `;
  }

  cardEl.style.display = 'flex';
  cardEl.className = `my-quick-entry-card ${type}-quick-theme active-player-card`;
  cardEl.innerHTML = `
    <div class="mqc-header">
      <div class="mqc-title-wrap">
        <span class="mqc-badge">📱 SENİN TELEFONUN</span>
        <h4 class="mqc-player-name">${escapeHtml(me.name)} ${renderPlayerRightsSymbols(me)}</h4>
        ${isCaller ? '<span class="mqc-caller-tag">👑 Söyleyen Sensin</span>' : ''}
      </div>
      <div class="mqc-status-wrap">
        <span class="mqc-hand-pts ${previewPts > 0 ? 'pos' : previewPts < 0 ? 'neg' : ''}">${myVal} ${escapeHtml(activeDef.unitName)} ➔ <b>${ptsFormatted}</b></span>
        <span class="mqc-sync-pill ${isConfirmed || myVal > 0 ? 'synced' : 'waiting'}">
          ${isConfirmed || myVal > 0 ? '✓ Masaya Gönderildi' : '⏳ Kaç Aldığını Seç'}
        </span>
      </div>
    </div>
    <div class="mqc-sub">
      Bu elde (${escapeHtml(activeDef.title)}) kaç <b>${escapeHtml(activeDef.unitName)}</b> aldığını aşağıdan tek dokunuşla seç:
    </div>
    <div class="mqc-num-grid">
      ${numberPillsHtml}
    </div>
  `;

  cardEl.querySelectorAll('.btn-my-num-pill').forEach(btn => {
    btn.addEventListener('click', () => {
      const val = parseInt(btn.dataset.val, 10);
      if (isNaN(val)) return;
      triggerHaptic(20);
      pushInputHistory(type, inputsArray);
      inputsArray[myIdx] = val;
      confirmedArray[myIdx] = true;
      state.activeHandType = type;
      saveStateToStorage();
      renderAll();
      sendPlayerInputToServer({
        action: 'set_player_unit',
        type: type,
        playerIdx: myIdx,
        value: val
      });
    });
  });
}

// Ortak Dağıtım Listesi Render Yardımcısı (Koz ve Ceza için)
function renderDistributionList(type, totalUnits, inputsArray, listId, quickId, badgeId, msgId, saveBtnId) {
  ensureStateArrays(state);
  const confirmedArray = type === 'koz' ? state.kozConfirmed : state.cezaConfirmed;
  const callerIdx = getCurrentCallerIndex();
  const activeGameKey = type === 'koz' ? 'koz' : (state.selectedCezaKey || 'el_almaz');
  const handPointsPreview = calculateHandPoints(activeGameKey, callerIdx, inputsArray);
  const myIdx = ['0', '1', '2', '3'].includes(myPlayerRole) ? parseInt(myPlayerRole, 10) : -1;

  renderMyQuickEntryCard(type, totalUnits, inputsArray);

  const container = document.getElementById(listId);
  container.innerHTML = '';

  state.players.forEach((p, idx) => {
    const val = inputsArray[idx] || 0;
    const isConfirmed = Boolean(confirmedArray[idx]) || val > 0;
    const isMe = idx === myIdx;
    const handPt = handPointsPreview[idx] || 0;
    const row = document.createElement('div');
    row.className = `dist-row ${isMe ? 'my-player-row' : ''} ${isConfirmed ? 'row-confirmed' : ''}`;
    row.innerHTML = `
      <div class="dist-player-info">
        <div class="dist-player-title-line">
          <span class="dist-player-name">${escapeHtml(p.name)}</span>
          ${renderPlayerRightsSymbols(p)}
          ${isMe ? '<span class="my-player-tag">📱 SEN</span>' : ''}
          <span class="player-confirm-badge ${isConfirmed ? 'confirmed' : 'pending'}">
            ${isConfirmed ? '✓ Girdi' : '⏳ Bekleniyor'}
          </span>
        </div>
        <div class="dist-player-sub-line">
          <span class="dist-player-score">Toplam: ${p.score > 0 ? '+' : ''}${p.score} P</span>
          ${isConfirmed ? `<span class="dist-hand-delta ${handPt > 0 ? 'pos' : handPt < 0 ? 'neg' : ''}">Bu El: ${handPt > 0 ? '+' : ''}${handPt} P</span>` : ''}
        </div>
      </div>
      <div class="stepper-wrap">
        <button type="button" class="btn-stepper" data-action="dec" data-p="${idx}" ${isSpectatorMode ? 'disabled' : ''}>−</button>
        <span class="stepper-val">${val}</span>
        <button type="button" class="btn-stepper" data-action="inc" data-p="${idx}" ${isSpectatorMode ? 'disabled' : ''}>+</button>
      </div>
    `;

    row.querySelector('[data-action="dec"]').addEventListener('click', () => {
      if (isSpectatorMode) return;
      triggerHaptic(15);
      if (inputsArray[idx] > 0) {
        pushInputHistory(type, inputsArray);
        inputsArray[idx]--;
        confirmedArray[idx] = true;
        state.activeHandType = type;
        saveStateToStorage();
        renderAll();
        sendPlayerInputToServer({
          action: 'set_player_unit',
          type: type,
          playerIdx: idx,
          value: inputsArray[idx]
        });
      }
    });

    row.querySelector('[data-action="inc"]').addEventListener('click', () => {
      if (isSpectatorMode) return;
      triggerHaptic(15);
      const sum = inputsArray.reduce((a, b) => a + b, 0);
      if (sum < totalUnits) {
        pushInputHistory(type, inputsArray);
        inputsArray[idx]++;
        confirmedArray[idx] = true;
        state.activeHandType = type;
        saveStateToStorage();
        renderAll();
        sendPlayerInputToServer({
          action: 'set_player_unit',
          type: type,
          playerIdx: idx,
          value: inputsArray[idx]
        });
      }
    });

    container.appendChild(row);
  });

    // Hızlı Kalanı Ata Butonları
  const quickContainer = document.getElementById(quickId);
  if (quickContainer) {
    quickContainer.innerHTML = '';
    state.players.forEach((p, idx) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'btn-qf';
      btn.innerHTML = `<span>${escapeHtml(p.name)}</span> ${renderPlayerRightsSymbols(p, 'prb-sm')}`;
      btn.disabled = isSpectatorMode;
      btn.addEventListener('click', () => {
        if (isSpectatorMode) return;
        triggerHaptic(20);
        pushInputHistory(type, inputsArray);
        const currentSumWithoutP = inputsArray.reduce((sum, val, i) => i === idx ? sum : sum + val, 0);
        const remaining = Math.max(0, totalUnits - currentSumWithoutP);
        inputsArray[idx] = remaining;
        confirmedArray[idx] = true;
        state.activeHandType = type;
        saveStateToStorage();
        renderAll();
        sendPlayerInputToServer({
          action: 'set_all_units',
          type: type,
          inputs: inputsArray,
          confirmed: confirmedArray
        });
      });
      quickContainer.appendChild(btn);
    });
  }

  // Geri Al ve Temizle Butonlarını Yönet (Her zaman açık, belirgin ve tıklanabilir)
  const undoBtn = document.getElementById(type === 'ceza' ? 'btnUndoCeza' : 'btnUndoKoz');
  const clearBtn = document.getElementById(type === 'ceza' ? 'btnClearCeza' : 'btnClearKoz');

  if (undoBtn) {
    undoBtn.disabled = isSpectatorMode;
    undoBtn.onclick = () => {
      triggerHaptic(20);
      undoInput(type, inputsArray);
    };
  }

  if (clearBtn) {
    clearBtn.disabled = isSpectatorMode;
    clearBtn.onclick = () => {
      triggerHaptic(25);
      clearInputs(type, inputsArray);
    };
  }

  validateDistribution(totalUnits, type === 'koz' ? 'El' : 'Adet', inputsArray, badgeId, msgId, saveBtnId);
}

function validateDistribution(totalUnits, unitName, inputsArray, badgeId, msgId, saveBtnId) {
  const sum = inputsArray.reduce((a, b) => a + b, 0);
  const diff = totalUnits - sum;
  const badge = document.getElementById(badgeId);
  const msg = document.getElementById(msgId);
  const btnSave = document.getElementById(saveBtnId);

  if (!badge || !msg || !btnSave) return;

  const isKoz = (saveBtnId === 'btnSaveKoz');
  const typeText = isKoz ? 'Koz' : 'Ceza';
  const typeTextUpper = isKoz ? 'KOZ' : 'CEZA';

  if (diff === 0) {
    badge.textContent = `Tamamlandı (${totalUnits}/${totalUnits})`;
    badge.className = 'remaining-counter valid';
    msg.textContent = `✓ Dağılım eksiksiz doğrulandı. Kaydedebilirsiniz.`;
    msg.className = 'validation-bar success';
    btnSave.disabled = isSpectatorMode;
    btnSave.classList.add('ready-to-save');
    btnSave.innerHTML = `<span class="save-btn-icon">💾</span> <span class="save-btn-text">${typeTextUpper} ELİNİ KAYDET &amp; ÇETEYE İŞLE ✓</span>`;
  } else if (diff > 0) {
    badge.textContent = `Kalan: ${diff} / ${totalUnits} ${unitName}`;
    badge.className = 'remaining-counter';
    msg.textContent = `Dağıtılması gereken ${diff} adet ${unitName} kaldı.`;
    msg.className = 'validation-bar';
    btnSave.disabled = true;
    btnSave.classList.remove('ready-to-save');
    btnSave.innerHTML = `<span class="save-btn-icon">💾</span> <span class="save-btn-text">${typeText} Elini Kaydet (${diff} ${unitName} kaldı)</span>`;
  } else {
    badge.textContent = `Fazla: +${Math.abs(diff)}`;
    badge.className = 'remaining-counter';
    msg.textContent = `Toplam ${totalUnits} olmalı, ${Math.abs(diff)} adet fazla girildi.`;
    msg.className = 'validation-bar error';
    btnSave.disabled = true;
    btnSave.classList.remove('ready-to-save');
    btnSave.innerHTML = `<span class="save-btn-icon">⚠️</span> <span class="save-btn-text">Fazla Girildi (+${Math.abs(diff)} Düzeltin)</span>`;
  }
}

function renderLiveActiveHandTracker(currentHand, callerIdx, isGameOver) {
  const trackerEl = document.getElementById('liveActiveHandTracker');
  if (!trackerEl) return;

  if (isGameOver) {
    trackerEl.style.display = 'none';
    return;
  }

  const isKozActive = state.activeHandType === 'koz' && state.rounds.length >= 4;
  const activeKey = isKozActive ? 'koz' : (state.selectedCezaKey || 'el_almaz');
  const activeDef = GAME_DEFS[activeKey] || GAME_DEFS.el_almaz;
  const inputsArr = isKozActive ? state.kozInputs : state.cezaInputs;
  const confArr = isKozActive ? state.kozConfirmed : state.cezaConfirmed;
  const previewPts = calculateHandPoints(activeKey, callerIdx, inputsArr);
  const sumEntered = inputsArr.reduce((a, b) => a + (b || 0), 0);
  const remUnits = Math.max(0, activeDef.totalUnits - sumEntered);

  const suitNames = { karo: '♦ Karo', kupa: '♥️ Kupa', maca: '♠ Maça', sinek: '♣ Sinek' };
  const gameBadgeText = isKozActive
    ? `👑 Koz: ${suitNames[state.selectedKozSuit] || '♦ Karo'}`
    : `${activeDef.icon} Ceza: ${activeDef.title}`;

  let playersLiveHtml = '';
  state.players.forEach((p, idx) => {
    const val = inputsArr[idx] || 0;
    const isConf = Boolean(confArr[idx]) || val > 0;
    const pt = previewPts[idx] || 0;
    const isMe = String(idx) === myPlayerRole;
    playersLiveHtml += `
      <div class="laht-player-chip ${isConf ? 'entered' : 'waiting'} ${isMe ? 'is-me' : ''}">
        <div class="laht-p-top">
          <span class="laht-p-name">${escapeHtml(p.name)} ${renderPlayerRightsSymbols(p, 'prb-sm')}</span>
          <span class="laht-p-status">${isConf ? '✓' : '⏳'}</span>
        </div>
        <div class="laht-p-val">
          <b>${val}</b> ${escapeHtml(activeDef.unitName)}
          <span class="laht-p-pts ${pt > 0 ? 'pos' : pt < 0 ? 'neg' : ''}">(${pt > 0 ? '+' : ''}${pt} P)</span>
        </div>
      </div>
    `;
  });

  trackerEl.style.display = 'flex';
  trackerEl.innerHTML = `
    <div class="laht-header">
      <div class="laht-title-group">
        <span class="live-pulse-dot"></span>
        <span class="laht-badge">CANLI EL GİRİŞİ (${currentHand}. EL)</span>
        <span class="laht-game-name">${gameBadgeText}</span>
      </div>
      <div class="laht-right-group">
        <span class="laht-counter ${remUnits === 0 ? 'done' : ''}">
          ${remUnits === 0 ? `✓ Tamamlandı (${activeDef.totalUnits}/${activeDef.totalUnits})` : `Girilen: ${sumEntered}/${activeDef.totalUnits} • Kalan: ${remUnits}`}
        </span>
        ${!isSpectatorMode ? `<button type="button" class="btn btn-xs btn-primary" id="btnTrackerGoEntry">✏️ Puan Gir ➔</button>` : ''}
      </div>
    </div>
    <div class="laht-players-grid">
      ${playersLiveHtml}
    </div>
  `;

  document.getElementById('btnTrackerGoEntry')?.addEventListener('click', () => {
    triggerHaptic(15);
    goToScreen(isKozActive ? 2 : 1, true);
  });
}

// --------------------------------------------------------------------------
// 4. TOPLU SONUÇLAR & ÇETELE MATRİSİ SAYFASI
// --------------------------------------------------------------------------
function renderResultsScreen(currentHand, callerIdx, isGameOver) {
  const caller = state.players[callerIdx] || state.players[0];

  renderLiveActiveHandTracker(currentHand, callerIdx, isGameOver);

  // Sıradaki El Çağrısı
  const lblHand = document.getElementById('lblResCurrentHand');
  const lblCaller = document.getElementById('lblResActiveCaller');
  const btnJumpKoz = document.getElementById('btnJumpToKoz');
  const btnJumpCeza = document.getElementById('btnJumpToCeza');
  const btnJumpKing = document.getElementById('btnJumpToKing');

  const btnFooterCeza = document.getElementById('btnFooterGoCeza');
  const btnFooterKoz = document.getElementById('btnFooterGoKoz');

  if (isGameOver) {
    if (hasKingWinner()) {
      lblHand.textContent = '🏆 KING ZAFERİ İLE BİTTİ!';
      lblCaller.innerHTML = `👑 KING ŞAMPİYONU: <span class="nt-caller-name" style="color:#fde047;">${escapeHtml(state.kingWinnerName)}</span> <span style="font-size:13px; color:#34d399;">(${state.kingWinnerTricks || 11} El Aldı — Ceza ve Koz Durumu Ne Olursa Olsun Kazandı!) 🏆</span>`;
    } else {
      lblHand.textContent = '20 / 20 (TAMAMLANDI)';
      lblCaller.textContent = 'Şampiyon Belli Oldu! 🏆';
    }
    btnJumpKoz.style.display = 'none';
    btnJumpCeza.style.display = 'none';
    if (btnJumpKing) btnJumpKing.style.display = 'none';
    if (btnFooterCeza) btnFooterCeza.style.display = 'none';
    if (btnFooterKoz) btnFooterKoz.style.display = 'none';
  } else {
    lblHand.textContent = `${currentHand} / 20`;
    lblCaller.innerHTML = `<span class="nt-caller-prefix">👑 SIRADAKİ SÖYLEYEN:</span> <span class="nt-caller-name">${escapeHtml(caller.name)}</span> ${renderPlayerRightsSymbols(caller)}`;
    
    // Hem üst çağrı kartında hem alt işlem alanında "Cezaya Git", "Koza Git" ve "KING" düğmeleri HER ZAMAN açık ve görünür
    btnJumpCeza.style.display = 'inline-flex';
    btnJumpKoz.style.display = 'inline-flex';
    if (btnJumpKing) btnJumpKing.style.display = isSpectatorMode ? 'none' : 'inline-flex';

    if (btnFooterCeza) btnFooterCeza.style.display = 'inline-flex';
    if (btnFooterKoz) btnFooterKoz.style.display = 'inline-flex';
  }

  // 4 Oyuncu Canlı Skor Kartları (Liderlik — KING kazananı varsa puan/ceza ne olursa olsun 1. sıradadır!)
  const board = document.getElementById('resultsLeaderboard');
  board.innerHTML = '';
  const sortedPlayers = [...state.players].sort((a, b) => {
    if (hasKingWinner()) {
      if (a.id === state.kingWinnerIdx) return -1;
      if (b.id === state.kingWinnerIdx) return 1;
    }
    return b.score - a.score;
  });
  const ranks = {};
  sortedPlayers.forEach((p, i) => ranks[p.id] = i + 1);

  state.players.forEach(p => {
    const isTurn = p.id === callerIdx && !isGameOver;
    const isKingChamp = hasKingWinner() && p.id === state.kingWinnerIdx;
    const rank = ranks[p.id];
    let medal = `${rank}.`;
    if (isKingChamp) medal = '👑🏆';
    else if (rank === 1) medal = '🥇';
    else if (rank === 2) medal = '🥈';
    else if (rank === 3) medal = '🥉';

    const card = document.createElement('div');
    card.className = `leader-card rank-${rank} ${isTurn ? 'active-turn' : ''} ${isKingChamp ? 'king-winner-card' : ''}`;
    card.innerHTML = `
      <div class="lc-top">
        <span class="lc-rank">${medal}</span>
        <span class="lc-name">${escapeHtml(p.name)}</span>
        ${isKingChamp ? `<span class="lc-king-win-badge">🏆 KING (${state.kingWinnerTricks || 11} EL) KAZANDI</span>` : (isTurn ? '<span class="lc-turn-badge">Sıradaki</span>' : '')}
      </div>
      <div class="lc-rights-row">
        ${renderPlayerRightsSymbols(p)}
      </div>
      <div class="lc-score ${isKingChamp || p.score > 0 ? 'pos' : p.score < 0 ? 'neg' : ''}">
        ${p.score > 0 ? '+' : ''}${p.score}
      </div>
      <div class="lc-stats">
        <span>Ceza: <b>${p.cezaCount}/3</b></span>
        <span>Koz: <b>${p.kozCount}/2</b></span>
      </div>
    `;
    board.appendChild(card);
  });

  // 20 El Çetele Matrisi Tablosu
  renderMatrixTable();

  // El Geçmişi Tablosu
  renderHistoryTable();
}

function renderMatrixTable() {
  for (let i = 0; i < 4; i++) {
    const thEl = document.getElementById(`thPlayer${i + 1}`);
    if (thEl && state.players[i]) {
      thEl.innerHTML = `<div class="th-p-name">${escapeHtml(state.players[i].name)}</div><div class="th-rights-wrap">${renderPlayerRightsSymbols(state.players[i], 'prb-sm')}</div>`;
    }
  }

  const tbody = document.getElementById('ceteleTableBody');
  tbody.innerHTML = '';

  const rows = [
    { title: '👑 Koz (1. Hak)', key: 'koz', isKoz: true, pts: '+50', unit: 0 },
    { title: '👑 Koz (2. Hak)', key: 'koz', isKoz: true, pts: '+50', unit: 1 },
    { title: '✋ El Almaz (1)', key: 'el_almaz', isKoz: false, pts: state.scoringMode === 'zero_sum' ? '-100' : '-50', roundIdx: 0 },
    { title: '✋ El Almaz (2)', key: 'el_almaz', isKoz: false, pts: state.scoringMode === 'zero_sum' ? '-100' : '-50', roundIdx: 1 },
    { title: '♥️ Kupa Almaz (1)', key: 'kupa_almaz', isKoz: false, pts: state.scoringMode === 'zero_sum' ? '-60' : '-30', roundIdx: 0 },
    { title: '♥️ Kupa Almaz (2)', key: 'kupa_almaz', isKoz: false, pts: state.scoringMode === 'zero_sum' ? '-60' : '-30', roundIdx: 1 },
    { title: '👸 Kız Almaz (1)', key: 'kiz_almaz', isKoz: false, pts: state.scoringMode === 'zero_sum' ? '-200' : '-100', roundIdx: 0 },
    { title: '👸 Kız Almaz (2)', key: 'kiz_almaz', isKoz: false, pts: state.scoringMode === 'zero_sum' ? '-200' : '-100', roundIdx: 1 },
    { title: '🤴 Erkek Almaz (1)', key: 'erkek_almaz', isKoz: false, pts: state.scoringMode === 'zero_sum' ? '-120' : '-60', roundIdx: 0 },
    { title: '🤴 Erkek Almaz (2)', key: 'erkek_almaz', isKoz: false, pts: state.scoringMode === 'zero_sum' ? '-120' : '-60', roundIdx: 1 },
    { title: '🍷 Rıfkı (1)', key: 'rifki', isKoz: false, pts: state.scoringMode === 'zero_sum' ? '-640' : '-320', roundIdx: 0 },
    { title: '🍷 Rıfkı (2)', key: 'rifki', isKoz: false, pts: state.scoringMode === 'zero_sum' ? '-640' : '-320', roundIdx: 1 },
    { title: '⏳ Son İki (1)', key: 'son_iki', isKoz: false, pts: state.scoringMode === 'zero_sum' ? '-360' : '-180', roundIdx: 0 },
    { title: '⏳ Son İki (2)', key: 'son_iki', isKoz: false, pts: state.scoringMode === 'zero_sum' ? '-360' : '-180', roundIdx: 1 }
  ];

  rows.forEach(r => {
    const tr = document.createElement('tr');
    let cellsHtml = `<td class="th-game">${r.title}</td><td class="th-pts">${r.pts}</td>`;

    if (r.isKoz) {
      for (let pIdx = 0; pIdx < 4; pIdx++) {
        let cellText = '—';
        let cellCls = '';
        const callerKozRounds = state.rounds.filter(rnd => rnd.callerIdx === pIdx && rnd.isKoz);
        const rnd = callerKozRounds[r.unit];
        if (rnd) {
          const pt = rnd.points[pIdx];
          cellText = `${pt > 0 ? '+' : ''}${pt} <span class="c-caller-badge" title="Söyleyen">👑</span>`;
          cellCls = 'cell-used pos';
        }
        cellsHtml += `<td class="${cellCls}">${cellText}</td>`;
      }
    } else {
      const cezaRounds = state.rounds.filter(x => x.gameKey === r.key);
      const rnd = cezaRounds[r.roundIdx];

      for (let pIdx = 0; pIdx < 4; pIdx++) {
        let cellText = '—';
        let cellCls = '';
        if (rnd) {
          const pt = rnd.points[pIdx];
          const isCaller = rnd.callerIdx === pIdx;
          const callerTag = isCaller ? ' <span class="c-caller-badge" title="Söyleyen">👑</span>' : '';
          cellText = `${pt > 0 ? '+' : ''}${pt}${callerTag}`;
          cellCls = pt < 0 ? 'cell-used neg' : pt > 0 ? 'cell-used pos' : 'cell-used';
        }
        cellsHtml += `<td class="${cellCls}">${cellText}</td>`;
      }
    }

    tr.innerHTML = cellsHtml;
    tbody.appendChild(tr);
  });

  // Toplam Satırı (Tüm oyuncuların toplam puanı)
  const tfoot = document.getElementById('ceteleTableFoot');
  if (tfoot) {
    let footHtml = `<tr><td colspan="2" style="text-align: left; font-weight: 800;">TOPLAM</td>`;
    for (let pIdx = 0; pIdx < 4; pIdx++) {
      const p = state.players[pIdx];
      const cls = p.score > 0 ? 'score-gain' : p.score < 0 ? 'score-loss' : '';
      footHtml += `<td class="cell-used ${cls}">${p.score > 0 ? '+' : ''}${p.score}</td>`;
    }
    footHtml += `</tr>`;
    tfoot.innerHTML = footHtml;
  }
}

function renderHistoryTable() {
  document.getElementById('thHistP1').textContent = state.players[0].name.slice(0, 8);
  document.getElementById('thHistP2').textContent = state.players[1].name.slice(0, 8);
  document.getElementById('thHistP3').textContent = state.players[2].name.slice(0, 8);
  document.getElementById('thHistP4').textContent = state.players[3].name.slice(0, 8);

  const tbody = document.getElementById('historyTableBody');
  document.getElementById('lblHistoryCount').textContent = `${state.rounds.length} / 20 El`;

  if (state.rounds.length === 0) {
    tbody.innerHTML = '<tr class="empty-row"><td colspan="7">Henüz el oynanmadı. Koz veya Ceza sayfasından ilk eli kaydedebilirsiniz.</td></tr>';
  } else {
    tbody.innerHTML = '';
    state.rounds.forEach(rnd => {
      const tr = document.createElement('tr');
      const def = GAME_DEFS[rnd.gameKey] || GAME_DEFS.koz;
      let pointsCols = '';
      rnd.points.forEach(pt => {
        const cls = pt > 0 ? 'score-gain' : pt < 0 ? 'score-loss' : '';
        pointsCols += `<td class="${cls}">${pt > 0 ? '+' : ''}${pt}</td>`;
      });

      tr.innerHTML = `
        <td><b>#${rnd.handNo}</b></td>
        <td>${escapeHtml(rnd.callerName)}</td>
        <td>${rnd.isKingWin ? `🏆 <b>KING! (${rnd.kingTricks || 11} El)</b>` : `${def.icon} ${def.shortTitle}`}</td>
        ${pointsCols}
      `;
      tbody.appendChild(tr);
    });
  }

  for (let i = 0; i < 4; i++) {
    const footEl = document.getElementById(`footP${i + 1}`);
    const score = state.players[i].score;
    let cls = score > 0 ? 'score-gain' : score < 0 ? 'score-loss' : '';
    footEl.className = `score-cell ${cls}`;
    footEl.textContent = `${score > 0 ? '+' : ''}${score}`;
  }
}

// ==========================================================================
// EL KAYDETME FONKSİYONLARI (KOZ & CEZA)
// ==========================================================================
function saveKozHand() {
  const currentHand = getCurrentHandNumber();
  if (currentHand > 20) return;

  const callerIdx = getCurrentCallerIndex();
  const def = GAME_DEFS.koz;
  const sum = state.kozInputs.reduce((a, b) => a + b, 0);

  if (sum !== def.totalUnits) {
    showToast('Lütfen toplam 13 el olacak şekilde dağıtın!', 'rose');
    return;
  }

  const distribution = [...state.kozInputs];
  const points = calculateHandPoints('koz', callerIdx, distribution);
  const callerTricks = distribution[callerIdx] || 0;
  const isKingWin = callerTricks >= 11;

  const roundData = {
    handNo: currentHand,
    callerIdx: callerIdx,
    callerName: state.players[callerIdx].name,
    gameKey: 'koz',
    gameTitle: isKingWin
      ? `🏆 KING! (${callerTricks} El)`
      : `Koz (${(activeKozSuit => {
          const defs = { karo: '♦ Karo', kupa: '♥️ Kupa', maca: '♠ Maça', sinek: '♣ Sinek' };
          return defs[activeKozSuit] || '♦ Karo';
        })(state.selectedKozSuit)})`,
    kozSuit: state.selectedKozSuit || 'karo',
    isKoz: true,
    isKingWin: isKingWin,
    kingTricks: isKingWin ? callerTricks : undefined,
    distribution: distribution,
    points: points,
    timestamp: new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })
  };

  state.rounds.push(roundData);
  recalculateAllScores();
  state.kozInputs = [0, 0, 0, 0];
  state.cezaInputs = [0, 0, 0, 0];
  state.kozConfirmed = [false, false, false, false];
  state.cezaConfirmed = [false, false, false, false];
  inputHistories.koz = [];
  saveStateToStorage();
  pushStateToServer();
  triggerHaptic(50);
  renderAll();

  if (isKingWin) {
    showToast(`🏆 KING! ${state.players[callerIdx].name} ${callerTricks} el alarak ceza ve koz durumu ne olursa olsun OYUNU KAZANDI!`, 'emerald');
  } else {
    showToast(`${currentHand}. el (Koz) başarıyla kaydedildi!`, 'emerald');
  }

  // Otomatik olarak Toplu Sonuçlar sayfasına kaydır
  goToScreen(3, true);
}

// ==========================================================================
// 👑 KING (11+ EL DOĞRUDAN ZAFER) İLAN FONKSİYONLARI
// ==========================================================================
let selectedKingModalSuit = 'karo';
let selectedKingModalTricks = 11;

function openKingDeclareModal() {
  if (isSpectatorMode) return;
  const currentHand = getCurrentHandNumber();
  if (currentHand > 20 || hasKingWinner()) {
    showToast('Oyun zaten tamamlandı!', 'amber');
    return;
  }

  triggerHaptic(25);
  const callerIdx = getCurrentCallerIndex();
  const caller = state.players[callerIdx] || state.players[0];
  selectedKingModalSuit = state.selectedKozSuit || 'karo';
  selectedKingModalTricks = 11;

  const banner = document.getElementById('kingModalCallerBanner');
  if (banner) {
    banner.innerHTML = `
      <div class="kcb-modal-caller">
        <span class="kcb-modal-label">👑 SIRADAKİ OYUNCU (KING DİYEN):</span>
        <div class="kcb-modal-name-row">
          <span class="kcb-modal-name">${escapeHtml(caller.name)}</span>
          ${renderPlayerRightsSymbols(caller)}
        </div>
        <span class="kcb-modal-score">Mevcut Puanı: <b>${caller.score > 0 ? '+' : ''}${caller.score} P</b> (Ceza: ${caller.cezaCount}/3 • Koz: ${caller.kozCount}/2)</span>
      </div>
    `;
  }

  const promptEl = document.getElementById('lblKingTricksPrompt');
  if (promptEl) {
    promptEl.innerHTML = `2. <b>${escapeHtml(caller.name)}</b> Kaç El Aldı? (En Az 11 El = Doğrudan Oyunu Kazanır):`;
  }

  document.querySelectorAll('#kingModalSuitsRow .btn-king-suit').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.ksuit === selectedKingModalSuit);
  });
  document.querySelectorAll('#kingModalTricksGrid .btn-king-trick').forEach(btn => {
    btn.classList.toggle('active', parseInt(btn.dataset.tricks, 10) === selectedKingModalTricks);
  });

  const modal = document.getElementById('modalKingDeclare');
  if (modal) modal.classList.add('active');
}

function closeKingDeclareModal() {
  const modal = document.getElementById('modalKingDeclare');
  if (modal) modal.classList.remove('active');
}

function confirmKingWin() {
  if (isSpectatorMode) return;
  const currentHand = getCurrentHandNumber();
  if (currentHand > 20 || hasKingWinner()) return;

  const callerIdx = getCurrentCallerIndex();
  const caller = state.players[callerIdx] || state.players[0];
  const tricks = Math.min(13, Math.max(11, selectedKingModalTricks || 11));
  const remTricks = 13 - tricks;

  // 13 eli tamamlayacak şekilde dağılım oluştur (söyleyen 11/12/13 el alır)
  const distribution = [0, 0, 0, 0];
  distribution[callerIdx] = tricks;
  if (remTricks > 0) {
    const nextIdx = (callerIdx + 1) % 4;
    distribution[nextIdx] = remTricks;
  }

  const points = calculateHandPoints('koz', callerIdx, distribution);
  const suitDefs = { karo: '♦ Karo', kupa: '♥️ Kupa', maca: '♠ Maça', sinek: '♣ Sinek' };
  const suitLabel = suitDefs[selectedKingModalSuit] || '♦ Karo';

  const roundData = {
    handNo: currentHand,
    callerIdx: callerIdx,
    callerName: caller.name,
    gameKey: 'koz',
    gameTitle: `🏆 KING! (${suitLabel} - ${tricks} El)`,
    kozSuit: selectedKingModalSuit,
    isKoz: true,
    isKingWin: true,
    kingTricks: tricks,
    distribution: distribution,
    points: points,
    timestamp: new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })
  };

  state.rounds.push(roundData);
  recalculateAllScores();
  state.kozInputs = [0, 0, 0, 0];
  state.cezaInputs = [0, 0, 0, 0];
  state.kozConfirmed = [false, false, false, false];
  state.cezaConfirmed = [false, false, false, false];
  inputHistories.koz = [];
  inputHistories.ceza = [];

  saveStateToStorage();
  pushStateToServer();
  triggerHaptic(60);
  closeKingDeclareModal();
  renderAll();
  goToScreen(3, true);

  showToast(`🏆 KING ZAFERİ! ${caller.name} ${tricks} el alarak ceza ve koz durumu ne olursa olsun OYUNU KAZANDI!`, 'emerald');
}

function saveCezaHand() {
  const currentHand = getCurrentHandNumber();
  if (currentHand > 20) return;

  const callerIdx = getCurrentCallerIndex();
  const def = GAME_DEFS[state.selectedCezaKey];
  const sum = state.cezaInputs.reduce((a, b) => a + b, 0);

  if (sum !== def.totalUnits) {
    showToast(`Lütfen toplam ${def.totalUnits} ${def.unitName} dağıtın!`, 'rose');
    return;
  }

  const distribution = [...state.cezaInputs];
  const points = calculateHandPoints(def.key, callerIdx, distribution);

  const roundData = {
    handNo: currentHand,
    callerIdx: callerIdx,
    callerName: state.players[callerIdx].name,
    gameKey: def.key,
    gameTitle: def.title,
    isKoz: false,
    distribution: distribution,
    points: points,
    timestamp: new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })
  };

  state.rounds.push(roundData);
  recalculateAllScores();
  state.cezaInputs = [0, 0, 0, 0];
  state.kozInputs = [0, 0, 0, 0];
  state.cezaConfirmed = [false, false, false, false];
  state.kozConfirmed = [false, false, false, false];
  inputHistories.ceza = [];
  saveStateToStorage();
  pushStateToServer();
  triggerHaptic(40);
  renderAll();

  showToast(`${currentHand}. el (${def.shortTitle}) başarıyla kaydedildi!`, 'emerald');

  // Otomatik olarak Toplu Sonuçlar sayfasına kaydır
  goToScreen(3, true);
}

function undoLastHand() {
  if (state.rounds.length === 0) {
    showToast('Geri alınacak el bulunamadı!', 'rose');
    return;
  }
  const removed = state.rounds.pop();
  recalculateAllScores();
  state.kozInputs = [0, 0, 0, 0];
  state.cezaInputs = [0, 0, 0, 0];
  state.kozConfirmed = [false, false, false, false];
  state.cezaConfirmed = [false, false, false, false];
  saveStateToStorage();
  pushStateToServer();
  triggerHaptic(30);
  renderAll();
  showToast(`${removed.handNo}. el geri alındı.`, 'amber');
}

function openResetConfirmModal() {
  const modalReset = document.getElementById('modalResetConfirm');
  const chkConfirm = document.getElementById('chkSecondConfirm');
  const btnConfirm = document.getElementById('btnConfirmResetFinal');
  const inputCode = document.getElementById('inputResetCode');
  const wrapCode = document.getElementById('wrapResetCode');
  const lblStatus = document.getElementById('lblResetGameStatus');

  const roundCount = (state.rounds && state.rounds.length) || 0;

  if (lblStatus) {
    if (roundCount > 0) {
      lblStatus.innerHTML = `Mevcut oyunda girilen <b>${roundCount} el</b>, 4 oyuncunun <b>bütün puanları</b> ve <b>çetele tablosu</b> sıfırlanacaktır.`;
    } else {
      lblStatus.innerHTML = `Girilen oyuncu isimleri ve masa ayarları sıfırlanacaktır.`;
    }
  }

  if (chkConfirm) chkConfirm.checked = false;
  if (inputCode) inputCode.value = '';
  if (btnConfirm) btnConfirm.disabled = true;

  if (wrapCode) {
    wrapCode.style.display = roundCount > 0 ? 'block' : 'none';
  }

  const updateResetBtnState = () => {
    const isCodeOk = roundCount > 0 ? (inputCode?.value.trim().toUpperCase() === 'SIFIRLA') : true;
    const isChkOk = Boolean(chkConfirm?.checked);
    if (btnConfirm) {
      btnConfirm.disabled = !(isCodeOk && isChkOk);
    }
  };

  if (inputCode) {
    inputCode.oninput = updateResetBtnState;
  }
  if (chkConfirm) {
    chkConfirm.onchange = () => {
      triggerHaptic(10);
      updateResetBtnState();
    };
  }

  if (modalReset) {
    modalReset.classList.add('active');
    if (roundCount > 0 && inputCode) {
      setTimeout(() => inputCode.focus(), 250);
    }
  }
}

async function executeResetGame() {
  // 1. GÜVENLİK: Masada oynanmış el varsa sıfırlamadan önce otomatik olarak Arşiv'e kaydet
  if (state.rounds && state.rounds.length > 0) {
    try {
      const now = new Date();
      const timeStr = now.toLocaleDateString('tr-TR') + ' ' + now.toLocaleTimeString('tr-TR');
      await fetch('/api/archive-current', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: `Otomatik Yedek (Yeni Oyun Öncesi - ${state.rounds.length}/20 El - ${timeStr})`
        })
      });
    } catch (e) {
      console.warn('Otomatik arşiv hatası:', e);
    }
  }

  // 2. HER ŞEYİ TERTEMİZ SIFIRLA (Eski isimler asla gelmesin)
  state = {
    players: [
      { id: 0, name: 'Oyuncu 1', score: 0, kozCount: 0, cezaCount: 0 },
      { id: 1, name: 'Oyuncu 2', score: 0, kozCount: 0, cezaCount: 0 },
      { id: 2, name: 'Oyuncu 3', score: 0, kozCount: 0, cezaCount: 0 },
      { id: 3, name: 'Oyuncu 4', score: 0, kozCount: 0, cezaCount: 0 },
    ],
    initialDealer: 0,
    scoringMode: 'standard',
    rounds: [],
    activeHandType: 'ceza',
    selectedCezaKey: 'el_almaz',
    selectedKozSuit: 'karo',
    kozInputs: [0, 0, 0, 0],
    cezaInputs: [0, 0, 0, 0],
    kozConfirmed: [false, false, false, false],
    cezaConfirmed: [false, false, false, false]
  };
  inputHistories.ceza = [];
  inputHistories.koz = [];
  hasUserEditedSetupInputs = false;

  // Input kutularını da tamamen temizle (Yeni isimler girilsin)
  ['inputPlayer1', 'inputPlayer2', 'inputPlayer3', 'inputPlayer4'].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });

  saveStateToStorage();
  pushStateToServer();
  renderAll();
  goToScreen(0, true, true);
  showToast('🔄 Yeni oyun başlatıldı. Eski oyun Arşiv\'e güvenle yedeklendi.', 'emerald');
}


// ==========================================================================
// 5. KOZA ÇIKMA HEDEFİ & STRATEJİ HESAPLAYICI (SAYFA 4)
// ==========================================================================
let targetSelectedPlayerId = 0;
let simKoz = 0;
let simKiz = 0;
let simRifki = false;
let simErkek = 0;

function renderTargetScreen(currentHand, callerIdx, isGameOver) {
  const container = document.getElementById('screen4');
  if (!container) return;

  // 1. Kalan Oyunlar Hesabı
  const gameLimits = {
    el_almaz: 2,
    kupa_almaz: 2,
    kiz_almaz: 2,
    erkek_almaz: 2,
    rifki: 2,
    son_iki: 2,
    koz: 8
  };
  const playedCounts = {
    el_almaz: 0,
    kupa_almaz: 0,
    kiz_almaz: 0,
    erkek_almaz: 0,
    rifki: 0,
    son_iki: 0,
    koz: 0
  };

  state.rounds.forEach(r => {
    if (r.isKoz) {
      playedCounts.koz++;
    } else if (playedCounts[r.gameKey] !== undefined) {
      playedCounts[r.gameKey]++;
    }
  });

  const remaining = {
    koz: Math.max(0, gameLimits.koz - playedCounts.koz),
    el_almaz: Math.max(0, gameLimits.el_almaz - playedCounts.el_almaz),
    kupa_almaz: Math.max(0, gameLimits.kupa_almaz - playedCounts.kupa_almaz),
    kiz_almaz: Math.max(0, gameLimits.kiz_almaz - playedCounts.kiz_almaz),
    erkek_almaz: Math.max(0, gameLimits.erkek_almaz - playedCounts.erkek_almaz),
    rifki: Math.max(0, gameLimits.rifki - playedCounts.rifki),
    son_iki: Math.max(0, gameLimits.son_iki - playedCounts.son_iki)
  };

  const totalRemainingHands = 20 - state.rounds.length;

  // Kalan Cezaların Tespiti (BİTMİŞ OLANLARI ASLA GÖSTERME!)
  const cezaNames = {
    rifki: { name: 'Rıfkı (Kupa Papazı)', icon: '🗡️', penalty: 320, type: 'single' },
    kiz_almaz: { name: 'Kız Almaz', icon: '👸', penalty: 100, type: 'multi', maxUnits: 4, unitName: 'Kız' },
    erkek_almaz: { name: 'Erkek Almaz', icon: '🤴', penalty: 60, type: 'multi', maxUnits: 4, unitName: 'Erkek' },
    son_iki: { name: 'Son İki El', icon: '⏳', penalty: 180, type: 'multi', maxUnits: 2, unitName: 'El' },
    kupa_almaz: { name: 'Kupa Almaz', icon: '♥️', penalty: 30, type: 'kupa' },
    el_almaz: { name: 'El Almaz', icon: '🃏', penalty: 50, type: 'el' }
  };

  const remainingCezaKeys = Object.keys(cezaNames).filter(k => remaining[k] > 0);

  // 1. Kalan Oyunlar Şeridi (Hero Banner)
  const heroBanner = document.getElementById('targetRemainingHero');
  if (heroBanner) {
    if (hasKingWinner()) {
      heroBanner.innerHTML = `
        <div class="rhb-item">
          <span>🏆 <b>KING ZAFERİ İLE BİTTİ:</b> 👑 <b>${escapeHtml(state.kingWinnerName)}</b> King deyip <b>${state.kingWinnerTricks || 11} el</b> alarak ceza ve koz durumu ne olursa olsun oyunu doğrudan kazandı!</span>
        </div>
      `;
    } else if (totalRemainingHands <= 0) {
      heroBanner.innerHTML = `
        <div class="rhb-item">
          <span>🏁 <b>Oyun Tamamlandı:</b> Tüm 20 el oynandı, çete bağlandı.</span>
        </div>
      `;
    } else {
      let heroHtml = '';
      if (remainingCezaKeys.length > 0) {
        const cezaSummary = remainingCezaKeys.map(k => `${cezaNames[k].icon} ${remaining[k]} ${cezaNames[k].name}`).join(', ');
        heroHtml += `
          <div class="rhb-item">
            <span class="rhb-badge ceza">⚡ Kalan Ceza: ${remainingCezaKeys.reduce((a, k) => a + remaining[k], 0)} El</span>
            <span>${cezaSummary}</span>
          </div>
        `;
      } else {
        heroHtml += `
          <div class="rhb-item">
            <span class="rhb-badge ceza" style="background:rgba(16,185,129,0.2); color:#34d399; border:1px solid rgba(16,185,129,0.4);">✓ Tüm Cezalar Bitti</span>
            <span>Masada hiç ceza kalmadı!</span>
          </div>
        `;
      }

      heroHtml += `
        <div class="rhb-item">
          <span class="rhb-badge koz">👑 Kalan Koz: ${remaining.koz} El</span>
          <span>Toplam ${remaining.koz * 13} El (+${remaining.koz * 13 * 50} Puan)</span>
        </div>
      `;
      heroBanner.innerHTML = heroHtml;
    }
  }

  // 2. 4 Oyuncunun "Kaç Koza Çıkacak?" Kartları
  const cardsGrid = document.getElementById('targetKozaCikmaCards');
  if (!cardsGrid) return;

  if (totalRemainingHands <= 0 || hasKingWinner()) {
    // Oyun Tamamen Bittiğinde (20 El Bitti veya KING İlan Edildi)
    const sorted = [...state.players].sort((a, b) => {
      if (hasKingWinner()) {
        if (a.id === state.kingWinnerIdx) return -1;
        if (b.id === state.kingWinnerIdx) return 1;
      }
      return b.score - a.score;
    });
    cardsGrid.innerHTML = `
      <div style="background: rgba(15, 23, 42, 0.9); border: 2px solid rgba(250, 204, 21, 0.55); border-radius: 16px; padding: 18px;">
        <h3 style="color: #fde047; margin-bottom: 12px; font-size: 16px;">
          ${hasKingWinner() ? `👑 KING ŞAMPİYONU: ${escapeHtml(state.kingWinnerName)} (${state.kingWinnerTricks || 11} El Aldı — Doğrudan Kazandı!)` : '🏆 20 El Sonucu — Nihai Masa Durumu'}
        </h3>
        <div style="display: flex; flex-direction: column; gap: 8px;">
          ${sorted.map(p => {
            const isKingChamp = hasKingWinner() && p.id === state.kingWinnerIdx;
            return `
            <div style="display: flex; justify-content: space-between; align-items: center; background: ${isKingChamp ? 'rgba(234, 179, 8, 0.16)' : 'rgba(255,255,255,0.04)'}; border: ${isKingChamp ? '1px solid rgba(250, 204, 21, 0.6)' : 'none'}; padding: 10px 14px; border-radius: 10px;">
              <span style="font-weight: 800; font-size: 15px; color: #fff;">${isKingChamp ? '👑🏆' : '👤'} ${escapeHtml(p.name)} ${renderPlayerRightsSymbols(p, 'prb-sm')}</span>
              <span style="font-weight: 800; font-size: 15px; color: ${isKingChamp ? '#fde047' : (p.score > 0 ? '#34d399' : (p.score === 0 ? '#fde047' : '#f87171'))};">
                ${isKingChamp ? `🏆 KING KAZANANI (${state.kingWinnerTricks || 11} El) • ` : ''}${p.score > 0 ? '+' : ''}${p.score} P
              </span>
            </div>
          `;}).join('')}
        </div>
      </div>
    `;
    return;
  }

  // Oyun Devam Ediyorken:
  cardsGrid.innerHTML = '';

  state.players.forEach(player => {
    const curPts = player.score;
    const isPos = curPts > 0;
    const isZero = curPts === 0;

    const card = document.createElement('div');
    card.className = `kzc-card ${isPos ? 'is-pos' : (isZero ? 'is-zero' : 'is-neg')}`;

    let casesHtml = '';

    // =======================================================================
    // DURUM 1: MASADA KALAN CEZA VARSA
    // =======================================================================
    if (remainingCezaKeys.length > 0) {
      remainingCezaKeys.forEach(cKey => {
        const cDef = cezaNames[cKey];

        // 1. CEZAYI YEMEZSE (0 Ceza)
        let neededNoPenalty = curPts < 0 ? Math.ceil(Math.abs(curPts) / 50) : 0;
        let calloutNoPenalty = '';
        if (curPts < 0) {
          const projected = curPts + (neededNoPenalty * 50);
          calloutNoPenalty = `
            <div class="kzc-target-koz-callout">
              <div class="kzc-callout-left">
                <span class="kzc-callout-label">🎯 KOZA ÇIKMAK İÇİN:</span>
                <span class="kzc-callout-sub">+${neededNoPenalty * 50} P ➔ ${projected > 0 ? '+' : ''}${projected} Puan ile biter</span>
              </div>
              <div class="kzc-big-koz-number gold">
                👑 EN AZ ${neededNoPenalty} EL KOZ
              </div>
            </div>
          `;
        } else if (curPts === 0) {
          calloutNoPenalty = `
            <div class="kzc-target-koz-callout even">
              <div class="kzc-callout-left">
                <span class="kzc-callout-label">⚖️ TAM 0 PUANDA (BAŞABAŞ):</span>
                <span class="kzc-callout-sub">Artıya geçmek için tek el yeter</span>
              </div>
              <div class="kzc-big-koz-number gold">
                👑 EN AZ 1 EL KOZ
              </div>
            </div>
          `;
        } else {
          calloutNoPenalty = `
            <div class="kzc-target-koz-callout safe">
              <div class="kzc-callout-left">
                <span class="kzc-callout-label">🏆 MEVCUT DURUM (+${curPts} P):</span>
                <span class="kzc-callout-sub">0 el koz alsa bile artıda tamamlar</span>
              </div>
              <div class="kzc-big-koz-number green">
                ✓ ZATEN KOZDA
              </div>
            </div>
          `;
        }

        casesHtml += `
          <div class="kzc-case-row">
            <div class="kzc-case-top">
              <span>🛡️ <b>${cDef.name}'ı Yemezse (0 Ceza):</b></span>
              <span class="kzc-case-pts ${isPos ? 'pos' : (isZero ? 'zero' : 'neg')}">${isPos ? '+' : ''}${curPts} P</span>
            </div>
            ${calloutNoPenalty}
          </div>
        `;

        // 2. CEZAYI YERSE (Tekil veya Çoklu Dağılım)
        if (cDef.type === 'single') {
          // RIFKI (-320 P)
          const ptsWithCeza = curPts - cDef.penalty;
          const neededWithCeza = ptsWithCeza < 0 ? Math.ceil(Math.abs(ptsWithCeza) / 50) : 0;
          let calloutWithCeza = '';

          if (ptsWithCeza < 0) {
            const projected = ptsWithCeza + (neededWithCeza * 50);
            calloutWithCeza = `
              <div class="kzc-target-koz-callout danger">
                <div class="kzc-callout-left">
                  <span class="kzc-callout-label">⚠️ CEZA YERSE KURTULMAK İÇİN:</span>
                  <span class="kzc-callout-sub">+${neededWithCeza * 50} P ➔ ${projected > 0 ? '+' : ''}${projected} Puan ile biter</span>
                </div>
                <div class="kzc-big-koz-number rose">
                  💥 EN AZ ${neededWithCeza} EL KOZ
                </div>
              </div>
            `;
          } else if (ptsWithCeza === 0) {
            calloutWithCeza = `
              <div class="kzc-target-koz-callout even">
                <div class="kzc-callout-left">
                  <span class="kzc-callout-label">⚖️ OYUN BİTEN OLUR (0 P):</span>
                  <span class="kzc-callout-sub">Artıya geçmek için tek el yeter</span>
                </div>
                <div class="kzc-big-koz-number gold">
                  👑 EN AZ 1 EL KOZ
                </div>
              </div>
            `;
          } else {
            calloutWithCeza = `
              <div class="kzc-target-koz-callout safe">
                <div class="kzc-callout-left">
                  <span class="kzc-callout-label">🏆 CEZA YESE BİLE ARTIDA:</span>
                  <span class="kzc-callout-sub">+${ptsWithCeza} P ile koza çıkmış kalır</span>
                </div>
                <div class="kzc-big-koz-number green">
                  ✓ ZATEN KOZDA
                </div>
              </div>
            `;
          }

          casesHtml += `
            <div class="kzc-case-row">
              <div class="kzc-case-top">
                <span>💥 <b>${cDef.name}'ı Yerse (-${cDef.penalty} P):</b></span>
                <span class="kzc-case-pts ${ptsWithCeza > 0 ? 'pos' : (ptsWithCeza === 0 ? 'zero' : 'neg')}">${ptsWithCeza > 0 ? '+' : ''}${ptsWithCeza} P</span>
              </div>
              ${calloutWithCeza}
            </div>
          `;

        } else if (cDef.type === 'multi') {
          // KIZ ALMAZ (-100 P / kız), ERKEK ALMAZ (-60 P / erkek), SON İKİ (-180 P / el)
          for (let u = 1; u <= cDef.maxUnits; u++) {
            const penPts = u * cDef.penalty;
            const ptsWithU = curPts - penPts;
            const neededWithU = ptsWithU < 0 ? Math.ceil(Math.abs(ptsWithU) / 50) : 0;
            let calloutU = '';

            if (ptsWithU < 0) {
              const projected = ptsWithU + (neededWithU * 50);
              calloutU = `
                <div class="kzc-target-koz-callout danger">
                  <div class="kzc-callout-left">
                    <span class="kzc-callout-label">⚠️ CEZA YERSE GEREKEN:</span>
                    <span class="kzc-callout-sub">+${neededWithU * 50} P ➔ ${projected > 0 ? '+' : ''}${projected} Puan ile biter</span>
                  </div>
                  <div class="kzc-big-koz-number rose">
                    💥 EN AZ ${neededWithU} EL KOZ
                  </div>
                </div>
              `;
            } else if (ptsWithU === 0) {
              calloutU = `
                <div class="kzc-target-koz-callout even">
                  <div class="kzc-callout-left">
                    <span class="kzc-callout-label">⚖️ OYUN BİTEN (0 P):</span>
                    <span class="kzc-callout-sub">Artıya geçmek için tek el yeter</span>
                  </div>
                  <div class="kzc-big-koz-number gold">
                    👑 EN AZ 1 EL KOZ
                  </div>
                </div>
              `;
            } else {
              calloutU = `
                <div class="kzc-target-koz-callout safe">
                  <div class="kzc-callout-left">
                    <span class="kzc-callout-label">🏆 HALA ARTIDA:</span>
                    <span class="kzc-callout-sub">+${ptsWithU} P ile koza çıkmış kalır</span>
                  </div>
                  <div class="kzc-big-koz-number green">
                    ✓ ZATEN KOZDA
                  </div>
                </div>
              `;
            }

            casesHtml += `
              <div class="kzc-case-row">
                <div class="kzc-case-top">
                  <span>💥 <b>${u} ${cDef.unitName} Yerse (-${penPts} P):</b></span>
                  <span class="kzc-case-pts ${ptsWithU > 0 ? 'pos' : (ptsWithU === 0 ? 'zero' : 'neg')}">${ptsWithU > 0 ? '+' : ''}${ptsWithU} P</span>
                </div>
                ${calloutU}
              </div>
            `;
          }
        } else {
          // Kupa veya El Almaz
          const penPts = 2 * cDef.penalty;
          const ptsWithU = curPts - penPts;
          const needed = ptsWithU < 0 ? Math.ceil(Math.abs(ptsWithU) / 50) : 0;
          casesHtml += `
            <div class="kzc-case-row">
              <div class="kzc-case-top">
                <span>💥 <b>Bu Cezadan Kağıt/El Yerse:</b></span>
                <span class="kzc-case-pts ${ptsWithU > 0 ? 'pos' : (ptsWithU === 0 ? 'zero' : 'neg')}">${ptsWithU > 0 ? '+' : ''}${ptsWithU} P</span>
              </div>
              <div class="kzc-target-koz-callout danger">
                <span>⚠️ <b>Koza Çıkmak İçin:</b> En az <b>${needed} el koz</b> almalı!</span>
              </div>
            </div>
          `;
        }
      });

    } else {
      // =======================================================================
      // DURUM 2: MASADA HİÇ CEZA KALMAMIŞSA (SADECE KOZ KALDIYSA)
      // =======================================================================
      const neededKoz = curPts < 0 ? Math.ceil(Math.abs(curPts) / 50) : 0;
      let kozCallout = '';
      if (curPts < 0) {
        const projected = curPts + (neededKoz * 50);
        kozCallout = `
          <div class="kzc-target-koz-callout">
            <div class="kzc-callout-left">
              <span class="kzc-callout-label">🎯 KOZA ÇIKMAK İÇİN:</span>
              <span class="kzc-callout-sub">+${neededKoz * 50} P ➔ ${projected > 0 ? '+' : ''}${projected} Puan ile biter</span>
            </div>
            <div class="kzc-big-koz-number gold">
              👑 EN AZ ${neededKoz} EL KOZ
            </div>
          </div>
        `;
      } else if (curPts === 0) {
        kozCallout = `
          <div class="kzc-target-koz-callout even">
            <div class="kzc-callout-left">
              <span class="kzc-callout-label">⚖️ TAM 0 PUANDA:</span>
              <span class="kzc-callout-sub">Artıya geçmek için tek el yeter</span>
            </div>
            <div class="kzc-big-koz-number gold">
              👑 EN AZ 1 EL KOZ
            </div>
          </div>
        `;
      } else {
        kozCallout = `
          <div class="kzc-target-koz-callout safe">
            <div class="kzc-callout-left">
              <span class="kzc-callout-label">🏆 MEVCUT DURUM:</span>
              <span class="kzc-callout-sub">Ekstra her el +50 P kâr yazar</span>
            </div>
            <div class="kzc-big-koz-number green">
              ✓ ZATEN KOZDA (+${curPts} P)
            </div>
          </div>
        `;
      }

      casesHtml += `
        <div class="kzc-case-row">
          <div class="kzc-case-top">
            <span>👑 <b>Kalan Koz Ellerinde:</b></span>
            <span class="kzc-case-pts ${isPos ? 'pos' : (isZero ? 'zero' : 'neg')}">${isPos ? '+' : ''}${curPts} P</span>
          </div>
          ${kozCallout}
        </div>
      `;
    }

    card.innerHTML = `
      <div class="kzc-header">
        <div class="kzc-player-info">
          <span style="font-size: 20px;">👤</span>
          <span class="kzc-player-name">${escapeHtml(player.name)}</span>
          ${renderPlayerRightsSymbols(player)}
        </div>
        <span class="kzc-current-pts ${isPos ? 'pos' : (isZero ? 'zero' : 'neg')}">
          Şu Anki Puan: ${isPos ? '+' : ''}${curPts} P
        </span>
      </div>
      <div class="kzc-cases-list">
        ${casesHtml}
      </div>
    `;

    cardsGrid.appendChild(card);
  });
}

function updateSimulatorView(player) {
  if (!player) return;

  const lblName = document.getElementById('lblSimPlayerName');
  const lblCurrent = document.getElementById('lblSimCurrentPts');
  const lblProjected = document.getElementById('lblSimProjectedPts');
  const lblBadge = document.getElementById('lblSimBadge');
  const lblAdvice = document.getElementById('lblSimAdvice');

  const lblKoz = document.getElementById('lblSimKozVal');
  const lblKiz = document.getElementById('lblSimKizVal');
  const lblErkek = document.getElementById('lblSimErkekVal');
  const btnRifki = document.getElementById('btnSimRifkiToggle');

  if (lblKoz) lblKoz.textContent = simKoz;
  if (lblKiz) lblKiz.textContent = simKiz;
  if (lblErkek) lblErkek.textContent = simErkek;

  if (btnRifki) {
    btnRifki.className = `btn-sim-toggle ${simRifki ? 'active' : ''}`;
    btnRifki.innerHTML = simRifki ? '<span>🗡️ Rıfkı YEDİ (-320 P)</span>' : '<span>🗡️ Yemedi (0 P)</span>';
  }

  const curPts = player.score;
  const delta = (simKoz * 50) - (simKiz * 100) - (simRifki ? 320 : 0) - (simErkek * 60);
  const projected = curPts + delta;

  if (lblName) lblName.textContent = player.name;
  if (lblCurrent) lblCurrent.textContent = `Şu An: ${curPts > 0 ? '+' : ''}${curPts} P`;
  if (lblProjected) {
    lblProjected.textContent = `Tahmini: ${projected > 0 ? '+' : ''}${projected} P`;
    lblProjected.style.color = projected > 0 ? '#34d399' : (projected === 0 ? '#fde047' : '#f87171');
  }

  if (lblBadge) {
    if (projected > 0) {
      lblBadge.className = 'sim-result-badge badge-safe';
      lblBadge.textContent = '🏆 Koza Çıkmış Oluyor (Artıda)';
    } else if (projected === 0) {
      lblBadge.className = 'sim-result-badge badge-even';
      lblBadge.textContent = '⚖️ Başabaş (0 Puan - Oyun Biten)';
    } else {
      lblBadge.className = 'sim-result-badge badge-danger';
      lblBadge.textContent = '⚠️ Cezaya Düşen Oluyor (Ekside)';
    }
  }

  if (lblAdvice) {
    if (projected > 0) {
      lblAdvice.innerHTML = `Bu senaryoda <b>${escapeHtml(player.name)}</b> oyunu <b>+${projected} puan</b> ile güvenle artıda bitirir.`;
    } else if (projected === 0) {
      lblAdvice.innerHTML = `Bu senaryoda <b>${escapeHtml(player.name)}</b> tam <b>0 puana (başabaşa)</b> ulaşır, ne ceza yer ne kâr eder.`;
    } else {
      const moreNeeded = Math.ceil(Math.abs(projected) / 50);
      lblAdvice.innerHTML = `Bu senaryoda <b>${escapeHtml(player.name)}</b> <b>${projected} puanda</b> kalarak ceza yer! Sıfırlamak için <b>${moreNeeded} el daha koz</b> alması veya ceza yememesi gerekir.`;
    }
  }
}

// ==========================================================================
// EVENT LISTENERS & MODALLAR
// ==========================================================================
function initEventListeners() {
  initSpectatorMode();

  // Çoklu Masa & Salon Modalı Dinleyicileri
  document.getElementById('btnOpenSalonOverview')?.addEventListener('click', openSalonOverview);
  document.getElementById('btnCloseSalonOverview')?.addEventListener('click', closeSalonOverview);
  document.getElementById('btnOkSalonOverview')?.addEventListener('click', closeSalonOverview);
  document.getElementById('btnRefreshSalon')?.addEventListener('click', () => {
    triggerHaptic(15);
    renderSalonTables();
  });
  document.getElementById('modalSalonOverview')?.addEventListener('click', (e) => {
    if (e.target === document.getElementById('modalSalonOverview')) closeSalonOverview();
  });

  // Masa Sayısı Butonları (1 Masa, 2 Masa, 3 Masa, 4 Masa)
  document.querySelectorAll('#tableCountSelector .btn-count-opt').forEach(btn => {
    btn.addEventListener('click', () => {
      const cnt = btn.getAttribute('data-count');
      if (cnt) setTableCount(cnt);
    });
  });

  // Oyuncu Veri Tabanı Modalı Olayları
  document.querySelectorAll('.btn-pick-player').forEach(btn => {
    btn.addEventListener('click', () => {
      const pIdx = parseInt(btn.dataset.playerIdx, 10) || 0;
      openPlayerDatabaseModal(pIdx);
    });
  });
  document.getElementById('btnClosePlayerDb')?.addEventListener('click', closePlayerDatabaseModal);
  document.getElementById('modalPlayerDatabase')?.addEventListener('click', (e) => {
    if (e.target === document.getElementById('modalPlayerDatabase')) closePlayerDatabaseModal();
  });
  document.getElementById('btnAddNewDbPlayer')?.addEventListener('click', addNewPlayerToDb);
  document.getElementById('inputNewDbPlayerName')?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addNewPlayerToDb();
    }
  });
  document.getElementById('inputSearchPlayerDb')?.addEventListener('input', () => {
    renderPlayerDbItems();
  });

  // Koz ve Ceza Kaydet Butonları
  document.getElementById('btnSaveKoz').addEventListener('click', saveKozHand);
  document.getElementById('btnSaveCeza').addEventListener('click', saveCezaHand);

  // 👑 KING (11+ El Doğrudan Zafer) Butonları & Modal Olayları
  document.getElementById('btnOpenKingFromCeza')?.addEventListener('click', openKingDeclareModal);
  document.getElementById('btnOpenKingFromKoz')?.addEventListener('click', openKingDeclareModal);
  document.getElementById('btnJumpToKing')?.addEventListener('click', openKingDeclareModal);
  document.getElementById('btnCloseKingModal')?.addEventListener('click', closeKingDeclareModal);
  document.getElementById('btnCancelKingModal')?.addEventListener('click', closeKingDeclareModal);
  document.getElementById('btnConfirmKingWin')?.addEventListener('click', confirmKingWin);

  document.querySelectorAll('#kingModalSuitsRow .btn-king-suit').forEach(btn => {
    btn.addEventListener('click', () => {
      triggerHaptic(15);
      selectedKingModalSuit = btn.dataset.ksuit || 'karo';
      document.querySelectorAll('#kingModalSuitsRow .btn-king-suit').forEach(b => {
        b.classList.toggle('active', b === btn);
      });
    });
  });

  document.querySelectorAll('#kingModalTricksGrid .btn-king-trick').forEach(btn => {
    btn.addEventListener('click', () => {
      triggerHaptic(15);
      selectedKingModalTricks = parseInt(btn.dataset.tricks, 10) || 11;
      document.querySelectorAll('#kingModalTricksGrid .btn-king-trick').forEach(b => {
        b.classList.toggle('active', b === btn);
      });
    });
  });

  // Geri Al & Yeni Oyun (Güvenlik Önlemli)
  document.getElementById('btnUndo').addEventListener('click', undoLastHand);
  const handleNewGameRequest = () => {
    triggerHaptic(20);
    if (myPlayerRole !== 'all') {
      showToast('⛔ Bu cihaz oyuncu/seyirci modundadır. Masayı sadece ana masa yöneticisi sıfırlayabilir.', 'rose');
      return;
    }
    const hasCustomPlayers = state.players && state.players.some((p, i) => p.name && p.name !== `Oyuncu ${i + 1}`);
    const hasRounds = state.rounds && state.rounds.length > 0;

    if (!hasRounds && !hasCustomPlayers) {
      executeResetGame();
    } else {
      openResetConfirmModal();
    }
  };
  document.getElementById('btnNewGame')?.addEventListener('click', handleNewGameRequest);
  document.getElementById('btnResetOnSetup')?.addEventListener('click', handleNewGameRequest);
  document.getElementById('btnFooterNewGame')?.addEventListener('click', handleNewGameRequest);

  // Yeni Oyun Başlatma / Sıfırlama Onay Modalı
  const modalReset = document.getElementById('modalResetConfirm');
  const btnCloseReset = document.getElementById('btnCloseResetModal');
  const btnCancelReset = document.getElementById('btnCancelReset');
  const btnConfirmReset = document.getElementById('btnConfirmResetFinal');

  const closeResetModal = () => {
    modalReset?.classList.remove('active');
  };

  btnCloseReset?.addEventListener('click', closeResetModal);
  btnCancelReset?.addEventListener('click', closeResetModal);

  btnConfirmReset?.addEventListener('click', () => {
    triggerHaptic(35);
    closeResetModal();
    executeResetGame();
  });

  // Oyuncu İsim Kutularında Yazarken Anında Kaydet ve Çakışmayı Denetle
  ['inputPlayer1', 'inputPlayer2', 'inputPlayer3', 'inputPlayer4'].forEach((id, idx) => {
    const el = document.getElementById(id);
    if (!el) return;

    el.addEventListener('focus', () => {
      const defaultName = getDefaultPlayerName(currentTableId, idx);
      if (el.value === defaultName) {
        el.select();
      }
    });

    el.addEventListener('input', () => {
      hasUserEditedSetupInputs = true;
      lastLocalEditTableId = currentTableId;
      lastLocalSetupEditAt = Date.now();
      const defaultName = getDefaultPlayerName(currentTableId, idx);
      const val = capitalizeWords(el.value);
      state.players[idx].name = val.trim() || defaultName;
      saveStateToStorage();

      // Krupiye seçim butonlarındaki isimleri input odağını bozmadan canlı güncelle
      const dealerBtns = document.querySelectorAll('#dealerPickRow .btn-dealer-pick');
      if (dealerBtns[idx]) {
        dealerBtns[idx].textContent = `♣2 ${idx + 1}. ${state.players[idx].name}`;
      }
      renderLivePlayerBar(getCurrentHandNumber(), getCurrentCallerIndex(), getCurrentHandNumber() > 20);

      clearTimeout(setupSyncTimer);
      setupSyncTimer = setTimeout(() => {
        validateAndSyncPlayerInput(idx);
      }, 700);
    });

    el.addEventListener('blur', () => {
      validateAndSyncPlayerInput(idx);
    });
  });

  // Kurulum / Oyuncu Düzenleme Sayfası: "Oyunu Başlat / Değişiklikleri Kaydet"
  const handleStartOrUpdateGame = () => {
    const isGameFinished = (state.rounds && state.rounds.length >= 20) || hasKingWinner();
    const isGameInProgress = state.rounds && state.rounds.length > 0 && !isGameFinished;

    const oldNames = state.players.map(p => p.name);
    const newNames = [
      capitalizeWords(document.getElementById('inputPlayer1').value.trim()) || getDefaultPlayerName(currentTableId, 0),
      capitalizeWords(document.getElementById('inputPlayer2').value.trim()) || getDefaultPlayerName(currentTableId, 1),
      capitalizeWords(document.getElementById('inputPlayer3').value.trim()) || getDefaultPlayerName(currentTableId, 2),
      capitalizeWords(document.getElementById('inputPlayer4').value.trim()) || getDefaultPlayerName(currentTableId, 3)
    ];

    // Başka masada oynayan oyuncu var mı kontrol et (mevcut masa hariç)
    if (activeTableCount > 1) {
      if (String(currentTableId) === '1') {
        // Masa 1 önceliklidir; Masa 2..4'te Masa 1 ile çakışan eski isim varsa temizle!
        cleanDuplicatePlayersAcrossTables();
      } else {
        const occupied = getAllOccupiedPlayers(currentTableId);
        for (let i = 0; i < 4; i++) {
          const nm = newNames[i];
          if (!isDefaultPlayerName(nm)) {
            const lower = nm.toLocaleLowerCase('tr-TR');
            const otherOccupied = occupied.get(lower);
            if (otherOccupied) {
              showToast(`⛔ "${nm}" zaten ${otherOccupied.tableName}'de oynuyor! Bir kişi aynı anda birden fazla masada oturamaz.`, 'rose');
              return;
            }
          }
        }
      }
    }

    // Aynı masada aynı isim kontrolü
    const lowerArr = newNames.map(n => n.toLocaleLowerCase('tr-TR'));
    const hasDup = lowerArr.some((n, idx) => !isDefaultPlayerName(n) && lowerArr.indexOf(n) !== idx);
    if (hasDup) {
      showToast('⚠️ Aynı isim masada birden fazla koltuğa yazılamaz!', 'amber');
      return;
    }

    let changedPlayers = [];
    for (let i = 0; i < 4; i++) {
      if (oldNames[i] !== newNames[i]) {
        changedPlayers.push({ old: oldNames[i], new: newNames[i], idx: i });
      }
      state.players[i].name = newNames[i];
    }

    // EĞER ÖNCEKİ OYUN BİTMİŞSE (20/20 veya King): Eski oyunu otomatik arşivle ve yeni temiz oyun başlat!
    if (isGameFinished) {
      try {
        archiveCurrentGameToHistory();
      } catch (e) {}
      state.rounds = [];
      state.kingWinnerIdx = null;
      state.kingWinnerName = null;
      state.kingWinnerTricks = null;
      state.kozInputs = [0, 0, 0, 0];
      state.cezaInputs = [0, 0, 0, 0];
      state.kozConfirmed = [false, false, false, false];
      state.cezaConfirmed = [false, false, false, false];
      state.activeHandType = 'ceza';
      state.selectedCezaKey = 'el_almaz';
      state.selectedKozSuit = 'karo';
      state.initialDealer = 0;
      state.players.forEach(p => {
        p.score = 0;
        p.cezaCount = 0;
        p.kozCount = 0;
      });
    }

    if (!isGameInProgress && !isGameFinished) {
      const selRadio = document.querySelector('input[name="scoringMode"]:checked');
      if (selRadio) state.scoringMode = selRadio.value;
    }

    recalculateAllScores();
    hasUserEditedSetupInputs = false;
    saveStateToStorage();
    pushStateToServer();
    triggerHaptic(25);
    renderAll();

    if (isGameInProgress) {
      // Oyun devam ediyorsa Sonuçlar (Çetele) ekranına geri dön
      goToScreen(3, true);
      if (changedPlayers.length > 0) {
        const desc = changedPlayers.map(cp => `${cp.old} ➔ ${cp.new}`).join(', ');
        showToast(`${desc} devri yapıldı! Puanlar ve haklar aynen korundu.`, 'emerald');
      } else {
        showToast('Oyuncu isimleri güncellendi.', 'emerald');
      }
    } else {
      // Yeni oyun ise Ceza ekranına geç (tüm haklar sıfır: △△△ ve ○○)
      goToScreen(1, true);
      showToast('Yeni oyun başlatıldı! Ceza sayfasındasınız.', 'amber');
    }
  };

  document.getElementById('btnStartGame')?.addEventListener('click', handleStartOrUpdateGame);
  document.getElementById('btnStartGameTop')?.addEventListener('click', handleStartOrUpdateGame);

  // Hızlı Geçiş Butonları (Sonuçlar Sayfasından Ceza ve Koza)
  document.getElementById('btnJumpToCeza').addEventListener('click', () => {
    triggerHaptic(15);
    goToScreen(1, true); // Ceza = Ekran 1
  });
  document.getElementById('btnJumpToKoz').addEventListener('click', () => {
    triggerHaptic(15);
    goToScreen(2, true); // Koz = Ekran 2
  });
  // Alt Butonlar: Cezaya Git & Koza Git
  document.getElementById('btnFooterGoCeza')?.addEventListener('click', () => {
    triggerHaptic(15);
    goToScreen(1, true); // Ceza = Ekran 1
  });
  document.getElementById('btnFooterGoKoz')?.addEventListener('click', () => {
    triggerHaptic(15);
    goToScreen(2, true); // Koz = Ekran 2
  });
  document.getElementById('btnGoCezaFromKoz')?.addEventListener('click', () => {
    triggerHaptic(15);
    goToScreen(1, true); // Koz ekranından Ceza ekranına (1) git
  });
  document.getElementById('btnGoKozFromCeza')?.addEventListener('click', () => {
    triggerHaptic(15);
    goToScreen(2, true); // Ceza ekranından Koz ekranına (2) git
  });

  // Sayfa Altı Karar Değiştirme ve Geri Dön Butonları
  document.getElementById('btnSwitchCezaToKoz')?.addEventListener('click', () => {
    triggerHaptic(15);
    goToScreen(2, true); // Ceza sayfasından Koz sayfasına (Ekran 2) geç
  });
  document.getElementById('btnSwitchKozToCeza')?.addEventListener('click', () => {
    triggerHaptic(15);
    goToScreen(1, true); // Koz sayfasından Ceza sayfasına (Ekran 1) geç
  });

  // Sayfa Altı: Çeteye / Sonuçlara Geri Dön Butonları
  document.getElementById('btnBackToResultsFromCeza')?.addEventListener('click', () => {
    triggerHaptic(15);
    goToScreen(3, true); // Sonuçlar & Çetele sayfasına (Ekran 3) geri dön
  });
  document.getElementById('btnBackToResultsFromKoz')?.addEventListener('click', () => {
    triggerHaptic(15);
    goToScreen(3, true); // Sonuçlar & Çetele sayfasına (Ekran 3) geri dön
  });

  // Oyuncuları Düzenle (Sonuçlar sayfasından Sayfa 0'a)
  document.getElementById('btnEditPlayers').addEventListener('click', () => {
    triggerHaptic(15);
    goToScreen(0, true);
  });

  // Yazdır / PDF
  
  // Screen 4: Koza Çıkma & Strateji Simülatör Dinleyicileri
  document.getElementById('btnSimKozDec')?.addEventListener('click', () => {
    triggerHaptic(15);
    if (simKoz > 0) {
      simKoz--;
      const selP = state.players.find(p => p.id === targetSelectedPlayerId) || state.players[0];
      updateSimulatorView(selP);
    }
  });
  document.getElementById('btnSimKozInc')?.addEventListener('click', () => {
    triggerHaptic(15);
    if (simKoz < 13) {
      simKoz++;
      const selP = state.players.find(p => p.id === targetSelectedPlayerId) || state.players[0];
      updateSimulatorView(selP);
    }
  });

  document.getElementById('btnSimKizDec')?.addEventListener('click', () => {
    triggerHaptic(15);
    if (simKiz > 0) {
      simKiz--;
      const selP = state.players.find(p => p.id === targetSelectedPlayerId) || state.players[0];
      updateSimulatorView(selP);
    }
  });
  document.getElementById('btnSimKizInc')?.addEventListener('click', () => {
    triggerHaptic(15);
    if (simKiz < 4) {
      simKiz++;
      const selP = state.players.find(p => p.id === targetSelectedPlayerId) || state.players[0];
      updateSimulatorView(selP);
    }
  });

  document.getElementById('btnSimRifkiToggle')?.addEventListener('click', () => {
    triggerHaptic(20);
    simRifki = !simRifki;
    const selP = state.players.find(p => p.id === targetSelectedPlayerId) || state.players[0];
    updateSimulatorView(selP);
  });

  document.getElementById('btnSimErkekDec')?.addEventListener('click', () => {
    triggerHaptic(15);
    if (simErkek > 0) {
      simErkek--;
      const selP = state.players.find(p => p.id === targetSelectedPlayerId) || state.players[0];
      updateSimulatorView(selP);
    }
  });
  document.getElementById('btnSimErkekInc')?.addEventListener('click', () => {
    triggerHaptic(15);
    if (simErkek < 8) {
      simErkek++;
      const selP = state.players.find(p => p.id === targetSelectedPlayerId) || state.players[0];
      updateSimulatorView(selP);
    }
  });

  // Hızlı Gezinme Butonları (Screen 4 ve Diğer Ekranlar)
  document.getElementById('btnFooterGoTarget')?.addEventListener('click', () => {
    triggerHaptic(15);
    goToScreen(4, true); // Screen 4'e git
  });
  document.getElementById('btnBackToResultsFromTarget')?.addEventListener('click', () => {
    triggerHaptic(15);
    goToScreen(3, true); // Sonuçlar (Screen 3)'e git
  });
  document.getElementById('btnGoToCezaFromTarget')?.addEventListener('click', () => {
    triggerHaptic(15);
    goToScreen(1, true); // Ceza (Screen 1)'e git
  });
  document.getElementById('btnGoToKozFromTarget')?.addEventListener('click', () => {
    triggerHaptic(15);
    goToScreen(2, true); // Koz (Screen 2)'ye git
  });

    // Son 1 El Banner Tıklamaları -> Screen 4'e geç
  ['btnLhaCeza', 'btnLhaKoz', 'btnLhaResults'].forEach(id => {
    document.getElementById(id)?.addEventListener('click', () => {
      triggerHaptic(20);
      goToScreen(4, true);
    });
  });

  // Strateji Raporunu Kopyala Butonu
  document.getElementById('btnCopyStrategyReport')?.addEventListener('click', copyStrategyReportToClipboard);

  
  // Arşiv ve Dışa Aktarma Butonları
  document.getElementById('btnExportCsv')?.addEventListener('click', () => {
    triggerHaptic(15);
    window.location.href = '/api/export-csv';
  });
  document.getElementById('btnOpenArchives')?.addEventListener('click', openArchivesModal);
  document.getElementById('btnCloseArchives')?.addEventListener('click', closeArchivesModal);
  document.getElementById('modalArchives')?.addEventListener('click', (e) => {
    if (e.target === document.getElementById('modalArchives')) closeArchivesModal();
  });
  document.getElementById('btnManualArchive')?.addEventListener('click', archiveCurrentGameManual);
  document.getElementById('btnArchiveDirect')?.addEventListener('click', archiveCurrentGameManual);
  document.getElementById('btnHeaderArchive')?.addEventListener('click', archiveCurrentGameManual);

  document.getElementById('btnPrintScores').addEventListener('click', () => {
    window.print();
  });

  // Çeteleyi Panoya Kopyala
  document.getElementById('btnExportMatrix').addEventListener('click', copyMatrixToClipboard);

  // Yardım / Kurallar Modalı
  const modalHelp = document.getElementById('modalHelp');
  document.getElementById('btnHelp').addEventListener('click', () => modalHelp.classList.add('active'));
  document.getElementById('btnCloseHelp').addEventListener('click', () => modalHelp.classList.remove('active'));
  document.getElementById('btnOkHelp').addEventListener('click', () => modalHelp.classList.remove('active'));

  // Telefondan Bağlan Modalı (QR Kod)
  const modalMobile = document.getElementById('modalMobileConnect');
  const btnConnect = document.getElementById('btnConnectMobile');
  if (btnConnect && modalMobile) {
    btnConnect.addEventListener('click', openMobileConnectModal);
    document.getElementById('btnCloseMobileConnect')?.addEventListener('click', () => modalMobile.classList.remove('active'));
    document.getElementById('btnOkMobileConnect')?.addEventListener('click', () => modalMobile.classList.remove('active'));
  }

  // iOS ve Android Kurulum Rehberi Sekmeleri
  const tabIos = document.getElementById('tabIosGuide');
  const tabAndroid = document.getElementById('tabAndroidGuide');
  const guideIos = document.getElementById('guideContentIos');
  const guideAndroid = document.getElementById('guideContentAndroid');

  tabIos?.addEventListener('click', () => {
    tabIos.classList.add('active');
    tabAndroid?.classList.remove('active');
    if (guideIos) guideIos.style.display = 'block';
    if (guideAndroid) guideAndroid.style.display = 'none';
  });

  tabAndroid?.addEventListener('click', () => {
    tabAndroid.classList.add('active');
    tabIos?.classList.remove('active');
    if (guideAndroid) guideAndroid.style.display = 'block';
    if (guideIos) guideIos.style.display = 'none';
  });

  // Yerel Ağ Adresini Kopyalama
  document.getElementById('btnCopyNetworkUrl')?.addEventListener('click', () => {
    const url = document.getElementById('networkUrlText')?.textContent;
    if (url) {
      navigator.clipboard.writeText(url).then(() => {
        showToast('Bağlantı adresi kopyalandı!', 'emerald');
      }).catch(() => {
        showToast('Adres kopyalanamadı.', 'rose');
      });
    }
  });

  // Modalların dışına tıklayınca kapatma
  [modalHelp, modalMobile, modalReset].forEach(modal => {
    if (modal) {
      modal.addEventListener('click', (e) => {
        if (e.target === modal) modal.classList.remove('active');
      });
    }
  });
}

function openMobileConnectModal(targetTableId = currentTableId) {
  let selectedTid = String(targetTableId || currentTableId || '1');
  const modal = document.getElementById('modalMobileConnect');
  const qrContainer = document.getElementById('qrCodeContainer');
  const urlText = document.getElementById('networkUrlText');
  const qrPillsContainer = document.getElementById('qrTablePills');
  if (!modal) return;

  const updateQrForTable = (tid) => {
    selectedTid = String(tid);

    // QR Haplarını güncelle
    if (qrPillsContainer) {
      qrPillsContainer.querySelectorAll('.btn-qr-table-pill').forEach(btn => {
        btn.classList.toggle('active', btn.getAttribute('data-table-id') === selectedTid);
      });
    }

    const origin = window.location.origin;
    let targetUrl = (selectedTid !== '1')
      ? `${origin}/?masa=${selectedTid}`
      : `${origin}`;

    if (urlText) urlText.textContent = targetUrl;

    if (qrContainer && typeof qrcode !== 'undefined') {
      try {
        const qr = qrcode(0, 'M');
        qr.addData(targetUrl);
        qr.make();
        qrContainer.innerHTML = qr.createSvgTag({ cellSize: 5, margin: 2 });
      } catch (e) {
        qrContainer.innerHTML = `<div style="padding: 16px; font-weight: bold; color: #0f172a;">${escapeHtml(targetUrl)}</div>`;
      }
    }
  };

  // QR Masa Seçim Hapları
  if (qrPillsContainer) {
    qrPillsContainer.innerHTML = '';
    const activeTables = tablesList.slice(0, Math.max(1, activeTableCount));
    activeTables.forEach(t => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = `btn-qr-table-pill ${String(t.id) === selectedTid ? 'active' : ''}`;
      btn.setAttribute('data-table-id', t.id);
      btn.innerHTML = `🪑 ${escapeHtml(t.name || ('Masa ' + t.id))}`;
      btn.addEventListener('click', () => {
        triggerHaptic(15);
        updateQrForTable(t.id);
      });
      qrPillsContainer.appendChild(btn);
    });
  }

  updateQrForTable(selectedTid);
  modal.classList.add('active');
}


function copyStrategyReportToClipboard() {
  triggerHaptic(15);
  const totalRemainingHands = 20 - state.rounds.length;

  const gameLimits = { el_almaz: 2, kupa_almaz: 2, kiz_almaz: 2, erkek_almaz: 2, rifki: 2, son_iki: 2, koz: 8 };
  const played = { el_almaz: 0, kupa_almaz: 0, kiz_almaz: 0, erkek_almaz: 0, rifki: 0, son_iki: 0, koz: 0 };
  state.rounds.forEach(r => {
    if (r.isKoz) played.koz++;
    else if (played[r.gameKey] !== undefined) played[r.gameKey]++;
  });
  const remaining = {
    koz: Math.max(0, gameLimits.koz - played.koz),
    rifki: Math.max(0, gameLimits.rifki - played.rifki),
    kiz_almaz: Math.max(0, gameLimits.kiz_almaz - played.kiz_almaz),
    erkek_almaz: Math.max(0, gameLimits.erkek_almaz - played.erkek_almaz),
    son_iki: Math.max(0, gameLimits.son_iki - played.son_iki),
    kupa_almaz: Math.max(0, gameLimits.kupa_almaz - played.kupa_almaz),
    el_almaz: Math.max(0, gameLimits.el_almaz - played.el_almaz),
  };

  const cezaNames = {
    rifki: { name: 'Rıfkı', penalty: 320, type: 'single' },
    kiz_almaz: { name: 'Kız Almaz', penalty: 100, type: 'multi', maxUnits: 4, unitName: 'Kız' },
    erkek_almaz: { name: 'Erkek Almaz', penalty: 60, type: 'multi', maxUnits: 4, unitName: 'Erkek' },
    son_iki: { name: 'Son İki', penalty: 180, type: 'multi', maxUnits: 2, unitName: 'El' },
    kupa_almaz: { name: 'Kupa Almaz', penalty: 30, type: 'kupa' },
    el_almaz: { name: 'El Almaz', penalty: 50, type: 'el' }
  };
  const remCezaKeys = Object.keys(cezaNames).filter(k => remaining[k] > 0);

  let out = `🎯 KİNG KOZA ÇIKMA HEDEF RAPORU
`;
  out += `👑 Kalan Koz: ${remaining.koz} El | ⚡ Kalan Ceza: ${remCezaKeys.map(k => `${remaining[k]} ${cezaNames[k].name}`).join(', ') || 'Yok'}
`;
  out += `----------------------------------------
`;

  state.players.forEach(p => {
    out += `👤 ${p.name} (Şu An: ${p.score > 0 ? '+' : ''}${p.score} P)
`;
    if (remCezaKeys.length > 0) {
      remCezaKeys.forEach(ck => {
        const cDef = cezaNames[ck];
        // Yemezse
        const nNo = p.score < 0 ? Math.ceil(Math.abs(p.score) / 50) : 0;
        out += `  🛡️ ${cDef.name} Yemezse: ${p.score > 0 ? '+' : ''}${p.score} P ➔ ${p.score < 0 ? `En az ${nNo} el koz almalı` : 'Koza çıkmış'}
`;
        // Yerse
        if (cDef.type === 'single') {
          const after = p.score - cDef.penalty;
          const nW = after < 0 ? Math.ceil(Math.abs(after) / 50) : 0;
          out += `  💥 ${cDef.name} Yerse (-${cDef.penalty} P ➔ ${after} P) ➔ ${after < 0 ? `En az ${nW} el koz almalı` : 'Koza çıkmış'}
`;
        } else if (cDef.type === 'multi') {
          for (let u = 1; u <= cDef.maxUnits; u++) {
            const after = p.score - (u * cDef.penalty);
            const nW = after < 0 ? Math.ceil(Math.abs(after) / 50) : 0;
            out += `  💥 ${u} ${cDef.unitName} Yerse (-${u * cDef.penalty} P ➔ ${after} P) ➔ ${after < 0 ? `En az ${nW} el koz almalı` : 'Koza çıkmış'}
`;
          }
        }
      });
    } else {
      const nKoz = p.score < 0 ? Math.ceil(Math.abs(p.score) / 50) : 0;
      out += `  👑 Koza çıkmak için en az ${nKoz} el koz almalı
`;
    }
    out += `
`;
  });

  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(out).then(() => {
      showToast('📋 Rapor panoya kopyalandı!', 'emerald');
    }).catch(() => {
      fallbackCopyText(out);
    });
  } else {
    fallbackCopyText(out);
  }
}

function fallbackCopyText(text) {
  const ta = document.createElement('textarea');
  ta.value = text;
  ta.style.position = 'fixed';
  ta.style.opacity = '0';
  document.body.appendChild(ta);
  ta.select();
  try {
    document.execCommand('copy');
    showToast('📋 Strateji raporu kopyalandı!', 'emerald');
  } catch (err) {
    showToast('Kopyalama başarısız oldu.', 'rose');
  }
  document.body.removeChild(ta);
}

function copyMatrixToClipboard() {
  const pNames = state.players.map(p => p.name).join('\t');
  let txt = `KING SKOR VE ÇETELE TABLOSU\n`;
  txt += `Tarih: ${new Date().toLocaleDateString('tr-TR')}\n\n`;
  txt += `Oyun\tPuan\t${pNames}\n`;

  const rows = [
    { title: 'Koz (1. Hak)', key: 'koz', isKoz: true, unit: 0 },
    { title: 'Koz (2. Hak)', key: 'koz', isKoz: true, unit: 1 },
    { title: 'El Almaz (1)', key: 'el_almaz', isKoz: false, roundIdx: 0 },
    { title: 'El Almaz (2)', key: 'el_almaz', isKoz: false, roundIdx: 1 },
    { title: 'Kupa Almaz (1)', key: 'kupa_almaz', isKoz: false, roundIdx: 0 },
    { title: 'Kupa Almaz (2)', key: 'kupa_almaz', isKoz: false, roundIdx: 1 },
    { title: 'Kız Almaz (1)', key: 'kiz_almaz', isKoz: false, roundIdx: 0 },
    { title: 'Kız Almaz (2)', key: 'kiz_almaz', isKoz: false, roundIdx: 1 },
    { title: 'Erkek Almaz (1)', key: 'erkek_almaz', isKoz: false, roundIdx: 0 },
    { title: 'Erkek Almaz (2)', key: 'erkek_almaz', isKoz: false, roundIdx: 1 },
    { title: 'Rıfkı (1)', key: 'rifki', isKoz: false, roundIdx: 0 },
    { title: 'Rıfkı (2)', key: 'rifki', isKoz: false, roundIdx: 1 },
    { title: 'Son İki (1)', key: 'son_iki', isKoz: false, roundIdx: 0 },
    { title: 'Son İki (2)', key: 'son_iki', isKoz: false, roundIdx: 1 }
  ];

  rows.forEach(r => {
    txt += `${r.title}\t${r.isKoz ? '+50' : ''}`;
    for (let pIdx = 0; pIdx < 4; pIdx++) {
      let cell = '—';
      if (r.isKoz) {
        const pk = state.rounds.filter(rnd => rnd.callerIdx === pIdx && rnd.isKoz);
        if (pk[r.unit]) cell = `${pk[r.unit].points[pIdx]}P (👑)`;
      } else {
        const cezaRounds = state.rounds.filter(x => x.gameKey === r.key);
        const rnd = cezaRounds[r.roundIdx];
        if (rnd) {
          const pt = rnd.points[pIdx];
          const isCaller = rnd.callerIdx === pIdx;
          cell = `${pt}P${isCaller ? ' (👑)' : ''}`;
        }
      }
      txt += `\t${cell}`;
    }
    txt += `\n`;
  });

  txt += `\nTOPLAM SKOR:\n`;
  state.players.forEach(p => {
    txt += `${p.name}: ${p.score} Puan\n`;
  });

  navigator.clipboard.writeText(txt).then(() => {
    showToast('Çetele tablosu panoya kopyalandı!', 'emerald');
  }).catch(() => {
    showToast('Kopyalama başarısız oldu.', 'rose');
  });
}

function showToast(msg, type = 'emerald') {
  let toast = document.getElementById('appToast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'appToast';
    toast.style.position = 'fixed';
    toast.style.bottom = '24px';
    toast.style.left = '50%';
    toast.style.transform = 'translateX(-50%) translateY(20px)';
    toast.style.padding = '10px 18px';
    toast.style.borderRadius = '999px';
    toast.style.fontSize = '13px';
    toast.style.fontWeight = '700';
    toast.style.zIndex = '9999';
    toast.style.boxShadow = '0 10px 30px rgba(0,0,0,0.6)';
    toast.style.transition = 'all 0.25s ease';
    toast.style.color = '#fff';
    toast.style.pointerEvents = 'none';
    toast.style.whiteSpace = 'nowrap';
    document.body.appendChild(toast);
  }

  const bgColors = {
    emerald: 'linear-gradient(135deg, #059669 0%, #047857 100%)',
    rose: 'linear-gradient(135deg, #e11d48 0%, #be123c 100%)',
    amber: 'linear-gradient(135deg, #d97706 0%, #b45309 100%)',
    cyan: 'linear-gradient(135deg, #0891b2 0%, #0e7490 100%)',
  };

  toast.style.background = bgColors[type] || bgColors.emerald;
  toast.textContent = msg;
  toast.style.opacity = '1';
  toast.style.transform = 'translateX(-50%) translateY(0)';

  clearTimeout(toast._timer);
  toast._timer = setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(-50%) translateY(20px)';
  }, 2600);
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
