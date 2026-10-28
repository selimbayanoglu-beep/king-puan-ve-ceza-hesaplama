
// --------------------------------------------------------------------------
// CANLI YAYIN & SEYİRCİ (İZLEYİCİ) MODU YÖNETİMİ
// --------------------------------------------------------------------------
let isSpectatorMode = false;

function initSpectatorMode() {
  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.get('mod') === 'izle' || urlParams.get('spectator') === '1') {
    enableSpectatorMode(false);
  }

  document.getElementById('btnShareLiveGame')?.addEventListener('click', shareLiveGameLink);
  document.getElementById('btnToggleSpectator')?.addEventListener('click', toggleSpectatorMode);
}

function shareLiveGameLink() {
  triggerHaptic(15);
  const liveUrl = `${window.location.origin}?mod=izle`;
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(liveUrl).then(() => {
      showToast('🔗 Canlı maç linki kopyalandı! Arkadaşlarınıza atın, canlı izlesinler.', 'emerald');
    }).catch(() => {
      prompt('Canlı izleme linkini kopyalayın:', liveUrl);
    });
  } else {
    prompt('Canlı izleme linkini kopyalayın:', liveUrl);
  }
}

function toggleSpectatorMode() {
  triggerHaptic(20);
  if (isSpectatorMode) {
    disableSpectatorMode();
  } else {
    enableSpectatorMode(true);
  }
}

function enableSpectatorMode(showToastMsg = true) {
  isSpectatorMode = true;
  document.body.classList.add('spectator-mode');
  const btn = document.getElementById('btnToggleSpectator');
  if (btn) {
    btn.classList.add('active');
    btn.innerHTML = '✏️ Oyuncu Moduna Geç';
  }
  goToScreen(3, true); // Doğrudan canlı sonuçlar / çete ekranına geç
  if (showToastMsg) {
    showToast('👀 Seyirci modu aktif: Cezalar ve skorlar anlık güncellenir.', 'sky');
  }
}

function disableSpectatorMode() {
  isSpectatorMode = false;
  document.body.classList.remove('spectator-mode');
  const btn = document.getElementById('btnToggleSpectator');
  if (btn) {
    btn.classList.remove('active');
    btn.innerHTML = '👀 Seyirci Modu';
  }
  showToast('✏️ Oyuncu moduna geçildi: Ceza ve koz girişi yapabilirsiniz.', 'emerald');
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
  currentScreenIndex = Math.max(0, Math.min(4, index));
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
  renderCezaScreen(currentHand, callerIdx, isGameOver);
  renderKozScreen(currentHand, callerIdx, isGameOver);
  renderResultsScreen(currentHand, callerIdx, isGameOver);
  renderTargetScreen(currentHand, callerIdx, isGameOver);
}

