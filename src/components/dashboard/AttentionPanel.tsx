import Link from "next/link";
import { OctagonAlert, TriangleAlert, Info } from "lucide-react";
import type { ChallengeView } from "@/lib/server/evaluate";

const ICON = { critical: OctagonAlert, warning: TriangleAlert, info: Info } as const;
const COLOR = { critical: "text-critical", warning: "text-warning", info: "text-accent" } as const;
const WORD = { critical: "Critical", warning: "Warning", info: "Notice" } as const;

export function AttentionPanel({ views }: { views: ChallengeView[] }) {
  const items = views.filter((v) => v.status === "active").flatMap((v) => v.attention.map((a) => ({ v, a })))
    .sort((x, y) => ["critical", "warning", "info"].indexOf(x.a.severity) - ["critical", "warning", "info"].indexOf(y.a.severity)).slice(0, 8);
  return (
    <section aria-labelledby="attention-h" className="panel">
      <h2 id="attention-h" className="border-b border-line px-4 py-3 text-sm font-semibold">Needs attention</h2>
      {items.length === 0 ? (
        <p className="px-4 py-6 text-sm text-muted">Nothing needs attention on your recorded data. This is not live monitoring: record fresh observations to keep it current.</p>
      ) : (
        <ul className="divide-y divide-line">
          {items.map(({ v, a }) => {
            const Icon = ICON[a.severity];
            return (
              <li key={`${v.id}-${a.key}`} className="flex gap-3 px-4 py-3">
                <Icon size={18} className={`mt-0.5 shrink-0 ${COLOR[a.severity]}`} aria-hidden="true" />
                <div className="min-w-0 text-sm">
                  <p className="font-medium"><span className="sr-only">{WORD[a.severity]}: </span><Link href={`/app/challenges/${v.id}`} className="hover:underline">{v.name}</Link></p>
                  <p className="text-muted">{a.message}</p>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
