"use client";
import { useRef, useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useForm, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Activity, ArrowLeftRight, Landmark, Pencil, type LucideIcon } from "lucide-react";
import { Dialog } from "@/components/ui/Dialog";
import { Field, describedBy } from "@/components/ui/Field";
import { FormMessage } from "@/components/ui/FormMessage";
import { addBalanceEvent, addSnapshot, saveTrade } from "@/features/trading/actions";
import { balanceEventSchema, snapshotSchema, tradeFormSchema, type BalanceEventInput, type SnapshotInput, type TradeFormInput } from "@/lib/validation/records";
import type { ActionResult } from "@/lib/validation/common";

export interface ChallengeOption { id: string; name: string; currency: string }

function useSubmit<T>(action: (v: T) => Promise<ActionResult | ActionResult<unknown>>, onDone: () => void, setFieldError: (k: string, m: string) => void) {
  const router = useRouter();
  const [msg, setMsg] = useState<{ ok: boolean; message: string } | null>(null);
  const [pending, start] = useTransition();
  const busy = useRef(false);
  const submit = (v: T) => {
    if (busy.current) return;
    busy.current = true;
    start(async () => {
      try {
        setMsg(null);
        const r = await action(v);
        if (r.ok) { onDone(); router.refresh(); return; }
        if (r.fieldErrors) for (const [k, m] of Object.entries(r.fieldErrors)) setFieldError(k, m);
        setMsg({ ok: false, message: r.message });
      } catch {
        setMsg({ ok: false, message: "Unable to reach the server. Please check your connection and try again." });
      } finally {
        busy.current = false;
      }
    });
  };
  return { msg, pending, submit };
}

function Actions({ pending, onCancel, label }: { pending: boolean; onCancel: () => void; label: string }) {
  return (
    <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
      <button type="button" className="btn-secondary" onClick={onCancel}>Cancel</button>
      <button type="submit" className="btn-primary" disabled={pending}>{pending ? "Saving…" : label}</button>
    </div>
  );
}

function ChallengeSelect({ id, options, error, register }: { id: string; options: ChallengeOption[]; error?: string | undefined; register: object }) {
  return (
    <Field id={id} label="Challenge account" error={error}>
      <select id={id} className="input" aria-invalid={!!error} aria-describedby={describedBy(id, error)} {...register}>
        {options.map((o) => <option key={o.id} value={o.id}>{o.name} ({o.currency})</option>)}
      </select>
    </Field>
  );
}

export function TradeForm({ options, defaults, onDone, timeZone }: { options: ChallengeOption[]; defaults: TradeFormInput; onDone: () => void; timeZone?: string }) {
  const { register, handleSubmit, setError, formState: { errors } } = useForm<TradeFormInput>({ resolver: zodResolver(tradeFormSchema) as unknown as Resolver<TradeFormInput>, defaultValues: defaults });
  const { msg, pending, submit } = useSubmit<TradeFormInput>(saveTrade, onDone, (k, m) => setError(k as keyof TradeFormInput, { message: m }));
  const e = (k: keyof TradeFormInput) => errors[k]?.message as string | undefined;
  const p = (k: keyof TradeFormInput) => ({ id: `t-${k}`, "aria-invalid": !!errors[k], "aria-describedby": describedBy(`t-${k}`, e(k)), ...register(k) });
  const tzHint = timeZone ? `Timezone: ${timeZone}` : undefined;
  return (
    <form onSubmit={handleSubmit(submit)} noValidate className="space-y-3">
      <ChallengeSelect id="t-challengeId" options={options} error={e("challengeId")} register={register("challengeId")} />
      <div className="grid grid-cols-2 gap-3">
        <Field id="t-instrument" label="Instrument" error={e("instrument")}><input className="input uppercase" autoComplete="off" placeholder="EURUSD" {...p("instrument")} /></Field>
        <Field id="t-direction" label="Direction" error={e("direction")}><select className="input" {...p("direction")}><option value="long">Long</option><option value="short">Short</option></select></Field>
        <Field id="t-entryTime" label="Entry time" error={e("entryTime")} hint={tzHint}><input type="datetime-local" className="input" {...p("entryTime")} /></Field>
        <Field id="t-exitTime" label="Exit time" error={e("exitTime")} hint={tzHint}><input type="datetime-local" className="input" {...p("exitTime")} /></Field>
        <Field id="t-entryPrice" label="Entry price" error={e("entryPrice")}><input className="input num" inputMode="decimal" {...p("entryPrice")} /></Field>
        <Field id="t-exitPrice" label="Exit price" error={e("exitPrice")}><input className="input num" inputMode="decimal" {...p("exitPrice")} /></Field>
        <Field id="t-stopLoss" label="Stop-loss" error={e("stopLoss")}><input className="input num" inputMode="decimal" {...p("stopLoss")} /></Field>
        <Field id="t-takeProfit" label="Take-profit" error={e("takeProfit")}><input className="input num" inputMode="decimal" {...p("takeProfit")} /></Field>
        <Field id="t-positionSize" label="Position size" error={e("positionSize")} hint="Lots or units, as your platform shows"><input className="input num" inputMode="decimal" {...p("positionSize")} /></Field>
        <Field id="t-costs" label="Costs" error={e("costs")} hint="Commission, swap, fees"><input className="input num" inputMode="decimal" {...p("costs")} /></Field>
        <Field id="t-grossPnl" label="Gross result" error={e("grossPnl")}><input className="input num" inputMode="decimal" {...p("grossPnl")} /></Field>
        <Field id="t-netPnl" label="Net result" error={e("netPnl")} hint="Blank = gross − costs"><input className="input num" inputMode="decimal" {...p("netPnl")} /></Field>
      </div>
      <p className="text-xs text-muted">Results are recorded manually in the account currency. Limitline does not work out profit or loss from prices.</p>
      <Field id="t-notes" label="Notes" error={e("notes")}><textarea className="input" rows={2} {...p("notes")} /></Field>
      <FormMessage state={msg} />
      <Actions pending={pending} onCancel={onDone} label={defaults.id ? "Save trade" : "Record trade"} />
    </form>
  );
}

