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

  if (userError || !userData) {
    return { applications: [], userRoleInfo: defaultRoleInfo };
  }

  // Define standard query for applications
  const standardApplicationQuery = `
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
  `;

  // Function to fetch applications with error handling
  const fetchApplications = async (query: any) => {
    const { data, error } = await query;
    if (error) {
      return [];
    }
    return data || [];
  };

  // If user is not a member, only show their own applications
  if (!userData.member) {
    const applications = await fetchApplications(
      supabase
        .from("applications")
        .select(standardApplicationQuery)
        .eq("user_id", userData.id)
    );
    
    return { applications, userRoleInfo: defaultRoleInfo };
  }

  // Get user roles
  const { data: userRoles, error: rolesError } = await supabase
    .from("roles")
    .select("id, type, subteam_id, division_id, title")
    .eq("member_id", userData.member);

  if (rolesError || !userRoles || userRoles.length === 0) {
    // If member has no role, treat as regular user and show only their own applications
    const applications = await fetchApplications(
      supabase
        .from("applications")
        .select(standardApplicationQuery)
        .eq("user_id", userData.id)
    );
    
    return { applications, userRoleInfo: defaultRoleInfo };
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
    isCoreOrUser: highestRoleValue <= 1
  };

  // Check if the user is a president
  if (userRoleInfo.isPresident) {
    const applications = await fetchApplications(
      supabase
        .from("applications")
        .select(standardApplicationQuery)
    );
    
    return { applications, userRoleInfo };
  }

  // Get applicable division IDs for chiefs, coordinators, or leads
  const getApplicableDivisionIds = (roleTypes: string[]) => {
    return userRoles
      .filter(role => roleTypes.includes(role.type))
      .map(role => role.division_id)
      .filter(Boolean) as number[];
  };

  // Check if user is a chief or coordinator
  if (userRoleInfo.isChief || userRoleInfo.isCoordinator) {
    const divisionIds = getApplicableDivisionIds(['chief', 'coordinator']);
    
    if (divisionIds.length === 0) {
      const applications = await fetchApplications(
        supabase
          .from("applications")
          .select(standardApplicationQuery)
          .eq("user_id", userData.id)
      );
      
      return { applications, userRoleInfo };
    }

    const applications = await fetchApplications(
      supabase
        .from("applications")
        .select(standardApplicationQuery)
        .or(`user_id.eq.${userData.id},open_position_id.in.(${divisionIds.join(',')})`)
    );
    
    return { applications, userRoleInfo };
  }

  // Check if user is a lead
  if (userRoleInfo.isLead) {
    const divisionIds = getApplicableDivisionIds(['lead']);
    
    if (divisionIds.length === 0) {
      const applications = await fetchApplications(
        supabase
          .from("applications")
          .select(standardApplicationQuery)
          .eq("user_id", userData.id)
      );
      
      return { applications, userRoleInfo };
    }

    const applications = await fetchApplications(
      supabase
        .from("applications")
        .select(standardApplicationQuery)
        .or(`user_id.eq.${userData.id},open_position_id.in.(${divisionIds.join(',')})`)
    );
    
    return { applications, userRoleInfo };
  }

  // For core_member or other roles, only show their own applications
  const applications = await fetchApplications(
    supabase
      .from("applications")
      .select(standardApplicationQuery)
      .eq("user_id", userData.id)
  );
  
  return { applications, userRoleInfo };
}