import { requireAdmin } from "@/lib/guard";
import { getSettings } from "@/lib/service";
import { SettingsForm } from "@/components/SettingsForm";

export default async function Settings() {
  await requireAdmin();
  const s = await getSettings();
  return (
    <div className="space-y-4">
      <h1>Ballot settings</h1>
      <div className="card"><SettingsForm values={s} /></div>
    </div>
  );
}
