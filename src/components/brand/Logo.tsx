/** Limitline mark: an "L" axis with a dashed threshold line and an end tick. Pure vector, legible at 16px. */
export function LogoMark({ size = 28, className = "" }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" className={className} aria-hidden="true" focusable="false">
      <rect width="32" height="32" rx="7" fill="#245C45" />
      <path d="M10 7v15.5h13" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="square" />
      <path d="M10 14.5h8" fill="none" stroke="#F5F4EF" strokeWidth="1.6" strokeDasharray="2 2" />
      <path d="M20.5 11.5v6" stroke="#F5F4EF" strokeWidth="1.6" />
    </svg>
  );
}

export function Wordmark({ descriptor = false }: { descriptor?: boolean }) {
  return (
    <span className="flex items-center gap-2.5">
      <LogoMark />
      <span className="leading-none">
        <span className="block text-[17px] font-semibold tracking-tight text-ink">Limitline</span>
        {descriptor && <span className="mt-1 block text-[11px] text-muted">Challenge monitoring</span>}
      </span>
    </span>
  );
}
