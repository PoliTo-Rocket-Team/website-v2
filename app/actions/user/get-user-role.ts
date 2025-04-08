"use server";

import { createClient } from "@/utils/supabase/server";

export type UserRoleInfo = {
  highestRole: string | null;
  isPresident: boolean;
  isChief: boolean;
  isCoordinator: boolean;
  isLead: boolean;
  isCoreOrUser: boolean;
};

export async function getUserRole(): Promise<UserRoleInfo> {
  console.log("⏳ getUserRole: Starting role detection...");
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
    console.log("❌ getUserRole: No authenticated user found");
    return defaultRoleInfo;
  }
  
  console.log(`✅ getUserRole: Authenticated user found with ID: ${user.id}`);

  // Get user member information
  const { data: userData, error: userError } = await supabase
    .from("users")
    .select("member, first_name, last_name")
    .eq("id", user.id)
    .single();

  if (userError) {
    console.log(`❌ getUserRole: Error fetching user data: ${userError.message}`);
    return defaultRoleInfo;
  }
  
  if (!userData?.member) {
    console.log(`ℹ️ getUserRole: User ${userData?.first_name} ${userData?.last_name || ''} has no member ID`);
    return defaultRoleInfo; // Regular user without member status
  }
  
  console.log(`✅ getUserRole: User ${userData.first_name} ${userData.last_name || ''} has member ID: ${userData.member}`);

  // Get user roles
  const { data: userRoles, error: rolesError } = await supabase
    .from("roles")
    .select("id, type, title, subteam_id, division_id")
    .eq("member_id", userData.member);

  if (rolesError) {
    console.log(`❌ getUserRole: Error fetching roles: ${rolesError.message}`);
    return defaultRoleInfo;
  }

  if (!userRoles || userRoles.length === 0) {
    console.log(`ℹ️ getUserRole: Member ID ${userData.member} has no roles assigned`);
    return defaultRoleInfo; // Member without roles
  }
  
  console.log(`✅ getUserRole: Found ${userRoles.length} roles for member ID ${userData.member}:`);
  userRoles.forEach((role, index) => {
    console.log(`  Role ${index + 1}: Type=${role.type}, Title=${role.title}, SubteamID=${role.subteam_id}, DivisionID=${role.division_id}`);
  });

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

  const result = {
    highestRole: highestRoleType,
    isPresident: userRoles.some(role => role.type === 'president'),
    isChief: userRoles.some(role => role.type === 'chief'),
    isCoordinator: userRoles.some(role => role.type === 'coordinator'),
    isLead: userRoles.some(role => role.type === 'lead'),
    isCoreOrUser: highestRoleValue <= 1 // core_member or no recognized role
  };
  
  console.log("🏁 getUserRole: Final role determination:", {
    highestRole: result.highestRole,
    isPresident: result.isPresident,
    isChief: result.isChief, 
    isCoordinator: result.isCoordinator,
    isLead: result.isLead,
    isCoreOrUser: result.isCoreOrUser
  });
  
  return result;
}