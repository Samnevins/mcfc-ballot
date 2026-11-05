// All display/input in Europe/London; storage in UTC.
export const TZ = "Europe/London";

const partsFmt = new Intl.DateTimeFormat("en-GB", {
  timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit",
  hour: "2-digit", minute: "2-digit", hourCycle: "h23",
});

function londonParts(d: Date) {
  const p = Object.fromEntries(partsFmt.formatToParts(d).map((x) => [x.type, x.value]));
  return { y: +p.year, mo: +p.month, d: +p.day, h: +p.hour, mi: +p.minute };
}

/** "2026-11-05T19:30" (London wall time) -> Date */
export function fromLondonInput(s: string): Date {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(s);
  if (!m) throw new Error("Invalid date/time");
  const [y, mo, d, h, mi] = m.slice(1).map(Number);
  const asUtc = Date.UTC(y, mo - 1, d, h, mi);
  const p = londonParts(new Date(asUtc));
  const offset = Date.UTC(p.y, p.mo - 1, p.d, p.h, p.mi) - asUtc;
  return new Date(asUtc - offset);
}

/** Date -> "YYYY-MM-DDTHH:mm" in London, for <input type="datetime-local"> */
export function toLondonInput(date: Date): string {
  const p = londonParts(date);
  const z = (n: number) => String(n).padStart(2, "0");
  return `${p.y}-${z(p.mo)}-${z(p.d)}T${z(p.h)}:${z(p.mi)}`;
}

/** Date -> "YYYY-MM-DD" in London */
export function londonDay(date: Date): string {
  return toLondonInput(date).slice(0, 10);
}

export function fmt(date: Date, opts: Intl.DateTimeFormatOptions = { dateStyle: "medium", timeStyle: "short" }) {
  return new Intl.DateTimeFormat("en-GB", { timeZone: TZ, ...opts }).format(date);
}
