"use client";
import { useActionState } from "react";
import { saveGameAction } from "@/app/actions";

type Values = { opponent: string; venue: string; kickoff: string; applicationDeadline: string; drawAt: string; ticketsAvailable: number };

export function GameForm({ id, values }: { id: string | null; values?: Values }) {
  const [state, run, pending] = useActionState(saveGameAction.bind(null, id), undefined);
  const field = (name: keyof Values, label: string, type = "text") => (
    <div>
      <label className="label" htmlFor={name}>{label}</label>
      <input id={name} name={name} type={type} className="input" required defaultValue={values?.[name]} min={type === "number" ? 0 : undefined} />
    </div>
  );
  return (
    <form action={run} className="grid gap-4 sm:grid-cols-2">
      {field("opponent", "Opponent")}
      {field("venue", "Venue")}
      {field("kickoff", "Kickoff (UK time)", "datetime-local")}
      {field("ticketsAvailable", "Tickets available", "number")}
      {field("applicationDeadline", "Application deadline (UK time)", "datetime-local")}
      {field("drawAt", "Draw date/time (UK time)", "datetime-local")}
      <div className="flex items-center gap-3 sm:col-span-2">
        <button className="btn" disabled={pending}>{id ? "Save changes" : "Create game"}</button>
        {state?.error && <p className="text-sm text-red-600">{state.error}</p>}
        {state?.ok && <p className="text-sm text-green-700">{state.ok}</p>}
      </div>
    </form>
  );
}
