"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getActionSession } from "@/lib/server/context";
import { createAdminClient } from "@/lib/supabase/admin";
import { isValidTimeZone } from "@/lib/calculations/time";
import { flattenZod, type ActionResult } from "@/lib/validation/common";
import { profileSchema, type ProfileInput } from "@/lib/validation/records";

export async function updateProfile(input: ProfileInput): Promise<ActionResult> {
  const s = await getActionSession();
  if (!s) return { ok: false, message: "Your session has expired. Sign in again to continue." };
  const parsed = profileSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: "Check the highlighted fields.", fieldErrors: flattenZod(parsed.error) };
  const v = parsed.data;
  if (!isValidTimeZone(v.timezone)) return { ok: false, message: "Check the highlighted fields.", fieldErrors: { timezone: "Choose a valid timezone" } };
  const { error } = await s.supabase.from("profiles").update({
    display_name: v.displayName ?? null, preferred_currency: v.preferredCurrency, timezone: v.timezone, locale: v.locale,
    warning_threshold_pct: v.warningThresholdPct, stale_after_hours: v.staleAfterHours, notify_in_app: v.notifyInApp,
  }).eq("id", s.user.id);
  if (error) return { ok: false, message: "Your changes could not be saved. Your existing settings have not been changed." };
  revalidatePath("/app", "layout");
  return { ok: true, message: "Settings saved." };
}

/** Deletes the signed-in user's auth record; every table cascades from auth.users. */
export async function deleteAccount(): Promise<ActionResult> {
  const s = await getActionSession();
  if (!s) return { ok: false, message: "Your session has expired. Sign in again to continue." };
  const admin = createAdminClient();
  if (!admin) return { ok: false, message: "Account deletion is not enabled on this deployment. The server needs the SUPABASE_SERVICE_ROLE_KEY environment variable." };
  const { error } = await admin.auth.admin.deleteUser(s.user.id);
  if (error) return { ok: false, message: "Your account could not be deleted. Nothing was removed." };
  await s.supabase.auth.signOut();
  redirect("/login");
}
