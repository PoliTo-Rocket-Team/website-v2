"use client";

import { Layers } from "lucide-react";
import { ALL_DEPARTMENTS_LABEL, ALL_DIVISIONS_LABEL, type DivisionTab, type DivisionTabOption } from "@/lib/dashboard/division-tabs";
import { FilterMenu, Segmented } from "./controls";

// A department head's division tabs (boards 63, 64 and 65, issue #230):
// "All divisions" and each division with its count, from md; one "All
// divisions" pill that opens the same choice on phones (boards 63m to 65m).
// A full-access Access page draws the same tabs over the team's departments
// (issue #238). The page keeps which tab is open; the tabs only draw and
// report it.

const ALL = "all";

const WORDS = {
  division: { group: "Show divisions", menu: "Division", all: ALL_DIVISIONS_LABEL },
  department: { group: "Show departments", menu: "Department", all: ALL_DEPARTMENTS_LABEL },
} as const;

export function DivisionTabs({
  options,
  value,
  onChange,
  over = "division",
}: {
  options: readonly DivisionTabOption[];
  value: DivisionTab;
  onChange: (tab: DivisionTab) => void;
  /** What each tab is: a division, or a department on a full-access page. */
  over?: keyof typeof WORDS;
}) {
  const words = WORDS[over];
  return (
    <>
      {/* A flex box, so the tabs keep their own width on a full-width row (board 65). */}
      <div className="hidden min-w-0 md:flex">
        <Segmented
          label={words.group}
          value={value ?? ALL}
          onChange={(next) => onChange(next === ALL ? null : next)}
          options={options.map((o) => ({ value: o.division ?? ALL, label: o.label, count: o.count }))}
        />
      </div>
      <div className="md:hidden">
        <FilterMenu
          chip
          icon={Layers}
          label={words.menu}
          allLabel={words.all}
          value={value}
          onChange={onChange}
          options={options.flatMap((o) => (o.division === null ? [] : [{ value: o.division, label: o.label }]))}
        />
      </div>
    </>
  );
}
