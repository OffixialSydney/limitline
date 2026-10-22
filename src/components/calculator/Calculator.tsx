"use client";
import { useMemo, useState } from "react";
import { Info, OctagonAlert } from "lucide-react";
import { impactOn, planTrade } from "@/lib/calculations/risk";
import { parseMoney, percentOf } from "@/lib/calculations/money";
import { formatMoney, formatNumber } from "@/lib/formatting";
import { Field } from "@/components/ui/Field";

export interface CalcAccount {
  id: string; name: string; currency: string; baseCents: number; baseLabel: string;
  dailyRemaining: number | null; overallRemaining: number | null;
}

const num = (s: string) => (s.trim() === "" ? NaN : Number(s));

export function Calculator({ accounts, locale }: { accounts: CalcAccount[]; locale: string }) {
  const [id, setId] = useState(accounts[0]?.id ?? "");
  const [instrument, setInstrument] = useState("");
  const [entry, setEntry] = useState(""), [stop, setStop] = useState(""), [tp, setTp] = useState("");
  const [riskMode, setRiskMode] = useState<"amount" | "percent">("amount");
  const [risk, setRisk] = useState("");
  const [unitValue, setUnitValue] = useState(""), [lotStep, setLotStep] = useState("");
  const acct = accounts.find((a) => a.id === id);
  const result = useMemo(() => {
    if (!acct) return null;
    const riskCents = riskMode === "amount" ? parseMoney(risk) : percentOf(acct.baseCents, risk);
    if (riskCents === null || [entry, stop, unitValue].some((v) => v.trim() === "")) return null;
    return { riskCents, plan: planTrade({ entry: num(entry), stop: num(stop), takeProfit: tp.trim() === "" ? null : num(tp), riskCents, valuePerPriceUnit: num(unitValue), lotStep: lotStep.trim() === "" ? null : num(lotStep) }) };
  }, [acct, entry, stop, tp, risk, riskMode, unitValue, lotStep]);
  if (!acct) return null;
  const m = (c: number | null) => formatMoney(c, acct.currency, locale);
  const plan = result?.plan;
  const daily = plan?.ok ? impactOn(acct.dailyRemaining, plan.plannedRiskCents) : null;
  const overall = plan?.ok ? impactOn(acct.overallRemaining, plan.plannedRiskCents) : null;

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <section className="panel space-y-4 p-5" aria-labelledby="calc-in">
        <h2 id="calc-in" className="text-base font-semibold">Hypothetical trade</h2>
        <Field id="c-acct" label="Challenge account"><select id="c-acct" className="input" value={id} onChange={(e) => setId(e.target.value)}>{accounts.map((a) => <option key={a.id} value={a.id}>{a.name} ({a.currency})</option>)}</select></Field>
        <Field id="c-inst" label="Instrument (label only)"><input id="c-inst" className="input uppercase" value={instrument} onChange={(e) => setInstrument(e.target.value)} placeholder="EURUSD" /></Field>
        <div className="grid grid-cols-3 gap-3">
          <Field id="c-entry" label="Entry"><input id="c-entry" className="input num" inputMode="decimal" value={entry} onChange={(e) => setEntry(e.target.value)} /></Field>
          <Field id="c-stop" label="Stop-loss"><input id="c-stop" className="input num" inputMode="decimal" value={stop} onChange={(e) => setStop(e.target.value)} /></Field>
          <Field id="c-tp" label="Take-profit"><input id="c-tp" className="input num" inputMode="decimal" value={tp} onChange={(e) => setTp(e.target.value)} /></Field>
        </div>
        <div className="grid grid-cols-[1fr_1.4fr] gap-3">
          <Field id="c-risk" label="Risk"><input id="c-risk" className="input num" inputMode="decimal" value={risk} onChange={(e) => setRisk(e.target.value)} /></Field>
          <Field id="c-rm" label="Risk type"><select id="c-rm" className="input" value={riskMode} onChange={(e) => setRiskMode(e.target.value as "amount" | "percent")}><option value="amount">Amount ({acct.currency})</option><option value="percent">% of {acct.baseLabel.toLowerCase()}</option></select></Field>
        </div>
        <fieldset className="rounded-control border border-line p-3">
          <legend className="px-1 text-sm font-medium">Contract specification</legend>
          <div className="grid grid-cols-2 gap-3">
            <Field id="c-unit" label={`Value of a 1.00 price move per lot (${acct.currency})`} hint="From your platform's contract specification. Include any currency conversion."><input id="c-unit" className="input num" inputMode="decimal" value={unitValue} onChange={(e) => setUnitValue(e.target.value)} /></Field>
            <Field id="c-step" label="Lot step (optional)" hint="Size is rounded down to this step"><input id="c-step" className="input num" inputMode="decimal" value={lotStep} onChange={(e) => setLotStep(e.target.value)} /></Field>
          </div>
        </fieldset>
      </section>

      <section className="panel p-5" aria-labelledby="calc-out" aria-live="polite">
        <h2 id="calc-out" className="text-base font-semibold">Estimate{instrument ? ` for ${instrument.toUpperCase()}` : ""}</h2>
        {!result ? <p className="mt-3 text-sm text-muted">Enter an entry, a stop-loss, a risk and the contract value to see an estimate.</p>
          : !plan?.ok ? <p role="alert" className="mt-3 text-sm text-critical">{plan?.reason}</p> : (
          <>
            <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
              <dt className="text-muted">Direction implied by the stop</dt><dd className="text-right capitalize">{plan.direction}</dd>
              <dt className="text-muted">Stop-loss distance</dt><dd className="num text-right">{formatNumber(plan.stopDistance, locale, 8)}</dd>
              <dt className="text-muted">Estimated position size</dt><dd className="num text-right text-lg font-semibold">{formatNumber(plan.size, locale, 4)} lots</dd>
              <dt className="text-muted">Planned monetary risk</dt><dd className="num text-right">{m(plan.plannedRiskCents)}</dd>
              <dt className="text-muted">Planned risk of {acct.baseLabel.toLowerCase()}</dt><dd className="num text-right">{acct.baseCents > 0 ? `${(plan.plannedRiskCents / acct.baseCents * 100).toFixed(2)}%` : "-"}</dd>
              <dt className="text-muted">Take-profit estimate</dt><dd className="num text-right">{plan.rewardCents === null ? "Not set" : m(plan.rewardCents)}</dd>
              <dt className="text-muted">Risk-to-reward</dt><dd className="num text-right">{plan.riskReward === null ? "Not set" : `1 : ${plan.riskReward}`}</dd>
            </dl>
            {plan.tpWarning && <p role="alert" className="mt-3 text-sm text-warning">{plan.tpWarning}</p>}
            <h3 className="mt-5 text-sm font-semibold">Effect on configured allowances</h3>
            <ul className="mt-2 space-y-2 text-sm">
              {([["Daily loss", acct.dailyRemaining, daily], ["Overall loss", acct.overallRemaining, overall]] as const).map(([label, rem, imp]) => (
                <li key={label} className="rounded-control border border-line p-3">
                  <p className="font-medium">{label}</p>
                  {rem === null || !imp ? <p className="text-muted">Remaining allowance is not available from your recorded data, so the impact cannot be estimated.</p> : (
                    <p className={imp.exceeds ? "flex items-start gap-1.5 text-critical" : ""}>
                      {imp.exceeds && <OctagonAlert size={16} className="mt-0.5 shrink-0" aria-hidden="true" />}
                      <span>{imp.exceeds ? "If stopped out, this would use all of the recorded remaining room. " : ""}Recorded room {m(rem)} → <span className="num">{m(imp.afterCents)}</span> after a full stop-out.</span>
                    </p>)}
                </li>))}
            </ul>
          </>)}
        <div className="mt-5 flex gap-2 rounded-control bg-sunken/70 p-3 text-xs text-muted">
          <Info size={14} className="mt-0.5 shrink-0" aria-hidden="true" />
          <p>Estimates only. Limitline does not know the current market price, spreads, slippage or your firm&apos;s exact contract specification, and it never places trades. Allowances come from your last recorded observations.</p>
        </div>
      </section>
    </div>
  );
}
