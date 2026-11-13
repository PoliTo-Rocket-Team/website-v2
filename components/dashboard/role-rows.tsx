"use client";

import type { ReactNode } from "react";
import * as DropdownMenuPrimitive from "@radix-ui/react-dropdown-menu";
import { Check, ChevronDown, Crown, GraduationCap, Lock, Plus, User, UserMinus } from "lucide-react";
import { DropdownMenu, DropdownMenuPortal, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { sameAdvisorChoice, type AdvisorPlaceChoice, type AdvisorPlaceOption } from "@/lib/dashboard/advisor-roles";
import { ADVISOR_SCOPE_LABELS, roleLabel, sameRole, type RoleChoice, type RoleOption } from "@/lib/dashboard/member-actions";
import type { MoveDepartment } from "@/lib/dashboard/member-move";
import type { Permission } from "@/lib/dashboard/team";
import { inputClass } from "./field";
import { Chips } from "./division-chips";

// Edit details' role rows (issue #972, boards 103b to 103d): one row per
// place someone holds, with the unit's name, its department muted, a role
// pill and a ⋯ menu, and the place's title box under it. The pill opens the
// dashboard's own menu (103c), never the browser's dropdown; the ⋯ holds Move
// to… and Remove from this division (103d). Every choice is staged: the panel's
// Save applies it.

const FOCUS = "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";

/** The dark menu surface every dashboard menu draws (the member ⋯ menu's, `RowMenu`). */
const MENU_CONTENT =
  "z-50 rounded-xl border border-hairline bg-panel p-1.5 text-prt-text shadow-[0_16px_40px_rgba(0,0,0,0.6)] focus:outline-none motion-safe:data-[state=open]:animate-in motion-safe:data-[state=open]:fade-in-0";

const PILL = `inline-flex h-8 min-w-0 max-w-full items-center gap-1.5 rounded-full border px-3 text-[13px] font-medium transition-colors duration-300 ease-out ${FOCUS}`;

/** The muted group heading inside a menu: "ADVISOR · ADVISES". */
const MENU_LABEL = "px-2.5 pb-1 pt-2 font-mono text-[10px] uppercase tracking-[0.3em] text-dim";

/**
 * One place's row (board 103b), flat on the panel: the unit's name, its
 * department muted beside it, then the pill and the ⋯; `children` sit under
 * the row (the title box, a move's boxes, the step-down question). The name is
 * the row's identity, so it never truncates: it wraps, the department
 * truncates first, and a long pill gives way before either.
 */
export function RoleRow({ name, department, pill, menu, children }: { name: string; department: string | null; pill: ReactNode; menu: ReactNode; children?: ReactNode }) {
  return (
    <li>
      <div className="flex min-h-8 items-center gap-2.5">
        <p className="flex min-w-[45%] flex-1 flex-wrap items-baseline gap-x-2">
          <span className="min-w-0 text-[14px] font-medium text-prt-text [overflow-wrap:anywhere]">{name}</span>
          {department !== null && department !== "" && <span className="min-w-0 max-w-full truncate text-[13px] text-prt-muted">{department}</span>}
        </p>
        {pill}
        {menu !== null && menu !== false && <div className="flex shrink-0">{menu}</div>}
      </div>
      {children}
    </li>
  );
}

/** A pill that opens nothing: a seat, a headship or a division added on this Save, whose role here is fixed. */
export function FixedPill({ children, locked = false }: { children: ReactNode; locked?: boolean }) {
  return (
    <span className={`${PILL} cursor-default border-white-10 text-text-2`}>
      <span className="truncate">{children}</span>
      {locked && <Lock aria-hidden className="h-3 w-3 shrink-0 text-prt-muted" strokeWidth={1.75} />}
    </span>
  );
}

/**
 * The role pill (board 103c): what they are in the division, opening Member,
 * Lead, then the advisor scopes under "Advisor · advises". The current choice
 * carries a check; a locked one is disabled with its reason under it. `staged`
 * draws the pill in the accent once its choice differs from what they are now.
 */
export function RolePill({
  label,
  options,
  value,
  staged,
  onChange,
}: {
  /** "Role in Mission Analysis": the pill's accessible name, before its value. */
  label: string;
  options: readonly RoleOption[];
  value: RoleChoice;
  staged: boolean;
  onChange: (choice: RoleChoice) => void;
}) {
  const roles = options.filter((o) => o.choice.kind !== "advisor");
  const advisors = options.filter((o) => o.choice.kind === "advisor");
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={`${label}: ${roleLabel(value)}`}
        className={`${PILL} ${staged ? "border-accent text-prt-text" : "border-white-10 text-prt-text hover:border-border-strong"} data-[state=open]:border-accent`}
      >
        <span className="truncate">{roleLabel(value)}</span>
        <ChevronDown aria-hidden className="h-3.5 w-3.5 shrink-0 text-prt-muted" strokeWidth={1.75} />
      </DropdownMenuTrigger>
      <DropdownMenuPortal>
        <DropdownMenuPrimitive.Content align="end" sideOffset={6} className={`${MENU_CONTENT} w-[280px]`}>
          {roles.map((o) => (
            <RoleItem key={o.choice.kind} option={o} current={sameRole(o.choice, value)} onChange={onChange}>
              {roleLabel(o.choice)}
            </RoleItem>
          ))}
          {advisors.length > 0 && (
            <DropdownMenuPrimitive.Group>
              <DropdownMenuPrimitive.Separator className="my-1.5 h-px bg-hairline" />
              <DropdownMenuPrimitive.Label className={MENU_LABEL}>Advisor · advises</DropdownMenuPrimitive.Label>
              {advisors.map((o) => (
                <RoleItem key={o.choice.kind === "advisor" ? o.choice.scope : o.choice.kind} option={o} current={sameRole(o.choice, value)} onChange={onChange}>
                  {o.choice.kind === "advisor" ? ADVISOR_SCOPE_LABELS[o.choice.scope] : roleLabel(o.choice)}
                </RoleItem>
              ))}
            </DropdownMenuPrimitive.Group>
          )}
        </DropdownMenuPrimitive.Content>
      </DropdownMenuPortal>
    </DropdownMenu>
  );
}

