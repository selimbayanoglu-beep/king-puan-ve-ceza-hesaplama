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
  selectedCezaKey: 'el_almaz',
  kozInputs: [0, 0, 0, 0],
  cezaInputs: [0, 0, 0, 0]
};

// Çoklu Cihaz Senkronizasyonu & Haptic
let serverVersion = 0;
let isServerOnline = false;
let isSyncing = false;
let serverNetworkUrl = '';
let syncIntervalId = null;
let currentScreenIndex = 0;

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
  loadStateFromStorage();
  initSliderNavigation();
  initEventListeners();
  renderAll();

  // Eğer oyun zaten başlamışsa doğrudan Koz veya Sonuçlar sayfasına kaydır
  if (state.rounds.length > 0) {
    goToScreen(3, false); // Sonuçlar
  } else {
    goToScreen(0, false); // Kurulum
  }

  // Sunucu ve ağ kontrolü
  await fetchNetworkInfo();
  await fetchServerState(true);

  // Periyodik senkronizasyon (her 1.5 sn)
  syncIntervalId = setInterval(() => {
    fetchServerState(false);
  }, 1500);
});

// ==========================================================================
// SWIPE SLIDER & EKRAN KAYDIRMA YÖNETİMİ
// ==========================================================================
function initSliderNavigation() {
  const slider = document.getElementById('screensSlider');
  const tabs = document.querySelectorAll('.swipe-tab');

  // Sekmelere tıklama
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      const idx = parseInt(tab.dataset.index, 10);
      triggerHaptic(15);
      goToScreen(idx, true);
    });
  });

  // Dokunmatik kaydırma bitişini dinle (Scroll Snap)
  let scrollTimeout = null;
  slider.addEventListener('scroll', () => {
    clearTimeout(scrollTimeout);
    scrollTimeout = setTimeout(() => {
      const screenWidth = slider.clientWidth;
      if (screenWidth > 0) {
        const newIndex = Math.round(slider.scrollLeft / screenWidth);
        if (newIndex !== currentScreenIndex && newIndex >= 0 && newIndex <= 3) {
          currentScreenIndex = newIndex;
          updateSwipeTabs(currentScreenIndex);
        }
      }
    }, 40);
  }, { passive: true });
}

function goToScreen(index, smooth = true) {
  const slider = document.getElementById('screensSlider');
  currentScreenIndex = Math.max(0, Math.min(3, index));
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

  tabs.forEach((tab, i) => {
    tab.classList.toggle('active', i === index);
  });

  if (indicator) {
    indicator.style.transform = `translateX(${index * 100}%)`;
  }
}

// ==========================================================================
// SUNUCU & STORAGE SENKRONİZASYONU
// ==========================================================================
async function fetchNetworkInfo() {
  try {
    const res = await fetch('/api/network-info', { cache: 'no-store' });
    if (res.ok) {
      const data = await res.json();
      if (data.url) serverNetworkUrl = data.url;
      return data;
    }
  } catch (e) {}
  return null;
}

async function fetchServerState(initial = false) {
  if (isSyncing) return;
  try {
    const res = await fetch('/api/state', { cache: 'no-store' });
    if (res.ok) {
      const data = await res.json();
      updateSyncBadge(true);
      if (data.version && data.version > serverVersion) {
        serverVersion = data.version;
        if (data.state && Array.isArray(data.state.players)) {
          state = data.state;
          if (!state.kozInputs) state.kozInputs = [0, 0, 0, 0];
          if (!state.cezaInputs) state.cezaInputs = [0, 0, 0, 0];
          recalculateAllScores();
          saveStateToStorage();
          renderAll();
          if (!initial) {
            showToast('🔄 Çetele güncellendi (senkronize)', 'cyan');
          }
        }
      }
    } else {
      updateSyncBadge(false);
    }
  } catch (e) {
    updateSyncBadge(false);
  }
}

