"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getActionSession } from "@/lib/server/context";
import { logAudit } from "@/lib/server/audit";
import { syncAlerts } from "@/lib/server/alerts";
import { challengeFormSchema, type ChallengeFormInput } from "@/lib/validation/challenge";
import { flattenZod, uuid, type ActionResult } from "@/lib/validation/common";
import { RULE_SCHEMAS, type RuleType } from "@/lib/validation/rules";
import { buildRules, canonical } from "./rules";
import type { ChallengeRow, RuleRow } from "@/types/db";

const FAIL_SAVE = "Your changes could not be saved. Your existing records have not been marked as updated.";
const NO_SESSION = "Your session has expired. Sign in again to continue.";

async function writeRules(session: NonNullable<Awaited<ReturnType<typeof getActionSession>>>, challengeId: string,
  rules: Partial<Record<RuleType, unknown>>, source: string | undefined, verifiedOn: string | undefined): Promise<{ changed: RuleType[]; error: boolean }> {
  const { supabase } = session;
  const { data: existing, error: readErr } = await supabase.from("challenge_rules").select("id, rule_type, configuration, source_reference, version, verified_at").eq("challenge_id", challengeId);
  if (readErr) return { changed: [], error: true };
  const byType = new Map((existing as RuleRow[]).map((r) => [r.rule_type, r]));
  const changed: RuleType[] = [];
  const verifiedAt = verifiedOn ? `${verifiedOn}T00:00:00Z` : null;
  for (const type of Object.keys(RULE_SCHEMAS) as RuleType[]) {
    const prev = byType.get(type);
    const next = rules[type];
    if (next === undefined) {
      if (prev) {
        const { error } = await supabase.from("challenge_rules").delete().eq("id", prev.id);
        if (error) return { changed, error: true };
        changed.push(type);
      }
      continue;
    }
    const parsed = RULE_SCHEMAS[type].safeParse(next); // never store unvalidated configuration
    if (!parsed.success) return { changed, error: true };
    const same = prev && canonical(prev.configuration) === canonical(parsed.data) && (prev.source_reference ?? null) === (source ?? null) && (prev.verified_at?.slice(0, 10) ?? null) === (verifiedOn ?? null);
    if (same) continue;
    const row = { challenge_id: challengeId, rule_type: type, configuration: parsed.data, source_reference: source ?? null, verified_at: verifiedAt, version: (prev?.version ?? 0) + 1 };
    const { error } = prev
      ? await supabase.from("challenge_rules").update(row).eq("id", prev.id)
      : await supabase.from("challenge_rules").insert(row);
    if (error) return { changed, error: true };
    changed.push(type);
  }
  return { changed, error: false };
}

export async function createChallenge(input: ChallengeFormInput): Promise<ActionResult<{ id: string }>> {
  const session = await getActionSession();
  if (!session) return { ok: false, message: NO_SESSION };
  const parsed = challengeFormSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: "Check the highlighted fields.", fieldErrors: flattenZod(parsed.error) };
  const v = parsed.data;
  const { supabase, user } = session;
  const { data, error } = await supabase.from("challenges").insert({
    user_id: user.id, name: v.name, firm_name: v.firmName, account_currency: v.accountCurrency, starting_balance: v.startingBalance,
    current_phase: v.currentPhase, status: "active", start_date: v.startDate, deadline: v.deadline ?? null, notes: v.notes ?? null,
  }).select("id").single<{ id: string }>();
  if (error || !data) return { ok: false, message: FAIL_SAVE };
  const rules = await writeRules(session, data.id, buildRules(v), v.ruleSource, v.ruleVerifiedOn);
  if (rules.error) {
    // Do not leave a half-configured challenge behind.
    await supabase.from("challenges").delete().eq("id", data.id);
    return { ok: false, message: FAIL_SAVE };
  }
  await logAudit(supabase, { userId: user.id, challengeId: data.id, action: "challenge_created", entityType: "challenge", entityId: data.id, details: { name: v.name } });
  await syncAlerts(supabase, user.id, data.id, session.profile);
  revalidatePath("/app", "layout");
  return { ok: true, message: "Challenge created.", data: { id: data.id } };
}

