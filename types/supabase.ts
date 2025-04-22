export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          operationName?: string
          query?: string
          variables?: Json
          extensions?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      applications: {
        Row: {
          applied_at: string
          custom_answers: Json[] | null
          cv_name: string | null
          id: number
          ml_name: string | null
          open_position_id: number | null
          status: Database["public"]["Enums"]["application_status"]
          user_id: string
        }
        Insert: {
          applied_at?: string
          custom_answers?: Json[] | null
          cv_name?: string | null
          id: number
          ml_name?: string | null
          open_position_id?: number | null
          status?: Database["public"]["Enums"]["application_status"]
          user_id: string
        }
        Update: {
          applied_at?: string
          custom_answers?: Json[] | null
          cv_name?: string | null
          id?: number
          ml_name?: string | null
          open_position_id?: number | null
          status?: Database["public"]["Enums"]["application_status"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "applications_open_position_id_fkey"
            columns: ["open_position_id"]
            isOneToOne: false
            referencedRelation: "apply_positions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "applications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      apply_positions: {
        Row: {
          created_at: string | null
          custom_questions: string[] | null
          description: string | null
          desirable_skills: string[] | null
          division_id: number | null
          id: number
          required_skills: string[] | null
          status: boolean
          title: string | null
        }
        Insert: {
          created_at?: string | null
          custom_questions?: string[] | null
          description?: string | null
          desirable_skills?: string[] | null
          division_id?: number | null
          id: number
          required_skills?: string[] | null
          status: boolean
          title?: string | null
        }
        Update: {
          created_at?: string | null
          custom_questions?: string[] | null
          description?: string | null
          desirable_skills?: string[] | null
          division_id?: number | null
          id?: number
          required_skills?: string[] | null
          status?: boolean
          title?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "open_positions_division_id_fkey"
            columns: ["division_id"]
            isOneToOne: false
            referencedRelation: "divisions"
            referencedColumns: ["id"]
          },
        ]
      }
      departments: {
        Row: {
          closed_at: string | null
          code: string | null
          id: number
          name: string | null
          started_at: string | null
        }
        Insert: {
          closed_at?: string | null
          code?: string | null
          id: number
          name?: string | null
          started_at?: string | null
        }
        Update: {
          closed_at?: string | null
          code?: string | null
          id?: number
          name?: string | null
          started_at?: string | null
        }
        Relationships: []
      }
      divisions: {
        Row: {
          closed_at: string | null
          code: string | null
          dept_id: number | null
          id: number
          name: string | null
          started_at: string | null
        }
        Insert: {
          closed_at?: string | null
          code?: string | null
          dept_id?: number | null
          id: number
          name?: string | null
          started_at?: string | null
        }
        Update: {
          closed_at?: string | null
          code?: string | null
          dept_id?: number | null
          id?: number
          name?: string | null
          started_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "divisions_subteam_id_fkey"
            columns: ["dept_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
        ]
      }
      members: {
        Row: {
          discord: string | null
          member_id: number
          mobile_number: string | null
          nda_confirmed_by: number | null
          nda_name: string | null
          nda_signed_at: string | null
          picture: string | null
          prt_email: string | null
        }
        Insert: {
          discord?: string | null
          member_id: number
          mobile_number?: string | null
          nda_confirmed_by?: number | null
          nda_name?: string | null
          nda_signed_at?: string | null
          picture?: string | null
          prt_email?: string | null
        }
        Update: {
          discord?: string | null
          member_id?: number
          mobile_number?: string | null
          nda_confirmed_by?: number | null
          nda_name?: string | null
          nda_signed_at?: string | null
          picture?: string | null
          prt_email?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "members_nda_confirmed_by_fkey"
            columns: ["nda_confirmed_by"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["member_id"]
          },
        ]
      }
      orders: {
        Row: {
          created_at: string | null
          description: string | null
          id: number
          name: string | null
          price: number | null
          quantity: number | null
          quote_name: string | null
          reason: string | null
          requester: number | null
          status: Database["public"]["Enums"]["status"]
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id: number
          name?: string | null
          price?: number | null
          quantity?: number | null
          quote_name?: string | null
          reason?: string | null
          requester?: number | null
          status?: Database["public"]["Enums"]["status"]
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: number
          name?: string | null
          price?: number | null
          quantity?: number | null
          quote_name?: string | null
          reason?: string | null
          requester?: number | null
          status?: Database["public"]["Enums"]["status"]
        }
        Relationships: [
          {
            foreignKeyName: "orders_requester_fkey"
            columns: ["requester"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["member_id"]
          },
        ]
      }
      roles: {
        Row: {
          dept_id: number | null
          division_id: number | null
          id: number
          leaved_at: string | null
          member_id: number | null
          started_at: string | null
          title: string | null
          type: Database["public"]["Enums"]["position_type"] | null
        }
        Insert: {
          dept_id?: number | null
          division_id?: number | null
          id: number
          leaved_at?: string | null
          member_id?: number | null
          started_at?: string | null
          title?: string | null
          type?: Database["public"]["Enums"]["position_type"] | null
        }
        Update: {
          dept_id?: number | null
          division_id?: number | null
          id?: number
          leaved_at?: string | null
          member_id?: number | null
          started_at?: string | null
          title?: string | null
          type?: Database["public"]["Enums"]["position_type"] | null
        }
        Relationships: [
          {
            foreignKeyName: "positions_division_id_fkey"
            columns: ["division_id"]
            isOneToOne: false
            referencedRelation: "divisions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "positions_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "positions_subteam_id_fkey"
            columns: ["dept_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
        ]
      }
      users: {
        Row: {
          access: string[] | null
          created_at: string
          email: string
          first_name: string | null
          id: string
          last_name: string | null
          level_of_study: string | null
          linkedin: string | null
          member: number | null
          origin: string | null
          polito_id: string | null
          program: string | null
          updated_at: string | null
        }
        Insert: {
          access?: string[] | null
          created_at?: string
          email: string
          first_name?: string | null
          id: string
          last_name?: string | null
          level_of_study?: string | null
          linkedin?: string | null
          member?: number | null
          origin?: string | null
          polito_id?: string | null
          program?: string | null
          updated_at?: string | null
        }
        Update: {
          access?: string[] | null
          created_at?: string
          email?: string
          first_name?: string | null
          id?: string
          last_name?: string | null
          level_of_study?: string | null
          linkedin?: string | null
          member?: number | null
          origin?: string | null
          polito_id?: string | null
          program?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "users_member_fkey"
            columns: ["member"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["member_id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_president_id: {
        Args: Record<PropertyKey, never>
        Returns: number
      }
    }
    Enums: {
      application_status:
        | "pending"
        | "rejected"
        | "accepted"
        | "received"
        | "accepted_by_another_team"
      position_type: "president" | "head" | "lead" | "core"
      status: "pending" | "accepted" | "rejected"
      status_type:
        | "open"
        | "closed"
        | "pending"
        | "approved"
        | "rejected"
        | "in_progress"
        | "completed"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DefaultSchema = Database[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof (Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        Database[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? (Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      Database[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof Database },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof Database },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends { schema: keyof Database }
  ? Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      application_status: [
        "pending",
        "rejected",
        "accepted",
        "received",
        "accepted_by_another_team",
      ],
      position_type: ["president", "head", "lead", "core"],
      status: ["pending", "accepted", "rejected"],
      status_type: [
        "open",
        "closed",
        "pending",
        "approved",
        "rejected",
        "in_progress",
        "completed",
      ],
    },
  },
} as const

