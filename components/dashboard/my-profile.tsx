"use client";

import { useEffect, useId, useRef, useState, type FormEvent, type ReactNode } from "react";
import { Info, Linkedin, Lock, LogOut, Mail, Upload } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type { YourDetails } from "@/lib/dashboard/details";
import { checkPhoto, MAX_LEAVE_REASON, normalizeLinkedin, type LeaveState, type MyProfile } from "@/lib/dashboard/self";
import { initialsOf, type ViewerSession } from "@/lib/dashboard/viewer";
import type { WriteResult } from "@/lib/dashboard/write";
import { AccountCard, Card, DANGER_GHOST_PILL, DANGER_PILL, DangerBox, DangerRow, DeleteAccountDialog } from "./account-parts";
import { ConfirmDialog } from "./confirm-dialog";
import { Drawer } from "./drawer";
import { Field, inputClass, LOCKED_INPUT } from "./field";
import { GHOST_PILL, PageHeader, PRIMARY_PILL } from "./page-header";
import { PHOTO_ACCEPT, PhotoCropDialog } from "./photo-crop-dialog";
import { DetailValue, EditPill, YourDetailsCard } from "./your-details";

type Actions = {
  saveLinkedin: (text: string) => Promise<WriteResult<string | null>>;
  uploadPhoto: (form: FormData) => Promise<WriteResult<null>>;
  removePhoto: () => Promise<WriteResult<null>>;
  saveDetails: (input: unknown) => Promise<WriteResult<YourDetails>>;
  leaveTeam: (reason: string) => Promise<WriteResult<null>>;
  deleteAccount: (withdrawOpenApplications: boolean) => Promise<WriteResult<null>>;
};

// Board 55 (55m on phones): a team member's own profile. The photo at the two
// sizes the site shows it, the details their lead sets with their LinkedIn,
// "Your details", how they sign in, and Leave or delete. Props in, nothing
// fetched; every change lives in this page's state once the write answers.
export function MyProfileView({ profile, session, ...actions }: { profile: MyProfile; session: ViewerSession } & Actions) {
  return (
    <>
      <PageHeader title="My profile" intro="How you appear on the site and to the team." />
      <div className="mt-6 flex flex-col gap-5">
        <PhotoCard name={profile.name} photoUrl={profile.photoUrl} uploadPhoto={actions.uploadPhoto} removePhoto={actions.removePhoto} />
        <DetailsCard profile={profile} saveLinkedin={actions.saveLinkedin} />
        <YourDetailsCard details={profile.details} editor="member" saveDetails={actions.saveDetails} />
        <AccountCard signIn={profile.signIn} />
        <LeaveOrDelete leave={profile.leave} session={session} leaveTeam={actions.leaveTeam} deleteAccount={actions.deleteAccount} />
      </div>
    </>
  );
}

