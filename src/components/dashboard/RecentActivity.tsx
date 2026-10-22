import Link from "next/link";
import type { AuditRow } from "@/types/db";
import { AUDIT_TEXT } from "@/lib/server/audit";
import { formatDateTime, formatRelative, type FormatPrefs } from "@/lib/formatting";

export function ActivityList({ rows, prefs, names }: { rows: AuditRow[]; prefs: FormatPrefs; names?: Map<string, string> }) {
  if (rows.length === 0) return <p className="px-4 py-6 text-sm text-muted">No activity recorded yet.</p>;
  return (
    <ol className="divide-y divide-line">
      {rows.map((r) => {
        const summary = typeof r.details?.summary === "string" ? r.details.summary : null;
        const name = r.challenge_id ? names?.get(r.challenge_id) : null;
        return (
          <li key={r.id} className="flex items-start justify-between gap-3 px-4 py-3 text-sm">
            <div className="min-w-0">
              <p className="font-medium">{AUDIT_TEXT[r.action] ?? r.action}{summary ? <span className="font-normal text-muted"> · {summary}</span> : null}</p>
              {name && r.challenge_id && <Link href={`/app/challenges/${r.challenge_id}`} className="text-xs text-muted hover:underline">{name}</Link>}
            </div>
            <time dateTime={r.created_at} title={formatDateTime(r.created_at, prefs)} className="shrink-0 text-xs text-muted">{formatRelative(r.created_at)}</time>
          </li>
        );
      })}
    </ol>
  );
}

export function RecentActivity({ rows, prefs, names }: { rows: AuditRow[]; prefs: FormatPrefs; names: Map<string, string> }) {
  return (
    <section aria-labelledby="activity-h" className="panel">
      <h2 id="activity-h" className="border-b border-line px-4 py-3 text-sm font-semibold">Recent activity</h2>
      <ActivityList rows={rows} prefs={prefs} names={names} />
    </section>
  );
}
