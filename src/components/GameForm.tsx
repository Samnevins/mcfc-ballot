"use client";
import { useFormAction } from "@/components/useFormAction";
import { saveGameAction } from "@/app/actions";
import { COMPETITIONS, HOME_AWAY } from "@/lib/fixture";

type Values = { opponent: string; venue: string; homeAway: string; competition: string; kickoff: string; applicationDeadline: string; drawAt: string; ticketsAvailable: number };

export function GameForm({ id, values }: { id: string | null; values?: Values }) {
  const { state, onSubmit, pending } = useFormAction(saveGameAction.bind(null, id));
  const field = (name: keyof Values, label: string, type = "text") => (
    <div>
      <label className="label" htmlFor={name}>{label}</label>
      <input id={name} name={name} type={type} className="input" required defaultValue={values?.[name]} min={type === "number" ? 0 : undefined} />
    </div>
  );
  const select = (name: "homeAway" | "competition", label: string, options: Record<string, string>, fallback: string) => (
    <div>
      <label className="label" htmlFor={name}>{label}</label>
      <select id={name} name={name} className="input" required defaultValue={values?.[name] ?? fallback}>
        {Object.entries(options).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
      </select>
    </div>
  );
  return (
    <form onSubmit={onSubmit} className="grid gap-4 sm:grid-cols-2">
      {field("opponent", "Opponent")}
      {field("venue", "Venue")}
      {select("homeAway", "Home or away", HOME_AWAY, "HOME")}
      {select("competition", "Competition", COMPETITIONS, "PREMIER_LEAGUE")}
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
