"use server";

import { createClient } from "@/utils/supabase/server";
import { Database } from "@/types/supabase";

export type ApplyPosition =
  Database["public"]["Tables"]["apply_positions"]["Row"] & {
    divisions?: Partial<
      Database["public"]["Tables"]["divisions"]["Row"] & {
        departments?: { name: string } | null;
      }
    > | null;
  };

export async function getApplyPositionsByUserRole() {
  const supabase = await createClient();

  // Get current user
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { positions: [] };

  // Get user member information
  const { data: userData } = await supabase
    .from("users")
    .select("member")
    .eq("id", user.id)
    .single();

  if (!userData?.member) {
    return { positions: [] };
  }

  // Get user roles
  const { data: userRoles } = await supabase
    .from("roles")
    .select("id, type, dept_id, division_id, title")
    .eq("member_id", userData.member);

  if (!userRoles || userRoles.length === 0) {
    return { positions: [] };
  }

  // Get all divisions with their department info to map division_id to dept_id
  const { data: divisions } = await supabase
    .from("divisions")
    .select("id, name, dept_id");

  if (!divisions) {
    return { positions: [] };
  }

  // Create a mapping of division_id to dept_id
  const divisionToDepartmentMap = new Map();
  divisions.forEach((division) => {
    if (division.dept_id) {
      divisionToDepartmentMap.set(division.id, division.dept_id);
    }
  });

  // Create a mapping of dept_id to array of division_ids (for chiefs to see all divisions in their department)
  const departmentToDivisionsMap = new Map();
  divisions.forEach((division) => {
    if (division.dept_id) {
      if (!departmentToDivisionsMap.has(division.dept_id)) {
        departmentToDivisionsMap.set(division.dept_id, []);
      }
      departmentToDivisionsMap.get(division.dept_id).push(division.id);
    }
  });

  // Get all open positions with related data
  const { data: allPositions, error: positionsError } = await supabase.from(
    "apply_positions"
  ).select(`
       *,
    divisions(
      *,
      departments(name))
    `);

  if (positionsError) {
    console.error("Error getting open positions:", positionsError);
    return { positions: [] };
  }

  if (!allPositions) {
    return { positions: [] };
  }

  let filteredPositions: ApplyPosition[] = [];

  // Filter positions based on user role
  for (const userRole of userRoles) {
    // President can see all positions
    if (userRole.type === "president") {
      allPositions.forEach((position) => {
        filteredPositions.push({
          ...position,
          divisions: position.divisions as Partial<
            Database["public"]["Tables"]["divisions"]["Row"]
          > | null,
        });
      });
    }
    // Chiefs and coordinators can see positions in all divisions that belong to their department
    else if (
      (userRole.type === "chief" || userRole.type === "coordinator") &&
      userRole.dept_id
    ) {
      // Get all division IDs that belong to this department
      const divisionsInDept =
        departmentToDivisionsMap.get(userRole.dept_id) || [];

      allPositions.forEach((position) => {
        if (divisionsInDept.includes(position.division_id)) {
          filteredPositions.push({
            ...position,
            divisions: position.divisions as Partial<
              Database["public"]["Tables"]["divisions"]["Row"]
            > | null,
          });
        }
      });
    }
    // Leads can see positions only in their specific division
    else if (userRole.type === "lead" && userRole.division_id) {
      allPositions.forEach((position) => {
        if (position.division_id === userRole.division_id) {
          filteredPositions.push({
            ...position,
            divisions: position.divisions as Partial<
              Database["public"]["Tables"]["divisions"]["Row"]
            > | null,
          });
        }
      });
    }
  }

  console.log(JSON.stringify(filteredPositions, null, 2));
  return {
    positions: filteredPositions,
  };
}
