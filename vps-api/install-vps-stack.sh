#!/bin/bash
# Jet Barkod VPS — PostgREST + Apache proxy kurulumu
# root@flowcobalt üzerinde çalıştırın: bash /opt/jetbarkod-api/install-vps-stack.sh

set -euo pipefail

API_DIR="/opt/jetbarkod-api"
POSTGREST_VERSION="12.2.3"
POSTGREST_BIN="/usr/local/bin/postgrest"
ENV_FILE="$API_DIR/postgrest.env"

echo "=== 1) PostgREST indir ==="
cd /tmp
curl -fsSL -o postgrest.tar.xz "https://github.com/PostgREST/postgrest/releases/download/v${POSTGREST_VERSION}/postgrest-v${POSTGREST_VERSION}-ubuntu.tar.xz"
tar -xJf postgrest.tar.xz
chmod +x postgrest
mv postgrest "$POSTGREST_BIN"
"$POSTGREST_BIN" --version

echo "=== 2) postgrest.env (DB sifresi .env den okunur) ==="
DB_PASS=$(grep '^DB_PASSWORD=' "$API_DIR/.env" | cut -d= -f2-)
cat > "$ENV_FILE" <<EOF
db-uri = "postgresql://jetbarkod:${DB_PASS}@127.0.0.1:5432/jetbarkod"
db-schemas = "public"
db-anon-role = "jetbarkod"
server-host = 127.0.0.1
server-port = 3002
EOF
chmod 600 "$ENV_FILE"

echo "=== 3) systemd postgrest ==="
cat > /etc/systemd/system/postgrest.service <<EOF
[Unit]
Description=PostgREST for Jet Barkod
After=postgresql.service

[Service]
Type=simple
ExecStart=$POSTGREST_BIN $ENV_FILE
Restart=always
RestartSec=3

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable postgrest
systemctl restart postgrest
sleep 1
systemctl is-active postgrest

echo "=== 4) Storage klasoru ==="
mkdir -p /var/www/jetbarkod-storage/update-images
chown -R www-data:www-data /var/www/jetbarkod-storage

echo "=== 5) Apache proxy (/rest/v1 + /storage/v1) ==="
patch_proxy() {
  local f="$1"
  [ -f "$f" ] || return 0
  if grep -q "/rest/v1/" "$f"; then
    echo "Zaten guncel: $f"
    return 0
  fi
  python3 - <<PY
from pathlib import Path
p = Path("$f")
text = p.read_text()
block = """    ProxyPass /rest/v1/ http://127.0.0.1:3002/
    ProxyPassReverse /rest/v1/ http://127.0.0.1:3002/
    ProxyPass /storage/v1/ http://127.0.0.1:3001/storage/v1/
    ProxyPassReverse /storage/v1/ http://127.0.0.1:3001/storage/v1/
    ProxyPass / http://127.0.0.1:3001/
    ProxyPassReverse / http://127.0.0.1:3001/
"""
if "ProxyPass /" in text and "/rest/v1/" not in text:
    text = text.replace("    ProxyPass / http://127.0.0.1:3001/", block.strip() + "\n", 1)
    text = text.replace("    ProxyPassReverse / http://127.0.0.1:3001/", "", 1)
elif "ServerName api.flowcobalt.com" in text and "/rest/v1/" not in text:
    text = text.replace("ServerName api.flowcobalt.com\n", "ServerName api.flowcobalt.com\n" + block, 1)
p.write_text(text)
print("Guncellendi:", p)
PY
}
patch_proxy /etc/apache2/sites-available/api.flowcobalt.com.conf
patch_proxy /etc/apache2/sites-available/api.flowcobalt.com-le-ssl.conf

a2enmod proxy proxy_http headers
apache2ctl configtest
systemctl reload apache2

echo "=== 6) Schema patch ==="
if [ -f "$API_DIR/vps_schema_patch.sql" ]; then
  sudo -u postgres psql -d jetbarkod -f "$API_DIR/vps_schema_patch.sql"
fi

echo "=== 7) API restart ==="
systemctl restart jetbarkod-api

echo "=== TAMAM ==="
curl -s http://127.0.0.1:3002/ | head -c 200 || true
echo
curl -s http://127.0.0.1:3001/health
