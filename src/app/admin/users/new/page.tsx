import { requireAdmin } from "@/lib/guard";
import { NewUserForm } from "@/components/UserForms";

export default async function NewUser() {
  await requireAdmin();
  return (
    <div className="space-y-4">
      <h1>Add user</h1>
      <p className="text-sm text-slate-500">Accounts added by an admin are approved straight away.</p>
      <div className="card"><NewUserForm /></div>
    </div>
  );
}
