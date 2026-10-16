"use client";

import { useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { toast } from "sonner";
import { Dialog, DialogClose, DialogOverlay, DialogPortal, DialogTitle } from "@/components/ui/dialog";
import { createProject } from "@/app/dashboard/project-actions";
import { newProjectProblems, PROJECT_KINDS, slugFrom, type NewProject, type ProjectKind } from "@/lib/project-content/new-project";
import { CONTENT_FOCUS as FOCUS } from "./content-parts";
import { SHEET_BUTTONS, SHEET_CANCEL, SHEET_CONTENT, SHEET_OVERLAY, SheetGrabber, sheetConfirm } from "./confirm-dialog";
import { Field, GroupLabel, inputClass } from "./field";

// New project on the dashboard Projects page (issue #301): the name, the
// address its page will have and whether it is a rocket or an engine. Create
// draft stores it as a draft, with the placeholder rocket on its card and
// page, and opens it in the editor (board 75b); it reaches no public page
// until it is published there. The address follows the name until it is
// typed in itself.

const KIND_LABEL: Readonly<Record<ProjectKind, string>> = { vehicle: "Rocket", engine: "Engine" };

export function NewProjectDialog({
  open,
  onOpenChange,
  taken,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The addresses the stored projects hold, so a taken one is caught before the request. */
  taken: ReadonlySet<string>;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [name, setName] = useState("");
  const [typedSlug, setTypedSlug] = useState<string | null>(null);
  const [kind, setKind] = useState<ProjectKind>("vehicle");
  const [tried, setTried] = useState(false);

  const project: NewProject = { name, slug: typedSlug ?? slugFrom(name), kind };
  const problems = tried ? newProjectProblems(project, taken) : [];
  const errorOf = (field: keyof NewProject) => problems.find((p) => p.field === field)?.error;

  const reset = () => {
    setName("");
    setTypedSlug(null);
    setKind("vehicle");
    setTried(false);
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    setTried(true);
    if (newProjectProblems(project, taken).length > 0) return;
    startTransition(async () => {
      const result = await createProject(project);
      if (!result.ok) {
        toast.error("Could not create the project", { description: result.error });
        return;
      }
      router.push(`/dashboard/projects/${result.value.slug}`);
    });
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next);
        if (!next) reset();
      }}
    >
      <DialogPortal>
        <DialogOverlay className={SHEET_OVERLAY} />
        <DialogPrimitive.Content aria-describedby={undefined} className={`${SHEET_CONTENT} sm:w-[480px]`}>
          <SheetGrabber />
          <DialogTitle className="text-[20px] font-bold leading-snug">New project</DialogTitle>
          <p className="mt-2 text-[14px] leading-relaxed text-text-2">
            It starts as a draft. Nothing shows on the site until you publish it.
          </p>
          <form onSubmit={submit} noValidate className="mt-6 flex flex-col gap-5">
            <Field label="Name" error={errorOf("name")}>
              {(id, describedBy) => (
                <input
                  id={id}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  aria-describedby={describedBy}
                  aria-invalid={describedBy !== undefined}
                  autoComplete="off"
                  placeholder="VES Mark III"
                  className={inputClass(errorOf("name"))}
                />
              )}
            </Field>
            <Field label="Address" hint="on the site" error={errorOf("slug")}>
              {(id, describedBy) => (
                <div className="relative">
                  <span aria-hidden className="pointer-events-none absolute inset-y-0 left-3.5 flex items-center font-mono text-[13px] text-dim">
                    /projects/
                  </span>
                  <input
                    id={id}
                    value={project.slug}
                    onChange={(e) => setTypedSlug(e.target.value)}
                    aria-describedby={describedBy}
                    aria-invalid={describedBy !== undefined}
                    autoComplete="off"
                    spellCheck={false}
                    className={`${inputClass(errorOf("slug"))} pl-[92px] font-mono text-[13px]`}
                  />
                </div>
              )}
            </Field>
            <div>
              <GroupLabel id="new-project-kind" label="Kind" />
              <div role="radiogroup" aria-labelledby="new-project-kind" className="grid grid-cols-2 gap-1 rounded-lg border border-hairline bg-panel/60 p-0.5">
                {PROJECT_KINDS.map((k) => (
                  <button
                    key={k}
                    type="button"
                    role="radio"
                    aria-checked={kind === k}
                    onClick={() => setKind(k)}
                    className={`h-9 rounded-md text-[14px] transition-colors duration-300 ease-out ${FOCUS} ${
                      kind === k ? "bg-white-10 font-semibold text-prt-text" : "text-text-2 hover:text-prt-text"
                    }`}
                  >
                    {KIND_LABEL[k]}
                  </button>
                ))}
              </div>
            </div>
            <div className={`${SHEET_BUTTONS} mt-1`}>
              <DialogClose type="button" className={SHEET_CANCEL}>
                Cancel
              </DialogClose>
              <button type="submit" disabled={pending} className={sheetConfirm(false)}>
                Create draft
              </button>
            </div>
          </form>
        </DialogPrimitive.Content>
      </DialogPortal>
    </Dialog>
  );
}
