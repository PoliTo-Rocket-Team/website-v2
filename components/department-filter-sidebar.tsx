"use client";

import { ApplyPosition } from "@/app/actions/types";
import { cn } from "@/lib/utils";

type Department = {
  id: number;
  name: string;
  count: number;
};

type DepartmentFilterSidebarProps = {
  positions: ApplyPosition[];
  selectedDepartment: number | null;
  onDepartmentChange: (departmentId: number | null) => void;
};

export function DepartmentFilterSidebar({
  positions,
  selectedDepartment,
  onDepartmentChange,
}: DepartmentFilterSidebarProps) {
  // Calculate department counts
  const departments: Department[] = positions.reduce((acc, position) => {
    const existingDept = acc.find((d) => d.id === position.dept_id);
    if (existingDept) {
      existingDept.count++;
    } else {
      acc.push({
        id: position.dept_id,
        name: position.dept_name,
        count: 1,
      });
    }
    return acc;
  }, [] as Department[]);

  // Calculate total positions
  const totalCount = positions.length;

  return (
    <div className="space-y-2">
      <h3 className="font-semibold text-lg mb-4">Filter by teams</h3>
      
      {/* All teams option */}
      <button
        onClick={() => onDepartmentChange(null)}
        className={cn(
          "w-full text-left px-4 py-2 rounded-md transition-colors hover:bg-secondary",
          selectedDepartment === null && "bg-secondary text-orange-500 font-medium"
        )}
      >
        <div className="flex justify-between items-center">
          <span>All teams</span>
          <span className="text-sm text-muted-foreground">· {totalCount}</span>
        </div>
      </button>

      {/* Individual departments */}
      {departments.map((dept) => (
        <button
          key={dept.id}
          onClick={() => onDepartmentChange(dept.id)}
          className={cn(
            "w-full text-left px-4 py-2 rounded-md transition-colors hover:bg-secondary",
            selectedDepartment === dept.id && "bg-secondary text-orange-500 font-medium"
          )}
        >
          <div className="flex justify-between items-center">
            <span>{dept.name}</span>
            <span className="text-sm text-muted-foreground">· {dept.count}</span>
          </div>
        </button>
      ))}
    </div>
  );
}