// --------------------------------------------------------------------------
// 1. OYUNCULAR SAYFASI
// --------------------------------------------------------------------------
function renderSetupScreen() {
  const isGameInProgress = state.rounds && state.rounds.length > 0;

  document.getElementById('inputPlayer1').value = state.players[0].name;
  document.getElementById('inputPlayer2').value = state.players[1].name;
  document.getElementById('inputPlayer3').value = state.players[2].name;
  document.getElementById('inputPlayer4').value = state.players[3].name;

  const heroIcon = document.getElementById('setupHeroIcon');
  const heroTitle = document.getElementById('setupHeroTitle');
  const heroSub = document.getElementById('setupHeroSub');
  const replacementNote = document.getElementById('playerReplacementNote');
  const startBtnText = document.getElementById('btnStartGameText');
  const dealerGroup = document.getElementById('dealerFormGroup');

  if (isGameInProgress) {
    if (heroIcon) heroIcon.textContent = '🔄';
    if (heroTitle) heroTitle.textContent = 'Oyuncu Düzenleme & Masa Değişimi';
    if (heroSub) heroSub.textContent = 'Masadan ayrılan bir oyuncu varsa yerine yeni oyuncunun adını yazabilirsiniz.';
    if (replacementNote) replacementNote.style.display = 'flex';
    if (startBtnText) startBtnText.textContent = '✓ Oyuncu Değişikliklerini Kaydet ve Masaya Dön';
    if (dealerGroup) {
      dealerGroup.style.opacity = '0.5';
      dealerGroup.style.pointerEvents = 'none';
      dealerGroup.title = 'İlk krupiye oyun başında belirlenmiştir.';
    }
  } else {
    if (heroIcon) heroIcon.textContent = '👥';
    if (heroTitle) heroTitle.textContent = 'Oyuncular & Masa Kurulumu';
    if (heroSub) heroSub.textContent = 'Oyuncu isimlerini belirleyin ve oyunu başlatın. Başladıktan sonra bu sayfaya dönmenize gerek kalmaz.';
    if (replacementNote) replacementNote.style.display = 'none';
    if (startBtnText) startBtnText.textContent = 'Oyunu Başlat ve Ceza Sayfasına Geç ➔';
    if (dealerGroup) {
      dealerGroup.style.opacity = '1';
      dealerGroup.style.pointerEvents = 'auto';
      dealerGroup.title = '';
    }
  }

  const dealerRow = document.getElementById('dealerPickRow');
  dealerRow.innerHTML = '';
  state.players.forEach((p, idx) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = `btn-dealer-pick ${state.initialDealer === idx ? 'selected' : ''}`;
    btn.textContent = `${idx + 1}. ${p.name}`;
    btn.addEventListener('click', () => {
      if (isGameInProgress) return;
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

  if (isGameOver) {
    handNoEl.textContent = 'Oyun Bitti (20/20)';
    callerEl.textContent = 'Sonuçları İnceleyin';
    entryBox.style.display = 'none';
    lockedAlert.style.display = 'none';
    return;
  }

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
    <span class="caller-prefix">👑 SÖYLEYEN:</span>
    <div class="caller-highlight-row">
      <span class="caller-highlight">${escapeHtml(caller.name)}</span>
      <span class="caller-koz-suit ${activeSuit.cssClass}" title="Koz: ${activeSuit.name}">${activeSuit.symbol}</span>
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
      triggerHaptic(15);
      state.selectedKozSuit = s;
      saveStateToStorage();
      pushStateToServer();
      renderKozScreen(currentHand, callerIdx, isGameOver);
    };
  });

  rightsEl.textContent = `Koz Hakkı: ${caller.kozCount} / 2`;

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

  if (isGameOver) {
    handNoEl.textContent = 'Oyun Bitti (20/20)';
    callerEl.textContent = 'Sonuçları İnceleyin';
    entryBox.style.display = 'none';
    lockedAlert.style.display = 'none';
    grid.style.display = 'none';
    return;
  }

  handNoEl.textContent = `${currentHand}. El (${currentHand} / 20)`;
  callerEl.innerHTML = `<span class="caller-prefix">👑 SÖYLEYEN:</span> <span class="caller-highlight">${escapeHtml(caller.name)}</span>`;
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
      inputHistories.ceza = [];
      renderCezaScreen(currentHand, callerIdx, isGameOver);
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
  if (inputHistories[type] && inputHistories[type].length > 0) {
    const prev = inputHistories[type].pop();
    for (let i = 0; i < inputsArray.length; i++) {
      inputsArray[i] = prev[i];
    }
    renderAll();
    showToast('↩️ Son işlem geri alındı.', 'cyan');
  } else {
    showToast('Geri alınacak bir önceki işlem yok.', 'rose');
  }
}

