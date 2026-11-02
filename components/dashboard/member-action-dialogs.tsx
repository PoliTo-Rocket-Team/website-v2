"use client";

import { useState, useTransition } from "react";
import { Crown, GraduationCap, Type } from "lucide-react";
import { toast } from "sonner";
import { changeDivisionPeople, saveDivisionTitle, saveMember } from "@/app/dashboard/team-actions";
import { roleTitleError, type DivisionRoleChange } from "@/lib/dashboard/division-members";
import { advisingLine, defaultAdvisorScope, type AdvisorScope, type ScopeNames } from "@/lib/dashboard/hand-over";
import { advisorChange, advisorStep } from "@/lib/dashboard/member-actions";
import { ConfirmDialog } from "./confirm-dialog";
import { Field, inputClass } from "./field";
import { AdvisorScopePicker, RadioChoice } from "./hand-over-choice";

// The "are you sure" steps behind a member menu's Change title, Make lead and
// Becomes an advisor (issue #901), which the Team tree and the Members page
// open alike (`MemberDialogs`, ./division-members.tsx). Each saves through
// the write its action already has: the title through Edit details' title
// rule, Make lead through Edit details' lead switch, and Becomes an advisor
// through Edit division's save (`changeDivisionPeople`).

/** Who an action is about. */
type Person = { readonly id: number; readonly name: string };

export type TitleAsking = { readonly kind: "title"; readonly person: Person; readonly divisionId: number; readonly short: string; readonly title: string | null };
export type LeadAsking = { readonly kind: "lead"; readonly person: Person; readonly divisionId: number; readonly short: string };
/** Becomes an advisor: the divisions it may start from, the first picked at first. */
export type AdvisorAsking = { readonly kind: "advisor"; readonly person: Person; readonly roles: readonly [DivisionRoleChange, ...DivisionRoleChange[]] };

function firstName(name: string): string {
  return name.split(" ")[0] ?? name;
}

/** Keeps the last asking while the dialog closes, so its words do not vanish mid-close. */
function useShown<T>(asking: T | null): T | null {
  const [shown, setShown] = useState(asking);
  if (asking !== null && asking !== shown) setShown(asking);
  return asking ?? shown;
}

/** Change title: their role title in one division, by the rule Edit details checks it with. */
export function TitleDialog({ asking, onClose }: { asking: TitleAsking | null; onClose: () => void }) {
  const shown = useShown(asking);
  if (shown === null) return null;
  return <TitleForm key={`${shown.person.id}-${shown.divisionId}`} open={asking !== null} asking={shown} onClose={onClose} />;
}

function TitleForm({ open, asking, onClose }: { open: boolean; asking: TitleAsking; onClose: () => void }) {
  const [title, setTitle] = useState(asking.title ?? "");
  const [pending, startTransition] = useTransition();
  const error = roleTitleError(title) ?? undefined;
  const save = () =>
    startTransition(async () => {
      const result = await saveDivisionTitle(asking.person.id, asking.divisionId, title);
      if (!result.ok) {
        toast.error("Could not change the title", { description: result.error });
        return;
      }
      toast.success(`${asking.person.name}'s title in ${asking.short} is saved`);
      onClose();
    });
  return (
    <ConfirmDialog
      open={open}
      onOpenChange={(next) => !next && onClose()}
      icon={<Type className="h-5 w-5" strokeWidth={1.75} />}
      title={`Change ${firstName(asking.person.name)}'s title`}
      description={`Their role in ${asking.short}. Their other roles keep their titles.`}
      cancelLabel="Cancel"
      confirmLabel="Save title"
      pending={pending}
      confirmDisabled={error !== undefined}
      onConfirm={save}
    >
      <Field label={`Role in ${asking.short}`} hint="shown on the Team page" error={error} className="mt-5">
        {(id, describedBy) => (
          <input
            id={id}
            value={title}
            maxLength={80}
            autoComplete="off"
            aria-describedby={describedBy}
            aria-invalid={error !== undefined}
            onChange={(e) => setTitle(e.target.value)}
            className={inputClass(error)}
          />
        )}
      </Field>
    </ConfirmDialog>
  );
}

