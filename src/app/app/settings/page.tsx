import type { Metadata } from "next";
import { PageHeader } from "@/components/ui/PageHeader";
import { ProfileForm, PasswordForm, DangerZone } from "@/components/settings/SettingsForms";
import { requireSession } from "@/lib/server/context";
import type { ProfileInput } from "@/lib/validation/records";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage() {
  const { profile, user } = await requireSession();
  const defaults: ProfileInput = {
    displayName: profile.display_name ?? "", preferredCurrency: profile.preferred_currency, timezone: profile.timezone,
    locale: profile.locale as ProfileInput["locale"], warningThresholdPct: profile.warning_threshold_pct, staleAfterHours: profile.stale_after_hours, notifyInApp: profile.notify_in_app,
  };
  return (
    <>
      <PageHeader title="Settings" description={`Signed in as ${user.email ?? "your account"}.`} />
      <div className="max-w-3xl space-y-6">
        <section className="panel p-5" aria-labelledby="s-profile"><h2 id="s-profile" className="mb-4 text-base font-semibold">Profile and preferences</h2><ProfileForm defaults={defaults} /></section>
        <section className="panel p-5" aria-labelledby="s-pw"><h2 id="s-pw" className="mb-4 text-base font-semibold">Password</h2><PasswordForm /></section>
        <section className="panel p-5" aria-labelledby="s-data"><h2 id="s-data" className="mb-4 text-base font-semibold">Your data</h2><DangerZone /></section>
      </div>
    </>
  );
}
