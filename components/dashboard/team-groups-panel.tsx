"use client";

import { useId, useState } from "react";
import { ChevronDown, ChevronUp, Plus, Trash2 } from "lucide-react";
import type { LayoutGroup, TeamLayout } from "@/lib/about/team-layout";
import {
  blocksIn,
  groupNameError,
  withGroupAdded,
  withGroupMoved,
  withGroupRenamed,
  withoutGroup,
  type GroupPlace,
} from "@/lib/about/team-page-groups";
import { CONTENT_FOCUS } from "./content-parts";
import { PANEL_GHOST_BUTTON, PANEL_PRIMARY_BUTTON } from "./drawer";
import { Field, GroupLabel, inputClass } from "./field";
import { PANEL_HINT, TeamPanel, VisualOnlyNote } from "./team-panel-parts";

// The Department groups panel (issue #856), opened by "Edit groups" beside a
// slide's heading on the Team page editor: the groups the departments
// carousel draws, in order. Each row renames its group in place, moves it
// up or down and deletes it, which is refused while a
// department sits in it; "Add group" puts a new one before or after any
// group, or at the end. Built from the panel parts the head and advisor
// panels use. The page redraws as the editor types; Done keeps the groups in
// the editor, and the edit bar's Save draft or Publish sends them. Which
// group a department sits in is set on its own head block panel.

const ICON_BUTTON = `inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-prt-muted transition-colors duration-300 ease-out hover:bg-white-5 hover:text-prt-text disabled:pointer-events-none disabled:text-white-10 ${CONTENT_FOCUS}`;

const LINK = `inline-flex items-center gap-1.5 rounded-md text-[13px] font-semibold text-accent transition-colors duration-300 ease-out hover:text-accent-hover ${CONTENT_FOCUS}`;

/** A place the Place field offers, as its option's value: "end", or "before:<id>" / "after:<id>". */
type PlaceValue = "end" | `before:${number}` | `after:${number}`;

function placeOf(value: PlaceValue): GroupPlace {
  if (value === "end") return "end";
  const [side, id] = value.split(":");
  return side === "before" ? { before: Number(id) } : { after: Number(id) };
}

const shownName = (group: LayoutGroup) => group.name.trim() || "Unnamed group";

export function TeamGroupsPanel({
  layout,
  onChange,
  onDone,
  onCancel,
}: {
  /** The working layout with the panel's groups laid on. */
  layout: TeamLayout;
  onChange: (groups: readonly LayoutGroup[]) => void;
  onDone: () => void;
  onCancel: () => void;
}) {
  const { groups } = layout;
  const [refusals, setRefusals] = useState<Readonly<Record<number, string>>>({});
  const [name, setName] = useState("");
  const [place, setPlace] = useState<PlaceValue>("end");
  const [nameError, setNameError] = useState<string | undefined>(undefined);
  const listLabel = useId();

  const change = (next: TeamLayout) => {
    setRefusals({});
    onChange(next.groups);
  };

  const remove = (id: number) => {
    const step = withoutGroup(layout, id);
    if (step.ok) change(step.layout);
    else setRefusals({ [id]: step.error });
  };

  const add = () => {
    const error = groupNameError(name);
    setNameError(error);
    if (error !== undefined) return;
    const step = withGroupAdded(layout, placeOf(place), name.trim());
    if (!step.ok) {
      setNameError(step.error);
      return;
    }
    change(step.layout);
    setName("");
    setPlace("end");
  };

  return (
    <TeamPanel
      label="Department groups"
      eyebrow="Departments"
      title="Department groups"
      onClose={onCancel}
      footEnd={
        <>
          <button type="button" onClick={onCancel} className={PANEL_GHOST_BUTTON}>
            Cancel
          </button>
          <button type="button" onClick={onDone} className={PANEL_PRIMARY_BUTTON}>
            Done
          </button>
        </>
      }
    >
      <VisualOnlyNote>
        Visual only. Groups are the headings of the departments area on the Team page. They change nothing in the team. Pick a department&apos;s group on its
        head block.
      </VisualOnlyNote>

      <div>
        <GroupLabel id={listLabel} label="Groups" hint="in page order" />
        <ul aria-labelledby={listLabel} className="space-y-2">
          {groups.map((group, index) => (
            <GroupRow
              key={group.id}
              group={group}
              count={blocksIn(layout, group.id)}
              refusal={refusals[group.id]}
              first={index === 0}
              last={index === groups.length - 1}
              onName={(next) => change(withGroupRenamed(layout, group.id, next))}
              onMove={(by) => change(withGroupMoved(layout, group.id, index + by))}
              onRemove={() => remove(group.id)}
            />
          ))}
        </ul>
        <p className={PANEL_HINT}>A group with no department shows nothing on the page.</p>
      </div>

      <div className="space-y-3 rounded-[10px] border border-white-10 p-3">
        <div className="grid grid-cols-2 gap-2.5">
          <Field label="New group" error={nameError}>
            {(id, describedBy) => (
              <input
                id={id}
                value={name}
                placeholder="Group name"
                aria-describedby={describedBy}
                aria-invalid={nameError !== undefined}
                onChange={(e) => {
                  setName(e.target.value);
                  setNameError(undefined);
                }}
                className={inputClass(nameError)}
              />
            )}
          </Field>
          <Field label="Place">
            {(id) => (
              <select id={id} value={place} onChange={(e) => setPlace(e.target.value as PlaceValue)} className={`${inputClass()} cursor-pointer`}>
                <option value="end" className="bg-panel">
                  At the end
                </option>
                {groups.map((g) => (
                  <option key={`before:${g.id}`} value={`before:${g.id}`} className="bg-panel">
                    Before {shownName(g)}
                  </option>
                ))}
                {groups.map((g) => (
                  <option key={`after:${g.id}`} value={`after:${g.id}`} className="bg-panel">
                    After {shownName(g)}
                  </option>
                ))}
              </select>
            )}
          </Field>
        </div>
        <button type="button" onClick={add} className={LINK}>
          <Plus aria-hidden className="h-3.5 w-3.5" strokeWidth={2} />
          Add group
        </button>
      </div>
    </TeamPanel>
  );
}

