import { CircleCheck, CircleDashed, CircleHelp, CircleX, OctagonAlert, TriangleAlert, Archive } from "lucide-react";
import type { RuleStatus } from "@/lib/calculations/engine";
import { CHALLENGE_STATUS_LABEL, STATUS_LABEL } from "@/lib/status";

const RULE_STYLE: Record<RuleStatus, { cls: string; Icon: typeof CircleCheck }> = {
  normal: { cls: "bg-positive/10 text-positive border-positive/30", Icon: CircleCheck },
  warning: { cls: "bg-warning/10 text-[#8A5A12] border-warning/40", Icon: TriangleAlert },
  limit_reached: { cls: "bg-critical/10 text-critical border-critical/40", Icon: OctagonAlert },
  breach_recorded: { cls: "bg-critical/10 text-critical border-critical/40", Icon: CircleX },
  unknown: { cls: "bg-sunken text-muted border-line", Icon: CircleHelp },
  data_incomplete: { cls: "bg-warning/10 text-[#8A5A12] border-warning/40", Icon: CircleDashed },
};

/** Status is always communicated by an icon and a text label, never by color alone. */
export function StatusBadge({ status }: { status: RuleStatus }) {
  const { cls, Icon } = RULE_STYLE[status];
  return (
    <span className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2 py-0.5 text-xs font-medium ${cls}`}>
      <Icon size={13} strokeWidth={2.25} aria-hidden="true" />
      {STATUS_LABEL[status]}
    </span>
  );
}

const CH_STYLE = {
  active: "bg-accent/10 text-accent border-accent/30",
  passed: "bg-positive/10 text-positive border-positive/30",
  failed: "bg-critical/10 text-critical border-critical/40",
  archived: "bg-sunken text-muted border-line",
} as const;

export function ChallengeStatusBadge({ status }: { status: keyof typeof CHALLENGE_STATUS_LABEL }) {
  return (
    <span className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2 py-0.5 text-xs font-medium ${CH_STYLE[status]}`}>
      {status === "archived" && <Archive size={12} aria-hidden="true" />}
      {CHALLENGE_STATUS_LABEL[status]}
    </span>
  );
}
