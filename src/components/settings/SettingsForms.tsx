"use client";
import { useMemo, useState, useTransition } from "react";
import { useForm, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Download } from "lucide-react";
import { Field, describedBy } from "@/components/ui/Field";
import { FormMessage } from "@/components/ui/FormMessage";
import { ConfirmButton } from "@/components/ui/ConfirmButton";
import { updateProfile, deleteAccount } from "@/features/settings/actions";
import { LOCALES, profileSchema, type ProfileInput } from "@/lib/validation/records";
import { createClient } from "@/lib/supabase/client";

const LOCALE_LABEL: Record<string, string> = { "en-US": "English (US) 1,234.56", "en-GB": "English (UK) 1,234.56", "de-DE": "Deutsch 1.234,56", "fr-FR": "Français 1 234,56", "es-ES": "Español 1.234,56", "pt-BR": "Português (BR) 1.234,56", "ja-JP": "日本語 1,234.56" };

export function ProfileForm({ defaults }: { defaults: ProfileInput }) {
  const zones = useMemo(() => { try { return (Intl as unknown as { supportedValuesOf: (k: string) => string[] }).supportedValuesOf("timeZone"); } catch { return ["UTC"]; } }, []);
  const { register, handleSubmit, setError, formState: { errors } } = useForm<ProfileInput>({ resolver: zodResolver(profileSchema) as unknown as Resolver<ProfileInput>, defaultValues: defaults });
  const [msg, setMsg] = useState<{ ok: boolean; message: string } | null>(null);
  const [pending, start] = useTransition();
  const e = (k: keyof ProfileInput) => errors[k]?.message as string | undefined;
  const p = (k: keyof ProfileInput) => ({ id: `p-${k}`, "aria-invalid": !!errors[k], "aria-describedby": describedBy(`p-${k}`, e(k)), ...register(k) });
  const submit = (v: ProfileInput) => start(async () => {
    setMsg(null);
    const r = await updateProfile(v);
    if (!r.ok && r.fieldErrors) for (const [k, m] of Object.entries(r.fieldErrors)) setError(k as keyof ProfileInput, { message: m });
    setMsg({ ok: r.ok, message: r.message });
  });
  return (
    <form onSubmit={handleSubmit(submit)} noValidate className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="p-displayName" label="Display name" error={e("displayName")}><input className="input" {...p("displayName")} /></Field>
        <Field id="p-preferredCurrency" label="Preferred currency" error={e("preferredCurrency")} hint="Default for new challenges"><input className="input uppercase" maxLength={3} {...p("preferredCurrency")} /></Field>
        <Field id="p-timezone" label="Timezone" error={e("timezone")} hint="Used to show and enter times"><select className="input" {...p("timezone")}>{zones.map((z) => <option key={z}>{z}</option>)}</select></Field>
        <Field id="p-locale" label="Date and number format" error={e("locale")}><select className="input" {...p("locale")}>{LOCALES.map((l) => <option key={l} value={l}>{LOCALE_LABEL[l]}</option>)}</select></Field>
      </div>
      <h3 className="pt-2 text-sm font-semibold">Alerts</h3>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="p-warningThresholdPct" label="Warning threshold (% of allowance used)" error={e("warningThresholdPct")} hint="A warning is raised at this level. A limit is only reached at 100%."><input className="input num" inputMode="numeric" {...p("warningThresholdPct")} /></Field>
        <Field id="p-staleAfterHours" label="Treat data as stale after (hours)" error={e("staleAfterHours")} hint="Older observations cannot give a healthy status"><input className="input num" inputMode="numeric" {...p("staleAfterHours")} /></Field>
      </div>
      <label className="flex min-h-[44px] items-center gap-3 text-sm"><input type="checkbox" className="h-5 w-5 accent-[#245C45]" {...register("notifyInApp")} />Create in-app alerts</label>
      <FormMessage state={msg} />
      <button type="submit" className="btn-primary" disabled={pending}>{pending ? "Saving…" : "Save settings"}</button>
    </form>
  );
}

export function PasswordForm() {
  const [pw, setPw] = useState(""), [pw2, setPw2] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; message: string } | null>(null);
  const [pending, start] = useTransition();
  const submit = (ev: React.FormEvent) => { ev.preventDefault(); start(async () => {
    if (pw.length < 8) return setMsg({ ok: false, message: "Use at least 8 characters." });
    if (pw !== pw2) return setMsg({ ok: false, message: "The two passwords do not match." });
    const { error } = await createClient().auth.updateUser({ password: pw });
    if (error) return setMsg({ ok: false, message: "The password could not be changed. Sign in again and retry." });
    setPw(""); setPw2(""); setMsg({ ok: true, message: "Password updated." });
  }); };
  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="pw1" label="New password"><input id="pw1" type="password" autoComplete="new-password" className="input" value={pw} onChange={(e) => setPw(e.target.value)} /></Field>
        <Field id="pw2" label="Confirm new password"><input id="pw2" type="password" autoComplete="new-password" className="input" value={pw2} onChange={(e) => setPw2(e.target.value)} /></Field>
      </div>
      <FormMessage state={msg} />
      <button type="submit" className="btn-secondary" disabled={pending}>{pending ? "Updating…" : "Update password"}</button>
    </form>
  );
}

export function DangerZone() {
  return (
    <div className="space-y-4">
      <a href="/api/export" className="btn-secondary" download><Download size={15} aria-hidden="true" />Export my data (JSON)</a>
      <div className="border-t border-line pt-4">
        <p className="mb-3 text-sm text-muted">Deleting your account permanently removes your profile, challenges, trades, observations, alerts and history. This cannot be undone.</p>
        <ConfirmButton className="btn-danger" label="Delete account" title="Delete your account?" description="All of your data will be permanently deleted." confirmLabel="Delete everything" requireText="DELETE" action={deleteAccount} />
      </div>
    </div>
  );
}
