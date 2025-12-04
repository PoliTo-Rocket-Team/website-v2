import { Database } from "@/types/supabase";
import { Prettify } from "@/lib/utils";

// Flattened application + user fields (no nested `user` object)
export type Applications = Prettify<
  Database["public"]["Tables"]["applications"]["Row"] & {
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
    // Position info
    position_title: string;
    division: string;
    div_id: number;
    department: string;
    dept_id: number;
    // File info flattened from relationships
    cv_name: string | null;
    cv_file_hash: string | null;
    ml_name: string | null;
    ml_file_hash: string | null;
    // Other applications for this user
    other_applications: OtherApplication[];
    // Similar applications (same name, different email)
    similar_applications: OtherApplication[];
  }
>;

// ApplyPosition type based on the apply_positions table schema with additional fields
export type ApplyPosition = Prettify<
  Database["public"]["Tables"]["apply_positions"]["Row"] & {
    div_name: string;
    div_code: string;
    dept_id: number;
    dept_name: string;
    dept_code: string;
    canEdit?: boolean;
  }
>;

export type Division = Prettify<
  Database["public"]["Tables"]["divisions"]["Row"] & {
    departments: Database["public"]["Tables"]["departments"]["Row"];
  }
>;

// Scope type based on the scopes table schema
export type Scope = Prettify<Database["public"]["Tables"]["scopes"]["Row"]>;

// Other applications for a user (simplified structure)
export type OtherApplication = {
  id: number;
  status: Database["public"]["Enums"]["application_status"];
  applied_at: string;
  position_title: string;
  division: string;
  department: string;
  division_lead_name?: string;
  user_email?: string;
  user_first_name?: string;
  user_last_name?: string;
};
