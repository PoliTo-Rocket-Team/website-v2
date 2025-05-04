"use server";
import { createClient } from "@/utils/supabase/server";
import { Database } from "@/types/supabase";

export type Application = Database["public"]["Tables"]["applications"]["Row"];

type UserRole = Pick<
  Database["public"]["Tables"]["roles"]["Row"],
  "id" | "type" | "dept_id" | "division_id" | "title"
>;

type ApplicationResult = {
  applications: any[];
  role?: string | null;
};

type Division = {
  id: number;
  [key: string]: any;
};

type Position = {
  id: number;
  [key: string]: any;
};

const applicationSelectQuery = `
  *,
  user:user_id(id, first_name, last_name),
  position:open_position_id(
    id, 
    title,
    division:division_id(id, name)
  )
`;

export async function getApplicationsByUserRole(): Promise<ApplicationResult> {
  const supabase = await createClient();
  
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { applications: [], role: null };
  
  const { data: userData } = await supabase
    .from("users")
    .select("member, id")
    .eq("id", user.id)
    .single();
  
  if (!userData?.member) {
    return getUserApplications(supabase, user.id);
  }
  
  const { data: userRoles } = (await supabase
    .from("roles")
    .select("id, type, dept_id, division_id, title")
    .eq("member_id", userData.member)) as { data: UserRole[] };
  
  if (!userRoles || userRoles.length === 0) {
    return getUserApplications(supabase, user.id);
  }
  
  if (userRoles.some(role => role.type === "president")) {
    return getPresidentApplications(supabase);
  }
  
  const headDeptIds = userRoles
    .filter(role => role.type === "head")
    .map(role => role.dept_id)
    .filter((id): id is number => id !== null);
  
  if (headDeptIds.length > 0) {
    const deptApplications = await getDepartmentHeadApplications(supabase, headDeptIds);
    if (deptApplications.applications.length > 0) {
      return deptApplications;
    }
  }
  
  const leadDivisionIds = userRoles
    .filter(role => role.type === "lead")
    .map(role => role.division_id)
    .filter((id): id is number => id !== null);
  
  if (leadDivisionIds.length > 0) {
    const divisionApplications = await getDivisionLeadApplications(supabase, leadDivisionIds);
    if (divisionApplications.applications.length > 0) {
      return divisionApplications;
    }
  }
  
  return getUserApplications(supabase, user.id);
}

async function getUserApplications(supabase: any, userId: string): Promise<ApplicationResult> {
  const { data, error } = await supabase
    .from("applications")
    .select(applicationSelectQuery)
    .eq("user_id", userId);
  
  if (error) {
    return { applications: [], role: "core" };
  }
  
  return { applications: data || [], role: "core" };
}

async function getPresidentApplications(supabase: any): Promise<ApplicationResult> {
  const { data, error } = await supabase
    .from("applications")
    .select(applicationSelectQuery)
    .order("applied_at", { ascending: false });
  
  if (error) {
    return { applications: [], role: "president" };
  }
  
  return { applications: data || [], role: "president" };
}

async function getDepartmentHeadApplications(supabase: any, deptIds: number[]): Promise<ApplicationResult> {
  const { data: deptDivisions } = await supabase
    .from("divisions")
    .select("id")
    .in("dept_id", deptIds);
  
  if (deptDivisions && deptDivisions.length > 0) {
    const divisionIds = deptDivisions.map((div: Division) => div.id);
    
    const { data: deptPositions } = await supabase
      .from("apply_positions")
      .select("id")
      .in("division_id", divisionIds);
    
    if (deptPositions && deptPositions.length > 0) {
      const applications = await getApplicationsByPositionIds(
        supabase, 
        deptPositions.map((pos: Position) => pos.id), 
        "head"
      );
      
      if (applications.applications.length > 0) {
        return applications;
      }
    }
  }
  
  const { data: directDeptPositions } = await supabase
    .from("apply_positions")
    .select("id")
    .in("dept_id", deptIds);
  
  if (directDeptPositions && directDeptPositions.length > 0) {
    return getApplicationsByPositionIds(
      supabase, 
      directDeptPositions.map((pos: Position) => pos.id), 
      "head"
    );
  }
  
  return { applications: [], role: "head" };
}

async function getDivisionLeadApplications(supabase: any, divisionIds: number[]): Promise<ApplicationResult> {
  const { data: divisionPositions } = await supabase
    .from("apply_positions")
    .select("id")
    .in("division_id", divisionIds);
  
  if (divisionPositions && divisionPositions.length > 0) {
    return getApplicationsByPositionIds(
      supabase, 
      divisionPositions.map((pos: Position) => pos.id), 
      "lead"
    );
  }
  
  return { applications: [], role: "lead" };
}

async function getApplicationsByPositionIds(
  supabase: any, 
  positionIds: number[], 
  role: string
): Promise<ApplicationResult> {
  const { data, error } = await supabase
    .from("applications")
    .select(applicationSelectQuery)
    .in("open_position_id", positionIds)
    .order("applied_at", { ascending: false });
  
  if (error) {
    return { applications: [], role };
  }
  
  return { applications: data || [], role };
}