export function EventForm({ options, defaults, onDone, timeZone }: { options: ChallengeOption[]; defaults: BalanceEventInput; onDone: () => void; timeZone?: string }) {
  const { register, handleSubmit, setError, watch, formState: { errors } } = useForm<BalanceEventInput>({ resolver: zodResolver(balanceEventSchema) as unknown as Resolver<BalanceEventInput>, defaultValues: defaults });
  const { msg, pending, submit } = useSubmit<BalanceEventInput>(addBalanceEvent, onDone, (k, m) => setError(k as keyof BalanceEventInput, { message: m }));
  const e = (k: keyof BalanceEventInput) => errors[k]?.message as string | undefined;
  const p = (k: keyof BalanceEventInput) => ({ id: `e-${k}`, "aria-invalid": !!errors[k], "aria-describedby": describedBy(`e-${k}`, e(k)), ...register(k) });
  const cid = watch("challengeId");
  const cur = options.find((o) => o.id === cid)?.currency ?? defaults.currency;
  const tzHint = timeZone ? `Interpreted in your profile timezone (${timeZone})` : undefined;
  return (
    <form onSubmit={handleSubmit((v) => submit({ ...v, currency: cur }))} noValidate className="space-y-3">
      <ChallengeSelect id="e-challengeId" options={options} error={e("challengeId")} register={register("challengeId")} />
      <div className="grid grid-cols-2 gap-3">
        <Field id="e-eventType" label="Type" error={e("eventType")}><select className="input" {...p("eventType")}><option value="deposit">Deposit</option><option value="withdrawal">Withdrawal</option><option value="fee">Fee</option><option value="credit">Credit</option><option value="adjustment">Other adjustment</option></select></Field>
        <Field id="e-amount" label={`Amount (${cur})`} error={e("amount")} hint="Positive. Only adjustments may be negative."><input className="input num" inputMode="decimal" {...p("amount")} /></Field>
      </div>
      <Field id="e-occurredAt" label="Date and time" error={e("occurredAt")} hint={tzHint}><input type="datetime-local" className="input" {...p("occurredAt")} /></Field>
      <p className="text-xs text-muted">These events are kept apart from trading results, so a deposit is never counted as profit.</p>
      <Field id="e-notes" label="Notes" error={e("notes")}><textarea className="input" rows={2} {...p("notes")} /></Field>
      <FormMessage state={msg} />
      <Actions pending={pending} onCancel={onDone} label="Record event" />
    </form>
  );
}

