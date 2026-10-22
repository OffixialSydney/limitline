import type { RuleStatus } from "./calculations/engine.ts";

export const STATUS_LABEL: Record<RuleStatus, string> = {
  normal: "Within limit",
  warning: "Approaching limit",
  limit_reached: "Limit reached",
  breach_recorded: "Breach recorded",
  unknown: "Not calculated",
  data_incomplete: "Data incomplete",
};
export const CHALLENGE_STATUS_LABEL = { active: "Active", passed: "Passed", failed: "Failed", archived: "Archived" } as const;
export const PHASE_LABEL: Record<string, string> = {
  phase_1: "Phase 1", phase_2: "Phase 2", phase_3: "Phase 3", funded: "Funded", other: "Other",
};
export const MODEL_LABEL: Record<string, string> = {
  static: "Static", trailing: "Trailing", eod_trailing: "End-of-day trailing", custom: "Custom / unsupported",
};
export const EVENT_LABEL: Record<string, string> = {
  deposit: "Deposit", withdrawal: "Withdrawal", fee: "Fee", credit: "Credit", adjustment: "Adjustment",
};