function RoleItem({ option, current, onChange, children }: { option: RoleOption; current: boolean; onChange: (choice: RoleChoice) => void; children: ReactNode }) {
  return (
    <ChoiceItem permission={option.permission} detail={option.detail} current={current} icon={<RoleIcon kind={option.choice.kind} />} onSelect={() => onChange(option.choice)}>
      {children}
    </ChoiceItem>
  );
}

/**
 * The pill of a department or whole-team Advisor role (issue #976), in the
 * role pill's own look (board 103c): the places the role may move to under
 * "Advisor · advises", then End this role. Locked choices carry their reason.
 */
export function AdvisorPlacePill({
  label,
  options,
  value,
  shown,
  staged,
  onChange,
}: {
  /** "Role in Aerodynamics": the pill's accessible name, before its value. */
  label: string;
  options: readonly AdvisorPlaceOption[];
  value: AdvisorPlaceChoice;
  /** "Advisor", "Advisor · Mission Analysis", "Ends on Save" (`advisorPillLabel`). */
  shown: string;
  staged: boolean;
  onChange: (choice: AdvisorPlaceChoice) => void;
}) {
  const places = options.filter((o) => o.choice.kind === "advise");
  const end = options.filter((o) => o.choice.kind === "end");
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={`${label}: ${shown}`}
        className={`${PILL} ${staged ? "border-accent text-prt-text" : "border-white-10 text-prt-text hover:border-border-strong"} data-[state=open]:border-accent`}
      >
        <span className="truncate">{shown}</span>
        <ChevronDown aria-hidden className="h-3.5 w-3.5 shrink-0 text-prt-muted" strokeWidth={1.75} />
      </DropdownMenuTrigger>
      <DropdownMenuPortal>
        {/* Opens beside the pill, not under it: on that side Radix can slide the menu up and down, so the whole
            window height is its room (a whole-team advisor's list is ~444px). It scrolls only when the window is shorter. */}
        <DropdownMenuPrimitive.Content
          side="left"
          align="start"
          sideOffset={6}
          collisionPadding={8}
          className={`${MENU_CONTENT} max-h-[var(--radix-dropdown-menu-content-available-height)] w-[280px] overflow-y-auto`}
        >
          <DropdownMenuPrimitive.Label className={MENU_LABEL}>Advisor · advises</DropdownMenuPrimitive.Label>
          {places.map((o) => (
            <ChoiceItem
              key={o.label}
              permission={o.permission}
              detail={o.detail}
              current={sameAdvisorChoice(o.choice, value)}
              icon={<GraduationCap aria-hidden className="mt-0.5 h-3.5 w-3.5 shrink-0" strokeWidth={1.75} />}
              onSelect={() => onChange(o.choice)}
            >
              {o.label}
            </ChoiceItem>
          ))}
          {end.length > 0 && <DropdownMenuPrimitive.Separator className="my-1.5 h-px bg-hairline" />}
          {end.map((o) => (
            <ChoiceItem
              key={o.label}
              permission={o.permission}
              detail={o.detail}
              current={sameAdvisorChoice(o.choice, value)}
              icon={<UserMinus aria-hidden className="mt-0.5 h-3.5 w-3.5 shrink-0" strokeWidth={1.75} />}
              onSelect={() => onChange(o.choice)}
            >
              {o.label}
            </ChoiceItem>
          ))}
        </DropdownMenuPrimitive.Content>
      </DropdownMenuPortal>
    </DropdownMenu>
  );
}

