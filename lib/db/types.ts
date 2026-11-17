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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      analyses: {
        Row: {
          covered_count: number
          created_at: string
          duration_ms: number | null
          id: string
          job_id: string | null
          map: Json
          model: string
          prompt_version: string
          provider: string
          response_count: number
          round_id: string
        }
        Insert: {
          covered_count: number
          created_at?: string
          duration_ms?: number | null
          id?: string
          job_id?: string | null
          map: Json
          model: string
          prompt_version: string
          provider: string
          response_count: number
          round_id: string
        }
        Update: {
          covered_count?: number
          created_at?: string
          duration_ms?: number | null
          id?: string
          job_id?: string | null
          map?: Json
          model?: string
          prompt_version?: string
          provider?: string
          response_count?: number
          round_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "analyses_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "analysis_jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "analyses_round_id_fkey"
            columns: ["round_id"]
            isOneToOne: true
            referencedRelation: "rounds"
            referencedColumns: ["id"]
          },
        ]
      }
      analysis_jobs: {
        Row: {
          attempts: number
          created_at: string
          created_by: string | null
          error: string | null
          id: string
          kind: Database["public"]["Enums"]["job_kind"]
          locked_at: string | null
          payload: Json
          result: Json | null
          round_id: string | null
          status: Database["public"]["Enums"]["job_status"]
          team_id: string | null
          updated_at: string
        }
        Insert: {
          attempts?: number
          created_at?: string
          created_by?: string | null
          error?: string | null
          id?: string
          kind: Database["public"]["Enums"]["job_kind"]
          locked_at?: string | null
          payload?: Json
          result?: Json | null
          round_id?: string | null
          status?: Database["public"]["Enums"]["job_status"]
          team_id?: string | null
          updated_at?: string
        }
        Update: {
          attempts?: number
          created_at?: string
          created_by?: string | null
          error?: string | null
          id?: string
          kind?: Database["public"]["Enums"]["job_kind"]
          locked_at?: string | null
          payload?: Json
          result?: Json | null
          round_id?: string | null
          status?: Database["public"]["Enums"]["job_status"]
          team_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "analysis_jobs_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "analysis_jobs_round_id_fkey"
            columns: ["round_id"]
            isOneToOne: false
            referencedRelation: "rounds"
            referencedColumns: ["id"]
          },
        ]
      }
      decision_reads: {
        Row: {
          decision_id: string
          read_at: string
          user_id: string
        }
        Insert: {
          decision_id: string
          read_at?: string
          user_id: string
        }
        Update: {
          decision_id?: string
          read_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "decision_reads_decision_id_fkey"
            columns: ["decision_id"]
            isOneToOne: false
            referencedRelation: "decisions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "decision_reads_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      decisions: {
        Row: {
          body: string
          cluster_refs: number[]
          created_at: string
          decided_by: string | null
          id: string
          rationale: string
          round_id: string
          team_id: string
        }
        Insert: {
          body: string
          cluster_refs?: number[]
          created_at?: string
          decided_by?: string | null
          id?: string
          rationale: string
          round_id: string
          team_id: string
        }
        Update: {
          body?: string
          cluster_refs?: number[]
          created_at?: string
          decided_by?: string | null
          id?: string
          rationale?: string
          round_id?: string
          team_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "decisions_decided_by_fkey"
            columns: ["decided_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "decisions_round_id_fkey"
            columns: ["round_id"]
            isOneToOne: true
            referencedRelation: "rounds"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "decisions_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      invites: {
        Row: {
          created_at: string
          created_by: string | null
          expires_at: string
          id: string
          organization_id: string
          token_hash: string
          used_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          expires_at?: string
          id?: string
          organization_id: string
          token_hash: string
          used_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          expires_at?: string
          id?: string
          organization_id?: string
          token_hash?: string
          used_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "invites_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invites_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invites_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_members: {
        Row: {
          joined_at: string
          managed: boolean
          organization_id: string
          role: Database["public"]["Enums"]["org_role"]
          user_id: string
        }
        Insert: {
          joined_at?: string
          managed?: boolean
          organization_id: string
          role?: Database["public"]["Enums"]["org_role"]
          user_id: string
        }
        Update: {
          joined_at?: string
          managed?: boolean
          organization_id?: string
          role?: Database["public"]["Enums"]["org_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_members_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organization_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          name: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          name: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "organizations_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          display_name: string
          id: string
        }
        Insert: {
          created_at?: string
          display_name: string
          id: string
        }
        Update: {
          created_at?: string
          display_name?: string
          id?: string
        }
        Relationships: []
      }
      responses: {
        Row: {
          author_id: string
          body: string
          created_at: string
          id: string
          pseudonym: string
          round_id: string
          source: Database["public"]["Enums"]["response_source"]
          updated_at: string
        }
        Insert: {
          author_id?: string
          body: string
          created_at?: string
          id?: string
          pseudonym?: string
          round_id: string
          source?: Database["public"]["Enums"]["response_source"]
          updated_at?: string
        }
        Update: {
          author_id?: string
          body?: string
          created_at?: string
          id?: string
          pseudonym?: string
          round_id?: string
          source?: Database["public"]["Enums"]["response_source"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "responses_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "responses_round_id_fkey"
            columns: ["round_id"]
            isOneToOne: false
            referencedRelation: "rounds"
            referencedColumns: ["id"]
          },
        ]
      }
      rounds: {
        Row: {
          anonymous: boolean
          closed_at: string | null
          context: string | null
          created_at: string
          created_by: string | null
          deadline: string
          id: string
          parent_round_id: string | null
          question: string
          status: Database["public"]["Enums"]["round_status"]
          team_id: string
        }
        Insert: {
          anonymous?: boolean
          closed_at?: string | null
          context?: string | null
          created_at?: string
          created_by?: string | null
          deadline: string
          id?: string
          parent_round_id?: string | null
          question: string
          status?: Database["public"]["Enums"]["round_status"]
          team_id: string
        }
        Update: {
          anonymous?: boolean
          closed_at?: string | null
          context?: string | null
          created_at?: string
          created_by?: string | null
          deadline?: string
          id?: string
          parent_round_id?: string | null
          question?: string
          status?: Database["public"]["Enums"]["round_status"]
          team_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "rounds_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rounds_parent_round_id_fkey"
            columns: ["parent_round_id"]
            isOneToOne: false
            referencedRelation: "rounds"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rounds_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      team_members: {
        Row: {
          joined_at: string
          role: Database["public"]["Enums"]["team_role"]
          show_real_name: boolean
          team_id: string
          user_id: string
        }
        Insert: {
          joined_at?: string
          role?: Database["public"]["Enums"]["team_role"]
          show_real_name?: boolean
          team_id: string
          user_id: string
        }
        Update: {
          joined_at?: string
          role?: Database["public"]["Enums"]["team_role"]
          show_real_name?: boolean
          team_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "team_members_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "team_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      teams: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          name: string
          organization_id: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          name: string
          organization_id?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          name?: string
          organization_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "teams_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "teams_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      round_responses: {
        Row: {
          body: string | null
          created_at: string | null
          display_name: string | null
          id: string | null
          is_own: boolean | null
          pseudonym: string | null
          round_id: string | null
          source: Database["public"]["Enums"]["response_source"] | null
          updated_at: string | null
        }
        Relationships: [
          {
            foreignKeyName: "responses_round_id_fkey"
            columns: ["round_id"]
            isOneToOne: false
            referencedRelation: "rounds"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      add_team_member: {
        Args: { p_team_id: string; p_user_id: string }
        Returns: string
      }
      add_team_member_by_email: {
        Args: { p_email: string; p_team_id: string }
        Returns: string
      }
      claim_jobs: {
        Args: {
          p_job_id?: string
          p_kind: Database["public"]["Enums"]["job_kind"]
          p_limit?: number
        }
        Returns: {
          attempts: number
          created_at: string
          created_by: string | null
          error: string | null
          id: string
          kind: Database["public"]["Enums"]["job_kind"]
          locked_at: string | null
          payload: Json
          result: Json | null
          round_id: string | null
          status: Database["public"]["Enums"]["job_status"]
          team_id: string | null
          updated_at: string
        }[]
        SetofOptions: {
          from: "*"
          to: "analysis_jobs"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      close_expired_rounds: { Args: never; Returns: number }
      create_organization: {
        Args: { p_name: string }
        Returns: {
          created_at: string
          created_by: string | null
          id: string
          name: string
        }
        SetofOptions: {
          from: "*"
          to: "organizations"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      create_team: {
        Args: { p_name: string; p_organization_id?: string }
        Returns: {
          created_at: string
          created_by: string | null
          id: string
          name: string
          organization_id: string | null
        }
        SetofOptions: {
          from: "*"
          to: "teams"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      decide_round: {
        Args: {
          p_body: string
          p_cluster_refs?: number[]
          p_rationale: string
          p_round_id: string
        }
        Returns: {
          body: string
          cluster_refs: number[]
          created_at: string
          decided_by: string | null
          id: string
          rationale: string
          round_id: string
          team_id: string
        }
        SetofOptions: {
          from: "*"
          to: "decisions"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      decision_read_count: {
        Args: { p_decision_id: string }
        Returns: {
          member_count: number
          read_count: number
        }[]
      }
      delete_organization: { Args: { p_org_id: string }; Returns: undefined }
      delete_team: { Args: { p_team_id: string }; Returns: undefined }
      find_user_id_by_email: { Args: { p_email: string }; Returns: string }
      is_guest_for_team: { Args: { p_team_id: string }; Returns: boolean }
      is_org_admin: { Args: { p_org_id: string }; Returns: boolean }
      is_org_member: { Args: { p_org_id: string }; Returns: boolean }
      is_team_lead: { Args: { p_team_id: string }; Returns: boolean }
      is_team_member: { Args: { p_team_id: string }; Returns: boolean }
      organization_people: {
        Args: { p_org_id: string }
        Returns: {
          display_name: string
          email: string
          joined_at: string
          managed: boolean
          pending: boolean
          role: Database["public"]["Enums"]["org_role"]
          user_id: string
        }[]
      }
      purge_test_users: {
        Args: { p_older_than?: string; p_run?: string }
        Returns: number
      }
      remove_organization_member: {
        Args: { p_org_id: string; p_user_id: string }
        Returns: undefined
      }
      round_response_count: { Args: { p_round_id: string }; Returns: number }
      set_organization_role: {
        Args: {
          p_org_id: string
          p_role: Database["public"]["Enums"]["org_role"]
          p_user_id: string
        }
        Returns: undefined
      }
      shares_org_with: { Args: { p_user_id: string }; Returns: boolean }
      shares_team_with: { Args: { p_user_id: string }; Returns: boolean }
      transfer_organization: {
        Args: { p_org_id: string; p_user_id: string }
        Returns: undefined
      }
      transfer_team: {
        Args: { p_team_id: string; p_user_id: string }
        Returns: undefined
      }
    }
    Enums: {
      job_kind: "transcribe" | "analyze"
      job_status: "pending" | "running" | "done" | "failed"
      org_role: "owner" | "member" | "guest"
      response_source: "text" | "voice"
      round_status: "open" | "closed" | "decided"
      team_role: "lead" | "member"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
      job_kind: ["transcribe", "analyze"],
      job_status: ["pending", "running", "done", "failed"],
      org_role: ["owner", "member", "guest"],
      response_source: ["text", "voice"],
      round_status: ["open", "closed", "decided"],
      team_role: ["lead", "member"],
    },
  },
} as const
