#!/usr/bin/env bash
# One-time server setup on a fresh Lightsail Ubuntu 24.04 instance. Run as the ubuntu user.
#   REPO_URL=git@github.com:you/mcfc-ballot.git DOMAIN=ballot.example.com bash setup.sh
set -euo pipefail
: "${REPO_URL:?set REPO_URL}"; : "${DOMAIN:?set DOMAIN}"
APP_DIR=/home/ubuntu/mcfc-ballot
DATA_DIR=/home/ubuntu/data

# Node 22, Caddy, sqlite3, AWS CLI
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt-get install -y nodejs git sqlite3 debian-keyring debian-archive-keyring apt-transport-https unzip
curl -1sLf https://dl.cloudsmith.io/public/caddy/stable/gpg.key | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt | sudo tee /etc/apt/sources.list.d/caddy-stable.list
sudo apt-get update && sudo apt-get install -y caddy
command -v aws >/dev/null || { curl -s https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip -o /tmp/awscli.zip && unzip -q /tmp/awscli.zip -d /tmp && sudo /tmp/aws/install; }
sudo npm install -g pm2

# 2 GB swap: keeps `next build` safe on small instances
if [ ! -f /swapfile ]; then
  sudo fallocate -l 2G /swapfile && sudo chmod 600 /swapfile && sudo mkswap /swapfile && sudo swapon /swapfile
  echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
fi

mkdir -p "$DATA_DIR/backups"
[ -d "$APP_DIR" ] || git clone "$REPO_URL" "$APP_DIR"
cd "$APP_DIR"
if [ ! -f .env ]; then
  cat > .env <<ENV
DATABASE_URL="file:$DATA_DIR/ballot.db"
AUTH_SECRET="$(openssl rand -base64 32)"
AUTH_TRUST_HOST=true
AUTH_URL="https://$DOMAIN"
ENV
fi

sed "s/ballot.example.com/$DOMAIN/" deploy/Caddyfile | sudo tee /etc/caddy/Caddyfile >/dev/null
sudo systemctl reload caddy

bash deploy/deploy.sh
pm2 save && sudo env PATH="$PATH" pm2 startup systemd -u ubuntu --hp /home/ubuntu
echo "Done. Seed demo data (optional): npm run db:seed. Then configure deploy/backup.sh in cron (see README)."
