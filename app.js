/**
 * KING PUAN & CEZA HESAPLAMA SİSTEMİ
 * 20 El Oyun Döngüsü, Otomatik Doğrulama ve Çetele Motoru
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
    desc: 'Kupa Papazını alan oyuncu tek seferde -320 puan ceza yer.'
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
  rounds: [], // Oynanan eller geçmişi
  selectedGameKey: 'koz',
  currentInputs: [0, 0, 0, 0] // Aktif el için 4 oyuncunun girdiği miktar
};

// Uygulama Başlatma
document.addEventListener('DOMContentLoaded', () => {
  loadStateFromStorage();
  initEventListeners();
  renderAll();
});

// ==========================================================================
// STATE & STORAGE YÖNETİMİ
// ==========================================================================
function saveStateToStorage() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (e) {
    console.warn('LocalStorage kaydı yapılamadı:', e);
  }
}

function loadStateFromStorage() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && Array.isArray(parsed.players) && parsed.players.length === 4) {
        state = parsed;
        // Eksik alanları tamamla
        if (!state.currentInputs || state.currentInputs.length !== 4) {
          state.currentInputs = [0, 0, 0, 0];
        }
        recalculateAllScores();
      }
    }
  } catch (e) {
    console.error('Kayıtlı oyun yüklenirken hata:', e);
  }
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
    selectedGameKey: 'koz',
    currentInputs: [0, 0, 0, 0]
  };
  saveStateToStorage();
  renderAll();
  showToast('Yeni oyun başlatıldı!', 'emerald');
}

function undoLastHand() {
  if (state.rounds.length === 0) {
    showToast('Geri alınacak el bulunamadı!', 'rose');
    return;
  }
  const removed = state.rounds.pop();
  recalculateAllScores();
  state.currentInputs = [0, 0, 0, 0];
  saveStateToStorage();
  renderAll();
  showToast(`${removed.handNo}. el geri alındı.`, 'amber');
}

// ==========================================================================
// PUAN VE HAK HESAPLAMA MOTORU
// ==========================================================================
function recalculateAllScores() {
  // Sıfırla
  state.players.forEach(p => {
    p.score = 0;
    p.kozCount = 0;
    p.cezaCount = 0;
  });

  state.rounds.forEach(round => {
    // Söyleyenin koz/ceza sayacını artır
    const caller = state.players[round.callerIdx];
    if (round.isKoz) {
      caller.kozCount++;
    } else {
      caller.cezaCount++;
    }

    // Puanları ekle
    round.points.forEach((pt, pIdx) => {
      state.players[pIdx].score += pt;
    });
  });
}

/**
 * Bir el için oyuncu puanlarını hesaplar
 */
function calculateHandPoints(gameKey, callerIdx, distribution) {
  const def = GAME_DEFS[gameKey];
  if (!def) return [0, 0, 0, 0];

  let unitPoint = def.baseUnitPoint;

  // Sıfır Toplamlı Mod (Zero-Sum) Ayarı:
  // Standartta Koz: +50 * 13 = +650 * 8 el = +5200. Cezalar toplamı -2600.
  // Sıfır toplamlıda cezalar x2 katına çıkar (-5200) veya koz yarıya iner.
  // Burada cezaları 2 ile çarpıyoruz ki tam sıfırlansın!
  if (state.scoringMode === 'zero_sum' && !def.isKoz) {
    unitPoint = def.baseUnitPoint * 2;
  }

  const points = distribution.map((count, pIdx) => {
    let p = count * unitPoint;

    // Kanlı King kuralı: Cezayı söyleyen kendisi ceza yerse x2
    if (state.scoringMode === 'bloody' && !def.isKoz && pIdx === callerIdx && p < 0) {
      p = p * 2;
    }

    return p;
  });

  return points;
}

// Aktif el numarasını döner (1 .. 20)
function getCurrentHandNumber() {
  return state.rounds.length + 1;
}

// Aktif elin söyleyenini (sıradaki oyuncu) belirler
function getCurrentCallerIndex() {
  const handIdx = state.rounds.length; // 0 .. 19
  return (state.initialDealer + handIdx) % 4;
}

