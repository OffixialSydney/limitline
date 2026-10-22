import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { AttentionKind } from "@/lib/calculations/engine";
import { evaluateFromRows, loadBundle } from "./evaluate";
import type { ChallengeRow, ProfileRow } from "@/types/db";

const TITLE: Record<AttentionKind, string> = {
  daily_warning: "Daily loss allowance approaching its limit",
  daily_limit: "Daily loss limit reached on recorded data",
  overall_warning: "Overall loss allowance approaching its limit",
  overall_limit: "Overall loss limit reached on recorded data",
  breach_recorded: "A recorded observation went through a loss limit",
  target_reached: "Profit target reached on recorded data",
  trading_days_incomplete: "Minimum trading days not yet met",
  deadline_approaching: "Challenge deadline approaching",
  data_incomplete: "Some calculations are unavailable",
};

/**
 * Evaluates the challenge from stored records and inserts in-app alerts for conditions not already alerted.
 * Runs after writes and on "Refresh alerts". It is not continuous monitoring.
 */
export async function syncAlerts(supabase: SupabaseClient, userId: string, challengeId: string, profile: ProfileRow): Promise<number> {
  if (!profile.notify_in_app) return 0;
  const { data: c } = await supabase.from("challenges").select("*").eq("id", challengeId).eq("user_id", userId).maybeSingle<ChallengeRow>();
  if (!c || c.status === "archived") return 0;
  const bundle = await loadBundle(supabase, [c.id]);
  const now = new Date();
  const evaluation = evaluateFromRows(c, bundle, profile, now);
  if (evaluation.attention.length === 0) return 0;
  const keys = evaluation.attention.map((a) => `${c.id}:${a.key}`);
  const { data: existing } = await supabase.from("notifications").select("dedupe_key").eq("user_id", userId).in("dedupe_key", keys);
  const seen = new Set((existing ?? []).map((r: { dedupe_key: string }) => r.dedupe_key));
  let created = 0;
  for (const a of evaluation.attention) {
    const key = `${c.id}:${a.key}`;
    if (seen.has(key)) continue;
    const { error } = await supabase.from("notifications").insert({
      user_id: userId, challenge_id: c.id, notification_type: a.kind, severity: a.severity,
      title: `${c.name}: ${TITLE[a.kind]}`, message: `${a.message} Based on records up to ${evaluation.lastObservedAt?.toISOString() ?? "n/a"}; calculated ${now.toISOString()}.`,
      dedupe_key: key, calculated_at: now.toISOString(),
    });
    if (!error) created += 1;
  }
  return created;
}
