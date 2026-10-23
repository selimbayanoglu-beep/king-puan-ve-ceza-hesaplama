#!/usr/bin/env python3
"""King Puan ve Ceza Hesaplama — Yerel Web Sunucusu.

Tamamen bağımsız, sıfır dış bağımlılık (sadece Python standart kütüphanesi).
Masadaki tüm oyuncuların (iPad, iPhone, Android, Laptop) aynı çeteleyi
yerel ağ üzerinden canlı görmesini sağlar.
"""

from __future__ import annotations

import http.server
import os
import socket
import socketserver
import subprocess
import sys
import webbrowser
from pathlib import Path

DEFAULT_PORT = 8888
DIR_PATH = Path(__file__).resolve().parent


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

    for iface in ("en0", "en1", "en2"):
        try:
            out = subprocess.check_output(["ipconfig", "getifaddr", iface], stderr=subprocess.DEVNULL, timeout=1).decode().strip()
            if out:
                return out
        except Exception:
            pass

    return "127.0.0.1"


class KingHTTPHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(DIR_PATH), **kwargs)

    def end_headers(self) -> None:
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Cache-Control", "no-cache, no-store, must-revalidate")
        super().end_headers()


def main():
    port = DEFAULT_PORT
    local_ip = get_local_ip()

    print("=" * 60)
    print("👑 KING PUAN & CEZA HESAPLAMA SİSTEMİ BAŞLATILIYOR")
    print("=" * 60)
    print(f"📍 Bu Bilgisayarda:  http://localhost:{port}")
    print(f"📱 Masadaki Telefon / Tablet: http://{local_ip}:{port}")
    print("=" * 60)
    print("Durdurmak için: Ctrl + C")

    open_browser = "--no-browser" not in sys.argv and not os.environ.get("NO_BROWSER")

    # Port doluluğu durumunda alternatif port dene
    while port < DEFAULT_PORT + 10:
        try:
            server = socketserver.TCPServer(("", port), KingHTTPHandler)
            break
        except OSError:
            port += 1

    if open_browser:
        try:
            webbrowser.open(f"http://localhost:{port}")
        except Exception:
            pass

    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nSunucu kapatıldı. İyi oyunlar!")
        server.server_close()


if __name__ == "__main__":
    main()
