export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      audit_log: {
        Row: {
          action: string
          details: Json | null
          entity_id: string | null
          entity_type: string | null
          id: string
          timestamp: string
          user_id: string | null
        }
        Insert: {
          action: string
          details?: Json | null
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          timestamp?: string
          user_id?: string | null
        }
        Update: {
          action?: string
          details?: Json | null
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          timestamp?: string
          user_id?: string | null
        }
        Relationships: []
      }
      checkins: {
        Row: {
          achievement_value: number
          completion_date: string
          created_at: string
          created_by: string
          goal_id: string
          id: string
          manager_comments: string | null
          score: number | null
        }
        Insert: {
          achievement_value: number
          completion_date?: string
          created_at?: string
          created_by?: string
          goal_id: string
          id?: string
          manager_comments?: string | null
          score?: number | null
        }
        Update: {
          achievement_value?: number
          completion_date?: string
          created_at?: string
          created_by?: string
          goal_id?: string
          id?: string
          manager_comments?: string | null
          score?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "checkins_goal_id_fkey"
            columns: ["goal_id"]
            isOneToOne: false
            referencedRelation: "goals"
            referencedColumns: ["id"]
          },
        ]
      }
      goals: {
        Row: {
          created_at: string
          created_by: string
          cycle: string
          deadline: string | null
          description: string | null
          employee_id: string
          id: string
          is_locked: boolean
          manager_comments: string | null
          status: Database["public"]["Enums"]["goal_status"]
          target: number
          title: string
          uom: Database["public"]["Enums"]["uom_type"]
          updated_at: string
          weightage: number
        }
        Insert: {
          created_at?: string
          created_by?: string
          cycle?: string
          deadline?: string | null
          description?: string | null
          employee_id: string
          id?: string
          is_locked?: boolean
          manager_comments?: string | null
          status?: Database["public"]["Enums"]["goal_status"]
          target: number
          title: string
          uom?: Database["public"]["Enums"]["uom_type"]
          updated_at?: string
          weightage: number
        }
        Update: {
          created_at?: string
          created_by?: string
          cycle?: string
          deadline?: string | null
          description?: string | null
          employee_id?: string
          id?: string
          is_locked?: boolean
          manager_comments?: string | null
          status?: Database["public"]["Enums"]["goal_status"]
          target?: number
          title?: string
          uom?: Database["public"]["Enums"]["uom_type"]
          updated_at?: string
          weightage?: number
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          manager_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          full_name?: string | null
          id: string
          manager_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          manager_id?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      shared_goals: {
        Row: {
          allocation_pct: number | null
          child_goal_id: string
          created_at: string
          id: string
          is_split_forked: boolean
          original_goal_id: string
          slocked: boolean
        }
        Insert: {
          allocation_pct?: number | null
          child_goal_id: string
          created_at?: string
          id?: string
          is_split_forked?: boolean
          original_goal_id: string
          slocked?: boolean
        }
        Update: {
          allocation_pct?: number | null
          child_goal_id?: string
          created_at?: string
          id?: string
          is_split_forked?: boolean
          original_goal_id?: string
          slocked?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "shared_goals_child_goal_id_fkey"
            columns: ["child_goal_id"]
            isOneToOne: false
            referencedRelation: "goals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shared_goals_original_goal_id_fkey"
            columns: ["original_goal_id"]
            isOneToOne: false
            referencedRelation: "goals"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_user_role: {
        Args: { _user_id: string }
        Returns: Database["public"]["Enums"]["app_role"]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "employee" | "manager" | "admin"
      goal_status: "PENDING" | "APPROVED" | "REJECTED"
      uom_type: "HIGHER_BETTER" | "LOWER_BETTER" | "TIMELINE" | "ZERO_BASED"
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
  public: {
    Enums: {
      app_role: ["employee", "manager", "admin"],
      goal_status: ["PENDING", "APPROVED", "REJECTED"],
      uom_type: ["HIGHER_BETTER", "LOWER_BETTER", "TIMELINE", "ZERO_BASED"],
    },
  },
} as const
