import type { ReactNode } from "react";

export function Field({
  id,
  label,
  action,
  error,
  hint,
  children,
  className = "",
}: {
  id: string;
  label: string;
  action?: ReactNode;
  error?: string | undefined;
  hint?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      {action ? (
        <div className="mb-1 flex items-baseline justify-between gap-2">
          <label htmlFor={id} className="label !mb-0">
            {label}
          </label>
          {action}
        </div>
      ) : (
        <label htmlFor={id} className="label">
          {label}
        </label>
      )}
      {children}
      {hint && !error && (
        <p id={`${id}-hint`} className="hint">
          {hint}
        </p>
      )}
      {error && (
        <p id={`${id}-error`} className="field-error">
          {error}
        </p>
      )}
    </div>
  );
}

export const describedBy = (id: string, error?: string, hint?: string) =>
  error ? `${id}-error` : hint ? `${id}-hint` : undefined;
