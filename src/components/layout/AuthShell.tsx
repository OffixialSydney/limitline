import type { ReactNode } from "react";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { Wordmark } from "@/components/brand/Logo";

export function AuthShell({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
}) {
  return (
    <div className="flex min-h-dvh flex-col bg-paper">
      <header className="border-b border-line bg-paper/95 px-4 pt-[env(safe-area-inset-top)]">
        <div className="mx-auto flex h-14 w-full max-w-6xl items-center justify-between sm:h-16">
          <Link href="/" aria-label="Limitline home">
            <Wordmark descriptor />
          </Link>
          <Link href="/" className="inline-flex items-center gap-1 text-xs font-medium text-muted hover:text-ink">
            <ChevronLeft size={14} aria-hidden="true" />
            Back to home
          </Link>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-[420px] flex-1 flex-col justify-center px-4 py-8 pb-[max(2rem,env(safe-area-inset-bottom))] sm:px-5 sm:py-12">
        <div className="panel p-5 sm:p-6">
          <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">{title}</h1>
          <p className="mt-1 text-xs text-muted sm:text-sm">{subtitle}</p>
          <div className="mt-5">{children}</div>
        </div>
        <p className="mt-4 text-center text-xs text-muted">
          Limitline evaluates only the figures and rules you record. It does not connect to brokers or prop firms.
        </p>
      </main>
    </div>
  );
}
