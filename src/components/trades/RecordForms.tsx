"use client";
import { useEffect, useId, useMemo, useRef, useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useForm, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Activity, ArrowLeftRight, Landmark, Pencil, type LucideIcon } from "lucide-react";
import { Dialog } from "@/components/ui/Dialog";
import { Field, describedBy } from "@/components/ui/Field";
import { FormMessage } from "@/components/ui/FormMessage";
import { addBalanceEvent, addSnapshot, saveTrade } from "@/features/trading/actions";
import {
  balanceEventSchema,
  normalizeTradeFormDefaults,
  snapshotSchema,
  tradeFormSchema,
  type BalanceEventInput,
  type SnapshotInput,
  type TradeFormInput,
} from "@/lib/validation/records";
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

function ChallengeSelect({
  id,
  options,
  defaultValue,
  error,
  register,
}: {
  id: string;
  options: ChallengeOption[];
  defaultValue?: string | undefined;
  error?: string | undefined;
  register: object;
}) {
  return (
    <Field id={id} label="Challenge account" error={error}>
      <select
        id={id}
        className="input"
        defaultValue={defaultValue}
        aria-invalid={!!error}
        aria-describedby={describedBy(id, error)}
        {...register}
      >
        {options.map((o) => <option key={o.id} value={o.id}>{o.name} ({o.currency})</option>)}
      </select>
    </Field>
  );
}

