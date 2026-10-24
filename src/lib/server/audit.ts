import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

export interface AuditInput {
  userId: string; challengeId: string | null; action: string; entityType: string; entityId?: string | null;
  details?: Record<string, string | number | boolean | null>;
}

/** Audit details hold short human summaries only. Never put secrets or full records in them. */
export async function logAudit(supabase: SupabaseClient, a: AuditInput) {
  const { error } = await supabase.from("audit_logs").insert({
    user_id: a.userId, challenge_id: a.challengeId, action: a.action, entity_type: a.entityType,
    entity_id: a.entityId ?? null, details: a.details ?? {},
  });
  if (error) console.error("audit log failed", error.code);
}

export const AUDIT_TEXT: Record<string, string> = {
  challenge_created: "Challenge created",
  challenge_updated: "Challenge details updated",
  challenge_deleted: "Challenge deleted",
  rules_changed: "Rules changed",
  status_changed: "Status changed",
  challenge_archived: "Challenge archived",
  challenge_restored: "Challenge restored",
  trade_recorded: "Trade recorded",
  trade_updated: "Trade updated",
  trade_deleted: "Trade deleted",
  balance_event_recorded: "Balance event recorded",
  balance_event_deleted: "Balance event deleted",
  snapshot_recorded: "Observation recorded",
  snapshot_deleted: "Observation deleted",
  trading_day_added: "Trading day added",
  trading_day_removed: "Trading day removed",
  breach_alert: "Recorded limit event",
};
