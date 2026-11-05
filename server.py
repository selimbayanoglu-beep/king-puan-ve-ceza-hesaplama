#!/usr/bin/env python3
"""King Puan ve Ceza Hesaplama — Çoklu Cihaz Canlı Senkronizasyon Sunucusu.

Tamamen bağımsız, sıfır dış bağımlılık (sadece Python standart kütüphanesi).
Masadaki tüm oyuncuların (iPhone, iPad, Android, Laptop) aynı çeteleye
kendi telefonlarından giriş yapmasını ve canlı senkronize olmasını sağlar.
"""

from __future__ import annotations

import http.server
import json
import os
import socket
import socketserver
import subprocess
import sys
import time
import webbrowser
import csv
import io
from datetime import datetime
from pathlib import Path
from typing import Any

DEFAULT_PORT = int(os.environ.get("PORT", 8888))
DIR_PATH = Path(__file__).resolve().parent
STATE_FILE = DIR_PATH / "session_state.json"
ARCHIVE_FILE = DIR_PATH / "games_archive.json"
PLAYERS_DB_FILE = DIR_PATH / "players_db.json"


# Varsayılan Oyun Durumu Üretici (Masa Bazlı İsimler: Masa 1: Oyuncu 1..4, Masa 2: Oyuncu 5..8, vb.)
def create_default_state(table_id: str = "1") -> dict[str, Any]:
    try:
        tid = int(table_id)
    except Exception:
        tid = 1
    start_num = (tid - 1) * 4 + 1
    return {
        "players": [
            {"id": 0, "name": f"Oyuncu {start_num}", "score": 0, "kozCount": 0, "cezaCount": 0},
            {"id": 1, "name": f"Oyuncu {start_num + 1}", "score": 0, "kozCount": 0, "cezaCount": 0},
            {"id": 2, "name": f"Oyuncu {start_num + 2}", "score": 0, "kozCount": 0, "cezaCount": 0},
            {"id": 3, "name": f"Oyuncu {start_num + 3}", "score": 0, "kozCount": 0, "cezaCount": 0},
        ],
        "initialDealer": 0,
        "scoringMode": "standard",
        "rounds": [],
        "activeHandType": "ceza",
        "selectedCezaKey": "el_almaz",
        "selectedKozSuit": "karo",
        "kozInputs": [0, 0, 0, 0],
        "cezaInputs": [0, 0, 0, 0],
        "kozConfirmed": [False, False, False, False],
        "cezaConfirmed": [False, False, False, False],
    }

DEFAULT_STATE: dict[str, Any] = create_default_state("1")

TABLES_CONFIG_FILE = DIR_PATH / "tables_config.json"


