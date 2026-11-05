import Link from "next/link";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/guard";
import { settle } from "@/lib/service";
import { gameStatus, STATUS_LABEL } from "@/lib/status";
import { fmt, londonDay } from "@/lib/time";
import { Badge } from "@/components/Badge";

type Ev = { gameId: string; kind: "Kickoff" | "Deadline" | "Draw"; at: Date; label: string };
const EV_STYLE = { Kickoff: "bg-navy text-white", Deadline: "bg-amber-100 text-amber-900", Draw: "bg-sky/30 text-navy" };

export default async function Calendar({ searchParams }: { searchParams: Promise<{ m?: string }> }) {
  const user = await requireUser();
  await settle();
  const { m } = await searchParams;
  const today = londonDay(new Date());
  const [y, mo] = (m && /^\d{4}-\d{2}$/.test(m) ? m : today.slice(0, 7)).split("-").map(Number);

  const games = await db.game.findMany({
    orderBy: { kickoff: "asc" },
    include: { draws: { select: { id: true } }, applications: { where: { userId: user.id }, select: { id: true } } },
  });

  const events: Ev[] = games.flatMap((g) => [
    { gameId: g.id, kind: "Deadline" as const, at: g.applicationDeadline, label: `Deadline: ${g.opponent}` },
    { gameId: g.id, kind: "Draw" as const, at: g.drawAt, label: `Draw: ${g.opponent}` },
    { gameId: g.id, kind: "Kickoff" as const, at: g.kickoff, label: `v ${g.opponent}` },
  ]);
  const byDay = new Map<string, Ev[]>();
  for (const e of events) {
    const k = londonDay(e.at);
    byDay.set(k, [...(byDay.get(k) ?? []), e]);
  }

  // Month grid, Monday first
  const first = new Date(Date.UTC(y, mo - 1, 1));
  const daysInMonth = new Date(Date.UTC(y, mo, 0)).getUTCDate();
  const lead = (first.getUTCDay() + 6) % 7;
  const cells: (string | null)[] = [
    ...Array(lead).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => `${y}-${String(mo).padStart(2, "0")}-${String(i + 1).padStart(2, "0")}`),
  ];
  while (cells.length % 7) cells.push(null);
  const shift = (d: number) => {
    const t = new Date(Date.UTC(y, mo - 1 + d, 1));
    return `${t.getUTCFullYear()}-${String(t.getUTCMonth() + 1).padStart(2, "0")}`;
  };

  const now = new Date();
  const upcoming = games.filter((g) => g.kickoff > now);

  return (
    <div className="space-y-6">
      <section className="card">
        <div className="mb-4 flex items-center justify-between">
          <Link href={`/?m=${shift(-1)}`} className="btn-secondary">‹</Link>
          <h1>{fmt(first, { month: "long", year: "numeric", timeZone: "UTC" })}</h1>
          <Link href={`/?m=${shift(1)}`} className="btn-secondary">›</Link>
        </div>
        <div className="grid grid-cols-7 gap-px overflow-hidden rounded-lg border border-slate-200 bg-slate-200 text-xs">
          {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
            <div key={d} className="bg-slate-50 p-1 text-center font-medium text-slate-500">{d}</div>
          ))}
          {cells.map((c, i) => (
            <div key={i} className={`min-h-20 bg-white p-1 ${c === today ? "ring-2 ring-inset ring-sky" : ""}`}>
              {c && <div className="mb-1 text-slate-400">{Number(c.slice(8))}</div>}
              {c && byDay.get(c)?.map((e) => (
                <Link key={e.kind + e.gameId} href={`/games/${e.gameId}`}
                  className={`mb-0.5 block truncate rounded px-1 py-0.5 ${EV_STYLE[e.kind]}`}
                  title={`${e.label} — ${fmt(e.at, { timeStyle: "short" })}`}>
                  {fmt(e.at, { timeStyle: "short" })} {e.label}
                </Link>
              ))}
            </div>
          ))}
        </div>
        <div className="mt-3 flex gap-3 text-xs">
          {Object.entries(EV_STYLE).map(([k, s]) => <span key={k} className={`rounded px-2 py-0.5 ${s}`}>{k}</span>)}
        </div>
      </section>

      <section className="card">
        <h2 className="mb-3">Upcoming games</h2>
        {upcoming.length === 0 && <p className="text-sm text-slate-500">No upcoming games.</p>}
        <ul className="divide-y divide-slate-100">
          {upcoming.map((g) => {
            const s = gameStatus(g, g.draws.length > 0, now);
            return (
              <li key={g.id}>
                <Link href={`/games/${g.id}`} className="flex flex-wrap items-center gap-x-4 gap-y-1 py-3 hover:bg-slate-50">
                  <span className="min-w-48 font-medium">v {g.opponent}</span>
                  <span className="text-sm text-slate-500">{fmt(g.kickoff)} · {g.venue}</span>
                  <span className="ml-auto flex items-center gap-2">
                    {g.applications.length > 0 && <Badge value="drawn">Applied</Badge>}
                    <Badge value={s}>{STATUS_LABEL[s]}</Badge>
                  </span>
                  <span className="w-full text-xs text-slate-500">
                    Deadline {fmt(g.applicationDeadline)} · Draw {fmt(g.drawAt)}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}