// Bir ceza türünün tüm oyunda kaç kez oynandığını bulur (Maks 2)
function getGlobalGameUsageCount(gameKey) {
  return state.rounds.filter(r => r.gameKey === gameKey).length;
}

// Bir oyuncunun bir ceza türünü kaç kez oynadığını bulur
function getPlayerGameUsageCount(playerIdx, gameKey) {
  return state.rounds.filter(r => r.callerIdx === playerIdx && r.gameKey === gameKey).length;
}

// Sıradaki oyuncunun bu oyunu seçip seçemeyeceğini kontrol eder
function isGameAvailableForCaller(callerIdx, gameKey) {
  const caller = state.players[callerIdx];
  const def = GAME_DEFS[gameKey];
  if (!def) return false;

  // 1. Koz seçimi kuralı: Bir oyuncu en fazla 2 koz söyleyebilir
  if (def.isKoz) {
    return caller.kozCount < 2;
  }

  // 2. Ceza seçimi kuralı: Bir oyuncu en fazla 3 ceza söyleyebilir
  if (caller.cezaCount >= 3) {
    return false;
  }

  // 3. Global ceza kuralı: Bir ceza türü oyunda en fazla 2 kez oynanabilir
  if (getGlobalGameUsageCount(gameKey) >= 2) {
    return false;
  }

  // 4. Oyuncu aynı cezayı daha önce söylemiş mi? (Geleneksel kurallarda bir oyuncu aynı cezayı en fazla 1 kez söyler)
  if (getPlayerGameUsageCount(callerIdx, gameKey) >= 1) {
    return false;
  }

  return true;
}

// ==========================================================================
// RENDER FONKSİYONLARI
// ==========================================================================
function renderAll() {
  const currentHand = getCurrentHandNumber();
  const callerIdx = getCurrentCallerIndex();
  const isGameOver = currentHand > 20;

  renderHeaderProgress(currentHand, callerIdx, isGameOver);
  renderPlayerCards(callerIdx);
  renderEntryPanel(currentHand, callerIdx, isGameOver);
  renderMatrixTable();
  renderHistoryTable();
}

function renderHeaderProgress(currentHand, callerIdx, isGameOver) {
  const lblHand = document.getElementById('lblCurrentHand');
  const lblCaller = document.getElementById('lblActivePlayer');
  const barFill = document.getElementById('progressBarFill');
  const playedKoz = state.rounds.filter(r => r.isKoz).length;
  const playedCeza = state.rounds.filter(r => !r.isKoz).length;

  document.getElementById('lblPlayedKozCount').textContent = `${playedKoz} / 8`;
  document.getElementById('lblPlayedCezaCount').textContent = `${playedCeza} / 12`;

  if (isGameOver) {
    lblHand.textContent = 'OYUN BİTTİ';
    lblCaller.textContent = 'Şampiyon Belli Oldu! 🏆';
    barFill.style.width = '100%';
  } else {
    lblHand.textContent = `${currentHand} / 20`;
    lblCaller.textContent = state.players[callerIdx]?.name || `Oyuncu ${callerIdx + 1}`;
    const pct = Math.min(100, Math.round(((currentHand - 1) / 20) * 100));
    barFill.style.width = `${Math.max(5, pct)}%`;
  }
}