function PhotoCard({
  name,
  photoUrl,
  uploadPhoto,
  removePhoto,
}: {
  name: string;
  photoUrl: string | null;
  uploadPhoto: Actions["uploadPhoto"];
  removePhoto: Actions["removePhoto"];
}) {
  const [shown, setShown] = useState(photoUrl);
  const [cropping, setCropping] = useState<File | null>(null);
  const [pending, setPending] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const local = useRef<string | null>(null);
  useEffect(() => () => {
    if (local.current) URL.revokeObjectURL(local.current);
  }, []);

  const show = (url: string | null) => {
    if (local.current) URL.revokeObjectURL(local.current);
    local.current = url !== null && url.startsWith("blob:") ? url : null;
    setShown(url);
  };

  const choose = (file: File) => {
    const error = checkPhoto(file);
    if (error !== null) {
      toast.error("Could not use that photo", { description: error });
      return;
    }
    setCropping(file);
  };

  const save = async (square: File) => {
    setPending(true);
    try {
      const form = new FormData();
      form.set("photo", square);
      const result = await uploadPhoto(form);
      if (!result.ok) {
        toast.error("Could not upload the photo", { description: result.error });
        return;
      }
      show(URL.createObjectURL(square));
      setCropping(null);
      toast.success("Photo updated");
    } catch (err) {
      toast.error("Could not upload the photo", { description: err instanceof Error ? err.message : "Please try again." });
    } finally {
      setPending(false);
    }
  };

  const remove = async () => {
    setPending(true);
    try {
      const result = await removePhoto();
      if (!result.ok) {
        toast.error("Could not remove the photo", { description: result.error });
        return;
      }
      show(null);
      toast.success("Photo removed");
    } finally {
      setPending(false);
    }
  };

  return (
    <Card
      title="Photo"
      detail="Used on the site to show you. Make sure your face is clear even when small. Square image, JPEG or PNG, up to 2 MB; we crop and resize it for you."
    >
      <div className="flex flex-col gap-6 px-5 py-5 md:flex-row md:items-end md:justify-between md:px-6">
        <div className="flex items-end gap-6 md:gap-7">
          <PhotoPreview name={name} url={shown} size="h-[72px] w-[72px] text-[24px] md:h-24 md:w-24 md:text-[30px]" caption="Team page" />
          <PhotoPreview name={name} url={shown} size="h-8 w-8 text-[11px] md:h-10 md:w-10 md:text-[13px]" caption="Dashboard" />
        </div>
        <div className="flex flex-col items-stretch gap-3 md:items-end">
          <input
            ref={input}
            type="file"
            accept={PHOTO_ACCEPT}
            className="sr-only"
            tabIndex={-1}
            aria-hidden
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = "";
              if (file) choose(file);
            }}
          />
          <button type="button" disabled={pending} onClick={() => input.current?.click()} className={`${PRIMARY_PILL} h-11 md:h-10`}>
            <Upload aria-hidden className="h-4 w-4" strokeWidth={2} />
            Upload photo
          </button>
          {shown !== null && (
            <button
              type="button"
              disabled={pending}
              onClick={remove}
              className="text-[13px] text-prt-muted transition-colors duration-300 ease-out hover:text-prt-text focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
            >
              Remove photo
            </button>
          )}
        </div>
      </div>
      <PhotoCropDialog
        file={cropping}
        onOpenChange={(open) => !open && setCropping(null)}
        onChooseAnother={() => input.current?.click()}
        onSave={save}
        pending={pending}
      />
    </Card>
  );
}

function PhotoPreview({ name, url, size, caption }: { name: string; url: string | null; size: string; caption: string }) {
  return (
    <figure className="flex flex-col items-center gap-2">
      {url === null ? (
        <span aria-hidden className={`flex items-center justify-center rounded-full bg-white-10 font-bold text-text-2 ${size}`}>
          {initialsOf(name)}
        </span>
      ) : (
        // A blob: preview or a Blob store URL; next/image would need every store host configured.
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt="" className={`rounded-full object-cover ${size}`} />
      )}
      <figcaption className="text-[12px] text-prt-muted">{caption}</figcaption>
    </figure>
  );
}

/**
 * Name, role and team email are set by the lead; LinkedIn is the person's.
 * From md it is board 55's form; on phones board 55m's list, whose Edit opens
 * LinkedIn on a full page.
 */
function DetailsCard({ profile, saveLinkedin }: { profile: MyProfile; saveLinkedin: Actions["saveLinkedin"] }) {
  const [saved, setSaved] = useState(profile.linkedin ?? "");
  const [editing, setEditing] = useState(false);
  return (
    <Card title="Details" meta={<span className="md:hidden"><EditPill onClick={() => setEditing(true)} /></span>}>
      <dl className="grid grid-cols-2 gap-x-6 gap-y-4 px-5 py-5 md:hidden">
        <DetailValue label="Name" value={profile.name} />
        <DetailValue label="Role" value={profile.role.split(" · ")[0]} />
        <DetailValue label="Team email" value={profile.teamEmail} />
        <DetailValue label="LinkedIn" value={saved || null} />
      </dl>
      <div className="hidden md:block">
        <LinkedinForm profile={profile} saved={saved} onSaved={setSaved} saveLinkedin={saveLinkedin} />
      </div>
      <LinkedinDrawer open={editing} onOpenChange={setEditing} saved={saved} onSaved={setSaved} saveLinkedin={saveLinkedin} />
    </Card>
  );
}

/** Checks and saves the LinkedIn field; answers the error to show, or null once saved. */
function useLinkedinSave(saveLinkedin: Actions["saveLinkedin"], onSaved: (value: string) => void) {
  const [pending, setPending] = useState(false);
  const save = async (text: string): Promise<string | null> => {
    const checked = normalizeLinkedin(text);
    if (!checked.ok) return checked.error;
    setPending(true);
    try {
      const result = await saveLinkedin(text);
      if (!result.ok) return result.error;
      onSaved(result.value ?? "");
      toast.success("Saved");
      return null;
    } catch (err) {
      return err instanceof Error ? err.message : "Please try again.";
    } finally {
      setPending(false);
    }
  };
  return { pending, save };
}

