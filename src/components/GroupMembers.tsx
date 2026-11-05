import { effectiveWeight, type BallotConfig } from "@/lib/ballot";
import { makeLeaderAction, removeMemberAction } from "@/app/actions";
import { ActionButton } from "@/components/ActionButton";
import { Badge } from "@/components/Badge";

type Member = {
  userId: string;
  user: { name: string; weight: number; banGamesLeft: number; reducedGamesLeft: number };
};

/** Members table with group draw weight; manage=true shows leader/admin controls. */
export function GroupMembers({ groupId, leaderId, members, cfg, manage }: {
  groupId: string; leaderId: string; members: Member[]; cfg: BallotConfig; manage: boolean;
}) {
  const eligible = members.filter((m) => effectiveWeight(m.user, cfg) > 0);
  const avg = eligible.length
    ? Math.round((eligible.reduce((s, m) => s + effectiveWeight(m.user, cfg), 0) / eligible.length) * 1000) / 1000
    : 0;
  const small = "btn-secondary !px-2 !py-1 text-xs";
  return (
    <div>
      <div className="overflow-x-auto">
        <table className="table">
          <thead><tr><th>Member</th><th>Weight</th><th>Weight in next draw</th><th></th></tr></thead>
          <tbody>
            {members.map((m) => {
              const ew = effectiveWeight(m.user, cfg);
              return (
                <tr key={m.userId}>
                  <td>{m.user.name} {m.userId === leaderId && <Badge value="drawn">Leader</Badge>}</td>
                  <td>{m.user.weight}</td>
                  <td>{ew > 0 ? ew : <span className="text-red-600">Banned (will be left out)</span>}</td>
                  <td className="text-right">
                    {manage && m.userId !== leaderId && (
                      <span className="inline-flex gap-1">
                        <ActionButton className={small} action={makeLeaderAction.bind(null, groupId, m.userId)}
                          confirm={`Make ${m.user.name} the group leader?`}>Make leader</ActionButton>
                        <ActionButton className={small} action={removeMemberAction.bind(null, groupId, m.userId)}
                          confirm={`Remove ${m.user.name} from the group?`}>Remove</ActionButton>
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-sm text-slate-600">
        Group draw weight: <strong>{avg}</strong> (average of {eligible.length} eligible member{eligible.length === 1 ? "" : "s"}) ·
        needs <strong>{eligible.length}</strong> ticket{eligible.length === 1 ? "" : "s"}
      </p>
    </div>
  );
}
