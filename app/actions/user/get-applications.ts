"use server";
import { createClient } from "@/utils/supabase/server";
import { Database } from "@/types/supabase";

export type Application = Database["public"]["Tables"]["applications"]["Row"] & {
  user?: { id: string; first_name: string; last_name: string } | null;
  position?: { 
    id: number; 
    title: string; 
    division?: { id: number; name: string } | null 
  } | null;
};

export async function getApplicationsByUserRole() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { applications: [], role: null };
  
  const { data: userData } = await supabase
    .from("users")
    .select("member, id")
    .eq("id", user.id)
    .single();
  
  if (!userData?.member) {
    return getApplications(supabase, { user_id: user.id }, "core");
  }

  const { data: userRoles } = await supabase
    .from("roles")
    .select("id, type, dept_id, division_id")
    .eq("member_id", userData.member);
  
  if (!userRoles || userRoles.length === 0) {
    return getApplications(supabase, { user_id: user.id }, "core");
  }

  if (userRoles.some(role => role.type === "president")) {
    return getApplications(supabase, {}, "president");
  }

  const positionIds = await getPositionIdsByRole(supabase, userRoles);
  
  if (positionIds.length > 0) {
    const role = userRoles.some(r => r.type === "head") ? "head" : "lead";
    return getApplications(supabase, { open_position_id: positionIds }, role);
  }
  
  return getApplications(supabase, { user_id: user.id }, "core");
}
async function getApplications(supabase: any, filters: any, role: string) {
  let query = supabase
    .from("applications")
    .select(`
      *,
      user:user_id(id, first_name, last_name),
      position:open_position_id(
        id, 
        title,
        division:division_id(id, name)
      )
    `)
    .order("applied_at", { ascending: false });
  
  Object.entries(filters).forEach(([key, value]) => {
    if (Array.isArray(value) && value.length > 0) {
      query = query.in(key, value);
    } else if (value !== undefined) {
      query = query.eq(key, value);
    }
  });
  
  const { data, error } = await query;
  return { applications: error ? [] : data || [], role };
}

async function getPositionIdsByRole(supabase: any, userRoles: any[]) {

  const deptIds = userRoles
    .filter(role => role.type === "head" && role.dept_id)
    .map(role => role.dept_id);
  
  const divisionIds = userRoles
    .filter(role => role.type === "lead" && role.division_id)
    .map(role => role.division_id);
  
  if (deptIds.length === 0 && divisionIds.length === 0) {
    return [];
  }

  let allDivisionIds = [...divisionIds];
  if (deptIds.length > 0) {
    const { data: deptDivisions } = await supabase
      .from("divisions")
      .select("id")
      .in("dept_id", deptIds);
    
    if (deptDivisions?.length) {
      allDivisionIds = [...allDivisionIds, ...deptDivisions.map((d: {id: number}) => d.id)];
    }
  }
  
  let orQuery = "";
  if (deptIds.length > 0) {
    orQuery += `dept_id.in.(${deptIds.join(',')})`;
  }
  
  if (allDivisionIds.length > 0) {
    if (orQuery) orQuery += ",";
    orQuery += `division_id.in.(${allDivisionIds.join(',')})`;
  }
  
  if (!orQuery) return [];
  
  const { data: positions } = await supabase
    .from("apply_positions")
    .select("id")
    .or(orQuery);
  
  return positions?.length ? positions.map((p: {id: number}) => p.id) : [];
}