"use client";
import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowLeftRight, Bell, Calculator, Layers, LayoutDashboard, LogOut, Menu, Settings, X } from "lucide-react";
import { Wordmark, LogoMark } from "@/components/brand/Logo";
import { logout } from "@/features/auth/actions";

const NAV = [
  { href: "/app/overview", label: "Overview", Icon: LayoutDashboard },
  { href: "/app/challenges", label: "Challenges", Icon: Layers },
  { href: "/app/trades", label: "Records", Icon: ArrowLeftRight },
  { href: "/app/calculator", label: "Calculator", Icon: Calculator },
  { href: "/app/alerts", label: "Alerts", Icon: Bell },
  { href: "/app/settings", label: "Settings", Icon: Settings },
] as const;

function NavList({ unread, compact, onNavigate }: { unread: number; compact: boolean; onNavigate?: () => void }) {
  const pathname = usePathname();
  return (
    <nav aria-label="Main" className="flex flex-col gap-1 px-2">
      {NAV.map(({ href, label, Icon }) => {
        const active = pathname === href || pathname.startsWith(`${href}/`);
        return (
          <Link key={href} href={href} onClick={onNavigate} aria-current={active ? "page" : undefined} title={compact ? label : undefined}
            className={`relative flex min-h-[44px] items-center gap-3 rounded-control px-3 text-sm font-medium transition-colors ${compact ? "md:justify-center lg:justify-start" : ""} ${active ? "bg-accent/10 text-accent" : "text-ink hover:bg-sunken"}`}>
            <Icon size={18} aria-hidden="true" />
            <span className={compact ? "md:sr-only lg:not-sr-only" : ""}>{label}</span>
            {href === "/app/alerts" && unread > 0 && (
              <span className={`ml-auto rounded-full bg-accent px-1.5 text-[11px] font-semibold leading-5 text-white ${compact ? "md:absolute md:right-1 md:top-1 md:ml-0 lg:static lg:ml-auto" : ""}`}>
                {unread > 99 ? "99+" : unread}<span className="sr-only"> unread</span>
              </span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}

export function AppShell({ children, unread, displayName }: { children: ReactNode; unread: number; displayName: string }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  useEffect(() => setOpen(false), [pathname]);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  const account = (
    <div className="border-t border-line p-2">
      <p className="truncate px-3 pb-1 pt-2 text-xs text-muted md:sr-only lg:not-sr-only">{displayName}</p>
      <form action={logout}>
        <button type="submit" className="flex min-h-[44px] w-full items-center gap-3 rounded-control px-3 text-sm font-medium text-ink hover:bg-sunken md:justify-center lg:justify-start" title="Sign out">
          <LogOut size={18} aria-hidden="true" /><span className="md:sr-only lg:not-sr-only">Sign out</span>
        </button>
      </form>
    </div>
  );

  return (
    <div className="min-h-dvh md:grid md:grid-cols-[64px_minmax(0,1fr)] lg:grid-cols-[232px_minmax(0,1fr)]">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-50 focus:rounded-control focus:bg-surface focus:px-3 focus:py-2 focus:shadow">Skip to content</a>
      {/* Tablet rail and desktop sidebar */}
      <aside className="sticky top-0 hidden h-dvh flex-col border-r border-line bg-surface md:flex">
        <div className="flex h-16 items-center px-4 md:justify-center lg:justify-start">
          <Link href="/app/overview" aria-label="Limitline overview"><span className="hidden lg:block"><Wordmark /></span><span className="lg:hidden"><LogoMark /></span></Link>
        </div>
        <div className="flex-1 overflow-y-auto"><NavList unread={unread} compact /></div>
        {account}
      </aside>

      <div className="min-w-0">
        {/* Mobile top bar */}
        <header className="sticky top-0 z-30 flex items-center justify-between border-b border-line bg-paper/95 px-3 pt-[env(safe-area-inset-top)] backdrop-blur md:hidden">
          <Link href="/app/overview" className="flex h-14 items-center" aria-label="Limitline overview"><Wordmark /></Link>
          <button type="button" className="btn-ghost !px-3" onClick={() => setOpen(true)} aria-label="Open navigation" aria-expanded={open} aria-controls="mobile-drawer">
            <Menu size={22} aria-hidden="true" />
            {unread > 0 && <span className="rounded-full bg-accent px-1.5 text-[11px] font-semibold text-white">{unread}<span className="sr-only"> unread alerts</span></span>}
          </button>
        </header>

        {open && <div className="fixed inset-0 z-40 bg-ink/40 md:hidden" onClick={() => setOpen(false)} aria-hidden="true" />}
        {open && (
        <div id="mobile-drawer" role="dialog" aria-modal="true" aria-label="Navigation"
          className="fixed inset-y-0 right-0 z-50 flex w-[min(300px,86vw)] flex-col border-l border-line bg-surface pt-[env(safe-area-inset-top)] md:hidden">
          <div className="flex h-14 items-center justify-between px-4">
            <Wordmark />
            <button type="button" className="btn-ghost !px-2" onClick={() => setOpen(false)} aria-label="Close navigation"><X size={22} aria-hidden="true" /></button>
          </div>
          <div className="flex-1 overflow-y-auto"><NavList unread={unread} compact={false} onNavigate={() => setOpen(false)} /></div>
          <div className="pb-[env(safe-area-inset-bottom)]">{account}</div>
        </div>
        )}

        <main id="main" className="mx-auto w-full max-w-[1280px] px-4 py-6 pb-[max(2rem,env(safe-area-inset-bottom))] sm:px-6 lg:px-8 lg:py-8">{children}</main>
      </div>
    </div>
  );
}
