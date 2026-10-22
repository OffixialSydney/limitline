"use client";
import { Archive, ArchiveRestore, CircleCheck, CircleX, RotateCcw } from "lucide-react";
import { ConfirmButton } from "@/components/ui/ConfirmButton";
import { archiveChallenge, restoreChallenge, setChallengeStatus } from "@/features/challenges/actions";

export function ChallengeActions({ id, name, status }: { id: string; name: string; status: "active" | "passed" | "failed" | "archived" }) {
  if (status === "archived") {
    return <ConfirmButton tone="primary" icon={<ArchiveRestore size={15} aria-hidden="true" />} label="Restore" title={`Restore ${name}?`} description="It will return to its previous status." confirmLabel="Restore" className="btn-secondary" action={() => restoreChallenge(id)} />;
  }
  return (
    <>
      {status !== "passed" && <ConfirmButton tone="primary" className="btn-secondary" icon={<CircleCheck size={15} aria-hidden="true" />} label="Mark passed" title="Mark this challenge as passed?" description="This is a manual change and is recorded in the account history. Limitline does not decide this for you from the data." confirmLabel="Mark passed" action={() => setChallengeStatus(id, "passed")} />}
      {status !== "failed" && <ConfirmButton className="btn-secondary" icon={<CircleX size={15} aria-hidden="true" />} label="Mark failed" title="Mark this challenge as failed?" description="This is a manual change and is recorded in the account history." confirmLabel="Mark failed" action={() => setChallengeStatus(id, "failed")} />}
      {status !== "active" && <ConfirmButton tone="primary" className="btn-secondary" icon={<RotateCcw size={15} aria-hidden="true" />} label="Set active" title="Set this challenge back to active?" description="Recorded in the account history." confirmLabel="Set active" action={() => setChallengeStatus(id, "active")} />}
      <ConfirmButton className="btn-secondary" icon={<Archive size={15} aria-hidden="true" />} label="Archive" title={`Archive ${name}?`} description="Archiving hides this challenge from the overview. Trades, observations and history are kept and you can restore it later." confirmLabel="Archive" action={() => archiveChallenge(id)} />
    </>
  );
}