export function SnapshotForm({ options, defaults, onDone, timeZone }: { options: ChallengeOption[]; defaults: SnapshotInput; onDone: () => void; timeZone?: string }) {
  const { register, handleSubmit, setError, formState: { errors } } = useForm<SnapshotInput>({ resolver: zodResolver(snapshotSchema) as unknown as Resolver<SnapshotInput>, defaultValues: defaults });
  const { msg, pending, submit } = useSubmit<SnapshotInput>(addSnapshot, onDone, (k, m) => setError(k as keyof SnapshotInput, { message: m }));
  const e = (k: keyof SnapshotInput) => errors[k]?.message as string | undefined;
  const p = (k: keyof SnapshotInput) => ({ id: `s-${k}`, "aria-invalid": !!errors[k], "aria-describedby": describedBy(`s-${k}`, e(k)), ...register(k) });
  const tzHint = timeZone ? `Interpreted in your profile timezone (${timeZone}). Change in Settings if needed.` : undefined;
  return (
    <form onSubmit={handleSubmit(submit)} noValidate className="space-y-3">
      <ChallengeSelect id="s-challengeId" options={options} error={e("challengeId")} register={register("challengeId")} />
      <div className="grid grid-cols-2 gap-3">
        <Field id="s-balance" label="Balance" error={e("balance")} hint="Closed-trade balance"><input className="input num" inputMode="decimal" {...p("balance")} /></Field>
        <Field id="s-equity" label="Equity" error={e("equity")} hint="Includes open positions"><input className="input num" inputMode="decimal" {...p("equity")} /></Field>
      </div>
      <Field id="s-observedAt" label="Observed at" error={e("observedAt")} hint={tzHint}><input type="datetime-local" className="input" {...p("observedAt")} /></Field>
      <p className="text-xs text-muted">Enter both Balance and Equity whenever possible so balance-based and equity-based loss rules stay synchronized. Limitline does not receive live broker data.</p>
      <Field id="s-notes" label="Notes" error={e("notes")}><textarea className="input" rows={2} {...p("notes")} /></Field>
      <FormMessage state={msg} />
      <Actions pending={pending} onCancel={onDone} label="Record observation" />
    </form>
  );
}

type Kind = "trade" | "event" | "snapshot";
export function RecordButtons({ options, challengeId, nowLocal, timeZone, size = "md" }: { options: ChallengeOption[]; challengeId?: string; nowLocal: string; timeZone?: string; size?: "sm" | "md" }) {
  const [open, setOpen] = useState<Kind | null>(null);
  const close = () => setOpen(null);
  const first = options.find((o) => o.id === challengeId) ?? options[0];
  if (!first) return null;
  const cls = size === "sm" ? "btn-secondary btn-sm" : "btn-secondary";
  const b = (k: Kind, Icon: LucideIcon, label: string) => <button type="button" className={cls} onClick={() => setOpen(k)}><Icon size={15} aria-hidden="true" />{label}</button>;
  return (
    <>
      {b("snapshot", Activity, "Record observation")}{b("trade", ArrowLeftRight, "Record trade")}{b("event", Landmark, "Balance event")}
      <Dialog open={open === "trade"} onClose={close} title="Record trade" wide>
        <TradeForm options={options} onDone={close} {...(timeZone ? { timeZone } : {})} defaults={{ challengeId: first.id, instrument: "", direction: "long", entryTime: nowLocal, exitTime: "", entryPrice: "", exitPrice: "", stopLoss: "", takeProfit: "", positionSize: "", grossPnl: "", costs: "", netPnl: "", notes: "" }} />
      </Dialog>
      <Dialog open={open === "event"} onClose={close} title="Record balance event" description="Deposits, withdrawals, fees, credits and other adjustments.">
        <EventForm options={options} onDone={close} {...(timeZone ? { timeZone } : {})} defaults={{ challengeId: first.id, eventType: "deposit", amount: "", currency: first.currency, occurredAt: nowLocal, notes: "" }} />
      </Dialog>
      <Dialog open={open === "snapshot"} onClose={close} title="Record observation" description="Your balance and equity at a point in time.">
        <SnapshotForm options={options} onDone={close} {...(timeZone ? { timeZone } : {})} defaults={{ challengeId: first.id, balance: "", equity: "", observedAt: nowLocal, notes: "" }} />
      </Dialog>
    </>
  );
}

export function EditTradeButton({ options, defaults }: { options: ChallengeOption[]; defaults: TradeFormInput }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" className="btn-secondary btn-sm" onClick={() => setOpen(true)}><Pencil size={14} aria-hidden="true" />Edit</button>
      <Dialog open={open} onClose={() => setOpen(false)} title="Edit trade" wide><TradeForm options={options} defaults={defaults} onDone={() => setOpen(false)} /></Dialog>
    </>
  );
}
export type { ReactNode };
