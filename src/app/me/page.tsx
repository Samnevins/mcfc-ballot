import { requireUser } from "@/lib/guard";
import { settle } from "@/lib/service";
import { UserSummary } from "@/components/UserSummary";

export default async function Me() {
  const user = await requireUser();
  await settle();
  return (
    <div className="space-y-4">
      <h1>My ballots</h1>
      <UserSummary userId={user.id} />
    </div>
  );
}
