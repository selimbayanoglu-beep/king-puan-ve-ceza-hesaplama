const { getStore, connectLambda } = require("@netlify/blobs");

function getKingStore(event) {
  if (event && event.blobs) {
    try {
      connectLambda(event);
    } catch (e) {
      // ignore
    }
  }
  const siteID = process.env.NETLIFY_SITE_ID || "9abf3460-2144-445e-8a97-605eec852f80";
  const token = process.env.NETLIFY_BLOBS_TOKEN;
  if (siteID && token) {
    return getStore({
      name: "king-state",
      siteID,
      token,
    });
  }
  return getStore("king-state");
}

const DEFAULT_STATE = {
  players: [
    { id: 0, name: "Oyuncu 1", score: 0, kozCount: 0, cezaCount: 0 },
    { id: 1, name: "Oyuncu 2", score: 0, kozCount: 0, cezaCount: 0 },
    { id: 2, name: "Oyuncu 3", score: 0, kozCount: 0, cezaCount: 0 },
    { id: 3, name: "Oyuncu 4", score: 0, kozCount: 0, cezaCount: 0 },
  ],
  initialDealer: 0,
  scoringMode: "standard",
  rounds: [],
  activeHandType: "ceza",
  selectedCezaKey: "el_almaz",
  selectedKozSuit: "karo",
  kozInputs: [0, 0, 0, 0],
  cezaInputs: [0, 0, 0, 0],
  kozConfirmed: [false, false, false, false],
  cezaConfirmed: [false, false, false, false],
};

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, X-Client-Version",
  "Cache-Control": "no-cache, no-store, must-revalidate",
};

