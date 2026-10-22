import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/ui/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { Calculator, type CalcAccount } from "@/components/calculator/Calculator";
import { requireSession } from "@/lib/server/context";
import { loadChallengeViews } from "@/lib/server/evaluate";

export const metadata: Metadata = { title: "Calculator" };
export const dynamic = "force-dynamic";

export default async function CalculatorPage() {
  const { supabase, profile, prefs } = await requireSession();
  const { views } = await loadChallengeViews(supabase, profile, { includeArchived: false });
  const accounts: CalcAccount[] = views.filter((v) => v.status === "active").map((v) => ({
    id: v.id, name: v.name, currency: v.currency,
    baseCents: v.balanceCents ?? v.startingCents, baseLabel: v.balanceCents !== null ? "Current balance" : "Starting balance",
    dailyRemaining: v.daily?.remainingCents ?? null, overallRemaining: v.overall?.remainingCents ?? null,
  }));
  return (
    <>
      <PageHeader title="Risk calculator" description="Plan a hypothetical trade and see how it would sit against your recorded allowances. Nothing here is recorded or executed." />
      {accounts.length === 0
        ? <div className="panel"><EmptyState title="No active challenges" action={<Link href="/app/challenges/new" className="btn-primary">New challenge</Link>}>Create a challenge to plan trades against its limits.</EmptyState></div>
        : <Calculator accounts={accounts} locale={prefs.locale} />}
    </>
  );
}
