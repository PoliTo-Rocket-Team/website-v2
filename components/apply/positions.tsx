"use client";

import * as AccordionPrimitive from "@radix-ui/react-accordion";
import { ArrowRight, Bell, Check, ChevronDown, Instagram, Lock, Plus } from "lucide-react";
import Link from "next/link";
import { useState, type ReactNode } from "react";
import { applyPage, INSTAGRAM_URL } from "@/lib/apply/page";
import type { ApplyListing, DepartmentGroup, Role } from "@/lib/apply/positions";

// The positions part of /apply, in the state the listing names (boards 34,
// 34b and 34c; 34m and 34bm on phones): a section title, department filter
// pills when more than one department shows, then one glass list per
// department. Every row is an item of one Radix accordion, so one row is open
// at a time. Every row starts closed: the boards draw one open only to show
// the open layout (issue #157). Rows open and close at once, with no
// animation.

export function Positions({ listing }: { listing: ApplyListing }) {
  return (
    <AccordionPrimitive.Root type="single" collapsible>
      {listing.kind === "none" ? (
        <Section title={applyPage.noneTitle} groups={listing.placeholders} notice={<Notice />} />
      ) : (
        <Section title={applyPage.openTitle} groups={listing.open} />
      )}
      {listing.kind === "few" && listing.others.length > 0 && <OtherRoles groups={listing.others} />}
    </AccordionPrimitive.Root>
  );
}

function Section({
  title,
  groups,
  notice,
}: {
  title: string;
  groups: readonly DepartmentGroup[];
  notice?: ReactNode;
}) {
  const [shown, setShown] = useState<string | null>(null);
  const visible = shown === null ? groups : groups.filter((g) => g.department === shown);
  return (
    <section className="px-5 pt-section md:px-16">
      <div className="mx-auto max-w-[1312px]">
        <h2 className="text-[26px] font-bold leading-[1.25] tracking-[-0.025em] md:text-[48px]">{title}</h2>
        {groups.length > 1 && <Filter groups={groups} shown={shown} onShow={setShown} />}
        {notice}
        <Groups groups={visible} />
      </div>
    </section>
  );
}

/** Board 34c: the closed roles of departments with nothing open, under their own title, intro and follow link. */
function OtherRoles({ groups }: { groups: readonly DepartmentGroup[] }) {
  return (
    <section className="px-5 pt-section md:px-16">
      <div className="mx-auto max-w-[1312px]">
        <h2 className="text-[26px] font-bold leading-[1.25] tracking-[-0.025em] md:text-[48px]">
          {applyPage.othersTitle}
        </h2>
        <div className="mt-4 flex flex-col gap-5 md:mt-8 md:flex-row md:items-center md:justify-between">
          <p className="text-[15px] leading-relaxed text-text-2 md:text-[17px]">{applyPage.othersIntro}</p>
          <FollowLink />
        </div>
        <Groups groups={groups} />
      </div>
    </section>
  );
}

/**
 * The department pills: "All" and each department with its count. The bar
 * scrolls sideways on phones, bleeding to the screen's right edge.
 */
