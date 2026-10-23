"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useForm, type FieldErrors, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Info } from "lucide-react";
import { challengeFormSchema, PHASES, type ChallengeFormInput } from "@/lib/validation/challenge";
import { createChallenge, updateChallenge } from "@/features/challenges/actions";
import { Field, describedBy } from "@/components/ui/Field";
import { FormMessage } from "@/components/ui/FormMessage";

function timeZones(): string[] {
  try {
    return (Intl as unknown as { supportedValuesOf: (k: string) => string[] }).supportedValuesOf("timeZone");
  } catch {
    return ["UTC", "America/New_York", "America/Chicago", "Europe/London", "Europe/Prague", "Asia/Tokyo"];
  }
}

export const EMPTY_CHALLENGE: ChallengeFormInput = {
  name: "",
  firmName: "",
  accountCurrency: "USD",
  startingBalance: "",
  startDate: "",
  currentPhase: "phase_1",
  targetMode: "percent",
  targetValue: "",
  deadline: "",
  minTradingDays: "",
  dailyMode: "percent",
  dailyValue: "",
  dailyReference: "start_of_day_balance",
  dailyIncludesOpen: false,
  resetTimezone: "",
  resetTime: "",
  overallMode: "percent",
  overallValue: "",
  drawdownModel: "static",
  overallMeasure: "balance",
  lockAtStart: false,
  consistencyPercent: "",
  notes: "",
  ruleSource: "",
  ruleVerifiedOn: "",
};

const FIELD_LABELS: Partial<Record<keyof ChallengeFormInput, string>> = {
  name: "Account nickname",
  firmName: "Prop firm",
  accountCurrency: "Account currency",
  startingBalance: "Starting balance",
  startDate: "Challenge start date",
  currentPhase: "Current phase",
  targetValue: "Profit target",
  minTradingDays: "Minimum trading days",
  deadline: "Deadline",
  dailyValue: "Maximum daily loss",
  resetTimezone: "Daily reset timezone",
  resetTime: "Daily reset time",
  overallValue: "Maximum overall loss",
  consistencyPercent: "Consistency rule (%)",
  ruleSource: "Rule source",
  ruleVerifiedOn: "Rules last verified on",
  notes: "Notes",
};

function Group({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <fieldset className="panel p-5">
      <legend className="float-left mb-4 w-full text-base font-semibold">{title}</legend>
      {description && <p className="clear-both -mt-2 mb-4 text-sm text-muted">{description}</p>}
      <div className="clear-both grid grid-cols-1 gap-4 sm:grid-cols-2">{children}</div>
    </fieldset>
  );
}

