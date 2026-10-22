"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowDown, ArrowUp, Pencil, Plus, Search, ArchiveRestore, Archive } from "lucide-react";
import type { ChallengeView, LossView } from "@/lib/server/evaluate";
import { StatusBadge, ChallengeStatusBadge } from "@/components/ui/StatusBadge";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { EmptyState } from "@/components/ui/EmptyState";
import { ConfirmButton } from "@/components/ui/ConfirmButton";
import { archiveChallenge, restoreChallenge } from "@/features/challenges/actions";
import { formatDateTime, formatMoney, formatPercent, formatRelative } from "@/lib/formatting";
import { PHASE_LABEL } from "@/lib/status";
import { statusRank } from "@/lib/calculations/engine";

type SortKey = "updated" | "name" | "balance" | "progress" | "status";
const SORTS: [SortKey, string][] = [["updated", "Last updated"], ["name", "Name"], ["balance", "Balance"], ["progress", "Target progress"], ["status", "Needs attention first"]];

function LossCell({ v, currency, locale }: { v: LossView | null; currency: string; locale: string }) {
  if (!v) return <span className="text-xs text-muted">Not configured</span>;
  return (
    <div title={v.reason ?? undefined}>
      <StatusBadge status={v.status} />
      {v.remainingCents !== null && (
        <p className="num mt-1 text-xs text-muted">{v.remainingCents <= 0 ? "No room left" : `${formatMoney(v.remainingCents, currency, locale)} left`}</p>
      )}
    </div>
  );
}

function ProgressCell({ v, locale }: { v: ChallengeView; locale: string }) {
  if (v.progressPercent === null) return <div><ProgressBar value={null} label="Target progress" /><p className="mt-1 text-xs text-muted">{v.targetCents === null ? "No target set" : "Not enough data"}</p></div>;
  return (
    <div>
      <ProgressBar value={v.progressPercent} label={`Target progress for ${v.name}`} tone={v.profitCents !== null && v.profitCents < 0 ? "warning" : "accent"} />
      <p className="num mt-1 text-xs text-muted">{formatPercent(v.progressRaw, locale)}{v.progressRaw !== null && v.progressRaw > 100 ? " (target exceeded)" : ""}</p>
    </div>
  );
}

export function RowActions({ v }: { v: ChallengeView }) {
  return (
    <div className="flex items-center gap-2">
      {v.status !== "archived" && <Link href={`/app/challenges/${v.id}/edit`} className="btn-secondary btn-sm"><Pencil size={14} aria-hidden="true" />Edit</Link>}
      {v.status === "archived" ? (
        <ConfirmButton tone="primary" icon={<ArchiveRestore size={14} aria-hidden="true" />} label="Restore" title={`Restore ${v.name}?`} description="It will return to its previous status." confirmLabel="Restore" action={() => restoreChallenge(v.id)} />
      ) : (
        <ConfirmButton icon={<Archive size={14} aria-hidden="true" />} label="Archive" title={`Archive ${v.name}?`} description="Archiving hides this challenge from the overview. Its trades, observations and history are kept, and you can restore it later." confirmLabel="Archive" action={() => archiveChallenge(v.id)} />
      )}
    </div>
  );
}