async function pushStateToServer() {
  saveStateToStorage();
  try {
    isSyncing = true;
    const res = await fetch('/api/state', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ state: state, version: serverVersion })
    });
    if (res.ok) {
      const data = await res.json();
      if (data.version) serverVersion = data.version;
      updateSyncBadge(true);
    } else {
      updateSyncBadge(false);
    }
  } catch (e) {
    updateSyncBadge(false);
  } finally {
    isSyncing = false;
  }
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
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (e) {}
}

function loadStateFromStorage() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && Array.isArray(parsed.players) && parsed.players.length === 4) {
        state = parsed;
        if (!state.kozInputs) state.kozInputs = [0, 0, 0, 0];
        if (!state.cezaInputs) state.cezaInputs = [0, 0, 0, 0];
        recalculateAllScores();
      }
    }
  } catch (e) {}
}

// ==========================================================================
// PUAN VE HAK HESAPLAMA MOTORU
// ==========================================================================
function recalculateAllScores() {
  state.players.forEach(p => {
    p.score = 0;
    p.kozCount = 0;
    p.cezaCount = 0;
  });

  state.rounds.forEach(round => {
    const caller = state.players[round.callerIdx];
    if (round.isKoz) {
      caller.kozCount++;
    } else {
      caller.cezaCount++;
    }

    round.points.forEach((pt, pIdx) => {
      state.players[pIdx].score += pt;
    });
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

  if (def.isKoz) {
    return caller.kozCount < 2;
  }

  if (caller.cezaCount >= 3) {
    return false;
  }

  if (getGlobalGameUsageCount(gameKey) >= 2) {
    return false;
  }

  if (getPlayerGameUsageCount(callerIdx, gameKey) >= 1) {
    return false;
  }

  return true;
}

// ==========================================================================
// RENDER MOTORU (TÜM SAYFALAR)
// ==========================================================================
function renderAll() {
  const currentHand = getCurrentHandNumber();
  const callerIdx = getCurrentCallerIndex();
  const isGameOver = currentHand > 20;

  renderSetupScreen();
  renderKozScreen(currentHand, callerIdx, isGameOver);
  renderCezaScreen(currentHand, callerIdx, isGameOver);
  renderResultsScreen(currentHand, callerIdx, isGameOver);
}

// --------------------------------------------------------------------------
// 1. OYUNCULAR SAYFASI
// --------------------------------------------------------------------------
function renderSetupScreen() {
  document.getElementById('inputPlayer1').value = state.players[0].name;
  document.getElementById('inputPlayer2').value = state.players[1].name;
  document.getElementById('inputPlayer3').value = state.players[2].name;
  document.getElementById('inputPlayer4').value = state.players[3].name;

  const dealerRow = document.getElementById('dealerPickRow');
  dealerRow.innerHTML = '';
  state.players.forEach((p, idx) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = `btn-dealer-pick ${state.initialDealer === idx ? 'selected' : ''}`;
    btn.textContent = `${idx + 1}. ${p.name}`;
    btn.addEventListener('click', () => {
      triggerHaptic(15);
      state.initialDealer = idx;
      renderSetupScreen();
    });
    dealerRow.appendChild(btn);
  });

  const selRadio = document.querySelector(`input[name="scoringMode"][value="${state.scoringMode}"]`);
  if (selRadio) selRadio.checked = true;
}

// --------------------------------------------------------------------------
// 2. KOZ SAYFASI
// --------------------------------------------------------------------------
function renderKozScreen(currentHand, callerIdx, isGameOver) {
  const caller = state.players[callerIdx] || state.players[0];
  const handNoEl = document.getElementById('lblKozHandNo');
  const callerEl = document.getElementById('lblKozCaller');
  const rightsEl = document.getElementById('lblKozCallerRights');
  const lockedAlert = document.getElementById('kozLockedAlert');
  const entryBox = document.getElementById('kozEntryBox');
  const playedKozCount = state.rounds.filter(r => r.isKoz).length;

  document.getElementById('tabBadgeKoz').textContent = `${playedKozCount}/8`;

  if (isGameOver) {
    handNoEl.textContent = 'Oyun Bitti (20/20)';
    callerEl.textContent = 'Sonuçları İnceleyin';
    entryBox.style.display = 'none';
    lockedAlert.style.display = 'none';
    return;
  }

  handNoEl.textContent = `${currentHand}. El (${currentHand} / 20)`;
  callerEl.textContent = `Söyleyen: ${caller.name}`;
  rightsEl.textContent = `Koz Hakkı: ${caller.kozCount} / 2`;

  const canPlayKoz = caller.kozCount < 2;

  if (!canPlayKoz) {
    lockedAlert.style.display = 'flex';
    entryBox.style.display = 'none';
    document.getElementById('kozLockedMsg').textContent = `${caller.name} oyuncusunun 2 Koz hakkı da tükendi. Bu elde Ceza seçilmelidir.`;
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
  const caller = state.players[callerIdx] || state.players[0];
  const handNoEl = document.getElementById('lblCezaHandNo');
  const callerEl = document.getElementById('lblCezaCaller');
  const rightsEl = document.getElementById('lblCezaCallerRights');
  const lockedAlert = document.getElementById('cezaLockedAlert');
  const entryBox = document.getElementById('cezaEntryBox');
  const grid = document.getElementById('cezaTypesGrid');
  const playedCezaCount = state.rounds.filter(r => !r.isKoz).length;

  document.getElementById('tabBadgeCeza').textContent = `${playedCezaCount}/12`;

  if (isGameOver) {
    handNoEl.textContent = 'Oyun Bitti (20/20)';
    callerEl.textContent = 'Sonuçları İnceleyin';
    entryBox.style.display = 'none';
    lockedAlert.style.display = 'none';
    grid.style.display = 'none';
    return;
  }

  handNoEl.textContent = `${currentHand}. El (${currentHand} / 20)`;
  callerEl.textContent = `Söyleyen: ${caller.name}`;
  rightsEl.textContent = `Ceza Hakkı: ${caller.cezaCount} / 3`;

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
      triggerHaptic(15);
      state.selectedCezaKey = k;
      state.cezaInputs = [0, 0, 0, 0];
      renderCezaScreen(currentHand, callerIdx, isGameOver);
    });

    grid.appendChild(btn);
  });

  // Seçilen Ceza Banner Güncelle
  const activeDef = GAME_DEFS[state.selectedCezaKey] || GAME_DEFS.el_almaz;
  document.getElementById('cezaBannerIcon').textContent = activeDef.icon;
  document.getElementById('cezaBannerTitle').textContent = activeDef.title;
  document.getElementById('cezaBannerDesc').textContent = activeDef.desc;

  let unitPts = (state.scoringMode === 'zero_sum') ? (activeDef.baseUnitPoint * 2) : activeDef.baseUnitPoint;
  document.getElementById('cezaBannerPts').textContent = `${unitPts} P / ${activeDef.unitName}`;

  // Rıfkı Özel Durumu: 4 Oyuncu Tek Dokunuş Seçim Butonları
  const rifkiBox = document.getElementById('rifkiPickerBox');
  const rifkiContainer = document.getElementById('rifkiPlayerButtons');
  const cezaList = document.getElementById('cezaPlayersList');
  const cezaQuickRow = document.getElementById('cezaQuickFillRow');

  if (activeDef.key === 'rifki') {
    rifkiBox.style.display = 'flex';
    cezaList.style.display = 'none';
    cezaQuickRow.style.display = 'none';
    rifkiContainer.innerHTML = '';

    state.players.forEach((p, idx) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      const isChosen = state.cezaInputs[idx] === 1;
      btn.className = `btn-rifki-p ${isChosen ? 'selected' : ''}`;
      btn.textContent = p.name;
      btn.addEventListener('click', () => {
        triggerHaptic(20);
        state.cezaInputs = [0, 0, 0, 0];
        state.cezaInputs[idx] = 1;
        renderCezaScreen(currentHand, callerIdx, isGameOver);
      });
      rifkiContainer.appendChild(btn);
    });

    validateDistribution(activeDef.totalUnits, activeDef.unitName, state.cezaInputs, 'cezaRemainingBadge', 'cezaValidationMsg', 'btnSaveCeza');
  } else {
    rifkiBox.style.display = 'none';
    cezaList.style.display = 'flex';
    cezaQuickRow.style.display = 'flex';

    renderDistributionList('ceza', activeDef.totalUnits, state.cezaInputs, 'cezaPlayersList', 'cezaQuickButtons', 'cezaRemainingBadge', 'cezaValidationMsg', 'btnSaveCeza');
  }
}