class GameSession:
    """Masadaki tüm cihazların paylaştığı tek gerçek veri kaynağı."""

    def __init__(self, filepath: Path, table_id: str = "1", table_name: str = "Masa 1"):
        self.filepath = filepath
        self.table_id = str(table_id)
        self.table_name = str(table_name)
        self.version = 1
        self.updated_at = int(time.time() * 1000)
        self.state = create_default_state(self.table_id)
        self.load()

    def load(self) -> None:
        if self.filepath.exists():
            try:
                with open(self.filepath, "r", encoding="utf-8") as f:
                    data = json.load(f)
                    if isinstance(data, dict) and "state" in data:
                        self.state = data["state"]
                        self.version = data.get("version", 1)
                        self.updated_at = data.get("updatedAt", int(time.time() * 1000))
                        return
                    elif isinstance(data, dict) and "players" in data:
                        self.state = data
                        self.version = 1
                        self.updated_at = int(time.time() * 1000)
                        return
            except Exception as e:
                print(f"[UYARI] session_state.json yüklenemedi: {e}")

    def save(self) -> None:
        try:
            temp_file = self.filepath.with_suffix(".tmp")
            payload = {
                "version": self.version,
                "updatedAt": self.updated_at,
                "state": self.state,
            }
            with open(temp_file, "w", encoding="utf-8") as f:
                json.dump(payload, f, ensure_ascii=False, indent=2)
            temp_file.replace(self.filepath)
        except Exception as e:
            print(f"[HATA] Oyun durumu kaydedilemedi: {e}")

    def update_state(self, new_state: dict[str, Any]) -> int:
        self.state = new_state
        self.version += 1
        self.updated_at = int(time.time() * 1000)
        self.save()
        return self.version

    def archive_current_game(self, title: str | None = None) -> bool:
        if not self.state or not self.state.get("rounds"):
            return False
        try:
            archives = []
            if ARCHIVE_FILE.exists():
                try:
                    with open(ARCHIVE_FILE, "r", encoding="utf-8") as f:
                        archives = json.load(f)
                        if not isinstance(archives, list):
                            archives = []
                except Exception:
                    archives = []

            # En yüksek puanlı oyuncuyu bul (Kazanan — Eğer KING ilanı ile kazanıldıysa doğrudan o kazanır)
            players = self.state.get("players", [])
            winner = None
            if self.state.get("kingWinnerName"):
                winner = f"{self.state.get('kingWinnerName')} (👑 KING!)"
            elif players:
                winner = sorted(players, key=lambda p: p.get("score", 0), reverse=True)[0].get("name")

            now_str = datetime.now().strftime("%d.%m.%Y %H:%M:%S")
            rounds_count = len(self.state.get("rounds", []))
            game_id = int(time.time() * 1000)

            record = {
                "id": game_id,
                "tableId": self.table_id,
                "tableName": self.table_name,
                "title": title or f"{self.table_name} — Oyun {len(archives) + 1} ({rounds_count}/20 El)",
                "date": now_str,
                "roundsCount": rounds_count,
                "winner": winner,
                "players": json.loads(json.dumps(players)),
                "rounds": json.loads(json.dumps(self.state.get("rounds", []))),
                "scoringMode": self.state.get("scoringMode", "standard"),
            }

            archives.insert(0, record)  # En yeni oyun en başa
            # En son 100 oyunu sakla
            archives = archives[:100]

            with open(ARCHIVE_FILE, "w", encoding="utf-8") as f:
                json.dump(archives, f, ensure_ascii=False, indent=2)
            print(f"[ARŞİV] Oyun başarıyla arşivlendi: {record['title']} (ID: {game_id})")
            return True
        except Exception as e:
            print(f"[HATA] Oyun arşivlenemedi: {e}")
            return False

    def reset_state(self, names: list[str] | None = None) -> int:
        # Sıfırlamadan önce mevcut oyunu arşivle (eğer en az 1 el oynandıysa)
        if self.state and self.state.get("rounds"):
            self.archive_current_game()

        # HER ŞEYİ TERTEMİZ SIFIRLA (O masanın varsayılan isimleri ile)
        new_state = create_default_state(self.table_id)
        if names and len(names) == 4 and any(n.strip() for n in names):
            for i, name in enumerate(names):
                def_name = new_state["players"][i]["name"]
                new_state["players"][i]["name"] = name.strip() or def_name

        self.state = new_state
        self.version += 1
        self.updated_at = int(time.time() * 1000)
        self.save()
        return self.version

    def restore_archive(self, archive_id: int) -> bool:
        if not ARCHIVE_FILE.exists():
            return False
        try:
            target_game = None
            with open(ARCHIVE_FILE, "r", encoding="utf-8") as f:
                archives = json.load(f)
                for item in archives:
                    if item.get("id") == archive_id:
                        target_game = item
                        break
            if not target_game:
                return False

            # Arşivdeki oyunun tüm bilgilerini masaya yükle
            restored_state = json.loads(json.dumps(DEFAULT_STATE))
            restored_state["players"] = target_game.get("players", restored_state["players"])
            restored_state["rounds"] = target_game.get("rounds", [])
            restored_state["scoringMode"] = target_game.get("scoringMode", "standard")
            restored_state["initialDealer"] = target_game.get("initialDealer", 0)

            self.state = restored_state
            self.version += 1
            self.updated_at = int(time.time() * 1000)
            self.save()
            print(f"[ARŞİV] Oyun masaya başarıyla geri yüklendi: {target_game.get('title')}")
            return True
        except Exception as e:
            print(f"[HATA] Arşiv geri yüklenemedi: {e}")
            return False



