"use client";
import { useActionState } from "react";

export type ActionState = { error?: string; ok?: string } | undefined;

/** A one-button form bound to a server action; shows any returned error. */
export function ActionButton({
  action, children, className = "btn", confirm, fields,
}: {
  action: (prev: ActionState, fd: FormData) => Promise<ActionState>;
  children: React.ReactNode;
  className?: string;
  confirm?: string;
  fields?: React.ReactNode;
}) {
  const [state, run, pending] = useActionState(action, undefined);
  return (
    <form
      action={run}
      onSubmit={(e) => { if (confirm && !window.confirm(confirm)) e.preventDefault(); }}
      className="inline-flex flex-wrap items-end gap-2"
    >
      {fields}
      <button className={className} disabled={pending}>{pending ? "Working…" : children}</button>
      {state?.error && <p className="w-full text-sm text-red-600">{state.error}</p>}
      {state?.ok && <p className="w-full text-sm text-green-700">{state.ok}</p>}
    </form>
  );
}
