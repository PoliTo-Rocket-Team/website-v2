"use client";

import { useState, type FormEvent } from "react";
import { Pencil } from "lucide-react";
import { toast } from "sonner";
import { DEGREE_PROGRAMMES, STUDY_PROGRAMMES } from "@/lib/apply/application-form";
import {
  DETAIL_FIELDS,
  detailText,
  editableDetailKeys,
  levelLabel,
  parseDetailsChange,
  type DetailErrors,
  type DetailKey,
  type DetailsEditor,
  type YourDetails,
} from "@/lib/dashboard/details";
import type { WriteResult } from "@/lib/dashboard/write";
import { Card } from "./account-parts";
import { Drawer } from "./drawer";
import { Field, inputClass } from "./field";
import { EYEBROW } from "./page-header";

const labelOf = (key: DetailKey) => DETAIL_FIELDS.find((f) => f.key === key)!.label;

/** The small outlined Edit pill in a card's header (boards 51 and 55). */
export function EditPill({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex h-8 items-center gap-1.5 rounded-full border border-white-10 px-3 text-[13px] font-medium transition-colors duration-300 ease-out hover:border-border-strong focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
    >
      <Pencil aria-hidden className="h-3.5 w-3.5" strokeWidth={1.75} />
      Edit
    </button>
  );
}

/** One label over its value; an empty value is the dimmed dash. */
export function DetailValue({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="min-w-0">
      <dt className={EYEBROW}>{label}</dt>
      <dd className={`mt-1.5 break-words text-[14px] ${value === null ? "text-dim" : "text-prt-text"}`}>{value ?? "–"}</dd>
    </div>
  );
}

// "Your details" (boards 51 and 55): the fields the apply form starts from,
// two columns on phones and three from md, and Edit, which opens the panel
// on the right (a full page with a back arrow on phones). Every change lives
// in this card's state once the write answers. The card shows, and Save
// sends, only the fields its editor may write (`editableDetailKeys`).
export function YourDetailsCard({
  details,
  editor,
  saveDetails,
}: {
  details: YourDetails;
  editor: DetailsEditor;
  saveDetails: (input: unknown) => Promise<WriteResult<YourDetails>>;
}) {
  const keys = editableDetailKeys(editor);
  const [saved, setSaved] = useState(details);
  const [editing, setEditing] = useState(false);
  return (
    <Card title="Your details" meta={<EditPill onClick={() => setEditing(true)} />}>
      <dl className="grid grid-cols-2 gap-x-6 gap-y-4 px-5 pb-4 pt-5 md:grid-cols-3 md:px-6">
        {keys.map((key) => (
          <DetailValue key={key} label={labelOf(key)} value={detailText(saved, key)} />
        ))}
      </dl>
      <p className="px-5 pb-5 text-[12px] text-prt-muted md:px-6">We fill these into the form the next time you apply.</p>
      <DetailsDrawer
        open={editing}
        onOpenChange={setEditing}
        details={saved}
        editor={editor}
        saveDetails={saveDetails}
        onSaved={(next) => {
          setSaved(next);
          setEditing(false);
        }}
      />
    </Card>
  );
}

function DetailsDrawer({
  open,
  onOpenChange,
  details,
  editor,
  saveDetails,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  details: YourDetails;
  editor: DetailsEditor;
  saveDetails: (input: unknown) => Promise<WriteResult<YourDetails>>;
  onSaved: (details: YourDetails) => void;
}) {
  const keys = editableDetailKeys(editor);
  const [draft, setDraft] = useState<Record<DetailKey, string>>(details);
  const [errors, setErrors] = useState<DetailErrors>({});
  const [pending, setPending] = useState(false);

  const reset = (next: boolean) => {
    if (next) {
      setDraft(details);
      setErrors({});
    }
    onOpenChange(next);
  };

  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const checked = parseDetailsChange(draft, editor);
    if (!checked.ok) return setErrors(checked.errors);
    setPending(true);
    try {
      const result = await saveDetails(checked.value);
      if (!result.ok) {
        toast.error("Could not save your details", { description: result.error });
        return;
      }
      onSaved(result.value);
      toast.success("Saved");
    } finally {
      setPending(false);
    }
  };

  const set = (key: DetailKey, value: string) => {
    setDraft((d) => ({ ...d, [key]: value }));
    setErrors((errs) => ({ ...errs, [key]: undefined }));
  };

  return (
    <Drawer
      open={open}
      onOpenChange={reset}
      title="Your details"
      detail="We fill these into the form the next time you apply."
      submitLabel="Save details"
      submitting={pending}
      onSubmit={submit}
    >
      <div className="grid gap-x-4 gap-y-5 sm:grid-cols-2">
        {keys.map((key) => (
          <Field key={key} label={labelOf(key)} error={errors[key]} className={key === "linkedin" || key === "programme" ? "sm:col-span-2" : ""}>
            {(id, describedBy) => {
              const common = {
                id,
                value: draft[key],
                "aria-invalid": errors[key] !== undefined,
                "aria-describedby": describedBy,
                className: inputClass(errors[key]),
              };
              if (key === "programme" || key === "level") {
                const options = key === "programme" ? DEGREE_PROGRAMMES : STUDY_PROGRAMMES;
                return (
                  <select {...common} onChange={(e) => set(key, e.target.value)}>
                    <option value="">Pick one</option>
                    {options.map((o) => (
                      <option key={o} value={o}>
                        {key === "level" ? levelLabel(o as (typeof STUDY_PROGRAMMES)[number]) : o}
                      </option>
                    ))}
                  </select>
                );
              }
              return (
                <input
                  {...common}
                  type={key === "birthDate" ? "date" : key === "phone" ? "tel" : "text"}
                  onChange={(e) => set(key, e.target.value)}
                  placeholder={PLACEHOLDERS[key]}
                  autoComplete={AUTOCOMPLETE[key]}
                />
              );
            }}
          </Field>
        ))}
      </div>
    </Drawer>
  );
}

const PLACEHOLDERS: Partial<Record<DetailKey, string>> = {
  phone: "+39 333 123 4567",
  politoId: "s312456",
  linkedin: "linkedin.com/in/your-name",
};

const AUTOCOMPLETE: Partial<Record<DetailKey, string>> = {
  firstName: "given-name",
  lastName: "family-name",
  phone: "tel",
  country: "country-name",
  birthDate: "bday",
  linkedin: "url",
};