class TableManager:
    """Birden fazla King masasını eşzamanlı olarak yöneten merkezi yönetici."""

    def __init__(self):
        self.config_file = TABLES_CONFIG_FILE
        self.active_count = 1
        self.tables_info: list[dict[str, str]] = [
            {"id": "1", "name": "Masa 1"},
            {"id": "2", "name": "Masa 2"},
            {"id": "3", "name": "Masa 3"},
            {"id": "4", "name": "Masa 4"},
        ]
        self.sessions: dict[str, GameSession] = {}
        self.load_config()
        self.init_sessions()

    def load_config(self) -> None:
        if self.config_file.exists():
            try:
                with open(self.config_file, "r", encoding="utf-8") as f:
                    data = json.load(f)
                    self.active_count = max(1, min(8, int(data.get("activeCount", 1))))
                    if isinstance(data.get("tables"), list) and data["tables"]:
                        self.tables_info = data["tables"]
            except Exception as e:
                print(f"[UYARI] tables_config.json okunamadı: {e}")

    def save_config(self) -> None:
        try:
            temp_file = self.config_file.with_suffix(".tmp")
            payload = {
                "activeCount": self.active_count,
                "tables": self.tables_info,
            }
            with open(temp_file, "w", encoding="utf-8") as f:
                json.dump(payload, f, ensure_ascii=False, indent=2)
            temp_file.replace(self.config_file)
        except Exception as e:
            print(f"[HATA] tables_config.json kaydedilemedi: {e}")

    def get_table_name(self, table_id: str) -> str:
        for t in self.tables_info:
            if str(t.get("id")) == str(table_id):
                return t.get("name", f"Masa {table_id}")
        return f"Masa {table_id}"

    def get_state_file_for_table(self, table_id: str) -> Path:
        if str(table_id) == "1":
            return STATE_FILE  # Geriye dönük %100 uyumluluk
        return DIR_PATH / f"session_state_table_{table_id}.json"

    def get_session(self, table_id: str | int | None = None) -> GameSession:
        tid = str(table_id or "1").strip()
        if not tid or tid == "0":
            tid = "1"
        if tid not in self.sessions:
            filepath = self.get_state_file_for_table(tid)
            tname = self.get_table_name(tid)
            self.sessions[tid] = GameSession(filepath, table_id=tid, table_name=tname)
        return self.sessions[tid]

    def init_sessions(self) -> None:
        for t in self.tables_info[:max(1, self.active_count)]:
            self.get_session(t["id"])

    def set_table_count(self, count: int) -> int:
        count = max(1, min(8, int(count)))
        self.active_count = count
        while len(self.tables_info) < count:
            next_id = str(len(self.tables_info) + 1)
            self.tables_info.append({"id": next_id, "name": f"Masa {next_id}"})
        self.save_config()
        for t in self.tables_info[:count]:
            self.get_session(t["id"])
        return self.active_count

    def update_table_name(self, table_id: str, new_name: str) -> bool:
        tid = str(table_id).strip()
        new_name = new_name.strip()
        if not tid or not new_name:
            return False
        found = False
        for t in self.tables_info:
            if str(t.get("id")) == tid:
                t["name"] = new_name
                found = True
                break
        if not found:
            self.tables_info.append({"id": tid, "name": new_name})
        sess = self.get_session(tid)
        sess.table_name = new_name
        self.save_config()
        return True

    def list_tables_summary(self) -> list[dict[str, Any]]:
        res = []
        for t in self.tables_info[:max(1, self.active_count)]:
            tid = str(t.get("id", "1"))
            sess = self.get_session(tid)
            st = sess.state or {}
            rounds = st.get("rounds", [])
            players = st.get("players", [])

            sorted_players = sorted(players, key=lambda p: p.get("score", 0), reverse=True)
            leader_name = sorted_players[0].get("name") if sorted_players else None

            res.append({
                "id": tid,
                "name": t.get("name", f"Masa {tid}"),
                "version": sess.version,
                "updatedAt": sess.updated_at,
                "roundsCount": len(rounds),
                "isGameOver": len(rounds) >= 20 or bool(st.get("kingWinnerName")),
                "kingWinnerName": st.get("kingWinnerName"),
                "activeHandType": st.get("activeHandType", "ceza"),
                "selectedCezaKey": st.get("selectedCezaKey", "el_almaz"),
                "selectedKozSuit": st.get("selectedKozSuit", "karo"),
                "leader": leader_name,
                "players": [{"id": p.get("id"), "name": p.get("name"), "score": p.get("score", 0)} for p in players],
            })
        return res


