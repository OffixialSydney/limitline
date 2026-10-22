"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Check, OctagonAlert, TriangleAlert, Info, RefreshCw } from "lucide-react";
import { markAllNotificationsRead, markNotificationRead, refreshAlerts } from "@/features/notifications/actions";
import { FormMessage } from "@/components/ui/FormMessage";

export interface AlertItem { id: string; challengeId: string | null; severity: "info" | "warning" | "critical"; title: string; message: string; createdAt: string; readAt: string | null; when: string }
const ICON = { critical: OctagonAlert, warning: TriangleAlert, info: Info } as const;
const COLOR = { critical: "text-critical", warning: "text-warning", info: "text-accent" } as const;
const WORD = { critical: "Critical", warning: "Warning", info: "Notice" } as const;

export function AlertControls({ unread }: { unread: number }) {
  const router = useRouter();
  const [msg, setMsg] = useState<{ ok: boolean; message: string } | null>(null);
  const [pending, start] = useTransition();
  const run = (fn: () => Promise<{ ok: boolean; message: string }>) => start(async () => { const r = await fn(); setMsg(r); router.refresh(); });
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        <button type="button" className="btn-secondary" disabled={pending} onClick={() => run(refreshAlerts)}><RefreshCw size={15} aria-hidden="true" />Check recorded data</button>
        <button type="button" className="btn-secondary" disabled={pending || unread === 0} onClick={() => run(markAllNotificationsRead)}><Check size={15} aria-hidden="true" />Mark all read</button>
      </div>
      <FormMessage state={msg} />
    </div>
  );
}

export function AlertList({ items }: { items: AlertItem[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  if (items.length === 0) return <p className="px-4 py-10 text-center text-sm text-muted">No alerts yet. Alerts are created when your recorded data crosses a configured threshold.</p>;
  return (
    <ul className="divide-y divide-line">
      {items.map((a) => {
        const Icon = ICON[a.severity];
        return (
          <li key={a.id} className={`flex gap-3 px-4 py-4 ${a.readAt ? "" : "bg-accent/[0.04]"}`}>
            <Icon size={18} className={`mt-0.5 shrink-0 ${COLOR[a.severity]}`} aria-hidden="true" />
            <div className="min-w-0 flex-1 text-sm">
              <p className="font-medium"><span className="sr-only">{WORD[a.severity]}{a.readAt ? "" : ", unread"}: </span>{a.title}</p>
              <p className="mt-0.5 text-muted">{a.message}</p>
              <p className="mt-1 flex flex-wrap items-center gap-x-3 text-xs text-muted"><time dateTime={a.createdAt}>{a.when}</time>{a.challengeId && <Link href={`/app/challenges/${a.challengeId}`} className="link">Open account</Link>}</p>
            </div>
            {!a.readAt && <button type="button" disabled={pending} className="btn-ghost btn-sm shrink-0" onClick={() => start(async () => { await markNotificationRead(a.id); router.refresh(); })}>Mark read</button>}
          </li>
        );
      })}
    </ul>
  );
}
