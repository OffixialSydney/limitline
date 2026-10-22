import type { Metadata } from "next";
import Link from "next/link";
import { Plus } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { SummaryStrip } from "@/components/dashboard/SummaryStrip";
import { ChallengeTable } from "@/components/dashboard/ChallengeTable";
import { AttentionPanel } from "@/components/dashboard/AttentionPanel";
import { RecentActivity } from "@/components/dashboard/RecentActivity";
import { PerformanceChart, type ChartPoint } from "@/components/dashboard/PerformanceChart";
import { requireSession } from "@/lib/server/context";
import { loadChallengeViews } from "@/lib/server/evaluate";
import { formatDate } from "@/lib/formatting";
import { parseMoney } from "@/lib/calculations/money";
import type { AuditRow, SnapshotRow } from "@/types/db";

export const metadata: Metadata = { title: "Overview" };
export const dynamic = "force-dynamic";

const RANGES: Record<string, { days: number | null; label: string }> = {
  "7d": { days: 7, label: "Last 7 days" }, "30d": { days: 30, label: "Last 30 days" }, "90d": { days: 90, label: "Last 90 days" }, all: { days: null, label: "All recorded time" },
};

export default async function OverviewPage({ searchParams }: { searchParams: Promise<{ c?: string; measure?: string; range?: string }> }) {
  const sp = await searchParams;
  const { supabase, profile, prefs } = await requireSession();
  const { views } = await loadChallengeViews(supabase, profile, { includeArchived: false });
  const measure = sp.measure === "equity" ? "equity" : "balance";
  const range = RANGES[sp.range ?? ""] ? (sp.range as string) : "30d";
  const selected = views.find((v) => v.id === sp.c) ?? views.find((v) => v.status === "active") ?? views[0];

  let points: ChartPoint[] = [];
  let truncated = false;
  if (selected) {
    const days = RANGES[range]!.days;
    let q = supabase.from("account_snapshots").select("balance, equity, observed_at").eq("challenge_id", selected.id).order("observed_at", { ascending: false }).limit(1000);
    if (days) q = q.gte("observed_at", new Date(Date.now() - days * 86400000).toISOString());
    const { data } = await q;
    const rows = ((data ?? []) as Pick<SnapshotRow, "balance" | "equity" | "observed_at">[]).reverse();
    truncated = rows.length === 1000;
    points = rows.map((r) => {
      const cents = parseMoney(measure === "balance" ? r.balance : r.equity);
      return { t: new Date(r.observed_at).getTime(), value: cents === null ? null : cents / 100 };
    });
  }
  const { data: audit } = await supabase.from("audit_logs").select("id, challenge_id, action, entity_type, entity_id, details, created_at").order("created_at", { ascending: false }).limit(8);
  const names = new Map(views.map((v) => [v.id, v.name]));

  return (
    <>
      <PageHeader title="Overview" description={`Based on the values you have recorded. Reporting date ${formatDate(new Date(), prefs)}.`}
        actions={<Link href="/app/challenges/new" className="btn-primary"><Plus size={16} aria-hidden="true" />New challenge</Link>} />
      <div className="space-y-6">
        <SummaryStrip views={views} locale={prefs.locale} />
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
          <div className="min-w-0 space-y-6">
            <ChallengeTable rows={views} prefs={prefs} variant="overview" />
            {selected && (
              <PerformanceChart points={points} options={views.map((v) => ({ id: v.id, name: v.name }))} selected={selected.id} measure={measure} range={range}
                currency={selected.currency} locale={prefs.locale} timeZone={prefs.timeZone} startingBalance={selected.startingCents / 100} truncated={truncated} rangeLabel={RANGES[range]!.label} />
            )}
          </div>
          <div className="space-y-6">
            <AttentionPanel views={views} />
            <RecentActivity rows={(audit ?? []) as AuditRow[]} prefs={prefs} names={names} />
          </div>
        </div>
      </div>
    </>
  );
}