TABLE_MANAGER = TableManager()
SESSION = TABLE_MANAGER.get_session("1")
SERVER_PORT = DEFAULT_PORT


def extract_table_id(handler: http.server.SimpleHTTPRequestHandler, payload: dict | None = None) -> str:
    """İstekten (query, header, body) hedef masa id'sini tespit eder."""
    # 1. URL Query parametresi (?table=2 veya ?masa=2)
    if "?" in handler.path:
        query = handler.path.split("?", 1)[1]
        for part in query.split("&"):
            if "=" in part:
                k, v = part.split("=", 1)
                if k.lower() in ("table", "masa", "tableid"):
                    val = v.strip()
                    if val:
                        return val
    # 2. HTTP Header
    hdr = handler.headers.get("X-Table-Id")
    if hdr and hdr.strip():
        return hdr.strip()
    # 3. JSON Payload
    if payload and isinstance(payload, dict):
        for k in ("tableId", "table", "masa"):
            if k in payload and str(payload[k]).strip():
                return str(payload[k]).strip()
    return "1"


def get_local_ip() -> str:
    """Yerel ağdaki (Wi-Fi) IP adresini tespit eder."""
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.settimeout(0.5)
        s.connect(("8.8.8.8", 80))
        ip = s.getsockname()[0]
        s.close()
        if ip and not ip.startswith("127."):
            return ip
    except Exception:
        pass

    for iface in ("en0", "en1", "en2", "wlan0", "eth0"):
        try:
            out = subprocess.check_output(
                ["ipconfig", "getifaddr", iface],
                stderr=subprocess.DEVNULL,
                timeout=1,
            ).decode().strip()
            if out:
                return out
        except Exception:
            pass

    return "127.0.0.1"


