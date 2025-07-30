"use server";

import { createSupabaseClient } from "@/utils/supabase/client";
import { Database } from "@/types/supabase";
import { auth } from "@/auth";

export type Dept = Database["public"]["Tables"]["departments"]["Row"] & {
  divisions?: Partial<Database["public"]["Tables"]["divisions"]["Row"]> | null;
};

type UserRole = Pick<
  Database["public"]["Tables"]["roles"]["Row"],
  "id" | "type" | "dept_id" | "division_id" | "title"
>;

export async function getDeptByUserRole() {
  const supabase = await createSupabaseClient();
  const session = await auth();

  const userId = session?.userId;

  if (!session) return { dept: [], role: null };

  const { data: userData } = await supabase
    .from("users")
    .select("member")
    .eq("id", userId)
    .single();

  if (!userData?.member) {
    return { dept: [], role: null };
  }
  const { data: userRoles } = (await supabase
    .from("roles")
    .select("id, type, dept_id, division_id, title")
    .eq("member_id", userData.member)) as { data: UserRole[] };2222222222222222

  if (!userRoles || userRoles.length === 0) {
    return { dept: [], role: null };
  }
  const { data: allDept, error: allDeptError } = (await supabase.from(
    "departments"
  ).select(`
      id,
      name,
      code,
      started_at,
      closed_at,

      divisions (
          id,
          dept_id,
          name,
          code,
          started_at,
          closed_at
      )
  `)) as { data: Dept[]; error?: any };

  if (allDeptError) {
    console.error(allDeptError);
    return { dept: [] };
  }

  if (!allDept || allDept.length === 0) {
    return { dept: [] };
  }

  const depts = userRoles.some(role => role.type === "president")
    ? allDept
    : allDept.filter(dept =>
        userRoles.some(role => role.type === "head" && role.dept_id === dept.id)
      );

  return { dept: depts };
}
