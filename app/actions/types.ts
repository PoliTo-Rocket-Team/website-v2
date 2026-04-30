export type { ApplyPosition, Division, Scope } from "@/db/types";

export type RelatedApplication = {
  id: number;
  status: string;
  applied_at: string;
  position_title: string;
  division: string;
  department: string;
  division_lead_name?: string;
  user_email?: string;
  user_first_name?: string;
  user_last_name?: string;
};

export type Applications = {
  id: number;
  user_id: string | null;
  applied_at: string;
  status: string;
  custom_answers: unknown[];
  user_email: string;
  user_first_name: string;
  user_last_name: string;
  user_origin: string;
  user_level_of_study: string;
  user_polito_id: string;
  user_program: string;
  user_gender: string;
  user_date_of_birth: string;
  user_mobile_number: string;
  user_polito_email: string;
  position_title: string;
  division: string;
  div_id: number;
  department: string;
  dept_id: number;
  cv_name: string | null;
  cv_file_hash: string | null;
  ml_name: string | null;
  ml_file_hash: string | null;
  other_applications: RelatedApplication[];
  similar_applications: RelatedApplication[];
};