class KingHTTPHandler(http.server.SimpleHTTPRequestHandler):
    """Statik dosya ve canlı senkronizasyon REST API işleyicisi."""

    extensions_map = {
        **http.server.SimpleHTTPRequestHandler.extensions_map,
        ".json": "application/json",
        ".svg": "image/svg+xml",
    }

    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(DIR_PATH), **kwargs)

    def log_message(self, format: str, *args: Any) -> None:
        # Arka plan polling istekleriyle logları kirletmemek için API isteklerini filtrele
        if len(args) > 0 and isinstance(args[0], str) and "/api/state" in args[0]:
            return
        super().log_message(format, *args)

    def end_headers(self) -> None:
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, X-Client-Version")
        self.send_header("Cache-Control", "no-cache, no-store, must-revalidate")
        super().end_headers()

    def do_OPTIONS(self) -> None:
        self.send_response(204)
        self.end_headers()

    def do_GET(self) -> None:
        # API: Masalar Listesi ve Salon Özeti
        if self.path == "/api/tables" or self.path.startswith("/api/tables?"):
            data = {
                "ok": True,
                "activeCount": TABLE_MANAGER.active_count,
                "tables": TABLE_MANAGER.list_tables_summary(),
            }
            body = json.dumps(data, ensure_ascii=False).encode("utf-8")
            self.send_response(200)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
            return

        # API: Ağ Bilgileri (IP, Port, URL, Masa URL'si)
        if self.path == "/api/network-info" or self.path.startswith("/api/network-info?"):
            table_id = extract_table_id(self)
            sess = TABLE_MANAGER.get_session(table_id)
            local_ip = get_local_ip()
            table_url = f"http://{local_ip}:{SERVER_PORT}/?masa={table_id}" if str(table_id) != "1" else f"http://{local_ip}:{SERVER_PORT}"
            data = {
                "localIp": local_ip,
                "port": SERVER_PORT,
                "tableId": table_id,
                "tableName": sess.table_name,
                "url": table_url,
                "baseUrl": f"http://{local_ip}:{SERVER_PORT}",
                "version": sess.version,
            }
            body = json.dumps(data, ensure_ascii=False).encode("utf-8")
            self.send_response(200)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
            return

                # API: Geçmiş Oyunlar Arşivi
        if self.path == "/api/archives":
            archives = []
            if ARCHIVE_FILE.exists():
                try:
                    with open(ARCHIVE_FILE, "r", encoding="utf-8") as f:
                        archives = json.load(f)
                except Exception:
                    archives = []
            # Hafif liste (tur detayları olmadan özet)
            summary_list = []
            for a in archives:
                summary_list.append({
                    "id": a.get("id"),
                    "title": a.get("title"),
                    "date": a.get("date"),
                    "roundsCount": a.get("roundsCount"),
                    "winner": a.get("winner"),
                    "players": [{"name": p.get("name"), "score": p.get("score")} for p in a.get("players", [])],
                })
            body = json.dumps({"ok": True, "archives": summary_list}, ensure_ascii=False).encode("utf-8")
            self.send_response(200)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
            return

        # API: Belirli Bir Arşivin Detayı
        if self.path.startswith("/api/archive-detail"):
            archive_id = None
            if "?" in self.path:
                query = self.path.split("?")[1]
                for part in query.split("&"):
                    if part.startswith("id="):
                        try:
                            archive_id = int(part.split("=")[1])
                        except ValueError:
                            pass
            found = None
            if ARCHIVE_FILE.exists():
                try:
                    with open(ARCHIVE_FILE, "r", encoding="utf-8") as f:
                        for item in json.load(f):
                            if item.get("id") == archive_id:
                                found = item
                                break
                except Exception:
                    pass
            if found:
                body = json.dumps({"ok": True, "game": found}, ensure_ascii=False).encode("utf-8")
                self.send_response(200)
                self.send_header("Content-Type", "application/json; charset=utf-8")
                self.send_header("Content-Length", str(len(body)))
                self.end_headers()
                self.wfile.write(body)
                return
            else:
                self.send_response(404)
                self.end_headers()
                return

        # API: Excel / CSV Olarak İndir (Toplu Çıktı)
        if self.path.startswith("/api/export-csv"):
            archive_id = None
            if "?" in self.path:
                query = self.path.split("?")[1]
                for part in query.split("&"):
                    if part.startswith("id="):
                        try:
                            archive_id = int(part.split("=")[1])
                        except ValueError:
                            pass

            target_game = None
            if archive_id and ARCHIVE_FILE.exists():
                try:
                    with open(ARCHIVE_FILE, "r", encoding="utf-8") as f:
                        for item in json.load(f):
                            if item.get("id") == archive_id:
                                target_game = item
                                break
                except Exception:
                    pass
            if not target_game:
                table_id = extract_table_id(self)
                sess = TABLE_MANAGER.get_session(table_id)
                target_game = {
                    "title": f"Aktif Oyun ({sess.table_name})",
                    "date": datetime.now().strftime("%d.%m.%Y %H:%M:%S"),
                    "players": sess.state.get("players", []),
                    "rounds": sess.state.get("rounds", []),
                }

            # CSV Oluştur
            output = io.StringIO()
            # UTF-8 BOM ekle ki Excel Türkçe karakterleri doğru göstersin
            output.write('\ufeff')
            writer = csv.writer(output, delimiter=';')

            players = target_game.get("players", [])
            p_names = [p.get("name", f"Oyuncu {i+1}") for i, p in enumerate(players)]

            writer.writerow(["KING PUAN VE CEZA HESAPLAMA ÇETESİ"])
            writer.writerow(["Tarih", target_game.get("date", "")])
            writer.writerow(["Toplam El", len(target_game.get("rounds", []))])
            writer.writerow([])
            writer.writerow(["El No", "Oyun Türü", "Söyleyen", *p_names])

            rounds = target_game.get("rounds", [])
            for r in rounds:
                hand_no = r.get("handNo", "")
                game_title = r.get("gameTitle", r.get("gameKey", "Koz"))
                caller_name = r.get("callerName", "")
                scores = [p.get("scoreDelta", 0) for p in r.get("players", [])]
                writer.writerow([hand_no, game_title, caller_name, *scores])

            writer.writerow([])
            writer.writerow(["TOPLAM PUANLAR", "", "", *[p.get("score", 0) for p in players]])

            csv_data = output.getvalue().encode("utf-8")
            filename = f"king_cete_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv"

            self.send_response(200)
            self.send_header("Content-Type", "text/csv; charset=utf-8")
            self.send_header("Content-Disposition", f'attachment; filename="{filename}"')
            self.send_header("Content-Length", str(len(csv_data)))
            self.end_headers()
            self.wfile.write(csv_data)
            return

        # API: Kayıtlı Oyuncular Veritabanı
        if self.path == "/api/players":
            players_list = []
            if PLAYERS_DB_FILE.exists():
                try:
                    with open(PLAYERS_DB_FILE, "r", encoding="utf-8") as f:
                        players_list = json.load(f)
                except Exception:
                    players_list = []
            # Eğer dosya boşsa arşivdeki isimlerden varsayılan liste oluştur
            if not players_list:
                known = set()
                # Mevcut masadaki isimler
                for p in SESSION.state.get("players", []):
                    nm = p.get("name", "").strip()
                    if nm and not nm.startswith("Oyuncu "):
                        known.add(nm)
                # Arşivdeki isimler
                if ARCHIVE_FILE.exists():
                    try:
                        with open(ARCHIVE_FILE, "r", encoding="utf-8") as f:
                            for a in json.load(f):
                                for p in a.get("players", []):
                                    nm = p.get("name", "").strip()
                                    if nm and not nm.startswith("Oyuncu "):
                                        known.add(nm)
                    except Exception:
                        pass
                # Temel varsayılanlar
                known.update(["Selim", "Alp", "Berkay", "Mesut", "Barış"])
                players_list = sorted(list(known))
                try:
                    with open(PLAYERS_DB_FILE, "w", encoding="utf-8") as f:
                        json.dump(players_list, f, ensure_ascii=False, indent=2)
                except Exception:
                    pass

            data = {"ok": True, "players": players_list}
            body = json.dumps(data, ensure_ascii=False).encode("utf-8")
            self.send_response(200)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
            return

        # API: Canlı Oyun Durumu (Masa Bazlı)
        if self.path == "/api/state" or self.path.startswith("/api/state?"):
            table_id = extract_table_id(self)
            sess = TABLE_MANAGER.get_session(table_id)
            data = {
                "ok": True,
                "tableId": table_id,
                "tableName": sess.table_name,
                "version": sess.version,
                "updatedAt": sess.updated_at,
                "state": sess.state,
            }
            body = json.dumps(data, ensure_ascii=False).encode("utf-8")
            self.send_response(200)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
            return

        super().do_GET()

    def do_POST(self) -> None:
        length = int(self.headers.get("Content-Length", 0))
        raw_body = self.rfile.read(length) if length > 0 else b"{}"

        try:
            payload = json.loads(raw_body.decode("utf-8")) if raw_body else {}
        except Exception:
            payload = {}

        if self.path == "/api/tables":
            action = payload.get("action")
            if action == "set_count":
                count = int(payload.get("count", 1))
                TABLE_MANAGER.set_table_count(count)
            elif action == "update_name":
                TABLE_MANAGER.update_table_name(payload.get("tableId"), payload.get("name", ""))

            res = {
                "ok": True,
                "activeCount": TABLE_MANAGER.active_count,
                "tables": TABLE_MANAGER.list_tables_summary(),
            }
            body = json.dumps(res, ensure_ascii=False).encode("utf-8")
            self.send_response(200)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
            return

        if self.path == "/api/state":
            table_id = extract_table_id(self, payload)
            sess = TABLE_MANAGER.get_session(table_id)
            new_state = payload.get("state")
            if isinstance(new_state, dict) and "players" in new_state:
                new_ver = sess.update_state(new_state)
                res = {"ok": True, "tableId": table_id, "version": new_ver, "updatedAt": sess.updated_at, "state": sess.state}
                body = json.dumps(res, ensure_ascii=False).encode("utf-8")
                self.send_response(200)
                self.send_header("Content-Type", "application/json; charset=utf-8")
                self.send_header("Content-Length", str(len(body)))
                self.end_headers()
                self.wfile.write(body)
                return
            else:
                self.send_response(400)
                self.end_headers()
                return

        if self.path == "/api/player-input":
            table_id = extract_table_id(self, payload)
            sess = TABLE_MANAGER.get_session(table_id)
            cur = sess.state
            if not isinstance(cur.get("kozInputs"), list) or len(cur["kozInputs"]) != 4:
                cur["kozInputs"] = [0, 0, 0, 0]
            if not isinstance(cur.get("cezaInputs"), list) or len(cur["cezaInputs"]) != 4:
                cur["cezaInputs"] = [0, 0, 0, 0]
            if not isinstance(cur.get("kozConfirmed"), list) or len(cur["kozConfirmed"]) != 4:
                cur["kozConfirmed"] = [False, False, False, False]
            if not isinstance(cur.get("cezaConfirmed"), list) or len(cur["cezaConfirmed"]) != 4:
                cur["cezaConfirmed"] = [False, False, False, False]

            action = payload.get("action", "set_player_unit")
            hand_type = "koz" if payload.get("type") == "koz" else "ceza"

            if action == "set_player_unit":
                try:
                    p_idx = int(payload.get("playerIdx", -1))
                    val = max(0, min(13, int(payload.get("value", 0))))
                except Exception:
                    p_idx, val = -1, 0
                if 0 <= p_idx < 4:
                    cur["activeHandType"] = hand_type
                    if hand_type == "koz":
                        cur["kozInputs"][p_idx] = val
                        cur["kozConfirmed"][p_idx] = True
                    else:
                        cur["cezaInputs"][p_idx] = val
                        cur["cezaConfirmed"][p_idx] = True
            elif action == "select_game":
                cur["activeHandType"] = hand_type
                game_key = payload.get("gameKey")
                if hand_type == "koz" and game_key:
                    cur["selectedKozSuit"] = str(game_key)
                elif hand_type == "ceza" and game_key:
                    if cur.get("selectedCezaKey") != str(game_key):
                        cur["selectedCezaKey"] = str(game_key)
                        cur["cezaInputs"] = [0, 0, 0, 0]
                        cur["cezaConfirmed"] = [False, False, False, False]
            elif action == "set_all_units":
                cur["activeHandType"] = hand_type
                inputs = payload.get("inputs")
                if isinstance(inputs, list) and len(inputs) == 4:
                    clean_arr = [max(0, min(13, int(v or 0))) for v in inputs]
                    conf_in = payload.get("confirmed")
                    conf_arr = [bool(x) for x in conf_in] if isinstance(conf_in, list) and len(conf_in) == 4 else [v > 0 for v in clean_arr]
                    if hand_type == "koz":
                        cur["kozInputs"] = clean_arr
                        cur["kozConfirmed"] = conf_arr
                    else:
                        cur["cezaInputs"] = clean_arr
                        cur["cezaConfirmed"] = conf_arr

            new_ver = sess.update_state(cur)
            res = {"ok": True, "tableId": table_id, "version": new_ver, "updatedAt": sess.updated_at, "state": sess.state}
            body = json.dumps(res, ensure_ascii=False).encode("utf-8")
            self.send_response(200)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
            return

        if self.path == "/api/archive-current":
            table_id = extract_table_id(self, payload)
            sess = TABLE_MANAGER.get_session(table_id)
            title = payload.get("title")
            success = sess.archive_current_game(title)
            res = {"ok": success, "tableId": table_id, "message": "Oyun arşivlendi" if success else "Arşivlenecek el bulunamadı"}
            body = json.dumps(res, ensure_ascii=False).encode("utf-8")
            self.send_response(200)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
            return

        if self.path == "/api/restore-archive":
            table_id = extract_table_id(self, payload)
            sess = TABLE_MANAGER.get_session(table_id)
            archive_id = payload.get("id")
            if archive_id is not None:
                try:
                    archive_id = int(archive_id)
                except ValueError:
                    archive_id = None
            success = sess.restore_archive(archive_id) if archive_id else False
            res = {"ok": success, "tableId": table_id, "version": sess.version, "state": sess.state}
            body = json.dumps(res, ensure_ascii=False).encode("utf-8")
            self.send_response(200 if success else 400)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
            return

        if self.path == "/api/players":
            action = payload.get("action", "add")
            name = payload.get("name", "").strip()

            players_list = []
            if PLAYERS_DB_FILE.exists():
                try:
                    with open(PLAYERS_DB_FILE, "r", encoding="utf-8") as f:
                        players_list = json.load(f)
                except Exception:
                    players_list = []

            if action == "add" and name:
                # İsim baş harflerini düzelt
                words = [w[0].upper() + w[1:] if w else "" for w in name.split(" ")]
                clean_name = " ".join([w for w in words if w])
                if clean_name not in players_list:
                    players_list.append(clean_name)
                    players_list.sort()
            elif action == "delete" and name:
                players_list = [p for p in players_list if p != name]

            try:
                with open(PLAYERS_DB_FILE, "w", encoding="utf-8") as f:
                    json.dump(players_list, f, ensure_ascii=False, indent=2)
            except Exception:
                pass

            res = {"ok": True, "players": players_list}
            body = json.dumps(res, ensure_ascii=False).encode("utf-8")
            self.send_response(200)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
            return

        if self.path == "/api/reset":
            table_id = extract_table_id(self, payload)
            sess = TABLE_MANAGER.get_session(table_id)
            names = payload.get("playerNames")
            new_ver = sess.reset_state(names)
            res = {"ok": True, "tableId": table_id, "version": new_ver, "state": sess.state}
            body = json.dumps(res).encode("utf-8")
            self.send_response(200)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
            return

        if self.path == "/api/pull-github":
            import urllib.request
            files_to_sync = [
                "index.html",
                "style.css",
                "app.js",
                "king_engine.py",
                "server.py",
                "icon.svg",
                "manifest.json",
                "qrcode.js",
                "tables_config.json",
            ]
            commit_ref = payload.get("ref", "main")
            repo_base = f"https://raw.githubusercontent.com/selimbayanoglu-beep/king-puan-ve-ceza-hesaplama/{commit_ref}/"
            updated_files = []
            errors = []
            for fname in files_to_sync:
                try:
                    url = f"{repo_base}{fname}?t={int(time.time() * 1000)}"
                    req = urllib.request.Request(
                        url,
                        headers={
                            "Cache-Control": "no-cache, no-store, must-revalidate",
                            "Pragma": "no-cache",
                            "User-Agent": "KingServerSync/2.0"
                        }
                    )
                    with urllib.request.urlopen(req, timeout=15) as resp:
                        data = resp.read()
                    if data:
                        target_path = DIR_PATH / fname
                        with open(target_path, "wb") as f:
                            f.write(data)
                        updated_files.append(fname)
                except Exception as exc:
                    errors.append(f"{fname}: {exc}")

            res = {"ok": len(errors) == 0, "updated": updated_files, "errors": errors, "ref": commit_ref}
            body = json.dumps(res, ensure_ascii=False).encode("utf-8")
            self.send_response(200 if not errors else 500)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)

            # Dosyalar güncellendikten sonra Python sürecini otomatik yenile
            if not errors and payload.get("restart", True):
                def _do_restart():
                    time.sleep(0.5)
                    os._exit(0)
                import threading
                threading.Thread(target=_do_restart).start()
            return

        self.send_response(404)
        self.end_headers()


