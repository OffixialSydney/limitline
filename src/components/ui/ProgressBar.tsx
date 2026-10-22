export function ProgressBar({ value, label, tone = "accent" }: { value: number | null; label: string; tone?: "accent" | "warning" | "critical" }) {
  const color = tone === "critical" ? "bg-critical" : tone === "warning" ? "bg-warning" : "bg-accent";
  if (value === null) return <div className="h-1.5 w-full rounded-full border border-dashed border-line" role="img" aria-label={`${label}: not enough data`} />;
  const v = Math.min(100, Math.max(0, value));
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-sunken" role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(v)}>
      <div className={`h-full rounded-full ${color} transition-[width] duration-200`} style={{ width: `${v}%` }} />
    </div>
  );
}
