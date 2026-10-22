import "server-only";
import { redirect } from "next/navigation";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import type { ProfileRow } from "@/types/db";
import type { FormatPrefs } from "@/lib/formatting";

export interface Session { supabase: SupabaseClient; user: User; profile: ProfileRow; prefs: FormatPrefs }

const PROFILE_COLUMNS = "id, display_name, preferred_currency, timezone, locale, warning_threshold_pct, stale_after_hours, notify_in_app";

/** Verifies the session on the server. Never relies on hidden UI for authorization. */
export async function requireSession(): Promise<Session> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  let { data: profile } = await supabase.from("profiles").select(PROFILE_COLUMNS).eq("id", user.id).maybeSingle<ProfileRow>();
  if (!profile) {
    const created = await supabase.from("profiles").insert({ id: user.id }).select(PROFILE_COLUMNS).single<ProfileRow>();
    profile = created.data;
  }
  if (!profile) throw new Error("Your profile could not be loaded.");
  return { supabase, user, profile, prefs: { locale: profile.locale, timeZone: profile.timezone } };
}

/** For server actions: returns null instead of redirecting so the action can report an error. */
export async function getActionSession(): Promise<Session | null> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: profile } = await supabase.from("profiles").select(PROFILE_COLUMNS).eq("id", user.id).maybeSingle<ProfileRow>();
  if (!profile) return null;
  return { supabase, user, profile, prefs: { locale: profile.locale, timeZone: profile.timezone } };
}