def main():
    global SERVER_PORT
    port = DEFAULT_PORT
    local_ip = get_local_ip()

    # Port doluluğu durumunda alternatif port dene
    socketserver.TCPServer.allow_reuse_address = True
    server = None
    while port < DEFAULT_PORT + 20:
        try:
            server = socketserver.TCPServer(("", port), KingHTTPHandler)
            SERVER_PORT = port
            break
        except OSError:
            port += 1

    if not server:
        print("[HATA] Uygun port bulunamadı!")
        sys.exit(1)

    print("=" * 64)
    print("👑 KING PUAN & CEZA HESAPLAMA — ÇOKLU CİHAZ CANLI SENKRONİZASYON")
    print("=" * 64)
    print(f"📍 Bu Bilgisayarda:              http://localhost:{SERVER_PORT}")
    print(f"📱 Telefon Girişi (Android/iOS):  http://{local_ip}:{SERVER_PORT}")
    print("=" * 64)
    print("✨ Tüm telefonlar ve tabletler aynı çeteye canlı olarak bağlanır!")
    print("Durdurmak için: Ctrl + C\n")

    open_browser = "--no-browser" not in sys.argv and not os.environ.get("NO_BROWSER")
    if open_browser:
        try:
            webbrowser.open(f"http://localhost:{SERVER_PORT}")
        except Exception:
            pass

    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nSunucu kapatıldı. İyi oyunlar!")
        server.server_close()


if __name__ == "__main__":
    main()
