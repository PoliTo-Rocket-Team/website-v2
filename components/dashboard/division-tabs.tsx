"use client";

import { Layers } from "lucide-react";
import { ALL_DIVISIONS_LABEL, type DivisionTab, type DivisionTabOption } from "@/lib/dashboard/division-tabs";
import { FilterMenu, Segmented } from "./controls";

// A department head's division tabs (boards 63, 64 and 65, issue #230):
// "All divisions" and each division with its count, from md; one "All
// divisions" pill that opens the same choice on phones (boards 63m to 65m).
// The page keeps which tab is open; the tabs only draw and report it.

const ALL = "all";

export function DivisionTabs({
  options,
  value,
  onChange,
}: {
  options: readonly DivisionTabOption[];
  value: DivisionTab;
  onChange: (tab: DivisionTab) => void;
}) {
  return (
    <>
      {/* A flex box, so the tabs keep their own width on a full-width row (board 65). */}
      <div className="hidden min-w-0 md:flex">
        <Segmented
          label="Show divisions"
          value={value ?? ALL}
          onChange={(next) => onChange(next === ALL ? null : next)}
          options={options.map((o) => ({ value: o.division ?? ALL, label: o.label, count: o.count }))}
        />
      </div>
      <div className="md:hidden">
        <FilterMenu
          chip
          icon={Layers}
          label="Division"
          allLabel={ALL_DIVISIONS_LABEL}
          value={value}
          onChange={onChange}
          options={options.flatMap((o) => (o.division === null ? [] : [{ value: o.division, label: o.label }]))}
        />
      </div>
    </>
  );
}
