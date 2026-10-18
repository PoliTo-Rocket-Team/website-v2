"use client";

import { useOptimistic, useTransition } from "react";
import { Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";
import { ROLE_HISTORY_NOTE, showsMe, switchDetail, withShowsMe, type MyAlumni } from "@/lib/dashboard/my-alumni";
import type { WriteResult } from "@/lib/dashboard/write";
import { Card } from "./account-parts";
import { AlumniSwitch } from "./alumni-panels";
import { PhotoCard, type PhotoPreviewSize } from "./my-profile";
import { PageHeader } from "./page-header";

type Actions = {
  setShown: (shown: boolean) => Promise<WriteResult<null>>;
  uploadPhoto: (form: FormData) => Promise<WriteResult<null>>;
  removePhoto: () => Promise<WriteResult<null>>;
};

/** Board 56b: the one size the Alumni page shows the photo at. */
const ALUMNI_PREVIEW: readonly PhotoPreviewSize[] = [{ caption: "Alumni page", size: "h-[72px] w-[72px] md:h-24 md:w-24" }];

const COLUMN_LABEL = "font-mono text-[10px] uppercase tracking-[0.2em] text-dim";

// Board 56b (issue #317): how an alumnus shows on the Alumni page. The
// switch, the photo the page shows, and their roles by academic year, which
// they cannot change here. Props in, nothing fetched.
export function MyAlumniView({ me, ...actions }: { me: MyAlumni } & Actions) {
  return (
    <>
      <PageHeader title="My alumni" intro="How you appear on the Alumni page, and your roles in the team." />
      <div className="mt-6 flex flex-col gap-5">
        <ShownCard me={me} setShown={actions.setShown} />
        <PhotoCard
          photoUrl={me.photo}
          uploadPhoto={actions.uploadPhoto}
          removePhoto={actions.removePhoto}
          detail="Shown next to your name on the Alumni page. Square image, JPEG or PNG, up to 2 MB."
          previews={ALUMNI_PREVIEW}
        />
        <RoleHistory me={me} />
      </div>
    </>
  );
}

/** "Show me on the Alumni page": the write lands at once, and a refusal puts the switch back. */
function ShownCard({ me, setShown }: { me: MyAlumni; setShown: Actions["setShown"] }) {
  const [on, setOn] = useOptimistic(showsMe(me));
  const [, startTransition] = useTransition();
  const flip = (next: boolean) =>
    startTransition(async () => {
      setOn(next);
      const result = await setShown(next);
      if (!result.ok) toast.error("Could not change it", { description: result.error });
    });
  const Icon = on ? Eye : EyeOff;
  return (
    <Card title="On the Alumni page">
      <label className="flex cursor-pointer items-center gap-4 px-5 py-5 md:px-6">
        <span aria-hidden className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white-5 text-text-2">
          <Icon className="h-4 w-4" strokeWidth={1.75} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[14px] font-medium">Show me on the Alumni page</span>
          <span className="block break-words text-[13px] text-prt-muted">{switchDetail(withShowsMe(me, on))}</span>
        </span>
        <AlumniSwitch checked={on} onCheckedChange={flip} label="Show me on the Alumni page" />
      </label>
    </Card>
  );
}

// Board 56b's table: one row per academic year, newest first, read from the
// team's roles. Phones stack each year's role and division under it.
function RoleHistory({ me }: { me: MyAlumni }) {
  return (
    <Card title="Role history">
      <div className="px-5 py-5 md:px-6">
        <div className="hidden grid-cols-3 gap-4 pb-1.5 md:grid">
          <span className={COLUMN_LABEL}>Year</span>
          <span className={COLUMN_LABEL}>Role</span>
          <span className={COLUMN_LABEL}>Division</span>
        </div>
        <ul className="flex flex-col gap-3 md:gap-0">
          {me.history.map((row) => (
            <li key={`${row.year}-${row.unit}`} className="grid grid-cols-1 gap-0.5 text-[14px] md:grid-cols-3 md:gap-4 md:py-2">
              <span className="font-medium tabular-nums md:font-normal">{row.year}</span>
              <span className="text-text-2 md:text-prt-text">{row.role}</span>
              <span className="text-text-2 md:text-prt-text">{row.unit}</span>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-[12px] text-prt-muted">{ROLE_HISTORY_NOTE}</p>
      </div>
    </Card>
  );
}