export function TradeForm({ options, defaults, onDone, timeZone }: { options: ChallengeOption[]; defaults: TradeFormInput; onDone: () => void; timeZone?: string }) {
  const formId = useId();
  const normalizedDefaults = useMemo(
    () =>
      normalizeTradeFormDefaults({
        id: defaults.id,
        challengeId: defaults.challengeId,
        instrument: defaults.instrument,
        direction: defaults.direction,
        entryTime: defaults.entryTime,
        exitTime: defaults.exitTime,
        entryPrice: defaults.entryPrice,
        exitPrice: defaults.exitPrice,
        stopLoss: defaults.stopLoss,
        takeProfit: defaults.takeProfit,
        positionSize: defaults.positionSize,
        grossPnl: defaults.grossPnl,
        costs: defaults.costs,
        netPnl: defaults.netPnl,
        notes: defaults.notes,
      }),
    [
      defaults.id,
      defaults.challengeId,
      defaults.instrument,
      defaults.direction,
      defaults.entryTime,
      defaults.exitTime,
      defaults.entryPrice,
      defaults.exitPrice,
      defaults.stopLoss,
      defaults.takeProfit,
      defaults.positionSize,
      defaults.grossPnl,
      defaults.costs,
      defaults.netPnl,
      defaults.notes,
    ],
  );
  const { register, handleSubmit, setError, reset, formState: { errors } } = useForm<TradeFormInput>({
    resolver: zodResolver(tradeFormSchema) as unknown as Resolver<TradeFormInput>,
    defaultValues: normalizedDefaults,
    values: normalizedDefaults,
  });
  useEffect(() => {
    reset(normalizedDefaults);
  }, [normalizedDefaults, reset]);

  const { msg, pending, submit } = useSubmit<TradeFormInput>(saveTrade, onDone, (k, m) => setError(k as keyof TradeFormInput, { message: m }));
  const e = (k: keyof TradeFormInput) => errors[k]?.message as string | undefined;
  const fid = (k: keyof TradeFormInput) => `${formId}-${k}`;
  const p = (k: Exclude<keyof TradeFormInput, "id">, hint?: string) => ({
    id: fid(k),
    defaultValue: normalizedDefaults[k] ?? "",
    "aria-invalid": !!errors[k],
    "aria-describedby": describedBy(fid(k), e(k), hint),
    ...register(k),
  });
  const tzHint = timeZone ? `Timezone: ${timeZone}` : undefined;
  const netHint = "Blank = gross − costs, or Not entered if gross is blank";
  const handleCancel = () => {
    reset(normalizedDefaults);
    onDone();
  };
  return (
    <form onSubmit={handleSubmit((v) => submit({ ...v, ...(normalizedDefaults.id ? { id: normalizedDefaults.id } : {}) }))} noValidate className="space-y-3">
      <input type="hidden" defaultValue={normalizedDefaults.id ?? ""} {...register("id")} />
      <ChallengeSelect id={fid("challengeId")} options={options} defaultValue={normalizedDefaults.challengeId} error={e("challengeId")} register={register("challengeId")} />
      <div className="grid grid-cols-2 gap-3">
        <Field id={fid("instrument")} label="Instrument" error={e("instrument")}><input className="input uppercase" autoComplete="off" placeholder="EURUSD" {...p("instrument")} /></Field>
        <Field id={fid("direction")} label="Direction" error={e("direction")}><select className="input" {...p("direction")}><option value="long">Long</option><option value="short">Short</option></select></Field>
        <Field id={fid("entryTime")} label="Entry time" error={e("entryTime")} hint={tzHint}><input type="datetime-local" className="input" {...p("entryTime", tzHint)} /></Field>
        <Field id={fid("exitTime")} label="Exit time" error={e("exitTime")} hint={tzHint}><input type="datetime-local" className="input" {...p("exitTime", tzHint)} /></Field>
        <Field id={fid("entryPrice")} label="Entry price" error={e("entryPrice")}><input className="input num" inputMode="decimal" {...p("entryPrice")} /></Field>
        <Field id={fid("exitPrice")} label="Exit price" error={e("exitPrice")}><input className="input num" inputMode="decimal" {...p("exitPrice")} /></Field>
        <Field id={fid("stopLoss")} label="Stop-loss" error={e("stopLoss")}><input className="input num" inputMode="decimal" {...p("stopLoss")} /></Field>
        <Field id={fid("takeProfit")} label="Take-profit" error={e("takeProfit")}><input className="input num" inputMode="decimal" {...p("takeProfit")} /></Field>
        <Field id={fid("positionSize")} label="Position size" error={e("positionSize")} hint="Lots or units, as your platform shows"><input className="input num" inputMode="decimal" {...p("positionSize", "Lots or units, as your platform shows")} /></Field>
        <Field id={fid("costs")} label="Costs" error={e("costs")} hint="Commission, swap, fees"><input className="input num" inputMode="decimal" {...p("costs", "Commission, swap, fees")} /></Field>
        <Field id={fid("grossPnl")} label="Gross result" error={e("grossPnl")}><input className="input num" inputMode="decimal" {...p("grossPnl")} /></Field>
        <Field id={fid("netPnl")} label="Net result (optional)" error={e("netPnl")} hint={netHint}><input className="input num" inputMode="decimal" {...p("netPnl", netHint)} /></Field>
      </div>
      <p className="text-xs text-muted">Results are recorded manually in the account currency. Leave Net result blank to use gross minus costs, or leave both blank to record the trade as Not entered (never counted as a zero result). Limitline does not work out profit or loss from prices.</p>
      <Field id={fid("notes")} label="Notes" error={e("notes")}><textarea className="input" rows={2} {...p("notes")} /></Field>
      <FormMessage state={msg} />
      <Actions pending={pending} onCancel={handleCancel} label={normalizedDefaults.id ? "Save trade" : "Record trade"} />
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
      <ChallengeSelect id="e-challengeId" options={options} defaultValue={defaults.challengeId} error={e("challengeId")} register={register("challengeId")} />
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
      <ChallengeSelect id="s-challengeId" options={options} defaultValue={defaults.challengeId} error={e("challengeId")} register={register("challengeId")} />
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

export function EditTradeButton({ options, defaults, timeZone }: { options: ChallengeOption[]; defaults: TradeFormInput; timeZone?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" className="btn-secondary btn-sm" onClick={() => setOpen(true)}><Pencil size={14} aria-hidden="true" />Edit</button>
      <Dialog open={open} onClose={() => setOpen(false)} title="Edit trade" wide>
        <TradeForm
          key={`${defaults.id ?? "trade"}-${open ? "open" : "closed"}`}
          options={options}
          defaults={defaults}
          onDone={() => setOpen(false)}
          {...(timeZone ? { timeZone } : {})}
        />
      </Dialog>
    </>
  );
}
export type { ReactNode };
