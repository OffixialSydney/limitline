import type { ReactNode } from "react";
import { Wordmark } from "@/components/brand/Logo";

export function AuthShell({ title, subtitle, children }: { title: string; subtitle: string; children: ReactNode }) {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-[420px] flex-col justify-center px-5 py-10 pb-[max(2.5rem,env(safe-area-inset-bottom))]">
      <Wordmark descriptor />
      <h1 className="mt-10 text-2xl font-semibold">{title}</h1>
      <p className="mt-1 text-sm text-muted">{subtitle}</p>
      <div className="mt-6">{children}</div>
      <p className="mt-10 text-xs text-muted">Limitline works from the values you record. It does not connect to brokers or prop firms.</p>
    </main>
  );
}
