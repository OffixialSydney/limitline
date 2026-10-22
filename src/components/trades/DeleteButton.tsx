"use client";
import { Trash2 } from "lucide-react";
import { ConfirmButton } from "@/components/ui/ConfirmButton";
import { deleteBalanceEvent, deleteSnapshot, deleteTrade } from "@/features/trading/actions";

const CFG = {
  trade: { fn: deleteTrade, noun: "trade" },
  event: { fn: deleteBalanceEvent, noun: "balance event" },
  snapshot: { fn: deleteSnapshot, noun: "observation" },
} as const;

export function DeleteButton({ kind, id }: { kind: keyof typeof CFG; id: string }) {
  const { fn, noun } = CFG[kind];
  return (
    <ConfirmButton icon={<Trash2 size={14} aria-hidden="true" />} label={<><span className="sr-only">Delete {noun}</span><span aria-hidden="true">Delete</span></>}
      title={`Delete this ${noun}?`} description="This permanently removes the record and changes the calculations that use it. This cannot be undone." confirmLabel="Delete" action={() => fn(id)} />
  );
}