// Ortak Dağıtım Listesi Render Yardımcısı (Koz ve Ceza için)
function renderDistributionList(type, totalUnits, inputsArray, listId, quickId, badgeId, msgId, saveBtnId) {
  const container = document.getElementById(listId);
  container.innerHTML = '';

  state.players.forEach((p, idx) => {
    const val = inputsArray[idx] || 0;
    const row = document.createElement('div');
    row.className = 'dist-row';
    row.innerHTML = `
      <div class="dist-player-info">
        <span class="dist-player-name">${escapeHtml(p.name)}</span>
        <span class="dist-player-score">${p.score > 0 ? '+' : ''}${p.score} P</span>
      </div>
      <div class="stepper-wrap">
        <button type="button" class="btn-stepper" data-action="dec" data-p="${idx}">−</button>
        <span class="stepper-val">${val}</span>
        <button type="button" class="btn-stepper" data-action="inc" data-p="${idx}">+</button>
      </div>
    `;

    row.querySelector('[data-action="dec"]').addEventListener('click', () => {
      triggerHaptic(15);
      if (inputsArray[idx] > 0) {
        inputsArray[idx]--;
        renderAll();
      }
    });

    row.querySelector('[data-action="inc"]').addEventListener('click', () => {
      triggerHaptic(15);
      const sum = inputsArray.reduce((a, b) => a + b, 0);
      if (sum < totalUnits) {
        inputsArray[idx]++;
        renderAll();
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
      btn.textContent = p.name;
      btn.addEventListener('click', () => {
        triggerHaptic(20);
        const currentSumWithoutP = inputsArray.reduce((sum, val, i) => i === idx ? sum : sum + val, 0);
        const remaining = Math.max(0, totalUnits - currentSumWithoutP);
        inputsArray[idx] = remaining;
        renderAll();
      });
      quickContainer.appendChild(btn);
    });
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

  if (diff === 0) {
    badge.textContent = `Tamamlandı (${totalUnits}/${totalUnits})`;
    badge.className = 'remaining-counter valid';
    msg.textContent = `✓ Dağılım eksiksiz doğrulandı. Kaydedebilirsiniz.`;
    msg.className = 'validation-bar success';
    btnSave.disabled = false;
  } else if (diff > 0) {
    badge.textContent = `Kalan: ${diff} / ${totalUnits} ${unitName}`;
    badge.className = 'remaining-counter';
    msg.textContent = `⚠️ Dağıtılması gereken ${diff} adet ${unitName} kaldı.`;
    msg.className = 'validation-bar error';
    btnSave.disabled = true;
  } else {
    badge.textContent = `Fazla: +${Math.abs(diff)}`;
    badge.className = 'remaining-counter';
    msg.textContent = `❌ Toplam ${totalUnits} olmalı, ${Math.abs(diff)} adet fazla girildi!`;
    msg.className = 'validation-bar error';
    btnSave.disabled = true;
  }
}

// --------------------------------------------------------------------------
// 4. TOPLU SONUÇLAR & ÇETELE MATRİSİ SAYFASI
// --------------------------------------------------------------------------
function renderResultsScreen(currentHand, callerIdx, isGameOver) {
  const caller = state.players[callerIdx] || state.players[0];

  // Sıradaki El Çağrısı
  const lblHand = document.getElementById('lblResCurrentHand');
  const lblCaller = document.getElementById('lblResActiveCaller');
  const btnJumpKoz = document.getElementById('btnJumpToKoz');
  const btnJumpCeza = document.getElementById('btnJumpToCeza');

  if (isGameOver) {
    lblHand.textContent = '20 / 20 (TAMAMLANDI)';
    lblCaller.textContent = 'Şampiyon Belli Oldu! 🏆';
    btnJumpKoz.style.display = 'none';
    btnJumpCeza.style.display = 'none';
  } else {
    lblHand.textContent = `${currentHand} / 20`;
    lblCaller.textContent = `Sıradaki: ${caller.name}`;
    btnJumpKoz.style.display = caller.kozCount < 2 ? 'inline-flex' : 'none';
    btnJumpCeza.style.display = caller.cezaCount < 3 ? 'inline-flex' : 'none';
  }

  // 4 Oyuncu Canlı Skor Kartları (Liderlik)
  const board = document.getElementById('resultsLeaderboard');
  board.innerHTML = '';
  const sortedPlayers = [...state.players].sort((a, b) => b.score - a.score);
  const ranks = {};
  sortedPlayers.forEach((p, i) => ranks[p.id] = i + 1);

  state.players.forEach(p => {
    const isTurn = p.id === callerIdx && !isGameOver;
    const rank = ranks[p.id];
    let medal = `${rank}.`;
    if (rank === 1) medal = '🥇';
    else if (rank === 2) medal = '🥈';
    else if (rank === 3) medal = '🥉';

    const card = document.createElement('div');
    card.className = `leader-card rank-${rank} ${isTurn ? 'active-turn' : ''}`;
    card.innerHTML = `
      <div class="lc-top">
        <span class="lc-rank">${medal}</span>
        <span class="lc-name">${escapeHtml(p.name)}</span>
        ${isTurn ? '<span class="lc-turn-badge">Sıradaki</span>' : ''}
      </div>
      <div class="lc-score ${p.score > 0 ? 'pos' : p.score < 0 ? 'neg' : ''}">
        ${p.score > 0 ? '+' : ''}${p.score}
      </div>
      <div class="lc-stats">
        <span>Koz: <b>${p.kozCount}/2</b></span>
        <span>Ceza: <b>${p.cezaCount}/3</b></span>
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
  document.getElementById('thPlayer1').textContent = state.players[0].name;
  document.getElementById('thPlayer2').textContent = state.players[1].name;
  document.getElementById('thPlayer3').textContent = state.players[2].name;
  document.getElementById('thPlayer4').textContent = state.players[3].name;

  const tbody = document.getElementById('ceteleTableBody');
  tbody.innerHTML = '';

  const rows = [
    { title: 'Koz (1. Hak)', key: 'koz', isKoz: true, pts: '+50', unit: 0 },
    { title: 'Koz (2. Hak)', key: 'koz', isKoz: true, pts: '+50', unit: 1 },
    { title: 'El Almaz', key: 'el_almaz', isKoz: false, pts: state.scoringMode === 'zero_sum' ? '-100' : '-50' },
    { title: 'Kupa Almaz', key: 'kupa_almaz', isKoz: false, pts: state.scoringMode === 'zero_sum' ? '-60' : '-30' },
    { title: 'Kız Almaz', key: 'kiz_almaz', isKoz: false, pts: state.scoringMode === 'zero_sum' ? '-200' : '-100' },
    { title: 'Erkek Almaz', key: 'erkek_almaz', isKoz: false, pts: state.scoringMode === 'zero_sum' ? '-120' : '-60' },
    { title: 'Rıfkı', key: 'rifki', isKoz: false, pts: state.scoringMode === 'zero_sum' ? '-640' : '-320' },
    { title: 'Son İki', key: 'son_iki', isKoz: false, pts: state.scoringMode === 'zero_sum' ? '-360' : '-180' }
  ];

  rows.forEach(r => {
    const tr = document.createElement('tr');
    let cellsHtml = `<td class="th-game">${r.title}</td><td class="th-pts">${r.pts}</td>`;

    for (let pIdx = 0; pIdx < 4; pIdx++) {
      let cellText = '—';
      let cellCls = '';

      if (r.isKoz) {
        const callerKozRounds = state.rounds.filter(rnd => rnd.callerIdx === pIdx && rnd.isKoz);
        const rnd = callerKozRounds[r.unit];
        if (rnd) {
          const pt = rnd.points[pIdx];
          cellText = `${pt > 0 ? '+' : ''}${pt}`;
          cellCls = 'cell-used pos';
        }
      } else {
        const rnd = state.rounds.find(x => x.callerIdx === pIdx && x.gameKey === r.key);
        if (rnd) {
          const pt = rnd.points[pIdx];
          cellText = `${pt}`;
          cellCls = 'cell-used neg';
        } else {
          const globalUsage = getGlobalGameUsageCount(r.key);
          if (globalUsage >= 2 || state.players[pIdx].cezaCount >= 3) {
            cellText = '✕';
            cellCls = 'cell-locked';
          }
        }
      }

      cellsHtml += `<td class="${cellCls}">${cellText}</td>`;
    }

    tr.innerHTML = cellsHtml;
    tbody.appendChild(tr);
  });
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
        <td>${def.icon} ${def.shortTitle}</td>
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

  const roundData = {
    handNo: currentHand,
    callerIdx: callerIdx,
    callerName: state.players[callerIdx].name,
    gameKey: 'koz',
    gameTitle: 'Koz',
    isKoz: true,
    distribution: distribution,
    points: points,
    timestamp: new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })
  };

  state.rounds.push(roundData);
  recalculateAllScores();
  state.kozInputs = [0, 0, 0, 0];
  saveStateToStorage();
  pushStateToServer();
  triggerHaptic(40);
  renderAll();

  showToast(`${currentHand}. el (Koz) başarıyla kaydedildi!`, 'emerald');

  // Otomatik olarak Toplu Sonuçlar sayfasına kaydır
  goToScreen(3, true);
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
  saveStateToStorage();
  pushStateToServer();
  triggerHaptic(30);
  renderAll();
  showToast(`${removed.handNo}. el geri alındı.`, 'amber');
}

function resetGame() {
  if (state.rounds.length > 0) {
    if (!confirm('Tüm oyun skorları ve çetele sıfırlanacak. Emin misiniz?')) {
      return;
    }
  }
  const currentNames = state.players.map(p => p.name);
  state = {
    players: [
      { id: 0, name: currentNames[0] || 'Oyuncu 1', score: 0, kozCount: 0, cezaCount: 0 },
      { id: 1, name: currentNames[1] || 'Oyuncu 2', score: 0, kozCount: 0, cezaCount: 0 },
      { id: 2, name: currentNames[2] || 'Oyuncu 3', score: 0, kozCount: 0, cezaCount: 0 },
      { id: 3, name: currentNames[3] || 'Oyuncu 4', score: 0, kozCount: 0, cezaCount: 0 },
    ],
    initialDealer: 0,
    scoringMode: state.scoringMode || 'standard',
    rounds: [],
    selectedCezaKey: 'el_almaz',
    kozInputs: [0, 0, 0, 0],
    cezaInputs: [0, 0, 0, 0]
  };
  saveStateToStorage();
  pushStateToServer();
  renderAll();
  goToScreen(0, true);
  showToast('Yeni oyun başlatıldı!', 'emerald');
}

// ==========================================================================
// EVENT LISTENERS & MODALLAR
// ==========================================================================
function initEventListeners() {
  // Koz ve Ceza Kaydet Butonları
  document.getElementById('btnSaveKoz').addEventListener('click', saveKozHand);
  document.getElementById('btnSaveCeza').addEventListener('click', saveCezaHand);

  // Geri Al & Yeni Oyun
  document.getElementById('btnUndo').addEventListener('click', undoLastHand);
  document.getElementById('btnNewGame').addEventListener('click', resetGame);

  // Kurulum Sayfası: "Oyunu Başlat"
  document.getElementById('btnStartGame').addEventListener('click', () => {
    state.players[0].name = document.getElementById('inputPlayer1').value.trim() || 'Oyuncu 1';
    state.players[1].name = document.getElementById('inputPlayer2').value.trim() || 'Oyuncu 2';
    state.players[2].name = document.getElementById('inputPlayer3').value.trim() || 'Oyuncu 3';
    state.players[3].name = document.getElementById('inputPlayer4').value.trim() || 'Oyuncu 4';

    const selRadio = document.querySelector('input[name="scoringMode"]:checked');
    if (selRadio) state.scoringMode = selRadio.value;

    recalculateAllScores();
    saveStateToStorage();
    pushStateToServer();
    triggerHaptic(25);
    renderAll();

    // Koz sayfasına pürüzsüzce kaydır
    goToScreen(1, true);
    showToast('Oyun başlatıldı! Koz sayfasındasınız.', 'emerald');
  });

  // Hızlı Geçiş Butonları (Sonuçlar Sayfasından Koz ve Cezaya)
  document.getElementById('btnJumpToKoz').addEventListener('click', () => {
    triggerHaptic(15);
    goToScreen(1, true);
  });
  document.getElementById('btnJumpToCeza').addEventListener('click', () => {
    triggerHaptic(15);
    goToScreen(2, true);
  });
  document.getElementById('btnGoCezaFromKoz').addEventListener('click', () => {
    triggerHaptic(15);
    goToScreen(2, true);
  });
  document.getElementById('btnGoKozFromCeza').addEventListener('click', () => {
    triggerHaptic(15);
    goToScreen(1, true);
  });

  // Oyuncuları Düzenle (Sonuçlar sayfasından Sayfa 0'a)
  document.getElementById('btnEditPlayers').addEventListener('click', () => {
    triggerHaptic(15);
    goToScreen(0, true);
  });

  // Yazdır / PDF
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
  [modalHelp, modalMobile].forEach(modal => {
    if (modal) {
      modal.addEventListener('click', (e) => {
        if (e.target === modal) modal.classList.remove('active');
      });
    }
  });
}

function openMobileConnectModal() {
  const modal = document.getElementById('modalMobileConnect');
  const qrContainer = document.getElementById('qrCodeContainer');
  const urlText = document.getElementById('networkUrlText');
  if (!modal) return;

  let targetUrl = serverNetworkUrl || window.location.href;
  if (serverNetworkUrl && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')) {
    targetUrl = serverNetworkUrl;
  }

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

  modal.classList.add('active');
}

function copyMatrixToClipboard() {
  const pNames = state.players.map(p => p.name).join('\t');
  let txt = `KING SKOR VE ÇETELE TABLOSU\n`;
  txt += `Tarih: ${new Date().toLocaleDateString('tr-TR')}\n\n`;
  txt += `Oyun\tPuan\t${pNames}\n`;

  const rows = [
    { title: 'Koz 1', key: 'koz', idx: 0 },
    { title: 'Koz 2', key: 'koz', idx: 1 },
    { title: 'El Almaz', key: 'el_almaz' },
    { title: 'Kupa Almaz', key: 'kupa_almaz' },
    { title: 'Kız Almaz', key: 'kiz_almaz' },
    { title: 'Erkek Almaz', key: 'erkek_almaz' },
    { title: 'Rıfkı', key: 'rifki' },
    { title: 'Son İki', key: 'son_iki' }
  ];

  rows.forEach(r => {
    txt += `${r.title}\t`;
    for (let pIdx = 0; pIdx < 4; pIdx++) {
      let cell = '—';
      if (r.key === 'koz') {
        const pk = state.rounds.filter(rnd => rnd.callerIdx === pIdx && rnd.isKoz);
        if (pk[r.idx]) cell = `${pk[r.idx].points[pIdx]}P`;
      } else {
        const rnd = state.rounds.find(x => x.callerIdx === pIdx && x.gameKey === r.key);
        if (rnd) cell = `${rnd.points[pIdx]}P`;
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
    showToast('Çetele panoya kopyalandı!', 'emerald');
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