export function ChallengeTable({ rows, prefs, variant }: { rows: ChallengeView[]; prefs: { locale: string; timeZone: string }; variant: "overview" | "manage" }) {
  const [q, setQ] = useState("");
  const [firm, setFirm] = useState("all");
  const [phase, setPhase] = useState("all");
  const [status, setStatus] = useState(variant === "overview" ? "all" : "open");
  const [sort, setSort] = useState<SortKey>("updated");
  const [desc, setDesc] = useState(true);
  const firms = useMemo(() => [...new Set(rows.map((r) => r.firmName))].sort(), [rows]);

  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const list = rows.filter((r) =>
      (!needle || r.name.toLowerCase().includes(needle) || r.firmName.toLowerCase().includes(needle)) &&
      (firm === "all" || r.firmName === firm) && (phase === "all" || r.phase === phase) &&
      (status === "all" || (status === "open" ? r.status !== "archived" : r.status === status)));
    const dir = desc ? -1 : 1;
    const key = (r: ChallengeView): number | string => {
      switch (sort) {
        case "name": return r.name.toLowerCase();
        case "balance": return r.balanceCents ?? Number.NEGATIVE_INFINITY;
        case "progress": return r.progressRaw ?? Number.NEGATIVE_INFINITY;
        case "status": return statusRank(r.worst);
        default: return r.updatedAt;
      }
    };
    return [...list].sort((a, b) => (key(a) < key(b) ? -1 : key(a) > key(b) ? 1 : 0) * dir);
  }, [rows, q, firm, phase, status, sort, desc]);

  const manage = variant === "manage";
  const filtered = q || firm !== "all" || phase !== "all" || (status !== "all" && status !== (variant === "overview" ? "all" : "open"));

  return (
    <section aria-labelledby={`tbl-${variant}`} className="panel">
      <div className="flex flex-col gap-3 border-b border-line px-4 py-3">
        <div className="flex items-center justify-between gap-3">
          <h2 id={`tbl-${variant}`} className="text-sm font-semibold">{manage ? "All challenges" : "Accounts"}</h2>
          {!manage && <Link href="/app/challenges" className="link text-sm">Manage</Link>}
        </div>
        <div className="grid grid-cols-2 gap-2 lg:grid-cols-[minmax(180px,1fr)_repeat(4,auto)]">
          <div className="relative col-span-2 lg:col-span-1">
            <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" aria-hidden="true" />
            <label htmlFor={`q-${variant}`} className="sr-only">Search accounts</label>
            <input id={`q-${variant}`} type="search" className="input pl-9" placeholder="Search name or firm" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          <div><label htmlFor={`f-${variant}`} className="sr-only">Prop firm</label>
            <select id={`f-${variant}`} className="input" value={firm} onChange={(e) => setFirm(e.target.value)}><option value="all">All firms</option>{firms.map((f) => <option key={f}>{f}</option>)}</select></div>
          <div><label htmlFor={`p-${variant}`} className="sr-only">Phase</label>
            <select id={`p-${variant}`} className="input" value={phase} onChange={(e) => setPhase(e.target.value)}><option value="all">All phases</option>{Object.entries(PHASE_LABEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></div>
          <div><label htmlFor={`s-${variant}`} className="sr-only">Status</label>
            <select id={`s-${variant}`} className="input" value={status} onChange={(e) => setStatus(e.target.value)}>
              {manage ? <option value="open">Not archived</option> : null}
              <option value="all">{manage ? "Everything" : "All statuses"}</option><option value="active">Active</option><option value="passed">Passed</option><option value="failed">Failed</option>{manage && <option value="archived">Archived</option>}
            </select></div>
          <div className="flex gap-1"><label htmlFor={`o-${variant}`} className="sr-only">Sort by</label>
            <select id={`o-${variant}`} className="input" value={sort} onChange={(e) => setSort(e.target.value as SortKey)}>{SORTS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
            <button type="button" className="btn-secondary !px-3" onClick={() => setDesc((d) => !d)} aria-label={desc ? "Sorted descending. Switch to ascending" : "Sorted ascending. Switch to descending"}>
              {desc ? <ArrowDown size={16} aria-hidden="true" /> : <ArrowUp size={16} aria-hidden="true" />}
            </button></div>
        </div>
        <p className="text-xs text-muted" role="status">{shown.length} of {rows.length} shown</p>
      </div>

      {shown.length === 0 ? (
        rows.length === 0 ? (
          <EmptyState title="No challenges yet" action={<Link href="/app/challenges/new" className="btn-primary"><Plus size={16} aria-hidden="true" />New challenge</Link>}>
            Create your first challenge to begin tracking your configured rules.
          </EmptyState>
        ) : (
          <EmptyState title="No accounts match" action={filtered ? <button type="button" className="btn-secondary" onClick={() => { setQ(""); setFirm("all"); setPhase("all"); setStatus(variant === "overview" ? "all" : "open"); }}>Clear filters</button> : undefined}>Try a different search or clear the filters.</EmptyState>
        )
      ) : (
        <>
          {/* Wide screens: table */}
          <div className="hidden overflow-x-auto md:block">
            <table className="w-full min-w-[860px] text-left">
              <caption className="sr-only">Challenge accounts with balance, target progress and loss-limit status</caption>
              <thead className="border-b border-line bg-sunken/60">
                <tr>
                  <th scope="col" className="th">Account</th><th scope="col" className="th">Balance</th>
                  <th scope="col" className="th min-w-[130px]">Target progress</th><th scope="col" className="th">Daily loss</th>
                  <th scope="col" className="th">Overall loss</th><th scope="col" className="th">Status</th>
                  <th scope="col" className="th">Updated</th>{manage && <th scope="col" className="th"><span className="sr-only">Actions</span></th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {shown.map((v) => (
                  <tr key={v.id} className="align-top hover:bg-sunken/40">
                    <td className="td"><Link href={`/app/challenges/${v.id}`} className="font-medium text-ink hover:underline">{v.name}</Link>
                      <p className="text-xs text-muted">{v.firmName} · {PHASE_LABEL[v.phase] ?? v.phase}</p></td>
                    <td className="td"><p className="num">{v.balanceCents === null ? <span className="text-muted">No data</span> : formatMoney(v.balanceCents, v.currency, prefs.locale)}</p>
                      <p className="num text-xs text-muted">{v.balanceSource === "derived" ? "Derived from records" : v.equityCents !== null ? `Equity ${formatMoney(v.equityCents, v.currency, prefs.locale)}` : `Start ${formatMoney(v.startingCents, v.currency, prefs.locale)}`}</p></td>
                    <td className="td"><ProgressCell v={v} locale={prefs.locale} /></td>
                    <td className="td"><LossCell v={v.daily} currency={v.currency} locale={prefs.locale} /></td>
                    <td className="td"><LossCell v={v.overall} currency={v.currency} locale={prefs.locale} /></td>
                    <td className="td"><ChallengeStatusBadge status={v.status} /></td>
                    <td className="td whitespace-nowrap text-xs text-muted" title={v.lastObservedAt ? `Last observation ${formatDateTime(v.lastObservedAt, prefs)}` : "No observations recorded"}>
                      {v.lastObservedAt ? formatRelative(v.lastObservedAt) : "No observations"}</td>
                    {manage && <td className="td"><RowActions v={v} /></td>}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {/* Narrow screens: purpose-built rows, not a squeezed table */}
          <ul className="divide-y divide-line md:hidden">
            {shown.map((v) => (
              <li key={v.id} className="space-y-3 px-4 py-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0"><Link href={`/app/challenges/${v.id}`} className="block truncate font-medium hover:underline">{v.name}</Link>
                    <p className="text-xs text-muted">{v.firmName} · {PHASE_LABEL[v.phase] ?? v.phase}</p></div>
                  <ChallengeStatusBadge status={v.status} />
                </div>
                <div className="flex items-baseline justify-between gap-3">
                  <p className="num text-lg font-semibold">{v.balanceCents === null ? <span className="text-sm font-normal text-muted">No balance data</span> : formatMoney(v.balanceCents, v.currency, prefs.locale)}</p>
                  <p className="text-xs text-muted">{v.lastObservedAt ? `Observed ${formatRelative(v.lastObservedAt)}` : "No observations"}</p>
                </div>
                <ProgressCell v={v} locale={prefs.locale} />
                <div className="grid grid-cols-2 gap-3">
                  <div><p className="mb-1 text-xs font-medium text-muted">Daily loss</p><LossCell v={v.daily} currency={v.currency} locale={prefs.locale} /></div>
                  <div><p className="mb-1 text-xs font-medium text-muted">Overall loss</p><LossCell v={v.overall} currency={v.currency} locale={prefs.locale} /></div>
                </div>
                {manage && <RowActions v={v} />}
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
