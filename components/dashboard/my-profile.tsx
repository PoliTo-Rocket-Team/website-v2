"use client";

import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { Linkedin, Lock, Mail, Upload } from "lucide-react";
import { toast } from "sonner";
import { checkPhoto, normalizeLinkedin, PHOTO_TYPES, type LeaveState, type MyProfile } from "@/lib/dashboard/self";
import { initialsOf, type ViewerSession } from "@/lib/dashboard/viewer";
import type { WriteResult } from "@/lib/dashboard/write";
import { AccountCard, Card, DANGER_GHOST_PILL, DANGER_PILL } from "./account-parts";
import { ConfirmDialog } from "./confirm-dialog";
import { Field, inputClass, LOCKED_INPUT } from "./field";
import { GHOST_PILL, PageHeader, PRIMARY_PILL } from "./page-header";

type Actions = {
  saveLinkedin: (text: string) => Promise<WriteResult<string | null>>;
  uploadPhoto: (form: FormData) => Promise<WriteResult<null>>;
  removePhoto: () => Promise<WriteResult<null>>;
  requestLeave: () => Promise<WriteResult<null>>;
};

// Board 45: a team member's own profile. The photo at the three sizes the
// site shows it, the details their lead sets, LinkedIn, the account, and
// Leave or delete. Props in, nothing fetched; every change lives in this
// page's state once the write answers.
export function MyProfileView({ profile, session, ...actions }: { profile: MyProfile; session: ViewerSession } & Actions) {
  const [leave, setLeave] = useState<LeaveState>(profile.leave);
  return (
    <>
      <PageHeader title="My profile" intro="How you appear on the site and to the team." />
      <div className="mt-6 flex flex-col gap-5">
        <PhotoCard name={profile.name} photoUrl={profile.photoUrl} uploadPhoto={actions.uploadPhoto} removePhoto={actions.removePhoto} />
        <DetailsCard profile={profile} saveLinkedin={actions.saveLinkedin} />
        <AccountCard signIn={profile.signIn} session={session} />
        <LeaveCard leave={leave} onLeft={() => setLeave("leave-requested")} requestLeave={actions.requestLeave} />
      </div>
    </>
  );
}

/** The longest side the browser sends: square, so a 2 MB JPEG fits well under the limit. */
const PHOTO_SIZE = 800;

/** The photo cut to its centre square and scaled down, as a JPEG. */
async function squarePhoto(file: File): Promise<File> {
  const bitmap = await createImageBitmap(file);
  const side = Math.min(bitmap.width, bitmap.height);
  const out = Math.min(side, PHOTO_SIZE);
  const canvas = document.createElement("canvas");
  canvas.width = out;
  canvas.height = out;
  canvas.getContext("2d")!.drawImage(bitmap, (bitmap.width - side) / 2, (bitmap.height - side) / 2, side, side, 0, 0, out, out);
  bitmap.close();
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.9));
  if (blob === null) throw new Error("Could not read that image.");
  return new File([blob], "photo.jpg", { type: "image/jpeg" });
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

  const upload = async (file: File) => {
    const error = checkPhoto(file);
    if (error !== null) {
      toast.error("Could not use that photo", { description: error });
      return;
    }
    setPending(true);
    try {
      const square = await squarePhoto(file);
      const form = new FormData();
      form.set("photo", square);
      const result = await uploadPhoto(form);
      if (!result.ok) {
        toast.error("Could not upload the photo", { description: result.error });
        return;
      }
      show(URL.createObjectURL(square));
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
      <div className="flex flex-col gap-6 px-5 py-5 md:flex-row md:items-end md:justify-between md:px-[22px]">
        <div className="flex items-end gap-5 md:gap-7">
          <PhotoPreview name={name} url={shown} shape="rounded-2xl" size="h-[120px] w-[120px] text-[40px] md:h-[160px] md:w-[160px] md:text-[52px]" caption="Alumni page" />
          <PhotoPreview name={name} url={shown} shape="rounded-full" size="h-[72px] w-[72px] text-[24px] md:h-24 md:w-24 md:text-[30px]" caption="Team page" />
          <PhotoPreview name={name} url={shown} shape="rounded-full" size="h-10 w-10 text-[13px]" caption="Small" />
        </div>
        <div className="flex flex-row items-center gap-4 md:flex-col md:items-end md:gap-3">
          <input
            ref={input}
            type="file"
            accept={PHOTO_TYPES.join(",")}
            className="sr-only"
            tabIndex={-1}
            aria-hidden
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = "";
              if (file) void upload(file);
            }}
          />
          <button type="button" disabled={pending} onClick={() => input.current?.click()} className={PRIMARY_PILL}>
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
    </Card>
  );
}

function PhotoPreview({ name, url, shape, size, caption }: { name: string; url: string | null; shape: string; size: string; caption: string }) {
  return (
    <figure className="flex flex-col items-center gap-2">
      {url === null ? (
        <span aria-hidden className={`flex items-center justify-center bg-white-10 font-bold text-text-2 ${shape} ${size}`}>
          {initialsOf(name)}
        </span>
      ) : (
        // A blob: preview or a Blob store URL; next/image would need every store host configured.
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt="" className={`object-cover ${shape} ${size}`} />
      )}
      <figcaption className="text-[12px] text-prt-muted">{caption}</figcaption>
    </figure>
  );
}