function clearInputs(type, inputsArray) {
  const hasValues = inputsArray.some(v => v > 0);
  if (!hasValues) {
    showToast('Girişler zaten sıfır.', 'cyan');
    return;
  }
  pushInputHistory(type, inputsArray);
  for (let i = 0; i < inputsArray.length; i++) {
    inputsArray[i] = 0;
  }
  renderAll();
  showToast('🗑️ Tüm girişler temizlendi (sıfırlandı).', 'amber');
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
        pushInputHistory(type, inputsArray);
        inputsArray[idx]--;
        renderAll();
      }
    });

    row.querySelector('[data-action="inc"]').addEventListener('click', () => {
      triggerHaptic(15);
      const sum = inputsArray.reduce((a, b) => a + b, 0);
      if (sum < totalUnits) {
        pushInputHistory(type, inputsArray);
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
        pushInputHistory(type, inputsArray);
        const currentSumWithoutP = inputsArray.reduce((sum, val, i) => i === idx ? sum : sum + val, 0);
        const remaining = Math.max(0, totalUnits - currentSumWithoutP);
        inputsArray[idx] = remaining;
        renderAll();
      });
      quickContainer.appendChild(btn);
    });
  }

  // Geri Al ve Temizle Butonlarını Yönet (Her zaman açık, belirgin ve tıklanabilir)
  const undoBtn = document.getElementById(type === 'ceza' ? 'btnUndoCeza' : 'btnUndoKoz');
  const clearBtn = document.getElementById(type === 'ceza' ? 'btnClearCeza' : 'btnClearKoz');

  if (undoBtn) {
    undoBtn.disabled = false;
    undoBtn.onclick = () => {
      triggerHaptic(20);
      undoInput(type, inputsArray);
    };
  }

  if (clearBtn) {
    clearBtn.disabled = false;
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

  const btnFooterCeza = document.getElementById('btnFooterGoCeza');
  const btnFooterKoz = document.getElementById('btnFooterGoKoz');

  if (isGameOver) {
    lblHand.textContent = '20 / 20 (TAMAMLANDI)';
    lblCaller.textContent = 'Şampiyon Belli Oldu! 🏆';
    btnJumpKoz.style.display = 'none';
    btnJumpCeza.style.display = 'none';
    if (btnFooterCeza) btnFooterCeza.style.display = 'none';
    if (btnFooterKoz) btnFooterKoz.style.display = 'none';
  } else {
    lblHand.textContent = `${currentHand} / 20`;
    lblCaller.innerHTML = `<span class="nt-caller-prefix">👑 SIRADAKİ SÖYLEYEN:</span> <span class="nt-caller-name">${escapeHtml(caller.name)}</span>`;
    
    // Hem üst çağrı kartında hem alt işlem alanında "Cezaya Git" ve "Koza Git" düğmeleri HER ZAMAN açık ve görünür
    btnJumpCeza.style.display = 'inline-flex';
    btnJumpKoz.style.display = 'inline-flex';

    if (btnFooterCeza) btnFooterCeza.style.display = 'inline-flex';
    if (btnFooterKoz) btnFooterKoz.style.display = 'inline-flex';
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
    gameTitle: `Koz (${(activeKozSuit => {
      const defs = { karo: '♦ Karo', kupa: '♥️ Kupa', maca: '♠ Maça', sinek: '♣ Sinek' };
      return defs[activeKozSuit] || '♦ Karo';
    })(state.selectedKozSuit)})`,
    kozSuit: state.selectedKozSuit || 'karo',
    isKoz: true,
    distribution: distribution,
    points: points,
    timestamp: new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })
  };

  state.rounds.push(roundData);
  recalculateAllScores();
  state.kozInputs = [0, 0, 0, 0];
  inputHistories.koz = [];
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

  if (modalReset) {
    if (chkConfirm) chkConfirm.checked = false;
    if (btnConfirm) btnConfirm.disabled = true;
    modalReset.classList.add('active');
  }
}

