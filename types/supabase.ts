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
          query?: string
          extensions?: Json
          variables?: Json
          operationName?: string
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
  next_auth: {
    Tables: {
      accounts: {
        Row: {
          access_token: string | null
          expires_at: number | null
          id: string
          id_token: string | null
          oauth_token: string | null
          oauth_token_secret: string | null
          provider: string
          providerAccountId: string
          refresh_token: string | null
          scope: string | null
          session_state: string | null
          token_type: string | null
          type: string
          userId: string | null
        }
        Insert: {
          access_token?: string | null
          expires_at?: number | null
          id?: string
          id_token?: string | null
          oauth_token?: string | null
          oauth_token_secret?: string | null
          provider: string
          providerAccountId: string
          refresh_token?: string | null
          scope?: string | null
          session_state?: string | null
          token_type?: string | null
          type: string
          userId?: string | null
        }
        Update: {
          access_token?: string | null
          expires_at?: number | null
          id?: string
          id_token?: string | null
          oauth_token?: string | null
          oauth_token_secret?: string | null
          provider?: string
          providerAccountId?: string
          refresh_token?: string | null
          scope?: string | null
          session_state?: string | null
          token_type?: string | null
          type?: string
          userId?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "accounts_userId_fkey"
            columns: ["userId"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      sessions: {
        Row: {
          expires: string
          id: string
          sessionToken: string
          userId: string | null
        }
        Insert: {
          expires: string
          id?: string
          sessionToken: string
          userId?: string | null
        }
        Update: {
          expires?: string
          id?: string
          sessionToken?: string
          userId?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sessions_userId_fkey"
            columns: ["userId"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      users: {
        Row: {
          email: string | null
          emailVerified: string | null
          id: string
          image: string | null
          name: string | null
        }
        Insert: {
          email?: string | null
          emailVerified?: string | null
          id?: string
          image?: string | null
          name?: string | null
        }
        Update: {
          email?: string | null
          emailVerified?: string | null
          id?: string
          image?: string | null
          name?: string | null
        }
        Relationships: []
      }
      verification_tokens: {
        Row: {
          expires: string
          identifier: string | null
          token: string
        }
        Insert: {
          expires: string
          identifier?: string | null
          token: string
        }
        Update: {
          expires?: string
          identifier?: string | null
          token?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      uid: {
        Args: Record<PropertyKey, never>
        Returns: string
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
          apply_position_id: number | null
          custom_answers: Json[] | null
          cv_name: string | null
          id: number
          ml_name: string | null
          status: Database["public"]["Enums"]["application_status"]
          user_id: string | null
        }
        Insert: {
          applied_at?: string
          apply_position_id?: number | null
          custom_answers?: Json[] | null
          cv_name?: string | null
          id?: number
          ml_name?: string | null
          status?: Database["public"]["Enums"]["application_status"]
          user_id?: string | null
        }
        Update: {
          applied_at?: string
          apply_position_id?: number | null
          custom_answers?: Json[] | null
          cv_name?: string | null
          id?: number
          ml_name?: string | null
          status?: Database["public"]["Enums"]["application_status"]
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "applications_apply_position_id_fkey"
            columns: ["apply_position_id"]
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
          created_at: string
          custom_questions: string[] | null
          description: string | null
          desirable_skills: string[] | null
          division_id: number | null
          id: number
          is_deleted: boolean
          required_skills: string[] | null
          requires_motivation_letter: boolean
          status: boolean
          title: string | null
        }
        Insert: {
          created_at?: string
          custom_questions?: string[] | null
          description?: string | null
          desirable_skills?: string[] | null
          division_id?: number | null
          id?: number
          is_deleted?: boolean
          required_skills?: string[] | null
          requires_motivation_letter?: boolean
          status: boolean
          title?: string | null
        }
        Update: {
          created_at?: string
          custom_questions?: string[] | null
          description?: string | null
          desirable_skills?: string[] | null
          division_id?: number | null
          id?: number
          is_deleted?: boolean
          required_skills?: string[] | null
          requires_motivation_letter?: boolean
          status?: boolean
          title?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "apply_positions_division_id_fkey"
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
          name: string
          started_at: string
        }
        Insert: {
          closed_at?: string | null
          code?: string | null
          id?: number
          name: string
          started_at?: string
        }
        Update: {
          closed_at?: string | null
          code?: string | null
          id?: number
          name?: string
          started_at?: string
        }
        Relationships: []
      }
      divisions: {
        Row: {
          closed_at: string | null
          code: string | null
          dept_id: number | null
          id: number
          name: string
          started_at: string
        }
        Insert: {
          closed_at?: string | null
          code?: string | null
          dept_id?: number | null
          id?: number
          name: string
          started_at?: string
        }
        Update: {
          closed_at?: string | null
          code?: string | null
          dept_id?: number | null
          id?: number
          name?: string
          started_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "divisions_dept_id_fkey"
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
          nda_confirmed_by: number | null
          nda_name: string | null
          nda_signed_at: string
          picture: string | null
          prt_email: string | null
        }
        Insert: {
          discord?: string | null
          member_id?: number
          nda_confirmed_by?: number | null
          nda_name?: string | null
          nda_signed_at?: string
          picture?: string | null
          prt_email?: string | null
        }
        Update: {
          discord?: string | null
          member_id?: number
          nda_confirmed_by?: number | null
          nda_name?: string | null
          nda_signed_at?: string
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
          created_at: string
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
          created_at?: string
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
        Update: {
          created_at?: string
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
          started_at: string
          title: string
          type: Database["public"]["Enums"]["position_type"] | null
        }
        Insert: {
          dept_id?: number | null
          division_id?: number | null
          id?: number
          leaved_at?: string | null
          member_id?: number | null
          started_at?: string
          title: string
          type?: Database["public"]["Enums"]["position_type"] | null
        }
        Update: {
          dept_id?: number | null
          division_id?: number | null
          id?: number
          leaved_at?: string | null
          member_id?: number | null
          started_at?: string
          title?: string
          type?: Database["public"]["Enums"]["position_type"] | null
        }
        Relationships: [
          {
            foreignKeyName: "roles_dept_id_fkey"
            columns: ["dept_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "roles_division_id_fkey"
            columns: ["division_id"]
            isOneToOne: false
            referencedRelation: "divisions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "roles_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["member_id"]
          },
        ]
      }
      scopes: {
        Row: {
          access_level: Database["public"]["Enums"]["access_level_type"]
          dept_id: number | null
          division_id: number | null
          given_by: string | null
          id: number
          scope: Database["public"]["Enums"]["scope_type"]
          target: Database["public"]["Enums"]["target_type"]
          user_id: string | null
        }
        Insert: {
          access_level?: Database["public"]["Enums"]["access_level_type"]
          dept_id?: number | null
          division_id?: number | null
          given_by?: string | null
          id?: number
          scope: Database["public"]["Enums"]["scope_type"]
          target: Database["public"]["Enums"]["target_type"]
          user_id?: string | null
        }
        Update: {
          access_level?: Database["public"]["Enums"]["access_level_type"]
          dept_id?: number | null
          division_id?: number | null
          given_by?: string | null
          id?: number
          scope?: Database["public"]["Enums"]["scope_type"]
          target?: Database["public"]["Enums"]["target_type"]
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "scopes_dept_id_fkey"
            columns: ["dept_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scopes_division_id_fkey"
            columns: ["division_id"]
            isOneToOne: false
            referencedRelation: "divisions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scopes_given_by_fkey"
            columns: ["given_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scopes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      users: {
        Row: {
          created_at: string
          date_of_birth: string | null
          email: string
          first_name: string | null
          gender: string | null
          how_found_us: string | null
          id: string
          last_name: string | null
          level_of_study: string | null
          linkedin: string | null
          member: number | null
          mobile_number: string | null
          origin: string | null
          polito_email: string | null
          polito_id: string | null
          program: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string
          date_of_birth?: string | null
          email: string
          first_name?: string | null
          gender?: string | null
          how_found_us?: string | null
          id: string
          last_name?: string | null
          level_of_study?: string | null
          linkedin?: string | null
          member?: number | null
          mobile_number?: string | null
          origin?: string | null
          polito_email?: string | null
          polito_id?: string | null
          program?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string
          date_of_birth?: string | null
          email?: string
          first_name?: string | null
          gender?: string | null
          how_found_us?: string | null
          id?: string
          last_name?: string | null
          level_of_study?: string | null
          linkedin?: string | null
          member?: number | null
          mobile_number?: string | null
          origin?: string | null
          polito_email?: string | null
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
      [_ in never]: never
    }
    Enums: {
      access_level_type: "view" | "edit"
      application_status:
        | "received"
        | "not_selected"
        | "interview"
        | "rejected_email_to_be_sent"
        | "rejected"
        | "accepted_email_to_be_sent"
        | "accepted"
        | "accepted_joined"
        | "resigned"
        | "accepted_by_another_team"
      position_type: "president" | "head" | "lead" | "core"
      scope_type: "admin" | "org" | "department" | "division" | "website"
      status: "pending" | "accepted" | "rejected"
      target_type:
        | "all"
        | "positions"
        | "applications"
        | "members"
        | "orders"
        | "faq"
        | "blog"
        | "logs"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
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
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
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
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
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
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  next_auth: {
    Enums: {},
  },
  public: {
    Enums: {
      access_level_type: ["view", "edit"],
      application_status: [
        "received",
        "not_selected",
        "interview",
        "rejected_email_to_be_sent",
        "rejected",
        "accepted_email_to_be_sent",
        "accepted",
        "accepted_joined",
        "resigned",
        "accepted_by_another_team",
      ],
      position_type: ["president", "head", "lead", "core"],
      scope_type: ["admin", "org", "department", "division", "website"],
      status: ["pending", "accepted", "rejected"],
      target_type: [
        "all",
        "positions",
        "applications",
        "members",
        "orders",
        "faq",
        "blog",
        "logs",
      ],
    },
  },
} as const