/** One checkable item of a pill's menu: open, or disabled with its reason under it; the current one carries a check. */
function ChoiceItem({
  permission,
  detail,
  current,
  icon,
  onSelect,
  children,
}: {
  permission: Permission;
  detail: string | null;
  current: boolean;
  icon: ReactNode;
  onSelect: () => void;
  children: ReactNode;
}) {
  const disabled = !permission.allowed;
  const under = permission.allowed ? detail : permission.reason;
  return (
    <DropdownMenuPrimitive.CheckboxItem
      checked={current}
      disabled={disabled}
      onSelect={onSelect}
      className={`flex cursor-pointer items-start gap-2.5 rounded-lg px-2.5 py-2 text-[13px] outline-none transition-colors data-[disabled]:cursor-not-allowed data-[highlighted]:bg-white-5 ${
        disabled ? "text-prt-muted" : "text-text-2 data-[highlighted]:text-prt-text data-[state=checked]:text-prt-text"
      }`}
    >
      {icon}
      <span className="min-w-0 flex-1">
        <span className="block">{children}</span>
        {under !== null && <span className="mt-0.5 block text-[12px] leading-snug text-dim">{under}</span>}
      </span>
      <span aria-hidden className="mt-0.5 flex h-3.5 w-3.5 shrink-0 items-center justify-center">
        {disabled ? (
          <Lock className="h-3.5 w-3.5" strokeWidth={1.75} />
        ) : (
          <DropdownMenuPrimitive.ItemIndicator>
            <Check className="h-3.5 w-3.5 text-accent" strokeWidth={2} />
          </DropdownMenuPrimitive.ItemIndicator>
        )}
      </span>
    </DropdownMenuPrimitive.CheckboxItem>
  );
}

/** Each role's icon in the pill's menu (board 103c): a person for Member, a crown for Lead, a mortarboard for every advisor scope. */
function RoleIcon({ kind }: { kind: RoleChoice["kind"] }) {
  const Icon = kind === "member" ? User : kind === "lead" ? Crown : GraduationCap;
  return <Icon aria-hidden className="mt-0.5 h-3.5 w-3.5 shrink-0" strokeWidth={1.75} />;
}

/** A place's title box under its row (board 103b): no label of its own, its name read aloud; the error under it. */
export function RowTitle({
  name,
  label,
  value,
  error,
  required = false,
  onChange,
}: {
  name: string;
  /** "Title in Mission Analysis": what a screen reader and the error summary name it. */
  label: string;
  value: string;
  error: string | undefined;
  required?: boolean;
  onChange: (value: string) => void;
}) {
  const errorId = `${name}-error`;
  return (
    <div className="mt-3">
      <input
        name={name}
        value={value}
        maxLength={80}
        autoComplete="off"
        aria-label={label}
        aria-required={required}
        aria-invalid={error !== undefined}
        aria-describedby={error === undefined ? undefined : errorId}
        placeholder="Title on the Team page"
        onChange={(e) => onChange(e.target.value)}
        className={inputClass(error)}
      />
      {error !== undefined && (
        <p id={errorId} className="mt-1.5 text-[12px] text-danger">
          {error}
        </p>
      )}
    </div>
  );
}

/**
 * "+ Add division" under the rows (board 103b): the divisions the viewer may
 * place them in, by department, each one they are in already left out. The
 * pick is a new row, added on Save.
 */
export function AddDivision({ departments, taken, onPick }: { departments: readonly MoveDepartment[]; taken: readonly number[]; onPick: (division: { id: number; short: string; department: string }) => void }) {
  const open = departments.map((d) => ({ ...d, divisions: d.divisions.filter((v) => !taken.includes(v.id)) })).filter((d) => d.divisions.length > 0);
  if (open.length === 0) return null;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className={`mt-3 inline-flex items-center gap-1.5 rounded-sm text-[13px] font-medium text-accent transition-colors duration-300 ease-out hover:text-prt-text ${FOCUS}`}
      >
        <Plus aria-hidden className="h-3.5 w-3.5" strokeWidth={2} />
        Add division
      </DropdownMenuTrigger>
      <DropdownMenuPortal>
        <DropdownMenuPrimitive.Content
          align="start"
          sideOffset={6}
          className={`${MENU_CONTENT} max-h-[min(420px,var(--radix-dropdown-menu-content-available-height))] w-[300px] overflow-y-auto`}
        >
          {open.map((d) => (
            <DropdownMenuPrimitive.Group key={d.id} className="py-1 first:pt-0">
              <DropdownMenuPrimitive.Label className={MENU_LABEL}>{d.name}</DropdownMenuPrimitive.Label>
              {d.divisions.map((v) => (
                <DropdownMenuPrimitive.Item
                  key={v.id}
                  onSelect={() => onPick({ id: v.id, short: v.name, department: d.name })}
                  className="flex h-10 cursor-pointer items-center gap-2.5 rounded-lg px-2.5 text-[14px] outline-none transition-colors data-[highlighted]:bg-white-5"
                >
                  {v.code !== null && <Chips chips={[{ divisionId: v.id, label: v.code, code: true }]} />}
                  <span className="min-w-0 truncate">{v.name}</span>
                </DropdownMenuPrimitive.Item>
              ))}
            </DropdownMenuPrimitive.Group>
          ))}
        </DropdownMenuPrimitive.Content>
      </DropdownMenuPortal>
    </DropdownMenu>
  );
}