function Filter({
  groups,
  shown,
  onShow,
}: {
  groups: readonly DepartmentGroup[];
  shown: string | null;
  onShow: (department: string | null) => void;
}) {
  const total = groups.reduce((n, g) => n + g.roles.length, 0);
  const pills = [
    { department: null, label: "All", count: total },
    ...groups.map((g) => ({ department: g.department, label: g.department, count: g.roles.length })),
  ];
  return (
    <div className="-mr-5 mt-6 overflow-x-auto [scrollbar-width:none] md:mr-0 md:mt-5 [&::-webkit-scrollbar]:hidden">
      <div role="group" aria-label="Filter by department" className="inline-flex gap-1 rounded-full bg-white-5 p-1 max-md:mr-5">
        {pills.map((p) => {
          const current = p.department === shown;
          return (
            <button
              key={p.label}
              type="button"
              aria-pressed={current}
              onClick={() => onShow(p.department)}
              className={`shrink-0 whitespace-nowrap rounded-full px-4 py-2 font-mono text-[12px] transition-colors duration-300 ease-out md:px-[18px] md:text-[13px] ${
                current ? "bg-prt-text text-ground" : "text-text-2 hover:text-prt-text"
              }`}
            >
              {p.label} · {p.count}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/** Board 34b: the notice that nothing is open, with the follow link. */
function Notice() {
  return (
    <div className="mt-8 flex flex-col gap-4 rounded-xl border border-accent/25 bg-accent/5 p-5 md:mt-9 md:flex-row md:items-center md:gap-5 md:px-7 md:py-6">
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-accent/40 bg-accent/10 text-accent">
        <Bell aria-hidden className="h-[18px] w-[18px]" />
      </span>
      <div className="flex-1">
        <p className="text-[19px] font-semibold leading-snug">{applyPage.notice.title}</p>
        <p className="mt-2 text-[15px] leading-relaxed text-text-2 md:mt-1">{applyPage.notice.body}</p>
      </div>
      <FollowLink className="w-full justify-center md:w-auto" />
    </div>
  );
}

function FollowLink({ className = "" }: { className?: string }) {
  return (
    <a
      href={INSTAGRAM_URL}
      target="_blank"
      rel="noopener noreferrer"
      className={`inline-flex shrink-0 items-center gap-2.5 rounded-full border border-white-10 px-5 py-3 text-[15px] font-semibold text-prt-text transition-colors duration-300 ease-out hover:border-border-strong ${className}`}
    >
      <Instagram aria-hidden className="h-4 w-4" />
      {applyPage.follow}
    </a>
  );
}

function Groups({ groups }: { groups: readonly DepartmentGroup[] }) {
  return (
    <div className="mt-8 flex flex-col gap-8 md:mt-10 md:gap-12">
      {groups.map((g) => (
        <Group key={g.department} group={g} />
      ))}
    </div>
  );
}

function Group({ group }: { group: DepartmentGroup }) {
  const open = group.roles.filter((r) => r.status === "open").length;
  return (
    <div>
      <h3 className="flex flex-wrap items-baseline gap-x-3 gap-y-1 px-0.5 md:px-1">
        <span className="text-[18px] font-bold tracking-[-0.01em] md:text-[20px]">{group.department}</span>
        <span className="font-mono text-[10px] tracking-[0.2em] text-prt-muted md:text-[11px]">
          DEPARTMENT{open > 0 && ` · ${open} OPEN`}
        </span>
      </h3>
      <ul className="glass-card mt-3 overflow-hidden rounded-xl md:mt-4">
        {group.roles.map((role) => (
          <RoleRow key={role.key} role={role} />
        ))}
      </ul>
    </div>
  );
}

function RoleRow({ role }: { role: Role }) {
  return (
    <AccordionPrimitive.Item value={role.key} asChild>
      <li className="border-t border-white-5 first:border-t-0 data-[state=open]:bg-white-5">
        <AccordionPrimitive.Header asChild>
          <div>
            <AccordionPrimitive.Trigger className="group/row flex w-full items-center gap-4 px-[18px] py-4 text-left md:gap-6 md:px-7 md:py-[18px]">
              <span className="min-w-0 flex-1">
                <span className="block text-[17px] font-semibold leading-snug md:text-[19px]">{role.title}</span>
                <span className="mt-0.5 block text-[13px] leading-snug text-text-2 md:text-[14px]">
                  {role.division} Division
                  <span className="md:hidden"> · {role.code}</span>
                </span>
                {role.status === "closed" && <ClosedTag className="mt-2 flex md:hidden" />}
              </span>
              {role.status === "closed" && <ClosedTag className="hidden md:inline-flex" />}
              <span className="hidden font-mono text-[11px] tracking-[0.15em] text-prt-muted md:inline">{role.code}</span>
              <ChevronDown
                aria-hidden
                className="h-4 w-4 shrink-0 text-prt-text transition-transform duration-300 ease-out group-data-[state=open]/row:rotate-180 motion-reduce:transition-none"
              />
            </AccordionPrimitive.Trigger>
          </div>
        </AccordionPrimitive.Header>
        <AccordionPrimitive.Content className="px-[18px] pb-6 md:px-7 md:pb-7">
          <RoleDetails role={role} />
        </AccordionPrimitive.Content>
      </li>
    </AccordionPrimitive.Item>
  );
}

function ClosedTag({ className }: { className: string }) {
  return (
    <span
      className={`w-fit items-center rounded-full border border-white-10 px-2.5 py-1 font-mono text-[9px] leading-none tracking-[0.2em] text-prt-muted md:text-[10px] ${className}`}
    >
      CLOSED
    </span>
  );
}

// An open row (board 34) puts the description on the left, filling the row,
// and the two skill lists side by side on the right, about 620px together.
// A closed row keeps the description over the skills. Phones stack both.
function RoleDetails({ role }: { role: Role }) {
  const skills = (
    <>
      <Skills label="REQUIRED SKILLS" skills={role.required} kind="required" />
      {role.desirable.length > 0 && <Skills label="DESIRABLE SKILLS" skills={role.desirable} kind="desirable" />}
    </>
  );
  return (
    <>
      {role.status === "open" ? (
        <div className="md:grid md:grid-cols-[minmax(0,1fr)_minmax(0,620px)] md:gap-14 md:pt-2">
          <p className="whitespace-pre-line text-[15px] leading-[1.6] text-text-2 md:text-[16px]">{role.description}</p>
          <div className="mt-6 grid gap-5 md:mt-0 md:grid-cols-2 md:gap-6">{skills}</div>
        </div>
      ) : (
        <>
          <p className="max-w-[760px] whitespace-pre-line text-[15px] leading-[1.6] text-text-2 md:pt-2 md:text-[16px]">
            {role.description}
          </p>
          <div className="mt-6 grid gap-5 md:mt-7 md:grid-cols-[396px_1fr] md:gap-0">{skills}</div>
        </>
      )}
      {role.status === "open" ? (
        <div className="mt-6 flex flex-col-reverse gap-4 border-white-5 md:mt-7 md:flex-row md:items-center md:justify-between md:border-t md:pt-5">
          <p className="text-center text-[13px] leading-snug text-prt-muted md:text-left">{applyPage.voluntary}</p>
          <Link
            href={role.href}
            className="group/apply inline-flex shrink-0 items-center justify-center gap-2 rounded-full bg-prt-text px-[22px] py-3 text-[15px] font-semibold text-ground transition-opacity hover:opacity-90 active:opacity-80 md:py-2.5 md:text-[14px]"
          >
            {applyPage.apply}
            <ArrowRight
              aria-hidden
              className="h-4 w-4 transition-transform duration-300 ease-out group-hover/apply:translate-x-1 motion-reduce:transition-none"
            />
          </Link>
        </div>
      ) : (
        <p className="mt-6 flex items-center justify-center gap-2.5 text-[13px] leading-snug text-prt-muted md:mt-7 md:justify-start md:border-t md:border-white-5 md:pt-5">
          <Lock aria-hidden className="h-3.5 w-3.5 shrink-0" />
          {applyPage.closed}
        </p>
      )}
    </>
  );
}

function Skills({
  label,
  skills,
  kind,
}: {
  label: string;
  skills: readonly string[];
  kind: "required" | "desirable";
}) {
  const Icon = kind === "required" ? Check : Plus;
  return (
    <div>
      <p className="font-mono text-[10px] tracking-[0.2em] text-prt-muted md:text-[11px]">{label}</p>
      <ul className="mt-2.5 flex flex-col gap-2 md:mt-3">
        {skills.map((skill) => (
          <li key={skill} className="flex items-start gap-3 text-[15px] leading-snug text-prt-text">
            <Icon
              aria-hidden
              className={`mt-[3px] h-3.5 w-3.5 shrink-0 ${kind === "required" ? "text-accent" : "text-prt-muted"}`}
              strokeWidth={2.25}
            />
            {skill}
          </li>
        ))}
      </ul>
    </div>
  );
}