/** Make lead: they lead the division beside its other leads (epic #861) and keep every other role. */
export function LeadDialog({ asking, onClose }: { asking: LeadAsking | null; onClose: () => void }) {
  const shown = useShown(asking);
  const [pending, startTransition] = useTransition();
  if (shown === null) return null;
  const confirm = () =>
    startTransition(async () => {
      const result = await saveMember(shown.person.id, shown.divisionId, "division-lead");
      if (!result.ok) {
        toast.error(`Could not make ${shown.person.name} a lead`, { description: result.error });
        return;
      }
      toast.success(`${shown.person.name} leads ${shown.short}`);
      onClose();
    });
  return (
    <ConfirmDialog
      open={asking !== null}
      onOpenChange={(next) => !next && onClose()}
      icon={<Crown className="h-5 w-5" strokeWidth={1.75} />}
      title={`Make ${shown.person.name} a lead of ${shown.short}?`}
      description={`${firstName(shown.person.name)} leads ${shown.short} beside its other leads and keeps every other role and division.`}
      cancelLabel="Cancel"
      confirmLabel="Make lead"
      pending={pending}
      onConfirm={confirm}
    />
  );
}

/**
 * Becomes an advisor (issue #901): the #900 advisor choice, "Where does
 * Marco advise?", over the division they advise from, picked first when
 * more than one offers it. Their lead or member role there ends.
 */
export function AdvisorDialog({ asking, onClose }: { asking: AdvisorAsking | null; onClose: () => void }) {
  const shown = useShown(asking);
  if (shown === null) return null;
  return <AdvisorForm key={shown.person.id} open={asking !== null} asking={shown} onClose={onClose} />;
}

function AdvisorForm({ open, asking, onClose }: { open: boolean; asking: AdvisorAsking; onClose: () => void }) {
  const { person, roles } = asking;
  const [divisionId, setDivisionId] = useState(roles[0].divisionId);
  const [scope, setScope] = useState<AdvisorScope | null>(null);
  const [pending, startTransition] = useTransition();
  const role = roles.find((r) => r.divisionId === divisionId) ?? roles[0];
  const step = advisorStep(role);
  const picked = scope ?? defaultAdvisorScope(step);
  const names: ScopeNames = { division: role.short, department: role.department || null };
  const name = `advisor-${person.id}`;
  const confirm = () =>
    startTransition(async () => {
      const result = await changeDivisionPeople(role.divisionId, advisorChange(person.id, role, picked));
      if (!result.ok) {
        toast.error(`Could not make ${person.name} an advisor`, { description: result.error });
        return;
      }
      toast.success(`${person.name} is an advisor`);
      onClose();
    });
  return (
    <ConfirmDialog
      open={open}
      onOpenChange={(next) => !next && onClose()}
      icon={<GraduationCap className="h-5 w-5" strokeWidth={1.75} />}
      title={`Make ${firstName(person.name)} an advisor?`}
      description={`Their ${role.role === "lead" ? "lead" : "member"} role in ${role.short} ends. ${firstName(person.name)} ${advisingLine(step, picked, names)}. They keep their other divisions.`}
      cancelLabel="Cancel"
      confirmLabel="Make advisor"
      pending={pending}
      onConfirm={confirm}
    >
      <div className="mt-5 flex flex-col gap-5">
        {roles.length > 1 && (
          <RadioChoice
            name={`${name}-from`}
            legend="Advises instead of their role in"
            value={String(divisionId)}
            onChange={(value) => {
              setDivisionId(Number(value));
              setScope(null);
            }}
            options={roles.map((r) => ({ value: String(r.divisionId), title: r.short, detail: r.role === "lead" ? "Lead" : "Member" }))}
          />
        )}
        <AdvisorScopePicker name={name} person={person.name} from={step} field={{ value: scope, names, onChange: setScope }} />
      </div>
    </ConfirmDialog>
  );
}
