"use server";

import { createClient } from "@/utils/supabase/server";
import { Database } from "@/types/supabase";

export type CustomAnswer = {
  question: string;
  answer: string;
};

export type Application = Database["public"]["Tables"]["applications"]["Row"] & {
  positions?: Partial<Database["public"]["Tables"]["apply_positions"]["Row"]> & {
    divisions?: Partial<Database["public"]["Tables"]["divisions"]["Row"]> | null;
  } | null;
  users?: Partial<Database["public"]["Tables"]["users"]["Row"]> | null;
};

export async function getApplicationsByUserRole() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { applications: [], canApply: false };

  const { data: userData } = await supabase
    .from("users")
    .select("member")
    .eq("id", user.id)
    .single();

  if (!userData?.member) {
    return { applications: [], canApply: false };
  }

  // Get user roles
  const { data: userRoles } = await supabase
    .from("roles")
    .select("id, type, subteam_id, division_id, title")
    .eq("member_id", userData.member);

  if (!userRoles || userRoles.length === 0) {
    // Allow core members (who have no assigned roles) to apply
    return { applications: [], canApply: true };
  }

  // Check if the user is a coordinator (they can apply)
  const isCoordinator = userRoles.some(role => role.type === "coordinator");
  
  // Get all divisions with their subteam info to map division_id to subteam_id
  const { data: divisions } = await supabase
    .from("divisions")
    .select("id, name, subteam_id");

  if (!divisions) {
    return { applications: [], canApply: isCoordinator };
  }

  // Create a mapping of subteam_id to array of division_ids (for chiefs to see all divisions in their subteam)
  const subteamToDivisionsMap = new Map();
  divisions.forEach(division => {
    if (division.subteam_id) {
      if (!subteamToDivisionsMap.has(division.subteam_id)) {
        subteamToDivisionsMap.set(division.subteam_id, []);
      }
      subteamToDivisionsMap.get(division.subteam_id).push(division.id);
    }
  });

  // If the user is a coordinator or core member, they shouldn't see applications
  if (isCoordinator || userRoles.length === 0) {
    return { applications: [], canApply: true };
  }

  // For president, chief, and lead roles, fetch applications
  const { data: allApplications, error: applicationsError } = await supabase
    .from("applications")
    .select(`
      *,
      positions:open_position_id(
        *,
        divisions(*)
      ),
      users:user_id(
        first_name,
        last_name,
        email,
        level_of_study,
        linkedin,
        origin,
        polito_id,
        program
      )
    `);

  if (applicationsError) {
    console.error("Error getting applications:", applicationsError);
    return { applications: [], canApply: false };
  }

  if (!allApplications) {
    return { applications: [], canApply: false };
  }

  let filteredApplications: Application[] = [];

  // Filter applications based on user role
  for (const userRole of userRoles) {
    // President can see all applications
    if (userRole.type === "president") {
      filteredApplications = allApplications.map(app => ({
        ...app,
        positions: app.positions as (Partial<Database["public"]["Tables"]["apply_positions"]["Row"]> & {
          divisions?: Partial<Database["public"]["Tables"]["divisions"]["Row"]> | null;
        }) | null,
        users: app.users as Partial<Database["public"]["Tables"]["users"]["Row"]> | null
      }));
      break; // If user is president, no need to check other roles
    } 
    // Chiefs can see applications for all divisions in their subteam
    else if (userRole.type === "chief" && userRole.subteam_id) {
      const divisionsInSubteam = subteamToDivisionsMap.get(userRole.subteam_id) || [];
      
      allApplications.forEach(app => {
        if (app.positions && divisionsInSubteam.includes(app.positions.division_id)) {
          filteredApplications.push({
            ...app,
            positions: app.positions as (Partial<Database["public"]["Tables"]["apply_positions"]["Row"]> & {
              divisions?: Partial<Database["public"]["Tables"]["divisions"]["Row"]> | null;
            }) | null,
            users: app.users as Partial<Database["public"]["Tables"]["users"]["Row"]> | null
          });
        }
      });
    } 
    // Leads can see applications only in their specific division
    else if (userRole.type === "lead" && userRole.division_id) {
      allApplications.forEach(app => {
        if (app.positions && app.positions.division_id === userRole.division_id) {
          filteredApplications.push({
            ...app,
            positions: app.positions as (Partial<Database["public"]["Tables"]["apply_positions"]["Row"]> & {
              divisions?: Partial<Database["public"]["Tables"]["divisions"]["Row"]> | null;
            }) | null,
            users: app.users as Partial<Database["public"]["Tables"]["users"]["Row"]> | null
          });
        }
      });
    }
  }

  // Remove duplicates by application ID
  const uniqueApplications = Array.from(
    new Map(filteredApplications.map(app => [app.id, app])).values()
  );

  return {
    applications: uniqueApplications,
    canApply: false // President, chief, and lead cannot apply
  };
}