import { allocationStatus } from "@/lib/status";
import { fmt } from "@/lib/time";
import { Badge } from "@/components/Badge";

type DrawWithAllocs = {
  id: string; round: number; ranAt: Date; ticketCount: number;
  allocations: { id: string; status: string; respondBy: Date; user: { name: string } }[];
};

export function Results({ draws }: { draws: DrawWithAllocs[] }) {
  if (!draws.length) return <p className="text-sm text-slate-500">The draw has not been run yet.</p>;
  return (
    <div className="space-y-4">
      {draws.map((d) => (
        <div key={d.id}>
          <h3 className="text-sm font-semibold text-slate-700">
            {d.round === 1 ? "Main draw" : `Redraw ${d.round - 1}`} · {fmt(d.ranAt)} · {d.ticketCount} ticket(s)
          </h3>
          {d.allocations.length === 0 ? (
            <p className="text-sm text-slate-500">No winners (no eligible applicants).</p>
          ) : (
            <ul className="mt-1 space-y-1">
              {d.allocations.map((a) => {
                const s = allocationStatus(a);
                return (
                  <li key={a.id} className="flex items-center gap-2 text-sm">
                    <span>{a.user.name}</span><Badge value={s} />
                    {s === "PENDING" && <span className="text-xs text-slate-500">respond by {fmt(a.respondBy)}</span>}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      ))}
    </div>
  );
}
