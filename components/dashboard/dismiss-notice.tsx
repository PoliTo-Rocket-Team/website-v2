"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { dismissNotice } from "@/app/dashboard/actions";
import { rowActionClass } from "./panel";

/**
 * Dismiss on a notice under "Needs your attention" (issue #201): the same
 * pill as the row's other actions, which ends the notice; the Overview then
 * reads again without it.
 */
export function DismissNotice({ noticeId, label, chip = false }: { noticeId: number; label: string; chip?: boolean }) {
  const [pending, startTransition] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      aria-busy={pending}
      onClick={() =>
        startTransition(async () => {
          const result = await dismissNotice(noticeId);
          if (!result.ok) toast.error("Could not dismiss the notice", { description: result.error });
        })
      }
      className={`${rowActionClass(chip)} disabled:opacity-60`}
    >
      {label}
    </button>
  );
}