function renderPlayerCards(activeCallerIdx) {
  const container = document.getElementById('playersGrid');
  container.innerHTML = '';

  // Oyuncuları sıralamak için kopya al
  const sortedPlayers = [...state.players].sort((a, b) => b.score - a.score);
  const ranks = {};
  sortedPlayers.forEach((p, idx) => {
    ranks[p.id] = idx + 1;
  });

  state.players.forEach(p => {
    const isCaller = p.id === activeCallerIdx && state.rounds.length < 20;
    const rank = ranks[p.id];
    let rankBadge = `${rank}.`;
    if (rank === 1) rankBadge = '🥇';
    else if (rank === 2) rankBadge = '🥈';
    else if (rank === 3) rankBadge = '🥉';

    let scoreClass = 'score-zero';
    let sign = '';
    if (p.score > 0) {
      scoreClass = 'score-positive';
      sign = '+';
    } else if (p.score < 0) {
      scoreClass = 'score-negative';
    }

    const card = document.createElement('div');
    card.className = `player-card ${isCaller ? 'active-turn' : ''} rank-${rank}`;
    card.innerHTML = `
      <div class="player-card-header">
        <div class="player-title-wrap">
          <span class="rank-badge">${rankBadge}</span>
          <span class="player-name-text">${escapeHtml(p.name)}</span>
        </div>
        ${isCaller ? '<span class="dealer-badge">👑 SÖYLÜYOR</span>' : ''}
      </div>
      <div class="player-score-main">
        <span class="score-number ${scoreClass}">${sign}${p.score}</span>
        <span class="score-rank-label">${rank}. Sırada</span>
      </div>
      <div class="player-card-stats">
        <div class="stat-box">
          <span class="stat-label">Koz Hakkı</span>
          <span class="stat-val val-koz">${p.kozCount} / 2</span>
        </div>
        <div class="stat-box">
          <span class="stat-label">Ceza Hakkı</span>
          <span class="stat-val val-ceza">${p.cezaCount} / 3</span>
        </div>
      </div>
    `;
    container.appendChild(card);
  });
}

function renderEntryPanel(currentHand, callerIdx, isGameOver) {
  const title = document.getElementById('entryPanelTitle');
  const callerTag = document.getElementById('entryCallerTag');
  const buttonsWrap = document.getElementById('gameTypeButtons');
  const btnSave = document.getElementById('btnSaveHand');

  if (isGameOver) {
    title.textContent = 'Oyun Tamamlandı (20/20)';
    callerTag.textContent = 'Sonuçlar Tablosunu İnceleyebilirsiniz';
    buttonsWrap.innerHTML = '<div style="grid-column: 1/-1; padding: 20px; text-align: center; color: var(--gold-300);">🎉 20 el tamamlandı. Yeni oyun başlatmak için yukarıdaki düğmeyi kullanabilirsiniz.</div>';
    document.getElementById('distPlayersList').innerHTML = '';
    document.getElementById('quickFillRow').style.display = 'none';
    btnSave.disabled = true;
    btnSave.innerHTML = 'Oyun Sona Erdi';
    return;
  }

  document.getElementById('quickFillRow').style.display = 'flex';
  title.textContent = `${currentHand}. El Kaydı`;
  callerTag.textContent = `Söyleyen: ${escapeHtml(state.players[callerIdx].name)}`;

  // Uygun olan ilk oyunu otomatik seç (eğer mevcut seçilen uygun değilse)
  if (!isGameAvailableForCaller(callerIdx, state.selectedGameKey)) {
    const availableKey = Object.keys(GAME_DEFS).find(k => isGameAvailableForCaller(callerIdx, k));
    if (availableKey) {
      state.selectedGameKey = availableKey;
    }
  }

  // Oyun türü butonlarını render et
  buttonsWrap.innerHTML = '';
  Object.values(GAME_DEFS).forEach(def => {
    const isAvail = isGameAvailableForCaller(callerIdx, def.key);
    const isSelected = def.key === state.selectedGameKey;
    const globalCount = getGlobalGameUsageCount(def.key);

    let countBadge = '';
    if (def.isKoz) {
      countBadge = `${state.players[callerIdx].kozCount}/2 Koz`;
    } else {
      countBadge = `${globalCount}/2 Toplam`;
    }

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = `btn-game-type ${isSelected ? 'selected' : ''}`;
    btn.disabled = !isAvail;
    btn.title = isAvail ? `${def.title} oyna` : 'Bu oyun hakkı tükendi veya kural gereği seçilemez';
    btn.innerHTML = `
      <span class="gt-icon">${def.icon}</span>
      <span class="gt-name">${def.shortTitle}</span>
      <span class="gt-count">${countBadge}</span>
    `;

    btn.addEventListener('click', () => {
      state.selectedGameKey = def.key;
      state.currentInputs = [0, 0, 0, 0];
      renderEntryPanel(currentHand, callerIdx, isGameOver);
    });

    buttonsWrap.appendChild(btn);
  });

  // Seçilen oyunun banner'ını güncelle
  const activeDef = GAME_DEFS[state.selectedGameKey] || GAME_DEFS.koz;
  document.getElementById('gameBannerIcon').textContent = activeDef.icon;
  document.getElementById('gameBannerTitle').textContent = activeDef.title;
  document.getElementById('gameBannerDesc').textContent = activeDef.desc;

  const ptsBadge = document.getElementById('gameBannerPoints');
  const unitPts = (state.scoringMode === 'zero_sum' && !activeDef.isKoz) ? (activeDef.baseUnitPoint * 2) : activeDef.baseUnitPoint;
  const sign = unitPts > 0 ? '+' : '';
  ptsBadge.textContent = `${sign}${unitPts} P / ${activeDef.unitName}`;
  ptsBadge.className = `banner-badge ${unitPts > 0 ? 'pos' : 'neg'}`;

  // Oyuncu miktar giriş satırlarını render et
  renderDistributionRows(activeDef);

  // Kalanı Doldur butonlarını render et
  renderQuickButtons(activeDef);

  // Validasyon kontrolü
  validateHandEntry(activeDef);
}

