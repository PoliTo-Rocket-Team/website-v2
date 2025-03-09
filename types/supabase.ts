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
          applied_at: string | null
          custom_answers: Json[] | null
          cv_name: string | null
          id: number
          ml_name: string | null
          open_position_id: number | null
          status: Database["public"]["Enums"]["application_status"]
          user_id: string
        }
        Insert: {
          applied_at?: string | null
          custom_answers?: Json[] | null
          cv_name?: string | null
          id: number
          ml_name?: string | null
          open_position_id?: number | null
          status?: Database["public"]["Enums"]["application_status"]
          user_id: string
        }
        Update: {
          applied_at?: string | null
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
          custom_questions: Json[] | null
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
          custom_questions?: Json[] | null
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
          custom_questions?: Json[] | null
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
      divisions: {
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
      members: {
        Row: {
          discord: string | null
          has_pp: boolean
          member_id: number
          mobile_number: string | null
          nda_name: string | null
          nda_signed_at: string | null
          prt_email: string | null
        }
        Insert: {
          discord?: string | null
          has_pp: boolean
          member_id: number
          mobile_number?: string | null
          nda_name?: string | null
          nda_signed_at?: string | null
          prt_email?: string | null
        }
        Update: {
          discord?: string | null
          has_pp?: boolean
          member_id?: number
          mobile_number?: string | null
          nda_name?: string | null
          nda_signed_at?: string | null
          prt_email?: string | null
        }
        Relationships: []
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
          division_id: number | null
          id: number
          leaved_at: string | null
          member_id: number | null
          started_at: string | null
          subteam_id: number | null
          title: string | null
          type: Database["public"]["Enums"]["position type"]
        }
        Insert: {
          division_id?: number | null
          id: number
          leaved_at?: string | null
          member_id?: number | null
          started_at?: string | null
          subteam_id?: number | null
          title?: string | null
          type?: Database["public"]["Enums"]["position type"]
        }
        Update: {
          division_id?: number | null
          id?: number
          leaved_at?: string | null
          member_id?: number | null
          started_at?: string | null
          subteam_id?: number | null
          title?: string | null
          type?: Database["public"]["Enums"]["position type"]
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
            columns: ["subteam_id"]
            isOneToOne: false
            referencedRelation: "subteams"
            referencedColumns: ["id"]
          },
        ]
      }
      subteams: {
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
      users: {
        Row: {
          created_at: string
          email: string | null
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
          created_at: string
          email?: string | null
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
          created_at?: string
          email?: string | null
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
      "position type": "chief" | "lead" | "coordinator" | "core_member"
      status: "pending" | "accepted" | "rejected"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type PublicSchema = Database[Extract<keyof Database, "public">]

export type Tables<
  PublicTableNameOrOptions extends
    | keyof (PublicSchema["Tables"] & PublicSchema["Views"])
    | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof (Database[PublicTableNameOrOptions["schema"]]["Tables"] &
        Database[PublicTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? (Database[PublicTableNameOrOptions["schema"]]["Tables"] &
      Database[PublicTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : PublicTableNameOrOptions extends keyof (PublicSchema["Tables"] &
        PublicSchema["Views"])
    ? (PublicSchema["Tables"] &
        PublicSchema["Views"])[PublicTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  PublicTableNameOrOptions extends
    | keyof PublicSchema["Tables"]
    | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? Database[PublicTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : PublicTableNameOrOptions extends keyof PublicSchema["Tables"]
    ? PublicSchema["Tables"][PublicTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  PublicTableNameOrOptions extends
    | keyof PublicSchema["Tables"]
    | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? Database[PublicTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : PublicTableNameOrOptions extends keyof PublicSchema["Tables"]
    ? PublicSchema["Tables"][PublicTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  PublicEnumNameOrOptions extends
    | keyof PublicSchema["Enums"]
    | { schema: keyof Database },
  EnumName extends PublicEnumNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = PublicEnumNameOrOptions extends { schema: keyof Database }
  ? Database[PublicEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : PublicEnumNameOrOptions extends keyof PublicSchema["Enums"]
    ? PublicSchema["Enums"][PublicEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof PublicSchema["CompositeTypes"]
    | { schema: keyof Database },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends { schema: keyof Database }
  ? Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof PublicSchema["CompositeTypes"]
    ? PublicSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

