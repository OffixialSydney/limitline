/** Row shapes as returned by Supabase (numeric columns arrive as number or string). */
export type Numeric = number | string;
export type ChallengeStatus = "active" | "passed" | "failed" | "archived";

export interface ProfileRow {
  id: string; display_name: string | null; preferred_currency: string; timezone: string; locale: string;
  warning_threshold_pct: number; stale_after_hours: number; notify_in_app: boolean;
}
export interface ChallengeRow {
  id: string; user_id: string; name: string; firm_name: string; account_currency: string; starting_balance: Numeric;
  current_phase: string; status: ChallengeStatus; archived_from_status: string | null; start_date: string;
  deadline: string | null; notes: string | null; created_at: string; updated_at: string;
}
export interface RuleRow {
  id: string; challenge_id: string; rule_type: string; configuration: unknown; source_reference: string | null;
  version: number; verified_at: string | null; updated_at: string;
}
export interface TradeRow {
  id: string; challenge_id: string; instrument: string; direction: "long" | "short"; entry_time: string; exit_time: string | null;
  entry_price: Numeric | null; exit_price: Numeric | null; stop_loss: Numeric | null; take_profit: Numeric | null;
  position_size: Numeric | null; gross_pnl: Numeric | null; costs: Numeric | null; net_pnl: Numeric | null;
  notes: string | null; created_at: string;
}
export interface BalanceEventRow {
  id: string; challenge_id: string; event_type: "deposit" | "withdrawal" | "fee" | "credit" | "adjustment";
  amount: Numeric; currency: string; occurred_at: string; notes: string | null;
}
export interface SnapshotRow {
  id: string; challenge_id: string; balance: Numeric | null; equity: Numeric | null; observed_at: string;
  source: string; notes: string | null;
}
export interface TradingDayRow { id: string; challenge_id: string; trading_date: string; status: "traded" | "not_counted" }
export interface NotificationRow {
  id: string; challenge_id: string | null; notification_type: string; severity: "info" | "warning" | "critical";
  title: string; message: string; calculated_at: string | null; read_at: string | null; created_at: string;
}
export interface AuditRow {
  id: string; challenge_id: string | null; action: string; entity_type: string; entity_id: string | null;
  details: Record<string, unknown>; created_at: string;
}
