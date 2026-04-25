import type { InferSelectModel } from "drizzle-orm";
import { applyPositions, departments, divisions, scopes } from "@/db/schema";
import { Prettify } from "@/lib/utils";

export type ApplyPositionRow = InferSelectModel<typeof applyPositions>;
export type DepartmentRow = InferSelectModel<typeof departments>;
export type DivisionRow = InferSelectModel<typeof divisions>;
export type ScopeRow = InferSelectModel<typeof scopes>;

export type ApplyPosition = Prettify<
  {
    id: ApplyPositionRow["id"];
    status: ApplyPositionRow["status"];
    division_id: ApplyPositionRow["divisionId"];
    title: ApplyPositionRow["title"];
    description: ApplyPositionRow["description"];
    required_skills: ApplyPositionRow["requiredSkills"];
    desirable_skills: ApplyPositionRow["desirableSkills"];
    custom_questions: ApplyPositionRow["customQuestions"];
    created_at: ApplyPositionRow["createdAt"];
    requires_motivation_letter: ApplyPositionRow["requiresMotivationLetter"];
    is_deleted: ApplyPositionRow["isDeleted"];
  } & {
    div_name: string;
    div_code: string;
    dept_id: number;
    dept_name: string;
    dept_code: string;
    canEdit?: boolean;
  }
>;

export type Division = Prettify<
  {
    id: DivisionRow["id"];
    dept_id: DivisionRow["deptId"];
    name: DivisionRow["name"];
    code: NonNullable<DivisionRow["code"]>;
  } & {
    departments: Array<{
      id: DepartmentRow["id"];
      name: DepartmentRow["name"];
      code: NonNullable<DepartmentRow["code"]>;
    }> | null;
  }
>;

export type Scope = Prettify<{
  id: ScopeRow["id"];
  member_id: ScopeRow["memberId"];
  given_by: ScopeRow["givenBy"];
  scope: ScopeRow["scope"];
  target: ScopeRow["target"];
  access_level: ScopeRow["accessLevel"];
  dept_id: ScopeRow["deptId"];
  division_id: ScopeRow["divisionId"];
}>;
