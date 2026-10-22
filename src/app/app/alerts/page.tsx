import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/ui/PageHeader";
import { AlertControls, AlertList, type AlertItem } from "@/components/alerts/AlertList";
import { requireSession } from "@/lib/server/context";
import { formatDateTime } from "@/lib/formatting";
import type { NotificationRow } from "@/types/db";

export const metadata: Metadata = { title: "Alerts" };
export const dynamic = "force-dynamic";

export default async function AlertsPage() {
  const { supabase, prefs, profile } = await requireSession();
  const { data, error } = await supabase.from("notifications").select("id, challenge_id, notification_type, severity, title, message, calculated_at, read_at, created_at").order("created_at", { ascending: false }).limit(100);
  const rows = (data ?? []) as NotificationRow[];
  const unread = rows.filter((r) => !r.read_at).length;
  const items: AlertItem[] = rows.map((r) => ({ id: r.id, challengeId: r.challenge_id, severity: r.severity, title: r.title, message: r.message, createdAt: r.created_at, readAt: r.read_at, when: formatDateTime(r.created_at, prefs) }));
  return (
    <>
      <PageHeader title="Alerts" description="In-app alerts created from your recorded data. This is not real-time protection: an alert only appears after you record or re-check data."
        actions={<span className="text-sm text-muted">Warning threshold {profile.warning_threshold_pct}% · <Link href="/app/settings" className="link">change</Link></span>} />
      <div className="mb-4"><AlertControls unread={unread} /></div>
      <section className="panel" aria-label="Alert list">
        {error ? <p role="alert" className="px-4 py-6 text-sm text-critical">Alerts could not be loaded. Nothing has been changed.</p> : <AlertList items={items} />}
      </section>
    </>
  );
}
