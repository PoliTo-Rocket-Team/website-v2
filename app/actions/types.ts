import { Database } from "@/types/supabase";
import { Prettify } from "@/lib/utils";

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


// Scope type based on the scopes table schema
export type Scope = Prettify<Database["public"]["Tables"]["scopes"]["Row"]>;
