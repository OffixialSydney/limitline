"use client";
import { useId, useRef, useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Dialog } from "./Dialog";
import type { ActionResult } from "@/lib/validation/common";

/** Button that asks for confirmation, runs a server action, and reports failure honestly. */
export function ConfirmButton({
  label,
  title,
  description,
  confirmLabel,
  action,
  tone = "danger",
  icon,
  className = "btn-secondary btn-sm",
  requireText,
  redirectTo,
  onSuccess,
}: {
  label: ReactNode;
  title: string;
  description: string;
  confirmLabel: string;
  action: () => Promise<ActionResult | ActionResult<unknown>>;
  tone?: "danger" | "primary";
  icon?: ReactNode;
  className?: string;
  requireText?: string;
  redirectTo?: string;
  onSuccess?: (message: string) => void;
}) {
  const inputId = useId();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [typed, setTyped] = useState("");
  const [pending, start] = useTransition();
  const busy = useRef(false);
  const router = useRouter();

  const run = () => {
    if (busy.current) return;
    if (requireText && typed.trim() !== requireText) return;
    busy.current = true;
    start(async () => {
      try {
        setError(null);
        const r = await action();
        if (r.ok) {
          setOpen(false);
          onSuccess?.(r.message);
          if (redirectTo) {
            router.push(redirectTo);
          }
          router.refresh();
        } else {
          setError(r.message);
        }
      } catch {
        setError("The operation could not be completed due to a network or server error. Your existing data was not changed.");
      } finally {
        busy.current = false;
      }
    });
  };

  return (
    <>
      <button
        type="button"
        className={className}
        onClick={() => {
          setError(null);
          setTyped("");
          setOpen(true);
        }}
      >
        {icon}
        {label}
      </button>
      <Dialog open={open} onClose={() => { if (!pending) setOpen(false); }} title={title} description={description}>
        {requireText && (
          <div className="mb-4">
            <label htmlFor={inputId} className="label">
              Type <span className="font-mono font-semibold text-ink">{requireText}</span> to confirm
            </label>
            <input
              id={inputId}
              className="input"
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              placeholder={requireText}
              autoComplete="off"
              disabled={pending}
            />
          </div>
        )}
        {error && (
          <p role="alert" className="mb-3 rounded-control border border-critical/40 bg-critical/5 px-3 py-2 text-sm text-critical">
            {error}
          </p>
        )}
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button type="button" className="btn-secondary" disabled={pending} onClick={() => setOpen(false)}>
            Cancel
          </button>
          <button
            type="button"
            className={tone === "danger" ? "btn-danger" : "btn-primary"}
            disabled={pending || (!!requireText && typed.trim() !== requireText)}
            onClick={run}
          >
            {pending ? "Working…" : confirmLabel}
          </button>
        </div>
      </Dialog>
    </>
  );
}
