import { requireAdmin } from "@/lib/guard";
import { GameForm } from "@/components/GameForm";

export default async function NewGame() {
  await requireAdmin();
  return (
    <div className="space-y-4">
      <h1>New game</h1>
      <div className="card"><GameForm id={null} /></div>
    </div>
  );
}