/** One group: its name typed in place, how many departments it holds, move up and down, and delete. */
function GroupRow({
  group,
  count,
  refusal,
  first,
  last,
  onName,
  onMove,
  onRemove,
}: {
  group: LayoutGroup;
  count: number;
  /** Why the last delete was refused; undefined when none was. */
  refusal: string | undefined;
  first: boolean;
  last: boolean;
  onName: (name: string) => void;
  /** -1 moves it up one place, 1 down one. */
  onMove: (by: -1 | 1) => void;
  onRemove: () => void;
}) {
  const error = groupNameError(group.name);
  const messageId = useId();
  const message = error ?? refusal;
  const name = shownName(group);
  return (
    <li className={`rounded-[10px] border bg-white-5 ${message === undefined ? "border-white-10" : "border-danger"}`}>
      <div className="flex items-center gap-2 px-3 py-2.5">
        <div className="min-w-0 flex-1">
          <input
            aria-label="Group name"
            value={group.name}
            aria-describedby={message === undefined ? undefined : messageId}
            aria-invalid={error !== undefined}
            onChange={(e) => onName(e.target.value)}
            className={`${inputClass(error)} h-9`}
          />
          <p className="mt-1 text-[12px] leading-tight text-prt-muted">{count === 0 ? "No departments" : count === 1 ? "1 department" : `${count} departments`}</p>
        </div>
        <button type="button" disabled={first} onClick={() => onMove(-1)} aria-label={`Move ${name} up`} className={ICON_BUTTON}>
          <ChevronUp aria-hidden className="h-4 w-4" strokeWidth={1.75} />
        </button>
        <button type="button" disabled={last} onClick={() => onMove(1)} aria-label={`Move ${name} down`} className={ICON_BUTTON}>
          <ChevronDown aria-hidden className="h-4 w-4" strokeWidth={1.75} />
        </button>
        <button type="button" onClick={onRemove} aria-label={`Delete ${name}`} className={ICON_BUTTON}>
          <Trash2 aria-hidden className="h-3.5 w-3.5" strokeWidth={1.75} />
        </button>
      </div>
      {message !== undefined && (
        <p id={messageId} role="alert" className="px-3 pb-2.5 text-[12px] text-danger">
          {message}
        </p>
      )}
    </li>
  );
}