export async function updateChallenge(id: string, input: ChallengeFormInput): Promise<ActionResult<{ id: string }>> {
  const session = await getActionSession();
  if (!session) return { ok: false, message: NO_SESSION };
  if (!uuid.safeParse(id).success) return { ok: false, message: "This challenge could not be found." };
  const parsed = challengeFormSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: "Check the highlighted fields.", fieldErrors: flattenZod(parsed.error) };
  const v = parsed.data;
  const { supabase, user } = session;
  const { data: current } = await supabase.from("challenges").select("id").eq("id", id).eq("user_id", user.id).maybeSingle();
  if (!current) return { ok: false, message: "This challenge could not be found." };
  const { error } = await supabase.from("challenges").update({
    name: v.name, firm_name: v.firmName, account_currency: v.accountCurrency, starting_balance: v.startingBalance,
    current_phase: v.currentPhase, start_date: v.startDate, deadline: v.deadline ?? null, notes: v.notes ?? null,
  }).eq("id", id).eq("user_id", user.id);
  if (error) return { ok: false, message: FAIL_SAVE };
  const rules = await writeRules(session, id, buildRules(v), v.ruleSource, v.ruleVerifiedOn);
  if (rules.error) return { ok: false, message: "Challenge details were saved, but the rules could not be fully updated. Review the rules and save again." };
  await logAudit(supabase, { userId: user.id, challengeId: id, action: "challenge_updated", entityType: "challenge", entityId: id, details: { name: v.name } });
  if (rules.changed.length > 0) {
    await logAudit(supabase, { userId: user.id, challengeId: id, action: "rules_changed", entityType: "challenge_rules", entityId: id, details: { rules: rules.changed.join(", ") } });
  }
  await syncAlerts(supabase, user.id, id, session.profile);
  revalidatePath("/app", "layout");
  return { ok: true, message: "Challenge updated.", data: { id } };
}

export async function archiveChallenge(id: string): Promise<ActionResult> {
  const session = await getActionSession();
  if (!session) return { ok: false, message: NO_SESSION };
  if (!uuid.safeParse(id).success) return { ok: false, message: "This challenge could not be found." };
  const { supabase, user } = session;
  const { data: c } = await supabase.from("challenges").select("id, status").eq("id", id).eq("user_id", user.id).maybeSingle<Pick<ChallengeRow, "id" | "status">>();
  if (!c) return { ok: false, message: "This challenge could not be found." };
  if (c.status === "archived") return { ok: true, message: "Challenge archived." };
  const { error } = await supabase.from("challenges").update({ status: "archived", archived_from_status: c.status }).eq("id", id).eq("user_id", user.id);
  if (error) return { ok: false, message: FAIL_SAVE };
  await logAudit(supabase, { userId: user.id, challengeId: id, action: "challenge_archived", entityType: "challenge", entityId: id, details: { from: c.status } });
  revalidatePath("/app", "layout");
  return { ok: true, message: "Challenge archived. Its trades and history are kept." };
}

export async function restoreChallenge(id: string): Promise<ActionResult> {
  const session = await getActionSession();
  if (!session) return { ok: false, message: NO_SESSION };
  if (!uuid.safeParse(id).success) return { ok: false, message: "This challenge could not be found." };
  const { supabase, user } = session;
  const { data: c } = await supabase.from("challenges").select("id, status, archived_from_status").eq("id", id).eq("user_id", user.id).maybeSingle<Pick<ChallengeRow, "id" | "status" | "archived_from_status">>();
  if (!c || c.status !== "archived") return { ok: false, message: "This challenge is not archived." };
  const restored = c.archived_from_status ?? "active";
  const { error } = await supabase.from("challenges").update({ status: restored, archived_from_status: null }).eq("id", id).eq("user_id", user.id);
  if (error) return { ok: false, message: FAIL_SAVE };
  await logAudit(supabase, { userId: user.id, challengeId: id, action: "challenge_restored", entityType: "challenge", entityId: id, details: { to: restored } });
  revalidatePath("/app", "layout");
  return { ok: true, message: "Challenge restored." };
}

const statusSchema = z.enum(["active", "passed", "failed"]);

/** Manual status changes only. Limitline never marks a challenge passed or failed automatically. */
export async function setChallengeStatus(id: string, status: string): Promise<ActionResult> {
  const session = await getActionSession();
  if (!session) return { ok: false, message: NO_SESSION };
  const s = statusSchema.safeParse(status);
  if (!s.success || !uuid.safeParse(id).success) return { ok: false, message: "That status is not valid." };
  const { supabase, user } = session;
  const { data: c } = await supabase.from("challenges").select("id, status").eq("id", id).eq("user_id", user.id).maybeSingle<Pick<ChallengeRow, "id" | "status">>();
  if (!c || c.status === "archived") return { ok: false, message: "Restore this challenge before changing its status." };
  const { error } = await supabase.from("challenges").update({ status: s.data }).eq("id", id).eq("user_id", user.id);
  if (error) return { ok: false, message: FAIL_SAVE };
  await logAudit(supabase, { userId: user.id, challengeId: id, action: "status_changed", entityType: "challenge", entityId: id, details: { from: c.status, to: s.data, manual: true } });
  revalidatePath("/app", "layout");
  return { ok: true, message: "Challenge updated." };
}
