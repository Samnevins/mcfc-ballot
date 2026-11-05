#!/usr/bin/env bash
# Deploy latest main: pull, install, migrate, build, restart.
set -euo pipefail
cd "$(dirname "$0")/.."
git pull --ff-only
npm ci
npx prisma migrate deploy
npm run build
pm2 reload ecosystem.config.cjs --update-env 2>/dev/null || pm2 start ecosystem.config.cjs
echo "Deployed $(git rev-parse --short HEAD)"