function LinkedinInput({ id, describedBy, value, error, onChange }: { id: string; describedBy: string | undefined; value: string; error?: string; onChange: (value: string) => void }) {
  return (
    <div className="relative">
      <Linkedin aria-hidden className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-text-2" strokeWidth={1.75} />
      <input
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="linkedin.com/in/your-name"
        autoComplete="url"
        aria-invalid={error !== undefined}
        aria-describedby={describedBy}
        className={`${inputClass(error)} pl-10`}
      />
    </div>
  );
}

function LinkedinForm({
  profile,
  saved,
  onSaved,
  saveLinkedin,
}: {
  profile: MyProfile;
  saved: string;
  onSaved: (value: string) => void;
  saveLinkedin: Actions["saveLinkedin"];
}) {
  const [linkedin, setLinkedin] = useState(saved);
  const [error, setError] = useState<string>();
  const { pending, save } = useLinkedinSave(saveLinkedin, (value) => {
    setLinkedin(value);
    onSaved(value);
  });

  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError((await save(linkedin)) ?? undefined);
  };

  return (
    <form noValidate onSubmit={submit} className="px-6 py-5">
      <div className="grid grid-cols-2 gap-x-4 gap-y-5">
        <Locked label="Name" hint="set by your lead" value={profile.name} />
        <Locked label="Role" hint="set by your lead" value={profile.role} />
        {profile.teamEmail && <Locked label="Team email" hint="shown on the site" value={profile.teamEmail} icon={<Mail aria-hidden className="h-4 w-4 shrink-0" strokeWidth={1.75} />} />}
        <Field label="LinkedIn" hint="optional" error={error} className={profile.teamEmail ? "" : "col-start-2"}>
          {(id, describedBy) => (
            <LinkedinInput
              id={id}
              describedBy={describedBy}
              value={linkedin}
              error={error}
              onChange={(value) => {
                setLinkedin(value);
                setError(undefined);
              }}
            />
          )}
        </Field>
      </div>
      <div className="mt-5 flex justify-end">
        <button type="submit" disabled={pending || linkedin.trim() === saved} className={`${GHOST_PILL} h-10 px-4 text-[14px] font-semibold`}>
          Save changes
        </button>
      </div>
    </form>
  );
}

function LinkedinDrawer({
  open,
  onOpenChange,
  saved,
  onSaved,
  saveLinkedin,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  saved: string;
  onSaved: (value: string) => void;
  saveLinkedin: Actions["saveLinkedin"];
}) {
  const [linkedin, setLinkedin] = useState(saved);
  const [error, setError] = useState<string>();
  const { pending, save } = useLinkedinSave(saveLinkedin, (value) => {
    onSaved(value);
    onOpenChange(false);
  });
  return (
    <Drawer
      open={open}
      onOpenChange={(next) => {
        if (next) {
          setLinkedin(saved);
          setError(undefined);
        }
        onOpenChange(next);
      }}
      title="Details"
      detail="Your lead sets your name, role and team email."
      submitLabel="Save changes"
      submitting={pending}
      onSubmit={async (e) => {
        e.preventDefault();
        setError((await save(linkedin)) ?? undefined);
      }}
    >
      <Field label="LinkedIn" hint="optional" error={error}>
        {(id, describedBy) => (
          <LinkedinInput
            id={id}
            describedBy={describedBy}
            value={linkedin}
            error={error}
            onChange={(value) => {
              setLinkedin(value);
              setError(undefined);
            }}
          />
        )}
      </Field>
    </Drawer>
  );
}

function Locked({ label, hint, value, icon }: { label: string; hint: string; value: string; icon?: ReactNode }) {
  return (
    <div className="min-w-0">
      <p className="mb-2 text-[13px] leading-snug text-prt-text">
        {label}
        <span className="ml-1.5 text-prt-muted">{hint}</span>
      </p>
      <p className={LOCKED_INPUT}>
        {icon}
        <span className="truncate">{value}</span>
        <Lock aria-label="Locked" className="h-3.5 w-3.5 shrink-0" strokeWidth={1.75} />
      </p>
    </div>
  );
}

const LEAVE_TEXT = "Your division lead sees a notice on their dashboard, and you move to Alumni. You keep your account.";
const LEFT_TEXT = "You left the team and are on the Alumni list. You keep your account.";
const MEMBER_DELETE_TEXT =
  "Closes your account, so you can't sign in with it again. You leave the team first. Your data is anonymized and kept only for statistics.";

/**
 * Board 55's "Leave or delete": one card from md, two on phones (55m). Leave
 * asks first, with an optional reason (55b); Delete asks for the word DELETE
 * (55c).
 */
