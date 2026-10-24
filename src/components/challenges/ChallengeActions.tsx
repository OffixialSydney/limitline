"use client";
import { Archive, ArchiveRestore, CircleCheck, CircleX, RotateCcw, Trash2 } from "lucide-react";
import { ConfirmButton } from "@/components/ui/ConfirmButton";
import { archiveChallenge, deleteChallenge, restoreChallenge, setChallengeStatus } from "@/features/challenges/actions";

export function ChallengeActions({ id, name, status }: { id: string; name: string; status: "active" | "passed" | "failed" | "archived" }) {
  const deleteBtn = (
    <ConfirmButton
      tone="danger"
      className="btn-secondary text-critical hover:border-critical/40 hover:bg-critical/5"
      icon={<Trash2 size={15} aria-hidden="true" />}
      label="Delete challenge"
      title={`Delete ${name} permanently?`}
      description={`This permanently deletes "${name}" and removes all of its associated rules, trades, observations (account snapshots), balance events, trading days, and notifications. Unlike archiving, this action cannot be undone.`}
      confirmLabel="Delete challenge permanently"
      requireText="DELETE"
      redirectTo="/app/challenges?deleted=1"
      action={() => deleteChallenge(id)}
    />
  );

  if (status === "archived") {
    return (
      <>
        <ConfirmButton
          tone="primary"
          icon={<ArchiveRestore size={15} aria-hidden="true" />}
          label="Restore"
          title={`Restore ${name}?`}
          description="It will return to its previous status."
          confirmLabel="Restore"
          className="btn-secondary"
          action={() => restoreChallenge(id)}
        />
        {deleteBtn}
      </>
    );
  }
  return (
    <>
      {status !== "passed" && <ConfirmButton tone="primary" className="btn-secondary" icon={<CircleCheck size={15} aria-hidden="true" />} label="Mark passed" title="Mark this challenge as passed?" description="This is a manual change and is recorded in the account history. Limitline does not decide this for you from the data." confirmLabel="Mark passed" action={() => setChallengeStatus(id, "passed")} />}
      {status !== "failed" && <ConfirmButton className="btn-secondary" icon={<CircleX size={15} aria-hidden="true" />} label="Mark failed" title="Mark this challenge as failed?" description="This is a manual change and is recorded in the account history." confirmLabel="Mark failed" action={() => setChallengeStatus(id, "failed")} />}
      {status !== "active" && <ConfirmButton tone="primary" className="btn-secondary" icon={<RotateCcw size={15} aria-hidden="true" />} label="Set active" title="Set this challenge back to active?" description="Recorded in the account history." confirmLabel="Set active" action={() => setChallengeStatus(id, "active")} />}
      <ConfirmButton className="btn-secondary" icon={<Archive size={15} aria-hidden="true" />} label="Archive" title={`Archive ${name}?`} description="Archiving hides this challenge from the overview. Trades, observations and history are kept and you can restore it later." confirmLabel="Archive" action={() => archiveChallenge(id)} />
      {deleteBtn}
    </>
  );
}
