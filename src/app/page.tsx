import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ClipboardList, Gauge, NotebookPen, ScrollText } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Wordmark } from "@/components/brand/Logo";
import { LandingNav } from "@/components/landing/LandingNav";
import { ProductPreview } from "@/components/landing/ProductPreview";

export const metadata: Metadata = {
  title: { absolute: "Limitline: know where you stand" },
  description: "Keep your challenge accounts, configured rules and trading activity organised in one clear workspace.",
};

const FEATURES = [
  { Icon: ClipboardList, title: "Challenge Tracking", text: "Organise every evaluation account in one place and follow progress toward each profit target." },
  { Icon: Gauge, title: "Rule Awareness", text: "See how much of your configured daily and overall loss allowance remains, and which requirements are still open." },
  { Icon: NotebookPen, title: "Activity Journal", text: "Record trades, balance events and account observations, and review them whenever you need." },
  { Icon: ScrollText, title: "Clear Reporting", text: "Review account history and the performance data you have recorded, with the basis of each figure explained." },
] as const;

const STEPS = [
  { n: "01", title: "Create an account and set up a challenge", text: "Add your account details and starting balance." },
  { n: "02", title: "Configure the rules and record activity", text: "Enter the rules your firm sets, then log trades and observations as they happen." },
  { n: "03", title: "Review progress and monitor your limits", text: "See progress, remaining allowance and how recent your data is." },
] as const;

export default async function Home() {
  // Signed-in users go straight to their workspace. Visitors see the public page.
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (user) redirect("/app/overview");

  return (
    <div className="min-h-dvh bg-paper">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-50 focus:rounded-control focus:bg-surface focus:px-3 focus:py-2 focus:shadow">Skip to content</a>
      <LandingNav />

      <main id="main">
        <section aria-labelledby="hero-h" className="px-4 pb-16 pt-14 sm:px-6 sm:pt-20 lg:px-8">
          <div className="mx-auto max-w-3xl text-center">
            <h1 id="hero-h" className="text-balance text-4xl font-semibold leading-[1.08] tracking-tight sm:text-5xl lg:text-6xl">
              Know where you stand. Understand your limits.
            </h1>
            <p className="mx-auto mt-5 max-w-xl text-pretty text-base text-muted sm:text-lg">
              Keep your challenge accounts, configured rules, and trading activity organised in one clear workspace.
            </p>
            <div className="mt-8 flex flex-col items-stretch justify-center gap-3 sm:flex-row sm:items-center">
              <Link href="/signup" className="btn-primary min-h-[48px] px-6 text-base">Get Started</Link>
              <a href="#features" className="btn-secondary min-h-[48px] px-6 text-base">Explore the Platform</a>
            </div>
          </div>
          <div className="mt-14"><ProductPreview /></div>
        </section>

        <section id="features" aria-labelledby="features-h" className="scroll-mt-20 border-t border-line px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
          <div className="mx-auto max-w-6xl">
            <h2 id="features-h" className="max-w-xl text-3xl font-semibold tracking-tight sm:text-4xl">Built around your own rules</h2>
            <p className="mt-3 max-w-xl text-muted">Firms define limits differently. Limitline works from the rules you enter, and shows its working.</p>
            <ul className="mt-10 grid gap-x-8 gap-y-10 sm:grid-cols-2 lg:grid-cols-4">
              {FEATURES.map(({ Icon, title, text }) => (
                <li key={title} className="border-t border-ink pt-4">
                  <Icon size={20} className="text-accent" aria-hidden="true" />
                  <h3 className="mt-3 text-base font-semibold">{title}</h3>
                  <p className="mt-1.5 text-sm text-muted">{text}</p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section id="how-it-works" aria-labelledby="how-h" className="scroll-mt-20 border-t border-line bg-sunken/50 px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
          <div className="mx-auto max-w-6xl">
            <h2 id="how-h" className="text-3xl font-semibold tracking-tight sm:text-4xl">How it works</h2>
            <ol className="mt-10 grid gap-8 md:grid-cols-3">
              {STEPS.map((s) => (
                <li key={s.n} className="flex gap-4 md:block">
                  <span className="num text-sm font-medium text-accent">{s.n}</span>
                  <div className="md:mt-3">
                    <h3 className="text-base font-semibold">{s.title}</h3>
                    <p className="mt-1.5 text-sm text-muted">{s.text}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section id="about" aria-labelledby="about-h" className="scroll-mt-20 border-t border-line px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
          <div className="mx-auto grid max-w-6xl gap-8 lg:grid-cols-[1fr_1.4fr]">
            <h2 id="about-h" className="text-3xl font-semibold tracking-tight sm:text-4xl">About Limitline</h2>
            <div className="space-y-4 text-muted">
              <p>Limitline is an organisational and analytical tool for people working through prop firm evaluations. It helps you keep records and see how they compare with the rules you have configured.</p>
              <p>It works from the values you enter. It does not connect to brokers or prop firms, does not show live market or account data, and cannot monitor your account in real time. When information is missing or out of date, it says so instead of guessing.</p>
              <p>Limitline does not give trading or financial advice, and it makes no promise about results.</p>
            </div>
          </div>
        </section>

        <section aria-labelledby="cta-h" className="border-t border-line bg-accent px-4 py-16 text-center text-white sm:px-6 sm:py-20 lg:px-8">
          <div className="mx-auto max-w-2xl">
            <h2 id="cta-h" className="text-3xl font-semibold tracking-tight !text-white sm:text-4xl">Bring clarity to every challenge.</h2>
            <Link href="/signup" className="btn mt-8 min-h-[48px] border-white bg-white px-6 text-base text-accent hover:bg-paper">Create Your Account</Link>
          </div>
        </section>
      </main>

      <footer className="border-t border-line px-4 py-10 sm:px-6 lg:px-8">
        <div className="mx-auto flex max-w-6xl flex-col gap-8 sm:flex-row sm:items-start sm:justify-between">
          <div className="max-w-sm">
            <Wordmark />
            <p className="mt-3 text-sm text-muted">Challenge tracking and rule monitoring for prop firm evaluations. Works from the values you record.</p>
          </div>
          <nav aria-label="Footer" className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
            <Link href="/" className="font-medium hover:underline">Home</Link>
            <Link href="/login" className="font-medium hover:underline">Sign In</Link>
            <Link href="/signup" className="font-medium hover:underline">Create Account</Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}
