"use client";

import { useState } from "react";
import { ApplyPosition } from "@/app/actions/types";
import { ApplyPositionsList } from "@/components/apply-positions-list";
import { DepartmentFilterSidebar } from "@/components/department-filter-sidebar";

type ApplyPageClientProps = {
  positions: ApplyPosition[];
};

export function ApplyPageClient({ positions }: ApplyPageClientProps) {
  const [selectedDepartment, setSelectedDepartment] = useState<number | null>(null);

  return (
    <div className="max-w-7xl mx-auto">
      <h2 className="text-lg md:text-4xl font-bold text-center text-primary mb-4 md:mb-8">
        Open Positions
      </h2>
      
      <div className="flex flex-col md:flex-row gap-6 md:gap-8">
        {/* Sidebar for department filter */}
        <aside className="w-full md:w-64 flex-shrink-0">
          <DepartmentFilterSidebar
            positions={positions}
            selectedDepartment={selectedDepartment}
            onDepartmentChange={setSelectedDepartment}
          />
        </aside>

        {/* Main content area */}
        <div className="flex-1 min-w-0">
          {/* Column headers - hide Department column since it's now in sidebar */}
          <div className="hidden md:visible md:grid md:grid-cols-[3fr_2fr_auto] text-center md:justify-items-start text-base px-2 py-4 mb-2">
            <h3>Position</h3>
            <h3>Division</h3>
            <div className="w-4"></div>
          </div>
          
          <ApplyPositionsList
            positions={positions}
            pageContext="apply"
            disclaimer="true"
            selectedDepartment={selectedDepartment}
          />
        </div>
      </div>
    </div>
  );
}

