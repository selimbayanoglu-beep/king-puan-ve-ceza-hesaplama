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
from pathlib import Path
from typing import Any

DEFAULT_PORT = 8888
DIR_PATH = Path(__file__).resolve().parent
STATE_FILE = DIR_PATH / "session_state.json"

# Varsayılan Oyun Durumu
DEFAULT_STATE: dict[str, Any] = {
    "players": [
        {"id": 0, "name": "Oyuncu 1", "score": 0, "kozCount": 0, "cezaCount": 0},
        {"id": 1, "name": "Oyuncu 2", "score": 0, "kozCount": 0, "cezaCount": 0},
        {"id": 2, "name": "Oyuncu 3", "score": 0, "kozCount": 0, "cezaCount": 0},
        {"id": 3, "name": "Oyuncu 4", "score": 0, "kozCount": 0, "cezaCount": 0},
    ],
    "initialDealer": 0,
    "scoringMode": "standard",
    "rounds": [],
    "selectedGameKey": "koz",
    "currentInputs": [0, 0, 0, 0],
}


class GameSession:
    """Masadaki tüm cihazların paylaştığı tek gerçek veri kaynağı."""

    def __init__(self, filepath: Path):
        self.filepath = filepath
        self.version = 1
        self.updated_at = int(time.time() * 1000)
        self.state = json.loads(json.dumps(DEFAULT_STATE))
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

    def reset_state(self, names: list[str] | None = None) -> int:
        new_state = json.loads(json.dumps(DEFAULT_STATE))
        if names and len(names) == 4:
            for i, name in enumerate(names):
                new_state["players"][i]["name"] = name
        elif self.state and "players" in self.state:
            for i, p in enumerate(self.state["players"][:4]):
                new_state["players"][i]["name"] = p.get("name", f"Oyuncu {i+1}")
        self.state = new_state
        self.version += 1
        self.updated_at = int(time.time() * 1000)
        self.save()
        return self.version


SESSION = GameSession(STATE_FILE)
SERVER_PORT = DEFAULT_PORT


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
        # API: Ağ Bilgileri (IP, Port, URL)
        if self.path == "/api/network-info":
            local_ip = get_local_ip()
            data = {
                "localIp": local_ip,
                "port": SERVER_PORT,
                "url": f"http://{local_ip}:{SERVER_PORT}",
                "version": SESSION.version,
            }
            body = json.dumps(data).encode("utf-8")
            self.send_response(200)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
            return

        # API: Canlı Oyun Durumu
        if self.path == "/api/state" or self.path.startswith("/api/state?"):
            data = {
                "ok": True,
                "version": SESSION.version,
                "updatedAt": SESSION.updated_at,
                "state": SESSION.state,
            }
            body = json.dumps(data, ensure_ascii=False).encode("utf-8")
            self.send_response(200)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
            return

        # Özel PWA MIME Tipleri
        if self.path == "/manifest.json":
            self.send_header("Content-Type", "application/manifest+json; charset=utf-8")
        elif self.path == "/icon.svg" or self.path.endswith(".svg"):
            self.send_header("Content-Type", "image/svg+xml; charset=utf-8")

        super().do_GET()

    def do_POST(self) -> None:
        length = int(self.headers.get("Content-Length", 0))
        raw_body = self.rfile.read(length) if length > 0 else b"{}"

        try:
            payload = json.loads(raw_body.decode("utf-8")) if raw_body else {}
        except Exception:
            payload = {}

        if self.path == "/api/state":
            new_state = payload.get("state")
            if isinstance(new_state, dict) and "players" in new_state:
                new_ver = SESSION.update_state(new_state)
                res = {"ok": True, "version": new_ver, "updatedAt": SESSION.updated_at}
                body = json.dumps(res).encode("utf-8")
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

        if self.path == "/api/reset":
            names = payload.get("playerNames")
            new_ver = SESSION.reset_state(names)
            res = {"ok": True, "version": new_ver, "state": SESSION.state}
            body = json.dumps(res).encode("utf-8")
            self.send_response(200)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
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
