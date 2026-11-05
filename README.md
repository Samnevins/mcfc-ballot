# MCFC London Supporters Club: Ticket Ballots

A single Next.js app (App Router, TypeScript, Tailwind) with Prisma + SQLite and Auth.js (email/password).

## Local setup

```bash
nvm use            # Node 22.12+ required (see .nvmrc)
npm install
cp .env.example .env            # then set AUTH_SECRET: openssl rand -base64 32
npx prisma migrate dev          # creates prisma/dev.db and runs the seed
npm run dev                     # http://localhost:3000
```

Seed logins (`npm run db:seed` resets the DB):
- Admin: `admin@example.com` / `admin123`
- Supporters: `supporter1@example.com` … `supporter10@example.com` / `password123`

The seed creates 3 games. The Arsenal game's deadline has already passed and it has 8 applicants, so an admin can run a draw straight away.

```bash
npm test          # unit tests (ballot logic, time zones)
npm run typecheck
```

## How it works

- **Statuses are derived, not stored.** A game is open, closed, drawn or past depending on the current time compared with its deadline and kickoff, and whether a draw exists. A pending ticket whose accept window has passed counts as expired. `settle()` (in `src/lib/service.ts`) runs on page loads and records any expiries and penalties. There is no scheduler.
- **Draw** (`src/lib/ballot.ts`): a seeded weighted random draw without replacement. Each draw stores its seed, inputs (weights) and full ranked order, and the admin game page shows them as an audit trail.
- **Weighting:** everyone starts at 1.0.
  - An unsuccessful application adds +X.
  - Accepting a ticket resets the weight to 1.0.
  - Returning a ticket, or not accepting it in time, bans the user from the next game and multiplies their weight by M for the 2 games after that.
  - "Next game" means the next main draw that runs. X, M and the accept window are set on Admin → Settings.
  - Every change is written to `WeightLog`.
- **Redraws:** when tickets are returned or expire, the admin presses "Redraw". Redraws use the remaining eligible applicants with the weights from the main draw.

## Deploy (Amazon Lightsail, London)

1. Create a Lightsail instance: **Linux/Unix → Ubuntu 24.04**, region **London (eu-west-2)**.
   - The **2 GB** plan is recommended.
   - The 1 GB plan also works, because the setup script adds 2 GB of swap for `next build`.
2. Attach a static IP. Open ports **80** and **443** in the instance firewall. Point your domain's A record at the static IP.
3. SSH in, then:
   ```bash
   curl -O https://raw.githubusercontent.com/<you>/mcfc-ballot/main/deploy/setup.sh
   REPO_URL=https://github.com/<you>/mcfc-ballot.git DOMAIN=ballot.example.com bash setup.sh
   ```
   This installs Node 22, PM2, Caddy, sqlite3 and the AWS CLI. It then clones the repo to `~/mcfc-ballot` and writes `.env`. The DB lives at `~/data/ballot.db`. Finally it deploys and enables PM2 on boot. Caddy gets HTTPS certificates automatically.
4. Create the first admin. Either run `npm run db:seed` (demo data only), or register through the site and promote yourself:
   ```bash
   sqlite3 ~/data/ballot.db "update User set role='ADMIN' where email='you@example.com';"
   ```

**Later deploys:**
```bash
ssh ubuntu@<ip> 'cd ~/mcfc-ballot && bash deploy/deploy.sh'   # pull, npm ci, migrate, build, pm2 reload
```

**Nightly backup to S3:**
1. Create a bucket in eu-west-2 with a lifecycle rule (e.g. expire after 30 days).
2. Run `aws configure` on the server, using an IAM user that is limited to `s3:PutObject` on that bucket.
3. `crontab -e` and add:
   ```
   15 2 * * * BACKUP_BUCKET=s3://your-bucket/ballot /home/ubuntu/mcfc-ballot/deploy/backup.sh >> /home/ubuntu/data/backup.log 2>&1
   ```

The script uses `sqlite3 .backup`, so the copy is consistent while the app is running. It also keeps 14 days of local copies in `~/data/backups`. **To restore:** `pm2 stop ballot`, gunzip a backup over `~/data/ballot.db`, then `pm2 start ballot`.

**Logs:** `pm2 logs ballot` for the app, `journalctl -u caddy` for Caddy.
