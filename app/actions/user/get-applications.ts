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
  console.log("⏳ getApplicationsByUserRole: Starting application fetching...");
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
    console.log("❌ getApplicationsByUserRole: No authenticated user found");
    return { applications: [], userRoleInfo: defaultRoleInfo };
  }
  
  console.log(`✅ getApplicationsByUserRole: Authenticated user with ID: ${user.id}`);

  // Get user member information
  const { data: userData, error: userError } = await supabase
    .from("users")
    .select("member, id, first_name, last_name")
    .eq("id", user.id)
    .single();

  if (userError) {
    console.log(`❌ getApplicationsByUserRole: Error fetching user data: ${userError.message}`);
    return { applications: [], userRoleInfo: defaultRoleInfo };
  }

  if (!userData) {
    console.log("❌ getApplicationsByUserRole: User data not found");
    return { applications: [], userRoleInfo: defaultRoleInfo };
  }
  
  console.log(`✅ getApplicationsByUserRole: Found user ${userData.first_name} ${userData.last_name || ''}`);

  // If user is not a member, only show their own applications
  if (!userData.member) {
    console.log(`ℹ️ getApplicationsByUserRole: User has no member ID, showing only their applications`);
    
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
      console.log(`❌ getApplicationsByUserRole: Error getting user applications: ${userAppsError.message}`);
      return { applications: [], userRoleInfo: defaultRoleInfo };
    }

    console.log(`✅ getApplicationsByUserRole: Found ${userApplications?.length || 0} applications for this user`);
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
    console.log(`❌ getApplicationsByUserRole: Error fetching roles: ${rolesError.message}`);
    return { applications: [], userRoleInfo: defaultRoleInfo };
  }

  if (!userRoles || userRoles.length === 0) {
    console.log(`ℹ️ getApplicationsByUserRole: Member has no roles, showing only their applications`);
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
      console.log(`❌ getApplicationsByUserRole: Error getting member applications: ${memberAppsError.message}`);
      return { applications: [], userRoleInfo: defaultRoleInfo };
    }

    console.log(`✅ getApplicationsByUserRole: Found ${memberApplications?.length || 0} applications for this member`);
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
  
  console.log(`✅ getApplicationsByUserRole: Found ${userRoles.length} roles for this member`);
  userRoles.forEach((role, index) => {
    console.log(`  Role ${index + 1}: Type=${role.type}, ID=${role.id}, Division=${role.division_id}, Subteam=${role.subteam_id}, Title=${role.title}`);
  });
  console.log("🏁 getApplicationsByUserRole: Final role determination:", {
    highestRole: userRoleInfo.highestRole,
    isPresident: userRoleInfo.isPresident,
    isChief: userRoleInfo.isChief,
    isCoordinator: userRoleInfo.isCoordinator,
    isLead: userRoleInfo.isLead,
    isCoreOrUser: userRoleInfo.isCoreOrUser
  });

  // Check if the user is a president
  if (userRoleInfo.isPresident) {
    console.log("ℹ️ getApplicationsByUserRole: User is a president, showing all applications");
    
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
      console.log(`❌ getApplicationsByUserRole: Error getting all applications: ${allAppsError.message}`);
      return { applications: [], userRoleInfo };
    }

    console.log(`✅ getApplicationsByUserRole: Found ${allApplications?.length || 0} total applications`);
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
    console.log(`ℹ️ getApplicationsByUserRole: User has ${chiefRoles.length} chief/coordinator roles`);
    
    // Log each chief/coordinator role in detail
    chiefRoles.forEach((role, idx) => {
      console.log(`   Chief/Coord Role ${idx+1}: subteam_id=${role.subteam_id}, title=${role.title}, division_id=${role.division_id}`);
    });
    
    const divisionIds = chiefRoles
      .map(role => role.division_id)
      .filter(Boolean) as number[];
    
    console.log(`ℹ️ getApplicationsByUserRole: Chiefs/Coordinators can only see applications with open_position_id matching their division_id: ${divisionIds.join(', ')}`);
    
    if (divisionIds.length === 0) {
      console.log("ℹ️ getApplicationsByUserRole: No division IDs found for these roles, showing only user's applications");
      
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
        console.log(`❌ getApplicationsByUserRole: Error getting user's own applications: ${userOwnAppsError.message}`);
        return { applications: [], userRoleInfo };
      }

      console.log(`✅ getApplicationsByUserRole: Found ${userOwnApps?.length || 0} of user's own applications`);
      return {
        applications: userOwnApps || [],
        userRoleInfo
      };
    }

    // Get applications for this chief/coordinator directly
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
      console.log(`❌ getApplicationsByUserRole: Error getting chief/coordinator applications: ${chiefAppsError.message}`);
      return { applications: [], userRoleInfo };
    }

    console.log(`✅ getApplicationsByUserRole: Found ${chiefApplications?.length || 0} applications for this chief/coordinator`);
    chiefApplications?.forEach((app, idx) => {
      console.log(`   App ${idx+1}: id=${app.id}, open_position_id=${app.open_position_id}, user=${app.user_id}`);
    });
    
    return {
      applications: chiefApplications || [],
      userRoleInfo
    };
  }

  // Check if user is a lead
  const leadRoles = userRoles.filter(role => role.type === 'lead');

  if (leadRoles.length > 0) {
    console.log(`ℹ️ getApplicationsByUserRole: User has ${leadRoles.length} lead roles`);
    
    // Log each lead role in detail
    leadRoles.forEach((role, idx) => {
      console.log(`   Lead Role ${idx+1}: division_id=${role.division_id}, title=${role.title}`);
    });
    
    const divisionIds = leadRoles
      .map(role => role.division_id)
      .filter(Boolean) as number[];
    
    console.log(`ℹ️ getApplicationsByUserRole: Leads can only see applications with open_position_id matching their division_id: ${divisionIds.join(', ')}`);
    
    if (divisionIds.length === 0) {
      console.log("ℹ️ getApplicationsByUserRole: No division IDs found for lead roles, showing only user's applications");
      
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
        console.log(`❌ getApplicationsByUserRole: Error getting user's own applications: ${userOwnAppsError.message}`);
        return { applications: [], userRoleInfo };
      }

      console.log(`✅ getApplicationsByUserRole: Found ${userOwnApps?.length || 0} of user's own applications`);
      return {
        applications: userOwnApps || [],
        userRoleInfo
      };
    }

    // Get applications for this lead directly
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
      console.log(`❌ getApplicationsByUserRole: Error getting lead applications: ${leadAppsError.message}`);
      return { applications: [], userRoleInfo };
    }

    console.log(`✅ getApplicationsByUserRole: Found ${leadApplications?.length || 0} applications for this lead`);
    leadApplications?.forEach((app, idx) => {
      console.log(`   App ${idx+1}: id=${app.id}, open_position_id=${app.open_position_id}, user=${app.user_id}`);
    });
    
    return {
      applications: leadApplications || [],
      userRoleInfo
    };
  }

  // For core_member or other roles, only show their own applications
  console.log("ℹ️ getApplicationsByUserRole: User is a core_member or has no specific role, showing only their applications");
  
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
    console.log(`❌ getApplicationsByUserRole: Error getting core member applications: ${coreAppsError.message}`);
    return { applications: [], userRoleInfo };
  }

  console.log(`✅ getApplicationsByUserRole: Found ${coreApplications?.length || 0} of core member's own applications`);
  return {
    applications: coreApplications || [],
    userRoleInfo
  };
}