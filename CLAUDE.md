# CLAUDE.md

Ticket ballot app for the Manchester City London Supporters Club. Keep it simple: one Next.js app, one SQLite file, no extra services.

## Stack
- Next.js 16 App Router + TypeScript + Tailwind v4 (`src/app/globals.css` holds the theme and utility classes `.btn`, `.card`, `.input`, `.table`)
- Prisma 6 + SQLite (`prisma/schema.prisma`). String fields stand in for enums.
- Auth.js v5 (next-auth beta), Credentials provider, JWT sessions. Role lives on `User.role` (`SUPPORTER` | `ADMIN`).
- Server Actions for every mutation (`src/app/actions.ts`). The only API route is Auth.js.
- Vitest for unit tests. zod for input validation. bcryptjs for hashing.
- Hosting: Lightsail (London) + PM2 + Caddy. Scripts are in `deploy/`.

## Commands
- `npm run dev` / `npm run build` / `npm start`
- `npm test`: unit tests (`src/**/*.test.ts`)
- `npm run typecheck`
- `npx prisma migrate dev --name <change>`: after editing the schema
- `npm run db:seed`: wipes and reseeds (1 admin, 10 supporters, 3 games)
- `bash deploy/deploy.sh`: production deploy (pull, ci, migrate deploy, build, pm2 reload)

## Layout
- `src/lib/ballot.ts`: **pure** draw and weighting logic (PRNG, effective weight, transitions, main draw, redraw). No DB, no I/O, no `Date.now()`.
- `src/lib/service.ts`: DB side: `settle()`, `runGameDraw`, `runGameRedraw`, `respondToAllocation`, apply/withdraw. Writes `WeightLog`.
- `src/lib/status.ts`: derived game and allocation statuses
- `src/lib/time.ts`: Europe/London conversions. Store UTC, display and input in London time.
- `src/lib/guard.ts`: `requireUser()` / `requireAdmin()`. These load the user fresh from the DB.

## Rules
- Weighting and draw rules change only in `ballot.ts`, with tests. Keep that file pure.
- Never store status columns that can be derived from timestamps. There is no scheduler or cron in the app. Expiry is applied lazily by `settle()`, so call it at the top of pages that show allocations.
- Every change to weight or penalty goes through `applyChange()` in `service.ts`, so it is logged.
- Draws are immutable audit records (seed + inputJson + orderJson). Never edit or delete them.
- Every server action must call `requireUser()` or `requireAdmin()` itself. Page guards don't protect actions.
- Next 16: `params` and `searchParams` are Promises, so `await` them.
- Keep dependencies minimal. Ask before adding one.
