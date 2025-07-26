"use server";

import { createSupabaseClient } from "@/utils/supabase/client";
import { Database } from "@/types/supabase";

export type Member = Database["public"]["Tables"]["members"]["Row"] & {
  users?: Partial<Database["public"]["Tables"]["users"]["Row"]>[] | null;
  roles?:
    | (Partial<Database["public"]["Tables"]["roles"]["Row"]> & {
        departments?: Partial<
          Database["public"]["Tables"]["departments"]["Row"]
        > | null;
        divisions?: Partial<
          Database["public"]["Tables"]["divisions"]["Row"]
        > | null;
      })[]
    | null;
};

export type Role = Database["public"]["Tables"]["roles"]["Row"] & {
  departments?: Partial<
    Database["public"]["Tables"]["departments"]["Row"]
  > | null;
  divisions?: Partial<Database["public"]["Tables"]["divisions"]["Row"]> | null;
};

export async function getMembersByUserRole() {
  const supabase = await createSupabaseClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { members: [], role: null };

  const { data: userData } = await supabase
    .from("users")
    .select("member")
    .eq("id", user.id)
    .single();

  if (!userData?.member) {
    return { members: [], role: null };
  }
  const { data: userRoles } = await supabase
    .from("roles")
    .select("id, type, dept_id, division_id, title")
    .eq("member_id", userData.member);

  if (!userRoles || userRoles.length === 0) {
    return { members: [], role: null };
  }

  const { data: allMembers, error: allMembersError } = await supabase.from(
    "members"
  ).select(`
      member_id, 
      prt_email,
      discord,
      mobile_number,
      nda_name,
      nda_signed_at,
      nda_confirmed_by,
      picture,
      users (
        first_name,
        last_name,
        email,
        level_of_study,
        linkedin,
        origin,
        polito_id,
        program,
        updated_at
      ),
      roles!inner (
        id,
        title,
        type,
        dept_id,
        division_id,
        departments(*),
        divisions(*)
      )
    `);

  if (allMembersError) {
    console.error("Error getting all members:", allMembersError);
    return { members: [], role: userRoles };
  }

  if (!allMembers) {
    return { members: [], role: userRoles };
  }

  let filteredMembers: Member[] = [];

  for (const userRole of userRoles) {
    allMembers.forEach(member => {
      if (!member.roles) return;
      if (member.member_id === userData.member) {
        return;
      }
      member.roles.forEach(role => {
        if (userRole.type === "president") {
          filteredMembers.push({
            ...member,
            roles: [
              {
                ...role,
                departments: role.departments
                  ? (role.departments as Partial<
                      Database["public"]["Tables"]["departments"]["Row"]
                    > | null)
                  : null,
                divisions: role.divisions
                  ? (role.divisions as Partial<
                      Database["public"]["Tables"]["divisions"]["Row"]
                    > | null)
                  : null,
              },
            ],
          });
        } else if (userRole.type === "head") {
          if (role.dept_id === userRole.dept_id) {
            filteredMembers.push({
              ...member,
              roles: [
                {
                  ...role,
                  departments: role.departments
                    ? (role.departments as Partial<
                        Database["public"]["Tables"]["departments"]["Row"]
                      > | null)
                    : null,
                  divisions: role.divisions
                    ? (role.divisions as Partial<
                        Database["public"]["Tables"]["divisions"]["Row"]
                      > | null)
                    : null,
                },
              ],
            });
          }
        } else if (userRole.type === "lead") {
          if (
            role.division_id === userRole.division_id &&
            role.dept_id === userRole.dept_id
          ) {
            filteredMembers.push({
              ...member,
              roles: [
                {
                  ...role,
                  departments: role.departments
                    ? (role.departments as Partial<
                        Database["public"]["Tables"]["departments"]["Row"]
                      > | null)
                    : null,
                  divisions: role.divisions
                    ? (role.divisions as Partial<
                        Database["public"]["Tables"]["divisions"]["Row"]
                      > | null)
                    : null,
                },
              ],
            });
          }
        }
      });
    });
  }
  return {
    members: filteredMembers as Member[],
    role: userRoles as Partial<Role>[],
  };
}
