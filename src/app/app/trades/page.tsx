import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/ui/PageHeader";
import { EmptyState, ErrorState } from "@/components/ui/EmptyState";
import { RecordButtons, EditTradeButton, type ChallengeOption } from "@/components/trades/RecordForms";
import { DeleteButton } from "@/components/trades/DeleteButton";
import { requireSession } from "@/lib/server/context";
import { addDays, wallTimeToUtc } from "@/lib/calculations/time";
import { formatDateTime, formatMoneyString, formatNumber, toLocalInputValue } from "@/lib/formatting";
import { EVENT_LABEL } from "@/lib/status";
import type { BalanceEventRow, SnapshotRow, TradeRow } from "@/types/db";
import type { TradeFormInput } from "@/lib/validation/records";

export const metadata: Metadata = { title: "Records" };
export const dynamic = "force-dynamic";
const PAGE_SIZE = 25;
type SP = { tab?: string; q?: string; challenge?: string; from?: string; to?: string; sort?: string; dir?: string; page?: string };

export default async function RecordsPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const { supabase, profile, prefs } = await requireSession();
  const tab = sp.tab === "events" || sp.tab === "snapshots" ? sp.tab : "trades";
  const page = Math.max(1, Number.parseInt(sp.page ?? "1", 10) || 1);
  const asc = sp.dir === "asc";
  const { data: ch } = await supabase.from("challenges").select("id, name, account_currency, status").order("name").limit(500);
  const challenges = (ch ?? []) as { id: string; name: string; account_currency: string; status: string }[];
  const options: ChallengeOption[] = challenges.filter((c) => c.status !== "archived").map((c) => ({ id: c.id, name: c.name, currency: c.account_currency }));
  const nameOf = new Map(challenges.map((c) => [c.id, c]));
  const nowLocal = toLocalInputValue(new Date(), prefs.timeZone);
  const isDate = (v?: string) => !!v && /^\d{4}-\d{2}-\d{2}$/.test(v);
  const fromIso = isDate(sp.from) ? wallTimeToUtc(sp.from!, "00:00", prefs.timeZone).toISOString() : null;
  const toIso = isDate(sp.to) ? wallTimeToUtc(addDays(sp.to!, 1), "00:00", prefs.timeZone).toISOString() : null;
  const challengeId = sp.challenge && nameOf.has(sp.challenge) ? sp.challenge : null;
  const range: [number, number] = [(page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1];
  const time = tab === "trades" ? "entry_time" : tab === "events" ? "occurred_at" : "observed_at";

  let rows: unknown[] = [], count = 0, failed = false;
  const apply = <T extends { eq: (c: string, v: string) => T; gte: (c: string, v: string) => T; lt: (c: string, v: string) => T }>(q: T): T => {
    let r = q;
    if (challengeId) r = r.eq("challenge_id", challengeId);
    if (fromIso) r = r.gte(time, fromIso);
    if (toIso) r = r.lt(time, toIso);
    return r;
  };
  if (tab === "trades") {
    let q = apply(supabase.from("trades").select("*", { count: "exact" }));
    const needle = (sp.q ?? "").replace(/[%,()*]/g, "").trim();
    if (needle) q = q.ilike("instrument", `%${needle}%`);
    const sortCol = sp.sort === "net_pnl" ? "net_pnl" : sp.sort === "instrument" ? "instrument" : "entry_time";
    const res = await q.order(sortCol, { ascending: asc }).order("id").range(...range);
    failed = !!res.error; rows = res.data ?? []; count = res.count ?? 0;
  } else if (tab === "events") {
    const res = await apply(supabase.from("balance_events").select("*", { count: "exact" })).order("occurred_at", { ascending: asc }).order("id").range(...range);
    failed = !!res.error; rows = res.data ?? []; count = res.count ?? 0;
  } else {
    const res = await apply(supabase.from("account_snapshots").select("*", { count: "exact" })).order("observed_at", { ascending: asc }).order("id").range(...range);
    failed = !!res.error; rows = res.data ?? []; count = res.count ?? 0;
  }
  const pages = Math.max(1, Math.ceil(count / PAGE_SIZE));
  const qs = (over: Partial<SP>) => { const p = new URLSearchParams(); for (const [k, v] of Object.entries({ ...sp, ...over })) if (v) p.set(k, String(v)); return `/app/trades?${p.toString()}`; };
  const money = (v: string | number | null, id: string) => formatMoneyString(v, nameOf.get(id)?.account_currency ?? profile.preferred_currency, prefs.locale);
  const tradeDefaults = (t: TradeRow): TradeFormInput => ({
    id: t.id, challengeId: t.challenge_id, instrument: t.instrument, direction: t.direction, entryTime: toLocalInputValue(t.entry_time, prefs.timeZone),
    exitTime: t.exit_time ? toLocalInputValue(t.exit_time, prefs.timeZone) : "", entryPrice: t.entry_price?.toString() ?? "", exitPrice: t.exit_price?.toString() ?? "",
    stopLoss: t.stop_loss?.toString() ?? "", takeProfit: t.take_profit?.toString() ?? "", positionSize: t.position_size?.toString() ?? "",
    grossPnl: t.gross_pnl?.toString() ?? "", costs: t.costs?.toString() ?? "", netPnl: t.net_pnl?.toString() ?? "", notes: t.notes ?? "",
  });
  const tabs: [string, string][] = [["trades", "Trades"], ["events", "Balance events"], ["snapshots", "Observations"]];

  return (
    <>
      <PageHeader title="Records" description="Everything here is entered by you. Trade results are labelled as manually recorded, and observations are not live broker data."
        actions={<RecordButtons options={options} {...(challengeId ? { challengeId } : {})} nowLocal={nowLocal} timeZone={prefs.timeZone} />} />
      <nav aria-label="Record types" className="mb-4 flex gap-1 overflow-x-auto border-b border-line">
        {tabs.map(([k, l]) => <Link key={k} href={qs({ tab: k, page: "1", q: "", sort: "" })} aria-current={tab === k ? "page" : undefined} className={`-mb-px min-h-[44px] whitespace-nowrap border-b-2 px-4 py-3 text-sm font-medium ${tab === k ? "border-accent text-accent" : "border-transparent text-muted hover:text-ink"}`}>{l}</Link>)}
      </nav>

      <form method="get" className="panel mb-4 grid grid-cols-2 gap-3 p-4 lg:grid-cols-[repeat(5,minmax(0,1fr))_auto]">
        <input type="hidden" name="tab" value={tab} />
        {tab === "trades" && <div className="col-span-2 lg:col-span-1"><label htmlFor="f-q" className="label">Instrument</label><input id="f-q" name="q" defaultValue={sp.q ?? ""} className="input" placeholder="Search" /></div>}
        <div><label htmlFor="f-ch" className="label">Account</label><select id="f-ch" name="challenge" defaultValue={challengeId ?? ""} className="input"><option value="">All accounts</option>{challenges.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
        <div><label htmlFor="f-from" className="label">From</label><input id="f-from" type="date" name="from" defaultValue={sp.from ?? ""} className="input" /></div>
        <div><label htmlFor="f-to" className="label">To</label><input id="f-to" type="date" name="to" defaultValue={sp.to ?? ""} className="input" /></div>
        {tab === "trades" && <div><label htmlFor="f-sort" className="label">Sort</label><select id="f-sort" name="sort" defaultValue={sp.sort ?? ""} className="input"><option value="">Entry time</option><option value="net_pnl">Net result</option><option value="instrument">Instrument</option></select></div>}
        <div><label htmlFor="f-dir" className="label">Order</label><select id="f-dir" name="dir" defaultValue={asc ? "asc" : "desc"} className="input"><option value="desc">Newest / highest first</option><option value="asc">Oldest / lowest first</option></select></div>
        <div className="col-span-2 flex items-end gap-2 lg:col-span-1"><button type="submit" className="btn-primary flex-1">Apply</button><Link href={`/app/trades?tab=${tab}`} className="btn-secondary">Clear</Link></div>
      </form>

      {failed ? <ErrorState title="Records could not be loaded">Nothing has been changed. Try again in a moment.</ErrorState> : (
        <section className="panel" aria-label={tabs.find(([k]) => k === tab)?.[1]}>
          {rows.length === 0 ? (
            <EmptyState title={tab === "trades" ? "No trades recorded for this account." : tab === "events" ? "No balance events recorded." : "No observations recorded."}>
              {options.length === 0 ? "Create a challenge first, then record trades, balance events and observations against it." : "Use the buttons above to add a record, or widen the filters."}
            </EmptyState>
          ) : tab === "trades" ? (
            <>
              <div className="hidden overflow-x-auto md:block">
                <table className="w-full min-w-[820px] text-left">
                  <caption className="sr-only">Recorded trades. Results are entered manually.</caption>
                  <thead className="border-b border-line bg-sunken/60"><tr>
                    <th scope="col" className="th">Entry</th><th scope="col" className="th">Account</th><th scope="col" className="th">Instrument</th><th scope="col" className="th">Side</th>
                    <th scope="col" className="th text-right">Size</th><th scope="col" className="th text-right">Net result (manual)</th><th scope="col" className="th"><span className="sr-only">Actions</span></th></tr></thead>
                  <tbody className="divide-y divide-line">
                    {(rows as TradeRow[]).map((t) => (
                      <tr key={t.id}>
                        <td className="td whitespace-nowrap text-xs">{formatDateTime(t.entry_time, prefs)}</td>
                        <td className="td"><Link href={`/app/challenges/${t.challenge_id}`} className="hover:underline">{nameOf.get(t.challenge_id)?.name ?? "Unknown"}</Link></td>
                        <td className="td font-medium">{t.instrument}</td><td className="td capitalize">{t.direction}</td>
                        <td className="td num text-right">{formatNumber(t.position_size, prefs.locale, 4)}</td>
                        <td className={`td num text-right ${Number(t.net_pnl) < 0 ? "text-critical" : Number(t.net_pnl) > 0 ? "text-positive" : ""}`}>{t.net_pnl === null ? <span className="text-muted">Not entered</span> : money(t.net_pnl, t.challenge_id)}</td>
                        <td className="td"><div className="flex justify-end gap-2"><EditTradeButton options={options} defaults={tradeDefaults(t)} /><DeleteButton kind="trade" id={t.id} /></div></td>
                      </tr>))}
                  </tbody>
                </table>
              </div>
              <ul className="divide-y divide-line md:hidden">
                {(rows as TradeRow[]).map((t) => (
                  <li key={t.id} className="space-y-2 px-4 py-4">
                    <div className="flex items-baseline justify-between gap-3"><p className="font-medium">{t.instrument} <span className="font-normal capitalize text-muted">{t.direction}</span></p>
                      <p className={`num font-medium ${Number(t.net_pnl) < 0 ? "text-critical" : Number(t.net_pnl) > 0 ? "text-positive" : ""}`}>{t.net_pnl === null ? <span className="text-sm font-normal text-muted">No result</span> : money(t.net_pnl, t.challenge_id)}</p></div>
                    <p className="text-xs text-muted">{nameOf.get(t.challenge_id)?.name ?? "Unknown"} · {formatDateTime(t.entry_time, prefs)}{t.position_size !== null ? ` · size ${formatNumber(t.position_size, prefs.locale, 4)}` : ""}</p>
                    <div className="flex gap-2"><EditTradeButton options={options} defaults={tradeDefaults(t)} /><DeleteButton kind="trade" id={t.id} /></div>
                  </li>))}
              </ul>
            </>
          ) : tab === "events" ? (
            <ul className="divide-y divide-line">
              {(rows as BalanceEventRow[]).map((e) => (
                <li key={e.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-sm">
                  <div><p className="font-medium">{EVENT_LABEL[e.event_type]} <span className="num font-normal">{money(e.amount, e.challenge_id)}</span></p>
                    <p className="text-xs text-muted">{nameOf.get(e.challenge_id)?.name ?? "Unknown"} · {formatDateTime(e.occurred_at, prefs)}{e.notes ? ` · ${e.notes}` : ""}</p></div>
                  <DeleteButton kind="event" id={e.id} />
                </li>))}
            </ul>
          ) : (
            <ul className="divide-y divide-line">
              {(rows as SnapshotRow[]).map((s) => (
                <li key={s.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-sm">
                  <div><p className="num font-medium">{s.balance !== null ? `Balance ${money(s.balance, s.challenge_id)}` : ""}{s.balance !== null && s.equity !== null ? " · " : ""}{s.equity !== null ? `Equity ${money(s.equity, s.challenge_id)}` : ""}</p>
                    <p className="text-xs text-muted">{nameOf.get(s.challenge_id)?.name ?? "Unknown"} · {formatDateTime(s.observed_at, prefs)} · {s.source === "manual" ? "Manual observation" : s.source}{s.notes ? ` · ${s.notes}` : ""}</p></div>
                  <DeleteButton kind="snapshot" id={s.id} />
                </li>))}
            </ul>
          )}
          {count > PAGE_SIZE && (
            <nav aria-label="Pagination" className="flex items-center justify-between border-t border-line px-4 py-3 text-sm">
              {page > 1 ? <Link href={qs({ page: String(page - 1) })} className="btn-secondary btn-sm">Previous</Link> : <span />}
              <span className="text-muted" role="status">Page {page} of {pages} · {count} records</span>
              {page < pages ? <Link href={qs({ page: String(page + 1) })} className="btn-secondary btn-sm">Next</Link> : <span />}
            </nav>)}
        </section>
      )}
    </>
  );
}