exports.handler = async (event, context) => {
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers: CORS_HEADERS, body: "" };
  }

  const path = event.path.replace(/\/\.netlify\/functions\/api/, "").replace(/^\/api/, "") || "/";
  const store = getKingStore(event);

  try {
    // 1. GET /state
    if (path === "/state" && event.httpMethod === "GET") {
      let data = await store.get("session_state", { type: "json" });
      if (!data || !data.state) {
        data = {
          version: 1,
          updatedAt: Date.now(),
          state: DEFAULT_STATE,
        };
        await store.setJSON("session_state", data);
      }
      return {
        statusCode: 200,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json; charset=utf-8" },
        body: JSON.stringify({ ok: true, version: data.version, updatedAt: data.updatedAt, state: data.state }),
      };
    }

    // 2. POST /state
    if (path === "/state" && event.httpMethod === "POST") {
      const payload = JSON.parse(event.body || "{}");
      const newState = payload.state;
      if (!newState || !Array.isArray(newState.players)) {
        return { statusCode: 400, headers: CORS_HEADERS, body: JSON.stringify({ ok: false, error: "Geçersiz state" }) };
      }

      let data = await store.get("session_state", { type: "json" }) || { version: 0 };
      const newVersion = (data.version || 0) + 1;
      const now = Date.now();

      await store.setJSON("session_state", {
        version: newVersion,
        updatedAt: now,
        state: newState,
      });

      return {
        statusCode: 200,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json; charset=utf-8" },
        body: JSON.stringify({ ok: true, version: newVersion, updatedAt: now, state: newState }),
      };
    }

    // 2.5. POST /player-input (Oyuncuların kendi telefonlarından anlık koz/ceza girişi — çakışmasız)
    if (path === "/player-input" && event.httpMethod === "POST") {
      const payload = JSON.parse(event.body || "{}");
      let data = await store.get("session_state", { type: "json" });
      if (!data || !data.state || !Array.isArray(data.state.players)) {
        data = {
          version: 1,
          updatedAt: Date.now(),
          state: JSON.parse(JSON.stringify(DEFAULT_STATE)),
        };
      }

      const cur = data.state;
      if (!Array.isArray(cur.kozInputs)) cur.kozInputs = [0, 0, 0, 0];
      if (!Array.isArray(cur.cezaInputs)) cur.cezaInputs = [0, 0, 0, 0];
      if (!Array.isArray(cur.kozConfirmed)) cur.kozConfirmed = [false, false, false, false];
      if (!Array.isArray(cur.cezaConfirmed)) cur.cezaConfirmed = [false, false, false, false];

      const action = payload.action || "set_player_unit";
      const type = payload.type === "koz" ? "koz" : "ceza";

      if (action === "set_player_unit") {
        const pIdx = Number(payload.playerIdx);
        const val = Math.max(0, Math.min(13, Number(payload.value) || 0));
        if (pIdx >= 0 && pIdx < 4) {
          cur.activeHandType = type;
          if (type === "koz") {
            cur.kozInputs[pIdx] = val;
            cur.kozConfirmed[pIdx] = true;
          } else {
            cur.cezaInputs[pIdx] = val;
            cur.cezaConfirmed[pIdx] = true;
          }
        }
      } else if (action === "select_game") {
        cur.activeHandType = type;
        if (type === "koz" && payload.gameKey) {
          cur.selectedKozSuit = String(payload.gameKey);
        } else if (type === "ceza" && payload.gameKey) {
          if (cur.selectedCezaKey !== String(payload.gameKey)) {
            cur.selectedCezaKey = String(payload.gameKey);
            cur.cezaInputs = [0, 0, 0, 0];
            cur.cezaConfirmed = [false, false, false, false];
          }
        }
      } else if (action === "set_all_units") {
        cur.activeHandType = type;
        if (Array.isArray(payload.inputs) && payload.inputs.length === 4) {
          const cleanArr = payload.inputs.map((v) => Math.max(0, Math.min(13, Number(v) || 0)));
          const confArr = Array.isArray(payload.confirmed) && payload.confirmed.length === 4
            ? payload.confirmed.map(Boolean)
            : cleanArr.map((v) => v > 0);
          if (type === "koz") {
            cur.kozInputs = cleanArr;
            cur.kozConfirmed = confArr;
          } else {
            cur.cezaInputs = cleanArr;
            cur.cezaConfirmed = confArr;
          }
        }
      }

      const newVersion = (data.version || 0) + 1;
      const now = Date.now();
      await store.setJSON("session_state", {
        version: newVersion,
        updatedAt: now,
        state: cur,
      });

      return {
        statusCode: 200,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json; charset=utf-8" },
        body: JSON.stringify({ ok: true, version: newVersion, updatedAt: now, state: cur }),
      };
    }

    // 3. POST /reset
    if (path === "/reset" && event.httpMethod === "POST") {
      const payload = JSON.parse(event.body || "{}");
      let data = await store.get("session_state", { type: "json" });
      // Eğer mevcut oyunda el varsa arşive kaydet
      if (data && data.state && data.state.rounds && data.state.rounds.length > 0) {
        let archives = (await store.get("games_archive", { type: "json" })) || [];
        const sorted = [...data.state.players].sort((a, b) => b.score - a.score);
        archives.unshift({
          id: Date.now(),
          title: `Oyun ${archives.length + 1} (${data.state.rounds.length}/20 El)`,
          date: new Date().toLocaleString("tr-TR"),
          roundsCount: data.state.rounds.length,
          winner: sorted[0] ? sorted[0].name : "Belirsiz",
          players: data.state.players,
          rounds: data.state.rounds,
          scoringMode: data.state.scoringMode || "standard",
        });
        await store.setJSON("games_archive", archives.slice(0, 100));
      }

      // Tertemiz sıfırla
      const newVersion = (data ? data.version || 0 : 0) + 1;
      const cleanState = JSON.parse(JSON.stringify(DEFAULT_STATE));
      if (Array.isArray(payload.playerNames) && payload.playerNames.length === 4) {
        payload.playerNames.forEach((n, idx) => {
          if (n && String(n).trim()) {
            cleanState.players[idx].name = String(n).trim();
          }
        });
      }
      await store.setJSON("session_state", {
        version: newVersion,
        updatedAt: Date.now(),
        state: cleanState,
      });

      return {
        statusCode: 200,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json; charset=utf-8" },
        body: JSON.stringify({ ok: true, version: newVersion, state: cleanState }),
      };
    }

    // 4. GET /archives
    if (path === "/archives" && event.httpMethod === "GET") {
      const archives = (await store.get("games_archive", { type: "json" })) || [];
      const summaryList = archives.map((a) => ({
        id: a.id,
        title: a.title,
        date: a.date,
        roundsCount: a.roundsCount,
        winner: a.winner,
        players: (a.players || []).map((p) => ({ name: p.name, score: p.score })),
      }));
      return {
        statusCode: 200,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json; charset=utf-8" },
        body: JSON.stringify({ ok: true, archives: summaryList }),
      };
    }

    // 5. POST /archive-current
    if (path === "/archive-current" && event.httpMethod === "POST") {
      const payload = JSON.parse(event.body || "{}");
      let data = await store.get("session_state", { type: "json" });
      if (!data || !data.state || !data.state.rounds || data.state.rounds.length === 0) {
        return { statusCode: 200, headers: CORS_HEADERS, body: JSON.stringify({ ok: false, message: "Arşivlenecek el bulunamadı" }) };
      }

      let archives = (await store.get("games_archive", { type: "json" })) || [];
      const sorted = [...data.state.players].sort((a, b) => b.score - a.score);
      const nowStr = new Date().toLocaleString("tr-TR");
      const record = {
        id: Date.now(),
        title: payload.title || `King Maçı (${data.state.rounds.length}/20 El - ${nowStr})`,
        date: nowStr,
        roundsCount: data.state.rounds.length,
        winner: sorted[0] ? sorted[0].name : "Belirsiz",
        players: data.state.players,
        rounds: data.state.rounds,
        scoringMode: data.state.scoringMode || "standard",
      };
      archives.unshift(record);
      await store.setJSON("games_archive", archives.slice(0, 100));

      return {
        statusCode: 200,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json; charset=utf-8" },
        body: JSON.stringify({ ok: true, message: "Oyun başarıyla arşivlendi" }),
      };
    }

    // 6. POST /restore-archive
    if (path === "/restore-archive" && event.httpMethod === "POST") {
      const payload = JSON.parse(event.body || "{}");
      const targetId = Number(payload.id);
      let archives = (await store.get("games_archive", { type: "json" })) || [];
      const targetGame = archives.find((a) => a.id === targetId);

      if (!targetGame) {
        return { statusCode: 404, headers: CORS_HEADERS, body: JSON.stringify({ ok: false, message: "Kayıtlı oyun bulunamadı" }) };
      }

      let data = (await store.get("session_state", { type: "json" })) || { version: 0 };
      const restoredState = {
        ...DEFAULT_STATE,
        players: targetGame.players || DEFAULT_STATE.players,
        rounds: targetGame.rounds || [],
        scoringMode: targetGame.scoringMode || "standard",
        initialDealer: targetGame.initialDealer || 0,
      };

      const newVersion = (data.version || 0) + 1;
      await store.setJSON("session_state", {
        version: newVersion,
        updatedAt: Date.now(),
        state: restoredState,
      });

      return {
        statusCode: 200,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json; charset=utf-8" },
        body: JSON.stringify({ ok: true, version: newVersion, state: restoredState }),
      };
    }

    // 7. GET /export-csv
    if (path === "/export-csv" && event.httpMethod === "GET") {
      const queryId = event.queryStringParameters ? Number(event.queryStringParameters.id) : null;
      let targetGame = null;

      if (queryId) {
        let archives = (await store.get("games_archive", { type: "json" })) || [];
        targetGame = archives.find((a) => a.id === queryId);
      }

      if (!targetGame) {
        let data = await store.get("session_state", { type: "json" });
        targetGame = {
          title: "Aktif Canlı Oyun",
          date: new Date().toLocaleString("tr-TR"),
          players: (data && data.state && data.state.players) || DEFAULT_STATE.players,
          rounds: (data && data.state && data.state.rounds) || [],
        };
      }

      const players = targetGame.players || [];
      const pNames = players.map((p, i) => p.name || `Oyuncu ${i + 1}`);

      let csvRows = [];
      csvRows.push("KING PUAN VE CEZA HESAPLAMA ÇETESİ");
      csvRows.push(`Tarih;${targetGame.date || ""}`);
      csvRows.push(`Toplam El;${(targetGame.rounds || []).length}`);
      csvRows.push("");
      csvRows.push(["El No", "Oyun Türü", "Söyleyen", ...pNames].join(";"));

      (targetGame.rounds || []).forEach((r) => {
        const handNo = r.handNo || "";
        const gameTitle = r.gameTitle || r.gameKey || "Koz";
        const callerName = r.callerName || "";
        const scores = Array.isArray(r.points)
          ? r.points
          : (r.players || []).map((p) => p.scoreDelta || 0);
        csvRows.push([handNo, gameTitle, callerName, ...scores].join(";"));
      });

      csvRows.push("");
      csvRows.push(["TOPLAM PUANLAR", "", "", ...players.map((p) => p.score || 0)].join(";"));

      const csvContent = "\ufeff" + csvRows.join("\r\n");
      const filename = `king_cete_${Date.now()}.csv`;

      return {
        statusCode: 200,
        headers: {
          ...CORS_HEADERS,
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="${filename}"`,
        },
        body: csvContent,
      };
    }

    // 8. GET /network-info
    if (path === "/network-info") {
      return {
        statusCode: 200,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json; charset=utf-8" },
        body: JSON.stringify({
          isNetlifyLive: true,
          liveUrl: "https://king-puan-ve-ceza.netlify.app",
          message: "Netlify Canlı Bulut Senkronizasyonu Aktif",
        }),
      };
    }

    return {
      statusCode: 404,
      headers: CORS_HEADERS,
      body: JSON.stringify({ error: "Endpoint bulunamadı", path }),
    };
  } catch (err) {
    return {
      statusCode: 500,
      headers: CORS_HEADERS,
      body: JSON.stringify({ error: err.message }),
    };
  }
};
