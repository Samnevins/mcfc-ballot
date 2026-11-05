"use client";
import { useFormAction } from "@/components/useFormAction";
import { saveSettingsAction } from "@/app/actions";

export function SettingsForm({ values }: { values: { weightIncrement: number; reducedMultiplier: number; acceptWindowHours: number } }) {
  const { state, onSubmit, pending } = useFormAction(saveSettingsAction);
  return (
    <form onSubmit={onSubmit} className="grid max-w-md gap-4">
      <div>
        <label className="label" htmlFor="weightIncrement">Weight added per unsuccessful application (X)</label>
        <input id="weightIncrement" name="weightIncrement" type="number" step="0.05" min={0} className="input" defaultValue={values.weightIncrement} />
      </div>
      <div>
        <label className="label" htmlFor="reducedMultiplier">Weight multiplier during the 2 reduced games (0–1)</label>
        <input id="reducedMultiplier" name="reducedMultiplier" type="number" step="0.05" min={0} max={1} className="input" defaultValue={values.reducedMultiplier} />
      </div>
      <div>
        <label className="label" htmlFor="acceptWindowHours">Hours winners have to accept</label>
        <input id="acceptWindowHours" name="acceptWindowHours" type="number" min={1} className="input" defaultValue={values.acceptWindowHours} />
      </div>
      <div className="flex items-center gap-3">
        <button className="btn" disabled={pending}>Save</button>
        {state?.error && <p className="text-sm text-red-600">{state.error}</p>}
        {state?.ok && <p className="text-sm text-green-700">{state.ok}</p>}
      </div>
    </form>
  );
}