function LeaveOrDelete({
  leave: initial,
  session,
  leaveTeam,
  deleteAccount,
}: {
  leave: LeaveState;
  session: ViewerSession;
  leaveTeam: Actions["leaveTeam"];
  deleteAccount: Actions["deleteAccount"];
}) {
  const [leave, setLeave] = useState(initial);
  const [asking, setAsking] = useState<"leave" | "delete" | null>(null);
  const left = leave === "left";

  const leaveButton = !left && (
    <button type="button" onClick={() => setAsking("leave")} className={`${DANGER_GHOST_PILL} w-full md:w-auto`}>
      Leave the team
    </button>
  );
  const deleteButton = (
    <button type="button" onClick={() => setAsking("delete")} className={`${DANGER_PILL} w-full md:w-auto`}>
      Delete account
    </button>
  );

  return (
    <>
      <Card title="Leave or delete" danger className="hidden md:block">
        <div className="divide-y divide-danger/25">
          <DangerRow title="Leave the team" text={left ? LEFT_TEXT : LEAVE_TEXT}>
            {leaveButton}
          </DangerRow>
          <DangerRow title="Delete account" text={MEMBER_DELETE_TEXT}>
            {deleteButton}
          </DangerRow>
        </div>
      </Card>
      <div className="flex flex-col gap-5 md:hidden">
        <section className="rounded-xl border border-hairline bg-panel/60">
          <DangerRow title="Leave the team" text={left ? LEFT_TEXT : LEAVE_TEXT}>
            {leaveButton}
          </DangerRow>
        </section>
        <DangerBox>
          <DangerRow title="Delete account" text={MEMBER_DELETE_TEXT}>
            {deleteButton}
          </DangerRow>
        </DangerBox>
      </div>

      <LeaveDialog
        open={asking === "leave"}
        onOpenChange={(open) => setAsking(open ? "leave" : null)}
        leaveTeam={leaveTeam}
        onLeft={() => {
          setLeave("left");
          setAsking(null);
        }}
      />
      <DeleteAccountDialog
        open={asking === "delete"}
        onOpenChange={(open) => setAsking(open ? "delete" : null)}
        session={session}
        openApplications={null}
        member
        deleteAccount={deleteAccount}
      />
    </>
  );
}

function LeaveDialog({
  open,
  onOpenChange,
  leaveTeam,
  onLeft,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  leaveTeam: Actions["leaveTeam"];
  onLeft: () => void;
}) {
  const router = useRouter();
  const [reason, setReason] = useState("");
  const [pending, setPending] = useState(false);
  const reasonId = useId();

  const confirm = async () => {
    setPending(true);
    try {
      const result = await leaveTeam(reason);
      if (!result.ok) {
        toast.error("Could not leave the team", { description: result.error });
        return;
      }
      onLeft();
      toast.success("You left the team");
      // Off the team, the dashboard opens as an applicant's (issue #201).
      router.replace("/dashboard");
    } finally {
      setPending(false);
    }
  };

  return (
    <ConfirmDialog
      open={open}
      onOpenChange={(next) => {
        if (!next) setReason("");
        onOpenChange(next);
      }}
      icon={<LogOut className="h-[18px] w-[18px]" strokeWidth={1.75} />}
      title="Leave the team?"
      description="Your division lead sees a notice on their dashboard. You move to Alumni with your years on the team."
      cancelLabel="Stay"
      confirmLabel="Leave the team"
      danger
      pending={pending}
      onConfirm={confirm}
    >
      <ul className="mt-5 flex flex-col gap-2.5 rounded-xl border border-hairline bg-white-5 px-4 py-3.5 text-[13px] text-text-2">
        {["You lose access to team pages", "Your account stays, so you can apply again later"].map((line) => (
          <li key={line} className="flex items-center gap-2.5">
            <Info aria-hidden className="h-4 w-4 shrink-0" strokeWidth={1.75} />
            {line}
          </li>
        ))}
      </ul>
      <label htmlFor={reasonId} className="mt-5 block text-[13px] font-medium">
        Why are you leaving?<span className="ml-1.5 font-normal text-prt-muted">optional</span>
      </label>
      <textarea
        id={reasonId}
        value={reason}
        maxLength={MAX_LEAVE_REASON}
        onChange={(e) => setReason(e.target.value)}
        rows={3}
        className={`${inputClass()} mt-2 h-auto resize-none py-2.5`}
      />
    </ConfirmDialog>
  );
}