function renderDistributionRows(activeDef) {
  const container = document.getElementById('distPlayersList');
  container.innerHTML = '';

  state.players.forEach((p, idx) => {
    const val = state.currentInputs[idx] || 0;
    const row = document.createElement('div');
    row.className = 'dist-player-row';
    row.innerHTML = `
      <div class="dp-name">
        <span>${escapeHtml(p.name)}:</span>
      </div>
      <div class="dp-controls">
        <button type="button" class="btn-step" data-action="dec" data-p="${idx}">−</button>
        <input type="number" class="dp-input" id="inputP${idx}" value="${val}" min="0" max="${activeDef.totalUnits}">
        <button type="button" class="btn-step" data-action="inc" data-p="${idx}">+</button>
      </div>
    `;

    // Buton dinleyicileri
    row.querySelector('[data-action="dec"]').addEventListener('click', () => {
      if (state.currentInputs[idx] > 0) {
        state.currentInputs[idx]--;
        renderDistributionRows(activeDef);
        validateHandEntry(activeDef);
      }
    });

    row.querySelector('[data-action="inc"]').addEventListener('click', () => {
      const sum = state.currentInputs.reduce((a, b) => a + b, 0);
      if (sum < activeDef.totalUnits) {
        state.currentInputs[idx]++;
        renderDistributionRows(activeDef);
        validateHandEntry(activeDef);
      }
    });

    const input = row.querySelector(`#inputP${idx}`);
    input.addEventListener('change', (e) => {
      let num = parseInt(e.target.value, 10);
      if (isNaN(num) || num < 0) num = 0;
      if (num > activeDef.totalUnits) num = activeDef.totalUnits;
      state.currentInputs[idx] = num;
      renderDistributionRows(activeDef);
      validateHandEntry(activeDef);
    });

    container.appendChild(row);
  });
}

function renderQuickButtons(activeDef) {
  const container = document.getElementById('quickButtons');
  container.innerHTML = '';

  state.players.forEach((p, idx) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'btn-quick';
    btn.textContent = p.name;
    btn.addEventListener('click', () => {
      const currentSumWithoutP = state.currentInputs.reduce((sum, val, i) => i === idx ? sum : sum + val, 0);
      const remaining = Math.max(0, activeDef.totalUnits - currentSumWithoutP);
      state.currentInputs[idx] = remaining;
      renderDistributionRows(activeDef);
      validateHandEntry(activeDef);
    });
    container.appendChild(btn);
  });
}

