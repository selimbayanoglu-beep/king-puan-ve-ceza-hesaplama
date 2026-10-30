#!/usr/bin/env bash
set -euo pipefail

SERVER_IP="159.195.255.168"
SERVER_USER="root"
REMOTE_DIR="/var/www/king"
SOURCE_DIR="/Users/selim/Documents/king-puan-ve-ceza-hesaplama"

cd "$SOURCE_DIR"

if [ ! -f "$HOME/.ssh/id_ed25519.pub" ]; then
  ssh-keygen -t ed25519 -N "" -f "$HOME/.ssh/id_ed25519"
fi

PUBKEY=$(cat "$HOME/.ssh/id_ed25519.pub")

echo "=================================================================="
echo "🚀 Güncel dosyalar (KING 11+ El Zafer Düğmesi) ${SERVER_IP}:8890 sunucusuna aktarılıyor..."
echo "📌 Şifre sorulursa sonunda 'Bu' OLMADAN şu şifreyi yapıştırıp Enter'a basın:"
echo ""
echo "    z7.vGM7XwCyg!"
echo ""
echo "=================================================================="

tar \
  --exclude='.git' \
  --exclude='.netlify' \
  --exclude='node_modules' \
  --exclude='__pycache__' \
  --exclude='session_state.json' \
  --exclude='games_archive.json' \
  -C "$SOURCE_DIR" -czf - index.html style.css app.js king_engine.py server.py icon.svg manifest.json qrcode.js | \
ssh -i "$HOME/.ssh/id_ed25519" -o ConnectTimeout=20 -o StrictHostKeyChecking=accept-new "${SERVER_USER}@${SERVER_IP}" "
  set -eu
  chmod 700 /root 2>/dev/null || true
  mkdir -p /root/.ssh
  chmod 700 /root/.ssh
  grep -qxF '${PUBKEY}' /root/.ssh/authorized_keys 2>/dev/null || echo '${PUBKEY}' >> /root/.ssh/authorized_keys
  chmod 600 /root/.ssh/authorized_keys
  chown -R root:root /root/.ssh 2>/dev/null || true

  mkdir -p '${REMOTE_DIR}'
  tar -xzf - -C '${REMOTE_DIR}'
  echo ''
  echo '✅ Sunucu dosyaları (/var/www/king) başarıyla güncellendi!'
"

echo ""
echo "🎉 TAMAMLANDI! http://159.195.255.168:8890/ adresindeki sunucunuz güncellendi."
