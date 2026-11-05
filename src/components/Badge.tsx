const colours: Record<string, string> = {
  open: "bg-green-100 text-green-800",
  closed: "bg-amber-100 text-amber-800",
  drawn: "bg-sky/20 text-navy",
  past: "bg-slate-200 text-slate-600",
  PENDING: "bg-amber-100 text-amber-800",
  ACCEPTED: "bg-green-100 text-green-800",
  RETURNED: "bg-red-100 text-red-800",
  EXPIRED: "bg-red-100 text-red-800",
};

export function Badge({ value, children }: { value: string; children?: React.ReactNode }) {
  return (
    <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${colours[value] ?? "bg-slate-100"}`}>
      {children ?? value}
    </span>
  );
}