function executeResetGame() {
  // HER ŞEYİ TERTEMİZ SIFIRLA (Eski isimler asla gelmesin)
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
    selectedCezaKey: 'el_almaz',
    selectedKozSuit: 'karo',
    kozInputs: [0, 0, 0, 0],
    cezaInputs: [0, 0, 0, 0]
  };
  inputHistories.ceza = [];
  inputHistories.koz = [];

  // Input kutularını da tamamen temizle (Yeni isimler girilsin)
  ['inputPlayer1', 'inputPlayer2', 'inputPlayer3', 'inputPlayer4'].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });

  saveStateToStorage();
  pushStateToServer();
  renderAll();
  goToScreen(0, true);
  showToast('🔄 Masa ve oyuncu adları sıfırlandı. Yeni oyuncuları yazabilirsiniz.', 'emerald');
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
    if (totalRemainingHands <= 0) {
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

  if (totalRemainingHands <= 0) {
    // Oyun Tamamen Bittiğinde
    const sorted = [...state.players].sort((a, b) => b.score - a.score);
    cardsGrid.innerHTML = `
      <div style="background: rgba(15, 23, 42, 0.9); border: 2px solid rgba(52, 211, 153, 0.4); border-radius: 16px; padding: 18px;">
        <h3 style="color: #34d399; margin-bottom: 12px; font-size: 16px;">🏆 20 El Sonucu — Nihai Masa Durumu</h3>
        <div style="display: flex; flex-direction: column; gap: 8px;">
          ${sorted.map(p => `
            <div style="display: flex; justify-content: space-between; align-items: center; background: rgba(255,255,255,0.04); padding: 10px 14px; border-radius: 10px;">
              <span style="font-weight: 800; font-size: 15px; color: #fff;">👤 ${escapeHtml(p.name)}</span>
              <span style="font-weight: 800; font-size: 15px; color: ${p.score > 0 ? '#34d399' : (p.score === 0 ? '#fde047' : '#f87171')};">
                ${p.score > 0 ? '+' : ''}${p.score} P (${p.score > 0 ? 'Koza Çıktı' : (p.score === 0 ? 'Oyun Biten' : 'Ceza Yiyen')})
              </span>
            </div>
          `).join('')}
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
  // Koz ve Ceza Kaydet Butonları
  document.getElementById('btnSaveKoz').addEventListener('click', saveKozHand);
  document.getElementById('btnSaveCeza').addEventListener('click', saveCezaHand);

  // Geri Al & Yeni Oyun
  document.getElementById('btnUndo').addEventListener('click', undoLastHand);
  document.getElementById('btnNewGame')?.addEventListener('click', () => {
    triggerHaptic(20);
    openResetConfirmModal();
  });

  // Yeni Oyun Başlatma / Sıfırlama Onay Modalı
  const modalReset = document.getElementById('modalResetConfirm');
  const btnCloseReset = document.getElementById('btnCloseResetModal');
  const btnCancelReset = document.getElementById('btnCancelReset');
  const btnConfirmReset = document.getElementById('btnConfirmResetFinal');
  const chkConfirm = document.getElementById('chkSecondConfirm');

  const closeResetModal = () => {
    modalReset?.classList.remove('active');
  };

  btnCloseReset?.addEventListener('click', closeResetModal);
  btnCancelReset?.addEventListener('click', closeResetModal);

  chkConfirm?.addEventListener('change', () => {
    triggerHaptic(10);
    if (btnConfirmReset) {
      btnConfirmReset.disabled = !chkConfirm.checked;
    }
  });

  btnConfirmReset?.addEventListener('click', () => {
    triggerHaptic(35);
    closeResetModal();
    executeResetGame();
  });

  // Kurulum / Oyuncu Düzenleme Sayfası: "Oyunu Başlat / Değişiklikleri Kaydet"
  document.getElementById('btnStartGame').addEventListener('click', () => {
    const isGameInProgress = state.rounds && state.rounds.length > 0;

    const oldNames = state.players.map(p => p.name);
    const newNames = [
      document.getElementById('inputPlayer1').value.trim() || 'Oyuncu 1',
      document.getElementById('inputPlayer2').value.trim() || 'Oyuncu 2',
      document.getElementById('inputPlayer3').value.trim() || 'Oyuncu 3',
      document.getElementById('inputPlayer4').value.trim() || 'Oyuncu 4'
    ];

    let changedPlayers = [];
    for (let i = 0; i < 4; i++) {
      if (oldNames[i] !== newNames[i]) {
        changedPlayers.push({ old: oldNames[i], new: newNames[i], idx: i });
      }
      state.players[i].name = newNames[i];
    }

    if (!isGameInProgress) {
      const selRadio = document.querySelector('input[name="scoringMode"]:checked');
      if (selRadio) state.scoringMode = selRadio.value;
    }

    recalculateAllScores();
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
      // Yeni oyun ise Ceza ekranına geç
      goToScreen(1, true);
      showToast('Oyun başlatıldı! Ceza sayfasındasınız.', 'amber');
    }
  });

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
