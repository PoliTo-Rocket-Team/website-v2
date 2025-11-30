"use server";

import { createSupabaseClient } from "@/utils/supabase/client";
import { auth } from "@/auth";

type MemberNode = {
  id: string;
  name: string;
  email: string;
  avatar_url: string | null;
  role_title: string;
};

type DivisionNode = {
  id: string;
  name: string;
  members: MemberNode[];
};

type DepartmentNode = {
  id: string;
  name: string;
  divisions: Record<string, DivisionNode>;
  direct_members: MemberNode[];
};

export async function getOrganizationTree() {
  const supabase = await createSupabaseClient();
  const session = await auth();
  const userId = session?.userId;

  if (!userId) return null;

  const { data: userData } = await supabase
    .from("users")
    .select("member")
    .eq("id", userId)
    .single();

  if (!userData?.member) return null;

  const { data: userScopes } = await supabase
    .from("scopes")
    .select("scope, dept_id, division_id")
    .eq("member_id", userData.member);

  if (!userScopes || userScopes.length === 0) return null;

  const isPresident = userScopes.some((s) => s.scope === "all");

  const allowedDeptIds = userScopes
    .filter((s) => s.scope === "department" && s.dept_id)
    .map((s) => s.dept_id);

  const allowedDivIds = userScopes
    .filter((s) => s.scope === "division" && s.division_id)
    .map((s) => s.division_id);

  let query = supabase.from("members").select(`
      member_id,
      picture,
      users ( first_name, last_name, email ),
      roles!inner (
        title,
        type,
        dept_id,
        division_id,
        departments ( id, name ),
        divisions ( id, name )
      )
    `);

  if (!isPresident) {
    const conditions: string[] = [];

    if (allowedDeptIds.length > 0) {
      conditions.push(`dept_id.in.(${allowedDeptIds.join(",")})`);
    }
    if (allowedDivIds.length > 0) {
      conditions.push(`division_id.in.(${allowedDivIds.join(",")})`);
    }

    if (conditions.length > 0) {
      query = query.or(conditions.join(","), { foreignTable: "roles" });
    } else {
      return {};
    }
  }

  const { data: allMembers, error } = await query;

  if (error) {
    console.error("Error fetching hierarchy:", error);
    return null;
  }

  const tree: Record<string, DepartmentNode> = {};

  const UNASSIGNED_KEY = "unassigned";

  const getOrCreateDept = (id: string, name: string) => {
    if (!tree[id]) {
      tree[id] = { id, name, divisions: {}, direct_members: [] };
    }
    return tree[id];
  };

  allMembers?.forEach((member) => {
    if (member.member_id === userData.member) return;

    if (!member.roles) return;

    member.roles.forEach((role: any) => {
      const memberNode: MemberNode = {
        id: member.member_id.toString(),
        name: `${member.users?.first_name || ""} ${member.users?.last_name || ""}`.trim(),
        email: member.users?.email || "",
        avatar_url: member.picture,
        role_title: role.title,
      };

      const deptId = role.departments?.id
        ? role.departments.id.toString()
        : UNASSIGNED_KEY;
      const deptName = role.departments?.name || "General / Unassigned";

      const deptNode = getOrCreateDept(deptId, deptName);

      if (role.divisions?.id) {
        const divId = role.divisions.id.toString();
        const divName = role.divisions.name;

        if (!deptNode.divisions[divId]) {
          deptNode.divisions[divId] = { id: divId, name: divName, members: [] };
        }

        if (
          !deptNode.divisions[divId].members.find((m) => m.id === memberNode.id)
        ) {
          deptNode.divisions[divId].members.push(memberNode);
        }
      } else {
        if (!deptNode.direct_members.find((m) => m.id === memberNode.id)) {
          deptNode.direct_members.push(memberNode);
        }
      }
    });
  });

  return tree;
}
