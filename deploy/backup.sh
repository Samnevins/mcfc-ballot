#!/usr/bin/env bash
# Nightly SQLite backup: consistent online copy, upload to S3, keep 14 days locally.
# Cron (crontab -e):  15 2 * * * BACKUP_BUCKET=s3://my-bucket/ballot /home/ubuntu/mcfc-ballot/deploy/backup.sh >> /home/ubuntu/data/backup.log 2>&1
set -euo pipefail
DB=/home/ubuntu/data/ballot.db
DIR=/home/ubuntu/data/backups
FILE="$DIR/ballot-$(date -u +%Y%m%dT%H%M%SZ).db"
mkdir -p "$DIR"
sqlite3 "$DB" ".backup '$FILE'"
gzip "$FILE"
if [ -n "${BACKUP_BUCKET:-}" ]; then
  aws s3 cp "$FILE.gz" "$BACKUP_BUCKET/"
fi
find "$DIR" -name 'ballot-*.db.gz' -mtime +14 -delete
echo "$(date -u) backup ok: $FILE.gz"
