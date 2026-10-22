export function FormMessage({ state }: { state: { ok: boolean; message: string } | null }) {
  if (!state) return null;
  return (
    <p role={state.ok ? "status" : "alert"} className={`rounded-control border px-3 py-2 text-sm ${state.ok ? "border-positive/30 bg-positive/10 text-positive" : "border-critical/40 bg-critical/5 text-critical"}`}>
      {state.message}
    </p>
  );
}