function validateHandEntry(activeDef) {
  const sum = state.currentInputs.reduce((a, b) => a + b, 0);
  const target = activeDef.totalUnits;
  const badge = document.getElementById('distRemainingBadge');
  const msg = document.getElementById('validationMessage');
  const btnSave = document.getElementById('btnSaveHand');

  const diff = target - sum;
  if (diff === 0) {
    badge.textContent = `Tamamlandı (${target} / ${target})`;
    badge.className = 'dist-counter valid';
    msg.textContent = `✓ Dağılım eksiksiz doğrulandı. Eli kaydedebilirsiniz.`;
    msg.className = 'validation-message success';
    btnSave.disabled = false;
  } else if (diff > 0) {
    badge.textContent = `Kalan: ${diff} ${activeDef.unitName}`;
    badge.className = 'dist-counter invalid';
    msg.textContent = `⚠️ Dağıtılması gereken ${diff} adet ${activeDef.unitName} kaldı.`;
    msg.className = 'validation-message error';
    btnSave.disabled = true;
  } else {
    badge.textContent = `Fazla: ${Math.abs(diff)} ${activeDef.unitName}`;
    badge.className = 'dist-counter invalid';
    msg.textContent = `❌ Toplam ${target} olmalı, ${Math.abs(diff)} adet fazla girildi!`;
    msg.className = 'validation-message error';
    btnSave.disabled = true;
  }
}

function saveCurrentHand() {
  const currentHand = getCurrentHandNumber();
  if (currentHand > 20) return;

  const callerIdx = getCurrentCallerIndex();
  const activeDef = GAME_DEFS[state.selectedGameKey];
  const sum = state.currentInputs.reduce((a, b) => a + b, 0);
  if (sum !== activeDef.totalUnits) {
    showToast('Lütfen kart / el dağılımını eksiksiz tamamlayın!', 'rose');
    return;
  }

  const distribution = [...state.currentInputs];
  const points = calculateHandPoints(activeDef.key, callerIdx, distribution);

  const roundData = {
    handNo: currentHand,
    callerIdx: callerIdx,
    callerName: state.players[callerIdx].name,
    gameKey: activeDef.key,
    gameTitle: activeDef.title,
    isKoz: activeDef.isKoz,
    distribution: distribution,
    points: points,
    timestamp: new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })
  };

  state.rounds.push(roundData);
  recalculateAllScores();
  state.currentInputs = [0, 0, 0, 0];
  saveStateToStorage();
  renderAll();

  showToast(`${currentHand}. el (${activeDef.title}) başarıyla kaydedildi!`, 'emerald');
}

// ==========================================================================
// ÇETELE MATRİSİ RENDERİ
// ==========================================================================
function renderMatrixTable() {
  const theadP1 = document.getElementById('thPlayer1');
  const theadP2 = document.getElementById('thPlayer2');
  const theadP3 = document.getElementById('thPlayer3');
  const theadP4 = document.getElementById('thPlayer4');

  theadP1.textContent = state.players[0].name;
  theadP2.textContent = state.players[1].name;
  theadP3.textContent = state.players[2].name;
  theadP4.textContent = state.players[3].name;

  const tbody = document.getElementById('ceteleTableBody');
  tbody.innerHTML = '';

  // Satır tanımları:
  // Koz 1, Koz 2, El Almaz, Kupa Almaz, Kız Almaz, Erkek Almaz, Rıfkı, Son İki
  const matrixRows = [
    { type: 'koz', index: 1, title: '👑 Koz (1. Hak)', pts: '+50/el', isKoz: true },
    { type: 'koz', index: 2, title: '👑 Koz (2. Hak)', pts: '+50/el', isKoz: true },
    { type: 'ceza', key: 'el_almaz', title: '✋ El Almaz', pts: '-50/el', isKoz: false },
    { type: 'ceza', key: 'kupa_almaz', title: '♥️ Kupa Almaz', pts: '-30/kupa', isKoz: false },
    { type: 'ceza', key: 'kiz_almaz', title: '👸 Kız Almaz', pts: '-100/kız', isKoz: false },
    { type: 'ceza', key: 'erkek_almaz', title: '🤴 Erkek Almaz', pts: '-60/erkek', isKoz: false },
    { type: 'ceza', key: 'rifki', title: '🗡️ Rıfkı (K♥️)', pts: '-320', isKoz: false },
    { type: 'ceza', key: 'son_iki', title: '⏳ Son İki', pts: '-180/el', isKoz: false },
  ];

  matrixRows.forEach(row => {
    const tr = document.createElement('tr');
    const ptsClass = row.isKoz ? 'pos' : 'neg';

    let cellsHtml = '';
    for (let pIdx = 0; pIdx < 4; pIdx++) {
      let cellStatus = 'available';
      let cellText = '—';

      if (row.type === 'koz') {
        // Bu oyuncunun oynadığı kozları bul
        const playerKozRounds = state.rounds.filter(r => r.callerIdx === pIdx && r.isKoz);
        if (row.index === 1 && playerKozRounds[0]) {
          cellStatus = 'used';
          cellText = `${playerKozRounds[0].distribution[pIdx]} el (${playerKozRounds[0].points[pIdx]}P)`;
        } else if (row.index === 2 && playerKozRounds[1]) {
          cellStatus = 'used';
          cellText = `${playerKozRounds[1].distribution[pIdx]} el (${playerKozRounds[1].points[pIdx]}P)`;
        } else {
          cellStatus = (state.rounds.length >= 20) ? 'locked' : 'available';
        }
      } else {
        // Ceza satırı: Bu oyuncu bu cezayı söyledi mi?
        const round = state.rounds.find(r => r.callerIdx === pIdx && r.gameKey === row.key);
        if (round) {
          cellStatus = 'used';
          const myPts = round.points[pIdx];
          const sign = myPts > 0 ? '+' : '';
          cellText = `${sign}${myPts}P`;
        } else {
          // Başka bir kural: Ceza globalde 2 kez söylendiyse veya oyuncu 3 cezasını bitirdiyse kilitli
          const globalCount = getGlobalGameUsageCount(row.key);
          const callerCezaCount = state.players[pIdx].cezaCount;
          if (globalCount >= 2 || callerCezaCount >= 3 || state.rounds.length >= 20) {
            cellStatus = 'locked';
          } else {
            cellStatus = 'available';
          }
        }
      }

      cellsHtml += `<td><span class="cell-slot ${cellStatus}">${cellText}</span></td>`;
    }

    tr.innerHTML = `
      <td class="game-name-cell">${row.title}</td>
      <td class="game-pts-cell ${ptsClass}">${row.pts}</td>
      ${cellsHtml}
    `;
    tbody.appendChild(tr);
  });
}

