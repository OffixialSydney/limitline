"use client";
import { useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Dialog } from "./Dialog";
import type { ActionResult } from "@/lib/validation/common";

/** Button that asks for confirmation, runs a server action, and reports failure honestly. */
export function ConfirmButton({ label, title, description, confirmLabel, action, tone = "danger", icon, className = "btn-secondary btn-sm", requireText }: {
  label: ReactNode; title: string; description: string; confirmLabel: string;
  action: () => Promise<ActionResult | ActionResult<unknown>>;
  tone?: "danger" | "primary"; icon?: ReactNode; className?: string; requireText?: string;
}) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [typed, setTyped] = useState("");
  const [pending, start] = useTransition();
  const router = useRouter();
  const run = () => start(async () => {
    const r = await action();
    if (r.ok) { setOpen(false); router.refresh(); } else setError(r.message);
  });
  return (
    <>
      <button type="button" className={className} onClick={() => { setError(null); setTyped(""); setOpen(true); }}>{icon}{label}</button>
      <Dialog open={open} onClose={() => setOpen(false)} title={title} description={description}>
        {requireText && (
          <div className="mb-4">
            <label htmlFor="confirm-text" className="label">Type {requireText} to confirm</label>
            <input id="confirm-text" className="input" value={typed} onChange={(e) => setTyped(e.target.value)} autoComplete="off" />
          </div>
        )}
        {error && <p role="alert" className="mb-3 rounded-control border border-critical/40 bg-critical/5 px-3 py-2 text-sm text-critical">{error}</p>}
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button type="button" className="btn-secondary" onClick={() => setOpen(false)}>Cancel</button>
          <button type="button" className={tone === "danger" ? "btn-danger" : "btn-primary"} disabled={pending || (!!requireText && typed !== requireText)} onClick={run}>
            {pending ? "Working…" : confirmLabel}
          </button>
        </div>
      </Dialog>
    </>
  );
}