export function ChallengeForm({
  mode,
  challengeId,
  defaults,
  today,
}: {
  mode: "create" | "edit";
  challengeId?: string;
  defaults: ChallengeFormInput;
  today: string;
}) {
  const router = useRouter();
  const zones = useMemo(timeZones, []);
  const {
    register,
    handleSubmit,
    setError,
    watch,
    formState: { errors },
  } = useForm<ChallengeFormInput>({
    resolver: zodResolver(challengeFormSchema) as unknown as Resolver<ChallengeFormInput>,
    defaultValues: { ...defaults, startDate: defaults.startDate || today },
  });
  const [msg, setMsg] = useState<{ ok: boolean; message: string } | null>(null);
  const [pending, start] = useTransition();
  const currency = (watch("accountCurrency") || "USD").toUpperCase();
  const model = watch("drawdownModel");
  const err = (k: keyof ChallengeFormInput) => errors[k]?.message as string | undefined;
  const props = (k: keyof ChallengeFormInput, hint?: string) => ({
    id: k,
    "aria-invalid": !!errors[k],
    "aria-describedby": describedBy(k, err(k), hint),
    ...register(k),
  });

  const onInvalid = (invalidErrors: FieldErrors<ChallengeFormInput>) => {
    const details = Object.entries(invalidErrors)
      .map(([key, val]) => {
        const label = FIELD_LABELS[key as keyof ChallengeFormInput] ?? key;
        const message = val?.message ? String(val.message) : "Invalid value";
        return `${label}: ${message}`;
      })
      .join(" · ");
    setMsg({
      ok: false,
      message: details ? `Please check the highlighted fields above (${details}).` : "Please check the highlighted fields above.",
    });
  };

  const onSubmit = (v: ChallengeFormInput) =>
    start(async () => {
      setMsg(null);
      try {
        const r = mode === "create" ? await createChallenge(v) : await updateChallenge(challengeId!, v);
        if (r.ok) {
          router.push(`/app/challenges/${r.data?.id ?? challengeId}`);
          router.refresh();
          return;
        }
        if (r.fieldErrors) {
          for (const [k, m] of Object.entries(r.fieldErrors)) {
            setError(k as keyof ChallengeFormInput, { message: m });
          }
        }
        setMsg({ ok: false, message: r.message });
      } catch (e) {
        if (process.env.NODE_ENV !== "production") {
          console.error("[ChallengeForm] Unexpected error:", e);
        }
        setMsg({
          ok: false,
          message: "Unable to save this challenge right now. Please check your connection and try again.",
        });
      }
    });

  const valueType = (id: "targetMode" | "dailyMode" | "overallMode") => (
    <select id={id} className="input" {...register(id)} aria-label="Value type">
      <option value="percent">% of starting balance</option>
      <option value="amount">Amount ({currency})</option>
    </select>
  );

  return (
    <form onSubmit={handleSubmit(onSubmit, onInvalid)} noValidate className="space-y-6">
      <Group title="Account information">
        <Field id="name" label="Account nickname" error={err("name")}>
          <input className="input" autoComplete="off" {...props("name")} />
        </Field>
        <Field id="firmName" label="Prop firm" error={err("firmName")}>
          <input className="input" autoComplete="off" {...props("firmName")} />
        </Field>
        <Field id="accountCurrency" label="Account currency" error={err("accountCurrency")} hint="3-letter code, for example USD or EUR">
          <input className="input uppercase" maxLength={3} {...props("accountCurrency", "x")} />
        </Field>
        <Field
          id="startingBalance"
          label={`Starting balance (${currency})`}
          error={err("startingBalance")}
          hint="Numbers only, without commas (for example 10000 or 50000.00)"
        >
          <input className="input num" inputMode="decimal" placeholder="10000.00" {...props("startingBalance", "x")} />
        </Field>
        <Field id="startDate" label="Challenge start date" error={err("startDate")}>
          <input type="date" className="input" {...props("startDate")} />
        </Field>
        <Field id="currentPhase" label="Current phase" error={err("currentPhase")}>
          <select className="input" {...props("currentPhase")}>
            {PHASES.map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
        </Field>
      </Group>

      <Group title="Profit target" description="Leave the target blank if your challenge has none. Progress is then shown as unavailable.">
        <Field id="targetValue" label="Target" error={err("targetValue")} hint="Profit above the starting balance that you must reach">
          <div className="grid grid-cols-[1fr_1.4fr] gap-2">
            <input className="input num" inputMode="decimal" {...props("targetValue", "x")} />
            {valueType("targetMode")}
          </div>
        </Field>
        <Field id="minTradingDays" label="Minimum trading days" error={err("minTradingDays")} hint="Leave blank if there is no requirement">
          <input className="input num" inputMode="numeric" {...props("minTradingDays", "x")} />
        </Field>
        <Field id="deadline" label="Deadline (optional)" error={err("deadline")}>
          <input type="date" className="input" {...props("deadline")} />
        </Field>
      </Group>

      <Group title="Loss rules" description="Firms define these differently. Enter your firm's own terms. Limitline will not guess a missing detail.">
        <div className="flex gap-2 rounded-control border border-line bg-sunken/60 p-3 text-sm text-muted sm:col-span-2">
          <Info size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
          <p>
            Firm presets are not included in this release: Limitline ships no verified, sourced rule data, and it will
            not invent any. Enter rules manually from your firm&apos;s published terms, and record where you found them
            below.
          </p>
        </div>
        <Field id="dailyValue" label="Maximum daily loss" error={err("dailyValue")} hint="Leave blank if there is no daily limit">
          <div className="grid grid-cols-[1fr_1.4fr] gap-2">
            <input className="input num" inputMode="decimal" {...props("dailyValue", "x")} />
            {valueType("dailyMode")}
          </div>
        </Field>
        <Field id="dailyReference" label="Daily loss is measured from" error={err("dailyReference")}>
          <select className="input" {...props("dailyReference")}>
            <option value="start_of_day_balance">Balance at the daily reset</option>
            <option value="start_of_day_equity">Equity at the daily reset</option>
            <option value="higher_of_balance_equity">Higher of balance and equity at the reset</option>
          </select>
        </Field>
        <Field id="resetTimezone" label="Daily reset timezone" error={err("resetTimezone")} hint="Without this, daily loss shows as incomplete">
          <select className="input" {...props("resetTimezone", "x")}>
            <option value="">Not set</option>
            {zones.map((z) => (
              <option key={z} value={z}>
                {z}
              </option>
            ))}
          </select>
        </Field>
        <Field id="resetTime" label="Daily reset time (24-hour)" error={err("resetTime")} hint="For example 17:00">
          <input type="time" className="input num" {...props("resetTime", "x")} />
        </Field>
        <label className="flex min-h-[44px] items-center gap-3 text-sm sm:col-span-2">
          <input type="checkbox" className="h-5 w-5 accent-[#245C45]" {...register("dailyIncludesOpen")} />
          Daily loss includes open-position losses (uses equity observations)
        </label>

        <hr className="border-line sm:col-span-2" />
        <Field id="overallValue" label="Maximum overall loss" error={err("overallValue")} hint="Leave blank only if the account has no overall limit">
          <div className="grid grid-cols-[1fr_1.4fr] gap-2">
            <input className="input num" inputMode="decimal" {...props("overallValue", "x")} />
            {valueType("overallMode")}
          </div>
        </Field>
        <Field id="drawdownModel" label="Drawdown model" error={err("drawdownModel")}>
          <select className="input" {...props("drawdownModel")}>
            <option value="static">Static</option>
            <option value="trailing">Trailing (intraday highs)</option>
            <option value="eod_trailing">End-of-day trailing</option>
            <option value="custom">Custom or unsupported</option>
          </select>
        </Field>
        {model === "custom" && (
          <p className="rounded-control border border-warning/40 bg-warning/10 p-3 text-sm sm:col-span-2">
            Custom models are stored but not calculated. The overall loss status will show as &ldquo;Not calculated&rdquo;
            and no other model is substituted.
          </p>
        )}
        <Field id="overallMeasure" label="Overall loss is checked against" error={err("overallMeasure")}>
          <select className="input" {...props("overallMeasure")}>
            <option value="balance">Balance observations</option>
            <option value="equity">Equity observations</option>
          </select>
        </Field>
        {(model === "trailing" || model === "eod_trailing") && (
          <label className="flex min-h-[44px] items-center gap-3 text-sm">
            <input type="checkbox" className="h-5 w-5 accent-[#245C45]" {...register("lockAtStart")} />
            Trailing stops once the threshold reaches the starting balance
          </label>
        )}
        {model === "eod_trailing" && (
          <p className="text-xs text-muted sm:col-span-2">
            End-of-day trailing uses the reset timezone and time above to decide where each day ends.
          </p>
        )}
      </Group>

      <Group title="Additional requirements and notes">
        <Field
          id="consistencyPercent"
          label="Consistency rule: max share of profit from one day (%)"
          error={err("consistencyPercent")}
          hint="Stored for reference. Not evaluated in this release."
        >
          <input className="input num" inputMode="decimal" {...props("consistencyPercent", "x")} />
        </Field>
        <Field id="ruleSource" label="Rule source (optional)" error={err("ruleSource")} hint="For example a page URL or document name">
          <input className="input" {...props("ruleSource", "x")} />
        </Field>
        <Field id="ruleVerifiedOn" label="Rules last verified on (optional)" error={err("ruleVerifiedOn")}>
          <input type="date" className="input" {...props("ruleVerifiedOn")} />
        </Field>
        <Field id="notes" label="Notes" error={err("notes")} className="sm:col-span-2">
          <textarea className="input" rows={3} {...props("notes")} />
        </Field>
      </Group>

      <FormMessage state={msg} />
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <button type="button" className="btn-secondary" onClick={() => router.back()}>
          Cancel
        </button>
        <button type="submit" className="btn-primary" disabled={pending}>
          {pending ? "Saving…" : mode === "create" ? "Create challenge" : "Save changes"}
        </button>
      </div>
    </form>
  );
}
