"use client";
import { useState } from "react";
import { useFormAction } from "@/components/useFormAction";
import { saveGameAction } from "@/app/actions";
import { COMPETITIONS, HOME_AWAY } from "@/lib/fixture";

type Values = { opponent: string; venue: string; homeAway: string; competition: string; kickoff: string; applicationDeadline: string; drawAt: string; ticketsAvailable: number | null };

export function GameForm({ id, values }: { id: string | null; values?: Values }) {
  const { state, onSubmit, pending } = useFormAction(saveGameAction.bind(null, id));
  const [tbc, setTbc] = useState(values ? values.ticketsAvailable == null : true);
  const field = (name: keyof Values, label: string, type = "text") => (
    <div>
      <label className="label" htmlFor={name}>{label}</label>
      <input id={name} name={name} type={type} className="input" required defaultValue={values?.[name] ?? undefined} />
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
      <div>
        <label className="label" htmlFor="ticketsAvailable">Tickets available</label>
        <div className="flex items-center gap-3">
          {tbc ? (
            <input key="tbc" className="input" value="TBC" disabled aria-label="Tickets to be confirmed" />
          ) : (
            <input key="n" id="ticketsAvailable" name="ticketsAvailable" type="number" min={0} className="input" required
              defaultValue={values?.ticketsAvailable ?? undefined} autoFocus={!!values && values.ticketsAvailable == null} />
          )}
          <label className="flex shrink-0 items-center gap-1.5 text-sm text-slate-700">
            <input type="checkbox" name="ticketsTbc" checked={tbc} onChange={(e) => setTbc(e.target.checked)} className="size-4 accent-navy" />
            TBC
          </label>
        </div>
        <p className="mt-1 text-xs text-slate-500">Often not known until the draw. You set the final number when you run it.</p>
      </div>
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