// ==========================================================================
// TUR GEÇMİŞİ TABLOSU RENDERİ
// ==========================================================================
function renderHistoryTable() {
  const tbody = document.getElementById('historyTableBody');
  document.getElementById('thHistP1').textContent = state.players[0].name;
  document.getElementById('thHistP2').textContent = state.players[1].name;
  document.getElementById('thHistP3').textContent = state.players[2].name;
  document.getElementById('thHistP4').textContent = state.players[3].name;

  document.getElementById('lblHistoryCount').textContent = `Toplam ${state.rounds.length} / 20 el oynandı`;

  if (state.rounds.length === 0) {
    tbody.innerHTML = `
      <tr class="empty-row">
        <td colspan="8">Henüz el oynanmadı. İlk elin kaydını yukarıdan başlatabilirsiniz.</td>
      </tr>
    `;
  } else {
    tbody.innerHTML = '';
    state.rounds.forEach(r => {
      const tr = document.createElement('tr');
      const ptsCells = r.points.map(pt => {
        let cls = 'score-none';
        let sign = '';
        if (pt > 0) { cls = 'score-gain'; sign = '+'; }
        else if (pt < 0) { cls = 'score-loss'; }
        return `<td class="${cls}">${sign}${pt}</td>`;
      }).join('');

      const distDetail = r.distribution.map((d, i) => `${state.players[i].name}: ${d}`).join(', ');

      tr.innerHTML = `
        <td><b>${r.handNo}</b></td>
        <td><span class="dealer-name">${escapeHtml(r.callerName)}</span></td>
        <td><b>${escapeHtml(r.gameTitle)}</b></td>
        ${ptsCells}
        <td style="font-size: 11.5px; color: var(--text-dim); text-align: left;">${escapeHtml(distDetail)}</td>
      `;
      tbody.appendChild(tr);
    });
  }

  // Footer Toplam Puanlar
  for (let i = 0; i < 4; i++) {
    const footEl = document.getElementById(`footP${i + 1}`);
    const score = state.players[i].score;
    let cls = 'score-none';
    let sign = '';
    if (score > 0) { cls = 'score-gain'; sign = '+'; }
    else if (score < 0) { cls = 'score-loss'; }
    footEl.className = `score-cell ${cls}`;
    footEl.textContent = `${sign}${score}`;
  }
}

