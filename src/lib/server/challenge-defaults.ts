import type { ChallengeFormInput } from "@/lib/validation/challenge";
import { parseRuleConfig } from "@/lib/validation/rules";
import type { ChallengeRow, RuleRow } from "@/types/db";

export function formDefaultsFromRows(c: ChallengeRow, rules: RuleRow[]): ChallengeFormInput {
  const get = (t: string) => rules.find((r) => r.rule_type === t);
  const target = parseRuleConfig("profit_target", get("profit_target")?.configuration);
  const daily = parseRuleConfig("daily_loss", get("daily_loss")?.configuration);
  const overall = parseRuleConfig("overall_loss", get("overall_loss")?.configuration);
  const days = parseRuleConfig("trading_days", get("trading_days")?.configuration);
  const cons = parseRuleConfig("consistency", get("consistency")?.configuration);
  const any = rules[0];
  return {
    name: c.name, firmName: c.firm_name, accountCurrency: c.account_currency, startingBalance: String(c.starting_balance),
    startDate: c.start_date, currentPhase: c.current_phase as ChallengeFormInput["currentPhase"],
    targetMode: target?.mode ?? "percent", targetValue: target?.value ?? "", deadline: c.deadline ?? "", minTradingDays: days ? String(days.required) : "",
    dailyMode: daily?.mode ?? "percent", dailyValue: daily?.value ?? "", dailyReference: daily?.reference ?? "start_of_day_balance",
    dailyIncludesOpen: daily?.includesOpenPositions ?? false, resetTimezone: daily?.resetTimezone ?? overall?.resetTimezone ?? "", resetTime: daily?.resetTime ?? overall?.resetTime ?? "",
    overallMode: overall?.mode ?? "percent", overallValue: overall?.value ?? "", drawdownModel: overall?.model ?? "static",
    overallMeasure: overall?.measure ?? "balance", lockAtStart: overall?.lockAtStartingBalance ?? false,
    consistencyPercent: cons?.maxSingleDayPercent ?? "", notes: c.notes ?? "", ruleSource: any?.source_reference ?? "", ruleVerifiedOn: any?.verified_at?.slice(0, 10) ?? "",
  };
}
