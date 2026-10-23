"use client";
import { useState } from "react";
import Link from "next/link";
import { Menu, X } from "lucide-react";
import { Wordmark } from "@/components/brand/Logo";

const LINKS = [
  { href: "#features", label: "Features" },
  { href: "#how-it-works", label: "How It Works" },
  { href: "#about", label: "About" },
] as const;

export function LandingNav() {
  const [open, setOpen] = useState(false);
  return (
    <header className="sticky top-0 z-40 border-b border-line bg-paper/95 pt-[env(safe-area-inset-top)] backdrop-blur">
      <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link href="/" aria-label="Limitline home"><Wordmark /></Link>

        <nav aria-label="Main" className="hidden items-center gap-1 md:flex">
          {LINKS.map((l) => (
            <a key={l.href} href={l.href} className="rounded-control px-3 py-2 text-sm font-medium text-ink hover:bg-sunken">{l.label}</a>
          ))}
        </nav>

        <div className="hidden items-center gap-2 md:flex">
          <Link href="/login" className="btn-ghost">Sign In</Link>
          <Link href="/signup" className="btn-primary">Get Started</Link>
        </div>

        <button type="button" className="btn-ghost !px-3 md:hidden" onClick={() => setOpen((o) => !o)}
          aria-expanded={open} aria-controls="landing-menu" aria-label={open ? "Close menu" : "Open menu"}>
          {open ? <X size={22} aria-hidden="true" /> : <Menu size={22} aria-hidden="true" />}
        </button>
      </div>

      {open && (
        <nav id="landing-menu" aria-label="Mobile" className="border-t border-line bg-paper px-4 pb-4 pt-2 md:hidden">
          <ul className="flex flex-col">
            {LINKS.map((l) => (
              <li key={l.href}>
                <a href={l.href} onClick={() => setOpen(false)} className="flex min-h-[48px] items-center border-b border-line text-base font-medium">{l.label}</a>
              </li>
            ))}
          </ul>
          <div className="mt-4 grid grid-cols-2 gap-2">
            <Link href="/login" className="btn-secondary">Sign In</Link>
            <Link href="/signup" className="btn-primary">Get Started</Link>
          </div>
        </nav>
      )}
    </header>
  );
}
