"use client";
import { useFormAction } from "@/components/useFormAction";
import { adjustWeightAction, createUserAction, resetPasswordAction, updateUserAction } from "@/app/actions";
import type { ActionState } from "@/components/ActionButton";

type Action = (prev: ActionState, fd: FormData) => Promise<ActionState>;

function Form({ action, children, submit, className = "grid gap-4 sm:grid-cols-2" }: {
  action: Action; children: React.ReactNode; submit: string; className?: string;
}) {
  const { state, onSubmit, pending } = useFormAction(action);
  return (
    <form onSubmit={onSubmit} className={className}>
      {children}
      <div className="flex items-center gap-3 sm:col-span-2">
        <button className="btn" disabled={pending}>{pending ? "Saving…" : submit}</button>
        {state?.error && <p className="text-sm text-red-600">{state.error}</p>}
        {state?.ok && <p className="text-sm text-green-700">{state.ok}</p>}
      </div>
    </form>
  );
}

function Input({ name, label, defaultValue, type = "text", required, step, min }: {
  name: string; label: string; defaultValue?: string | number | null; type?: string; required?: boolean; step?: string; min?: number;
}) {
  return (
    <div>
      <label className="label" htmlFor={name}>{label}</label>
      <input id={name} name={name} type={type} className="input" required={required} step={step} min={min}
        defaultValue={defaultValue ?? undefined} />
    </div>
  );
}

function Select({ name, label, value, options }: { name: string; label: string; value: string; options: string[] }) {
  return (
    <div>
      <label className="label" htmlFor={name}>{label}</label>
      <select id={name} name={name} defaultValue={value} className="input">
        {options.map((o) => <option key={o} value={o}>{o.charAt(0) + o.slice(1).toLowerCase()}</option>)}
      </select>
    </div>
  );
}

type User = {
  id: string; name: string; email: string; phone: string | null; membershipNumber: string | null;
  role: string; status: string; weight: number; banGamesLeft: number; reducedGamesLeft: number;
};

export function UserDetailsForm({ user }: { user: User }) {
  return (
    <Form action={updateUserAction.bind(null, user.id)} submit="Save details">
      <Input name="name" label="Name" defaultValue={user.name} required />
      <Input name="email" label="Email" type="email" defaultValue={user.email} required />
      <Input name="phone" label="Phone" defaultValue={user.phone} />
      <Input name="membershipNumber" label="Membership no." defaultValue={user.membershipNumber} />
      <Select name="role" label="Role" value={user.role} options={["SUPPORTER", "ADMIN"]} />
      <Select name="status" label="Status" value={user.status} options={["PENDING", "APPROVED", "REJECTED", "SUSPENDED"]} />
    </Form>
  );
}

export function NewUserForm() {
  return (
    <Form action={createUserAction} submit="Create user">
      <Input name="name" label="Name" required />
      <Input name="email" label="Email" type="email" required />
      <Input name="phone" label="Phone" />
      <Input name="membershipNumber" label="Membership no." />
      <Select name="role" label="Role" value="SUPPORTER" options={["SUPPORTER", "ADMIN"]} />
      <Input name="password" label="Initial password (min 8)" type="password" required />
    </Form>
  );
}

export function ResetPasswordForm({ userId }: { userId: string }) {
  return (
    <Form action={resetPasswordAction.bind(null, userId)} submit="Set password" className="grid gap-4">
      <Input name="password" label="New password (min 8)" type="password" required />
    </Form>
  );
}

export function WeightForm({ user }: { user: User }) {
  return (
    <Form action={adjustWeightAction.bind(null, user.id)} submit="Update weight" className="grid gap-4 sm:grid-cols-3">
      <Input name="weight" label="Weight" type="number" step="0.05" min={0} defaultValue={user.weight} required />
      <Input name="banGamesLeft" label="Ban games left" type="number" min={0} defaultValue={user.banGamesLeft} required />
      <Input name="reducedGamesLeft" label="Reduced games left" type="number" min={0} defaultValue={user.reducedGamesLeft} required />
    </Form>
  );
}
