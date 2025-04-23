type Member = {
  first_name: string;
  last_name: string;
  role_type: string;
  member_id: number;
  role_id: number;
  email: string;
  linkedin: string | null;
  role_title: string;
  division_id: number;
  department_id: number;
  discord: string | null;
  origin: string;
  level_of_study: string | null;
  polito_id: number | null;
  program: string | null;
  started_at: string;
  mobile_number: string | null;
  division_name: string;
  division_code: string;
  departments_name: string;
  department_code: string;
};

type Division = {
  name: string;
  code: string;
  id: number | null;
};

export type { Member, Division };