// ==========================================================================
// EVENT LISTENERS & MODALLAR
// ==========================================================================
function initEventListeners() {
  // El Kaydet Butonu
  document.getElementById('btnSaveHand').addEventListener('click', saveCurrentHand);

  // Geri Al Butonu
  document.getElementById('btnUndo').addEventListener('click', undoLastHand);

  // Yeni Oyun Butonu
  document.getElementById('btnNewGame').addEventListener('click', resetGame);

  // Yazdır / PDF
  document.getElementById('btnPrintScores').addEventListener('click', () => {
    window.print();
  });

  // Çeteleyi Panoya Kopyala
  document.getElementById('btnExportMatrix').addEventListener('click', copyMatrixToClipboard);

  // Ayarlar Modalı
  const modalSettings = document.getElementById('modalSettings');
  document.getElementById('btnSettings').addEventListener('click', () => {
    document.getElementById('inputPlayer1').value = state.players[0].name;
    document.getElementById('inputPlayer2').value = state.players[1].name;
    document.getElementById('inputPlayer3').value = state.players[2].name;
    document.getElementById('inputPlayer4').value = state.players[3].name;
    document.getElementById('selectFirstDealer').value = state.initialDealer;

    const radio = document.querySelector(`input[name="scoringMode"][value="${state.scoringMode}"]`);
    if (radio) radio.checked = true;

    modalSettings.classList.add('active');
  });

  document.getElementById('btnCloseSettings').addEventListener('click', () => modalSettings.classList.remove('active'));
  document.getElementById('btnCancelSettings').addEventListener('click', () => modalSettings.classList.remove('active'));

  document.getElementById('btnSaveSettings').addEventListener('click', () => {
    state.players[0].name = document.getElementById('inputPlayer1').value.trim() || 'Oyuncu 1';
    state.players[1].name = document.getElementById('inputPlayer2').value.trim() || 'Oyuncu 2';
    state.players[2].name = document.getElementById('inputPlayer3').value.trim() || 'Oyuncu 3';
    state.players[3].name = document.getElementById('inputPlayer4').value.trim() || 'Oyuncu 4';
    state.initialDealer = parseInt(document.getElementById('selectFirstDealer').value, 10) || 0;

    const selRadio = document.querySelector('input[name="scoringMode"]:checked');
    if (selRadio) {
      state.scoringMode = selRadio.value;
    }

    recalculateAllScores();
    saveStateToStorage();
    renderAll();
    modalSettings.classList.remove('active');
    showToast('Ayarlar başarıyla kaydedildi!', 'emerald');
  });

  // Yardım / Kurallar Modalı
  const modalHelp = document.getElementById('modalHelp');
  document.getElementById('btnHelp').addEventListener('click', () => modalHelp.classList.add('active'));
  document.getElementById('btnCloseHelp').addEventListener('click', () => modalHelp.classList.remove('active'));
  document.getElementById('btnOkHelp').addEventListener('click', () => modalHelp.classList.remove('active'));

  // Modalların dışına tıklayınca kapatma
  [modalSettings, modalHelp].forEach(modal => {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) modal.classList.remove('active');
    });
  });
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

// ==========================================================================
// TOAST BİLDİRİM SİSTEMİ
// ==========================================================================
function showToast(msg, type = 'emerald') {
  let toast = document.getElementById('appToast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'appToast';
    toast.style.position = 'fixed';
    toast.style.bottom = '24px';
    toast.style.right = '24px';
    toast.style.padding = '12px 20px';
    toast.style.borderRadius = '12px';
    toast.style.fontSize = '14px';
    toast.style.fontWeight = '600';
    toast.style.zIndex = '9999';
    toast.style.boxShadow = '0 10px 25px rgba(0,0,0,0.5)';
    toast.style.transition = 'all 0.3s ease';
    toast.style.color = '#fff';
    toast.style.pointerEvents = 'none';
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
  toast.style.transform = 'translateY(0)';

  clearTimeout(toast._timer);
  toast._timer = setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(12px)';
  }, 3200);
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
