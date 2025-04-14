"use server";

import { createClient } from "@/utils/supabase/server";
import { Database } from "@/types/supabase";

export type Application = Database["public"]["Tables"]["applications"]["Row"] & {
  users?: Partial<Database["public"]["Tables"]["users"]["Row"]> | null;
  apply_positions?: (Partial<Database["public"]["Tables"]["apply_positions"]["Row"]> & {
    divisions?: Partial<Database["public"]["Tables"]["divisions"]["Row"]> | null;
  }) | null;
};

export type UserRoleInfo = {
  highestRole: string | null;
  isPresident: boolean;
  isChief: boolean;
  isCoordinator: boolean;
  isLead: boolean;
  isCoreOrUser: boolean;
};

export async function getApplicationsByUserRole() {
  const supabase = await createClient();

  // Default role information
  const defaultRoleInfo: UserRoleInfo = {
    highestRole: null,
    isPresident: false,
    isChief: false,
    isCoordinator: false,
    isLead: false,
    isCoreOrUser: true,
  };

  // Get current user
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) {
    return { applications: [], userRoleInfo: defaultRoleInfo };
  }
  
  // Get user member information
  const { data: userData, error: userError } = await supabase
    .from("users")
    .select("member, id, first_name, last_name")
    .eq("id", user.id)
    .single();

  if (userError) {
    return { applications: [], userRoleInfo: defaultRoleInfo };
  }

  if (!userData) {
    return { applications: [], userRoleInfo: defaultRoleInfo };
  }

  // If user is not a member, only show their own applications
  if (!userData.member) {    
    const { data: userApplications, error: userAppsError } = await supabase
      .from("applications")
      .select(`
        *,
        users (
          id,
          first_name,
          last_name,
          email,
          level_of_study,
          program
        ),
        apply_positions (
          id,
          title,
          description,
          division_id,
          divisions (
            id,
            name,
            subteam_id
          )
        )
      `)
      .eq("user_id", userData.id);

    if (userAppsError) {
      return { applications: [], userRoleInfo: defaultRoleInfo };
    }

    return {
      applications: userApplications || [],
      userRoleInfo: defaultRoleInfo
    };
  }

  // Get user roles
  const { data: userRoles, error: rolesError } = await supabase
    .from("roles")
    .select("id, type, subteam_id, division_id, title")
    .eq("member_id", userData.member);

  if (rolesError) {
    return { applications: [], userRoleInfo: defaultRoleInfo };
  }

  if (!userRoles || userRoles.length === 0) {
    // If member has no role, treat as regular user and show only their own applications
    const { data: memberApplications, error: memberAppsError } = await supabase
      .from("applications")
      .select(`
        *,
        users (
          id,
          first_name,
          last_name,
          email,
          level_of_study,
          program
        ),
        apply_positions (
          id,
          title,
          description,
          division_id,
          divisions (
            id,
            name,
            subteam_id
          )
        )
      `)
      .eq("user_id", userData.id);

    if (memberAppsError) {
      return { applications: [], userRoleInfo: defaultRoleInfo };
    }

    return {
      applications: memberApplications || [],
      userRoleInfo: defaultRoleInfo
    };
  }

  // Determine user role information
  // Determine highest role
  const roleHierarchy = {
    'president': 5,
    'chief': 4,
    'coordinator': 3,
    'lead': 2,
    'core_member': 1
  };

  let highestRoleType = null;
  let highestRoleValue = 0;
  
  userRoles.forEach(role => {
    const roleValue = roleHierarchy[role.type as keyof typeof roleHierarchy] || 0;
    if (roleValue > highestRoleValue) {
      highestRoleValue = roleValue;
      highestRoleType = role.type;
    }
  });

  const userRoleInfo: UserRoleInfo = {
    highestRole: highestRoleType,
    isPresident: userRoles.some(role => role.type === 'president'),
    isChief: userRoles.some(role => role.type === 'chief'),
    isCoordinator: userRoles.some(role => role.type === 'coordinator'),
    isLead: userRoles.some(role => role.type === 'lead'),
    isCoreOrUser: highestRoleValue <= 1 // core_member or no recognized role
  };

  // Check if the user is a president
  if (userRoleInfo.isPresident) {
    const { data: allApplications, error: allAppsError } = await supabase
      .from("applications")
      .select(`
        *,
        users (
          id,
          first_name,
          last_name,
          email,
          level_of_study,
          program
        ),
        apply_positions (
          id,
          title,
          description,
          division_id,
          divisions (
            id,
            name,
            subteam_id
          )
        )
      `);

    if (allAppsError) {
      return { applications: [], userRoleInfo };
    }

    return {
      applications: allApplications || [],
      userRoleInfo
    };
  }

  // Check if user is a chief or coordinator
  const chiefRoles = userRoles.filter(role => 
    role.type === 'chief' || role.type === 'coordinator'
  );

  if (chiefRoles.length > 0) {
    const divisionIds = chiefRoles
      .map(role => role.division_id)
      .filter(Boolean) as number[];
    
    if (divisionIds.length === 0) {
      const { data: userOwnApps, error: userOwnAppsError } = await supabase
        .from("applications")
        .select(`
          *,
          users (
            id,
            first_name,
            last_name,
            email,
            level_of_study,
            program
          ),
          apply_positions (
            id,
            title,
            description,
            division_id,
            divisions (
              id,
              name,
              subteam_id
            )
          )
        `)
        .eq("user_id", userData.id);

      if (userOwnAppsError) {
        return { applications: [], userRoleInfo };
      }

      return {
        applications: userOwnApps || [],
        userRoleInfo
      };
    }

    // Get applications for this chief/coordinator directly - USING THE ORIGINAL QUERY STRUCTURE
    const { data: chiefApplications, error: chiefAppsError } = await supabase
      .from("applications")
      .select(`
        *,
        users (
          id,
          first_name,
          last_name,
          email,
          level_of_study,
          program
        ),
        apply_positions (
          id,
          title,
          description,
          division_id,
          divisions (
            id,
            name,
            subteam_id
          )
        )
      `)
      .or(`user_id.eq.${userData.id},open_position_id.in.(${divisionIds.join(',')})`);

    if (chiefAppsError) {
      return { applications: [], userRoleInfo };
    }
    
    return {
      applications: chiefApplications || [],
      userRoleInfo
    };
  }

  // Check if user is a lead
  const leadRoles = userRoles.filter(role => role.type === 'lead');

  if (leadRoles.length > 0) {
    const divisionIds = leadRoles
      .map(role => role.division_id)
      .filter(Boolean) as number[];
    
    if (divisionIds.length === 0) {
      const { data: userOwnApps, error: userOwnAppsError } = await supabase
        .from("applications")
        .select(`
          *,
          users (
            id,
            first_name,
            last_name,
            email,
            level_of_study,
            program
          ),
          apply_positions (
            id,
            title,
            description,
            division_id,
            divisions (
              id,
              name,
              subteam_id
            )
          )
        `)
        .eq("user_id", userData.id);

      if (userOwnAppsError) {
        return { applications: [], userRoleInfo };
      }

      return {
        applications: userOwnApps || [],
        userRoleInfo
      };
    }

    // Get applications for this lead directly - USING THE ORIGINAL QUERY STRUCTURE
    const { data: leadApplications, error: leadAppsError } = await supabase
      .from("applications")
      .select(`
        *,
        users (
          id,
          first_name,
          last_name,
          email,
          level_of_study,
          program
        ),
        apply_positions (
          id,
          title,
          description,
          division_id,
          divisions (
            id,
            name,
            subteam_id
          )
        )
      `)
      .or(`user_id.eq.${userData.id},open_position_id.in.(${divisionIds.join(',')})`);

    if (leadAppsError) {
      return { applications: [], userRoleInfo };
    }
    
    return {
      applications: leadApplications || [],
      userRoleInfo
    };
  }

  // For core_member or other roles, only show their own applications
  const { data: coreApplications, error: coreAppsError } = await supabase
    .from("applications")
    .select(`
      *,
      users (
        id,
        first_name,
        last_name,
        email,
        level_of_study,
        program
      ),
      apply_positions (
        id,
        title,
        description,
        division_id,
        divisions (
          id,
          name,
          subteam_id
        )
      )
    `)
    .eq("user_id", userData.id);

  if (coreAppsError) {
    return { applications: [], userRoleInfo };
  }

  return {
    applications: coreApplications || [],
    userRoleInfo
  };
}