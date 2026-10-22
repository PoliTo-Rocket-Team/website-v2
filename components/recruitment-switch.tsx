"use client";

import { useEffect, useId, useState } from "react";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import type { RecruitmentControl, SwitchRecruitmentResult } from "@/lib/apply/recruitment-switch";

type RecruitmentSwitchProps = RecruitmentControl & {
  onSetRecruitment: (isOpen: boolean) => Promise<SwitchRecruitmentResult>;
};

/**
 * The site-wide recruitment switch on the dashboard positions page (issue
 * #121). An org-wide positions editor flips it; everyone else sees its state.
 */
export function RecruitmentSwitch({ recruitment, canSwitch, onSetRecruitment }: RecruitmentSwitchProps) {
  const [isOpen, setIsOpen] = useState(recruitment.isOpen);
  const [isSaving, setIsSaving] = useState(false);
  const labelId = useId();
  const stateId = useId();

  useEffect(() => setIsOpen(recruitment.isOpen), [recruitment.isOpen]);

  async function handleChange(next: boolean) {
    setIsSaving(true);
    try {
      const result = await onSetRecruitment(next);
      if (result.status === "refused") {
        toast.error("You cannot change recruitment", {
          description: "Only members with org-wide edit access on positions can change it.",
          duration: 5000,
        });
        return;
      }
      setIsOpen(result.recruitment.isOpen);
      toast.success(result.recruitment.isOpen ? "Recruitment is open" : "Recruitment is closed", {
        description: result.recruitment.isOpen
          ? "Every open position is on the site again."
          : "No position shows on the site, and applications are stopped.",
        duration: 3000,
      });
    } catch (error) {
      console.error("Failed to change recruitment:", error);
      toast.error("Failed to change recruitment", {
        description:
          error instanceof Error ? error.message : "Please try again or contact support if the problem persists.",
        duration: 5000,
      });
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <Card className="mx-auto flex w-full max-w-5xl flex-col gap-4 p-4 md:flex-row md:items-center md:justify-between md:p-6">
      <div className="space-y-1">
        <h3 id={labelId} className="text-base font-semibold text-foreground md:text-lg">
          Recruitment open
        </h3>
        <p className="text-sm text-muted-foreground">
          Turning this off hides every position from the site and stops applications. Turning it on shows the
          positions that are open again.
        </p>
        {!canSwitch && (
          <p className="text-sm text-muted-foreground">
            Only members with org-wide edit access on positions can change it.
          </p>
        )}
      </div>
      <div className="flex shrink-0 items-center gap-3">
        <span id={stateId} className="text-sm font-medium text-foreground">
          {isOpen ? "On" : "Off"}
        </span>
        <Switch
          checked={isOpen}
          disabled={!canSwitch || isSaving}
          onCheckedChange={handleChange}
          aria-labelledby={labelId}
          aria-describedby={stateId}
          className="data-[state=checked]:bg-accent"
        />
      </div>
    </Card>
  );
}
