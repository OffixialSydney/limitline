"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Menu, X } from "lucide-react";
import { Wordmark } from "@/components/brand/Logo";

const LINKS = [
  { href: "#features", label: "Rule Engine" },
  { href: "#how-it-works", label: "Workflow" },
  { href: "#about", label: "Scope & Limits" },
] as const;

export function LandingNav() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-paper/95 pt-[env(safe-area-inset-top)] backdrop-blur">
      <div className="mx-auto flex h-14 w-full max-w-6xl items-center justify-between px-4 sm:h-16 sm:px-6 lg:px-8">
        <Link href="/" aria-label="Limitline home" className="flex items-center">
          <span className="sm:hidden">
            <Wordmark />
          </span>
          <span className="hidden sm:inline">
            <Wordmark descriptor />
          </span>
        </Link>

        <nav aria-label="Main" className="hidden items-center gap-1 md:flex">
          {LINKS.map((l) => (
            <a
              key={l.href}
              href={l.href}
              className="rounded-control px-3 py-1.5 text-sm font-medium text-muted transition-colors hover:bg-sunken hover:text-ink"
            >
              {l.label}
            </a>
          ))}
        </nav>

        <div className="hidden items-center gap-2 md:flex">
          <Link href="/login" className="btn-ghost btn-sm">
            Sign in
          </Link>
          <Link href="/signup" className="btn-primary btn-sm">
            Create account
          </Link>
        </div>

        <div className="flex items-center gap-1.5 md:hidden">
          <Link href="/login" className="btn-ghost btn-sm !px-2.5">
            Sign in
          </Link>
          <button
            type="button"
            className="btn-ghost !min-h-[40px] !px-2.5"
            onClick={() => setOpen((o) => !o)}
            aria-expanded={open}
            aria-controls="landing-menu"
            aria-label={open ? "Close menu" : "Open menu"}
          >
            {open ? <X size={20} aria-hidden="true" /> : <Menu size={20} aria-hidden="true" />}
          </button>
        </div>
      </div>

      {open && (
        <nav
          id="landing-menu"
          aria-label="Mobile"
          className="border-t border-line bg-surface px-4 pb-4 pt-1 shadow-sm md:hidden"
        >
          <ul className="flex flex-col divide-y divide-line">
            {LINKS.map((l) => (
              <li key={l.href}>
                <a
                  href={l.href}
                  onClick={() => setOpen(false)}
                  className="flex min-h-[44px] items-center text-sm font-medium text-ink"
                >
                  {l.label}
                </a>
              </li>
            ))}
          </ul>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <Link href="/login" onClick={() => setOpen(false)} className="btn-secondary btn-sm">
              Sign in
            </Link>
            <Link href="/signup" onClick={() => setOpen(false)} className="btn-primary btn-sm">
              Create account
            </Link>
          </div>
        </nav>
      )}
    </header>
  );
}
