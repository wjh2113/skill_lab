#!/usr/bin/env bash
# 部署 Skill Lab 到京东云：rsync + 服务器上 npm ci/build + nginx + pm2。
# 不覆盖服务器上的 .env（API Key 留在线上）。
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
REMOTE="${DEPLOY_HOST:-ubuntu@111.228.6.222}"
REMOTE_DIR="${DEPLOY_PATH:-/opt/skill-lab}"
STAGING="/tmp/skill-lab-deploy"
PORT="${DEPLOY_PORT:-8811}"
DOMAIN="${DEPLOY_DOMAIN:-skill.aidigitcloud.cn}"
PM2_NAME="${DEPLOY_PM2_NAME:-skill-lab}"

echo "==> Stage to ${REMOTE}:${STAGING}"
ssh "${REMOTE}" "rm -rf '${STAGING}' && mkdir -p '${STAGING}'"
rsync -az \
  --exclude '.git' \
  --exclude 'node_modules' \
  --exclude '.next' \
  --exclude '.env' \
  --exclude '.env.local' \
  --exclude 'data/runs' \
  --exclude '.DS_Store' \
  "${ROOT}/" "${REMOTE}:${STAGING}/"

echo "==> Install into ${REMOTE_DIR}, build, nginx, pm2"
ssh "${REMOTE}" bash -s <<REMOTE
set -euo pipefail
STAGING='${STAGING}'
REMOTE_DIR='${REMOTE_DIR}'
PORT='${PORT}'
DOMAIN='${DOMAIN}'
PM2_NAME='${PM2_NAME}'

sudo mkdir -p "\${REMOTE_DIR}"
sudo rsync -a \
  --exclude '.env' \
  --exclude '.env.local' \
  --exclude 'node_modules' \
  --exclude '.next' \
  --exclude 'data/runs' \
  "\${STAGING}/" "\${REMOTE_DIR}/"
sudo mkdir -p "\${REMOTE_DIR}/data/runs"
sudo chown -R ubuntu:ubuntu "\${REMOTE_DIR}"
cd "\${REMOTE_DIR}"

if [[ ! -f .env ]]; then
  cp .env.example .env
fi
chmod 600 .env

set_kv() {
  local k="\$1" v="\$2"
  if grep -q "^\${k}=" .env; then
    sed -i "s|^\${k}=.*|\${k}=\${v}|" .env
  else
    echo "\${k}=\${v}" >> .env
  fi
}
set_kv NODE_ENV production
set_kv PORT "\${PORT}"
set_kv SKILL_LAB_WORKSPACE "\${REMOTE_DIR}"

npm ci
npm run build

if pm2 describe "\${PM2_NAME}" >/dev/null 2>&1; then
  pm2 delete "\${PM2_NAME}"
fi
pm2 start node_modules/next/dist/bin/next \
  --name "\${PM2_NAME}" \
  --cwd "\${REMOTE_DIR}" \
  -- start -H 127.0.0.1 -p "\${PORT}"
pm2 save

sudo tee /etc/nginx/conf.d/skill-lab.conf >/dev/null <<NGINX
server {
    listen 80;
    server_name ${DOMAIN};

    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
    }

    location / {
        return 301 https://\\\$host\\\$request_uri;
    }
}

server {
    listen 443 ssl;
    server_name ${DOMAIN};

    ssl_certificate /etc/nginx/ssl/aidigitcloud.cn/fullchain.pem;
    ssl_certificate_key /etc/nginx/ssl/aidigitcloud.cn/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;
    client_max_body_size 20m;

    location / {
        proxy_pass http://127.0.0.1:${PORT};
        proxy_http_version 1.1;
        proxy_set_header Host \\\$host;
        proxy_set_header X-Real-IP \\\$remote_addr;
        proxy_set_header X-Forwarded-For \\\$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \\\$scheme;
        proxy_set_header Upgrade \\\$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_buffering off;
        proxy_cache off;
        proxy_read_timeout 600s;
        proxy_send_timeout 600s;
    }
}
NGINX

sudo nginx -t
sudo systemctl reload nginx

code=""
for i in 1 2 3 4 5 6 7 8 9 10 11 12; do
  code=\$(curl -sS -o /tmp/skill-lab-health.json -w "%{http_code}" "http://127.0.0.1:\${PORT}/api/health" || true)
  if [[ "\${code}" == "200" ]]; then
    break
  fi
  sleep 1
done
echo "health HTTP \${code}"
python3 - <<'PY'
import json
from pathlib import Path
raw = Path("/tmp/skill-lab-health.json").read_text()
data = json.loads(raw)
if not data.get("ok"):
    raise SystemExit(f"health check failed: {raw[:300]}")
print("health ok", {k: data.get(k) for k in ("ok", "hasApiKey")})
PY
rm -rf "\${STAGING}"
REMOTE

echo "==> Done https://${DOMAIN}"
