import { fmt } from "@/lib/time";

type Log = {
  id: string; reason: string; oldWeight: number; newWeight: number;
  banLeft: number; reducedLeft: number; createdAt: Date; game: { opponent: string } | null;
};

const REASON: Record<string, string> = {
  UNSUCCESSFUL: "Unsuccessful application",
  ACCEPTED: "Ticket accepted (reset)",
  RETURNED: "Ticket returned (penalty)",
  EXPIRED: "Not accepted in time (penalty)",
  PENALTY_USED: "Penalty game served",
  ADMIN: "Admin change",
};

export function WeightHistory({ logs }: { logs: Log[] }) {
  if (!logs.length) return <p className="text-sm text-slate-500">No changes yet.</p>;
  return (
    <div className="overflow-x-auto">
      <table className="table">
        <thead><tr><th>When</th><th>Game</th><th>Reason</th><th>Weight</th><th>Ban / reduced left</th></tr></thead>
        <tbody>
          {logs.map((l) => (
            <tr key={l.id}>
              <td className="whitespace-nowrap">{fmt(l.createdAt)}</td>
              <td>{l.game?.opponent ?? "—"}</td>
              <td>{REASON[l.reason] ?? l.reason}</td>
              <td className="whitespace-nowrap">{l.oldWeight} → {l.newWeight}</td>
              <td>{l.banLeft} / {l.reducedLeft}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