function DetailsCard({ profile, saveLinkedin }: { profile: MyProfile; saveLinkedin: Actions["saveLinkedin"] }) {
  const [linkedin, setLinkedin] = useState(profile.linkedin ?? "");
  const [saved, setSaved] = useState(profile.linkedin ?? "");
  const [error, setError] = useState<string>();
  const [pending, setPending] = useState(false);

  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const checked = normalizeLinkedin(linkedin);
    if (!checked.ok) return setError(checked.error);
    setPending(true);
    try {
      const result = await saveLinkedin(linkedin);
      if (!result.ok) return setError(result.error);
      setLinkedin(result.value ?? "");
      setSaved(result.value ?? "");
      toast.success("Saved");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Please try again.");
    } finally {
      setPending(false);
    }
  };

  return (
    <Card title="Details">
      <form noValidate onSubmit={submit} className="px-5 py-5 md:px-[22px]">
        <div className="grid gap-x-4 gap-y-5 md:grid-cols-2">
          <Locked label="Name" hint="set by your lead" value={profile.name} />
          <Locked label="Role" hint="set by your lead" value={profile.role} />
          {profile.teamEmail && <Locked label="Team email" hint="shown on the site" value={profile.teamEmail} icon={<Mail aria-hidden className="h-4 w-4 shrink-0" strokeWidth={1.75} />} />}
          <Field label="LinkedIn" hint="optional" error={error} className={profile.teamEmail ? "" : "md:col-start-2"}>
            {(id, describedBy) => (
              <div className="relative">
                <Linkedin aria-hidden className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-text-2" strokeWidth={1.75} />
                <input
                  id={id}
                  value={linkedin}
                  onChange={(e) => {
                    setLinkedin(e.target.value);
                    setError(undefined);
                  }}
                  placeholder="linkedin.com/in/your-name"
                  autoComplete="url"
                  aria-invalid={error !== undefined}
                  aria-describedby={describedBy}
                  className={`${inputClass(error)} pl-10`}
                />
              </div>
            )}
          </Field>
        </div>
        <div className="mt-5 flex justify-end">
          <button type="submit" disabled={pending || linkedin.trim() === saved} className={`${GHOST_PILL} h-9 px-4 text-[14px] font-semibold`}>
            Save changes
          </button>
        </div>
      </form>
    </Card>
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

function LeaveCard({ leave, onLeft, requestLeave }: { leave: LeaveState; onLeft: () => void; requestLeave: Actions["requestLeave"] }) {
  const [asking, setAsking] = useState<"leave" | "delete" | null>(null);
  const [pending, setPending] = useState(false);

  const confirmLeave = async () => {
    setPending(true);
    try {
      const result = await requestLeave();
      if (!result.ok) {
        toast.error("Could not send your request", { description: result.error });
        return;
      }
      onLeft();
      setAsking(null);
      toast.success("Your division lead and the recruitment manager got your message");
    } finally {
      setPending(false);
    }
  };

  const requested = leave === "leave-requested";
  return (
    <Card title="Leave or delete" danger>
      <div className="divide-y divide-danger/25">
        <div className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between md:px-[22px]">
          <div className="min-w-0">
            <p className="text-[14px] font-medium">Leave the team</p>
            <p className="mt-0.5 text-[13px] text-prt-muted">
              {requested
                ? "You asked to leave. You move to the alumni list once your division lead and the recruitment manager confirm."
                : "Your division lead and the recruitment manager get a message, and you move to the alumni list once they confirm. You keep your account."}
            </p>
          </div>
          <button type="button" disabled={requested} onClick={() => setAsking("leave")} className={`${DANGER_GHOST_PILL} self-start sm:self-auto`}>
            {requested ? "Leave requested" : "Leave the team"}
          </button>
        </div>
        <div className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between md:px-[22px]">
          <div className="min-w-0">
            <p className="text-[14px] font-medium">Delete account</p>
            <p className="mt-0.5 text-[13px] text-prt-muted">
              Removes your account, photo and personal data for good. Members leave the team first.
            </p>
          </div>
          <button type="button" onClick={() => setAsking("delete")} className={`${DANGER_PILL} self-start sm:self-auto`}>
            Delete account
          </button>
        </div>
      </div>

      <ConfirmDialog
        open={asking === "leave"}
        onOpenChange={(open) => setAsking(open ? "leave" : null)}
        title="Leave the team?"
        confirmLabel="Leave the team"
        danger
        pending={pending}
        onConfirm={confirmLeave}
      >
        Your division lead and the recruitment manager get a message. Once they confirm, you move to the alumni list. You keep your account.
      </ConfirmDialog>
      <ConfirmDialog open={asking === "delete"} onOpenChange={(open) => setAsking(open ? "delete" : null)} title="Leave the team first">
        {requested
          ? "Your request to leave is with your division lead. Once they confirm, you can delete your account here."
          : "You are on the team, so your name and photo are on the site. Leave the team first; once your division lead confirms, you can delete your account here."}
      </ConfirmDialog>
    </Card>
  );
}
