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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      blog_posts: {
        Row: {
          author_name: string
          category: string
          content: string
          created_at: string
          excerpt: string
          featured_image: string | null
          id: string
          is_published: boolean
          meta_description: string | null
          published_at: string | null
          slug: string
          tags: string[] | null
          title: string
          updated_at: string
        }
        Insert: {
          author_name?: string
          category?: string
          content: string
          created_at?: string
          excerpt: string
          featured_image?: string | null
          id?: string
          is_published?: boolean
          meta_description?: string | null
          published_at?: string | null
          slug: string
          tags?: string[] | null
          title: string
          updated_at?: string
        }
        Update: {
          author_name?: string
          category?: string
          content?: string
          created_at?: string
          excerpt?: string
          featured_image?: string | null
          id?: string
          is_published?: boolean
          meta_description?: string | null
          published_at?: string | null
          slug?: string
          tags?: string[] | null
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      learning_request_responses: {
        Row: {
          created_at: string
          id: string
          message: string
          proposed_rate: number | null
          request_id: string
          responder_id: string
          responder_name: string
          responder_skills: string[]
          status: string
        }
        Insert: {
          created_at?: string
          id?: string
          message: string
          proposed_rate?: number | null
          request_id: string
          responder_id: string
          responder_name: string
          responder_skills?: string[]
          status?: string
        }
        Update: {
          created_at?: string
          id?: string
          message?: string
          proposed_rate?: number | null
          request_id?: string
          responder_id?: string
          responder_name?: string
          responder_skills?: string[]
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "learning_request_responses_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "learning_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      learning_requests: {
        Row: {
          budget_max: number | null
          budget_min: number | null
          created_at: string
          description: string
          id: string
          preferred_duration: string | null
          request_type: Database["public"]["Enums"]["learning_request_type"]
          skills: string[]
          status: Database["public"]["Enums"]["learning_request_status"]
          title: string
          updated_at: string
          urgency: string | null
          user_id: string
        }
        Insert: {
          budget_max?: number | null
          budget_min?: number | null
          created_at?: string
          description: string
          id?: string
          preferred_duration?: string | null
          request_type?: Database["public"]["Enums"]["learning_request_type"]
          skills?: string[]
          status?: Database["public"]["Enums"]["learning_request_status"]
          title: string
          updated_at?: string
          urgency?: string | null
          user_id: string
        }
        Update: {
          budget_max?: number | null
          budget_min?: number | null
          created_at?: string
          description?: string
          id?: string
          preferred_duration?: string | null
          request_type?: Database["public"]["Enums"]["learning_request_type"]
          skills?: string[]
          status?: Database["public"]["Enums"]["learning_request_status"]
          title?: string
          updated_at?: string
          urgency?: string | null
          user_id?: string
        }
        Relationships: []
      }
      mentors: {
        Row: {
          avatar_url: string | null
          bio: string
          calendly_url: string | null
          created_at: string
          experience_years: number
          expertise: string[]
          hourly_rate: number
          id: string
          is_active: boolean
          is_verified: boolean
          linkedin_url: string | null
          name: string
          title: string
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          bio: string
          calendly_url?: string | null
          created_at?: string
          experience_years?: number
          expertise?: string[]
          hourly_rate: number
          id?: string
          is_active?: boolean
          is_verified?: boolean
          linkedin_url?: string | null
          name: string
          title: string
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          bio?: string
          calendly_url?: string | null
          created_at?: string
          experience_years?: number
          expertise?: string[]
          hourly_rate?: number
          id?: string
          is_active?: boolean
          is_verified?: boolean
          linkedin_url?: string | null
          name?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      mentorship_bookings: {
        Row: {
          created_at: string
          duration_minutes: number
          id: string
          meeting_link: string | null
          meeting_type: string
          mentor_id: string
          notes: string | null
          scheduled_at: string
          status: string
          topic_id: string
          total_price: number
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          duration_minutes?: number
          id?: string
          meeting_link?: string | null
          meeting_type?: string
          mentor_id: string
          notes?: string | null
          scheduled_at: string
          status?: string
          topic_id: string
          total_price: number
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          duration_minutes?: number
          id?: string
          meeting_link?: string | null
          meeting_type?: string
          mentor_id?: string
          notes?: string | null
          scheduled_at?: string
          status?: string
          topic_id?: string
          total_price?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "mentorship_bookings_mentor_id_fkey"
            columns: ["mentor_id"]
            isOneToOne: false
            referencedRelation: "mentors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mentorship_bookings_topic_id_fkey"
            columns: ["topic_id"]
            isOneToOne: false
            referencedRelation: "mentorship_topics"
            referencedColumns: ["id"]
          },
        ]
      }
      mentorship_topics: {
        Row: {
          created_at: string
          description: string | null
          icon: string | null
          id: string
          is_active: boolean
          name: string
          slug: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          icon?: string | null
          id?: string
          is_active?: boolean
          name: string
          slug: string
        }
        Update: {
          created_at?: string
          description?: string | null
          icon?: string | null
          id?: string
          is_active?: boolean
          name?: string
          slug?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          full_name: string
          id: string
          phone: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          full_name: string
          id?: string
          phone?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          full_name?: string
          id?: string
          phone?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      purchases: {
        Row: {
          created_at: string
          expires_at: string | null
          id: string
          price: number
          purchased_at: string
          service_name: string
          service_type: string
          status: string
          user_id: string
        }
        Insert: {
          created_at?: string
          expires_at?: string | null
          id?: string
          price: number
          purchased_at?: string
          service_name: string
          service_type: string
          status?: string
          user_id: string
        }
        Update: {
          created_at?: string
          expires_at?: string | null
          id?: string
          price?: number
          purchased_at?: string
          service_name?: string
          service_type?: string
          status?: string
          user_id?: string
        }
        Relationships: []
      }
      security_reports: {
        Row: {
          created_at: string
          id: string
          report_data: Json | null
          risk_level: string
          scan_type: string
          scanned_at: string
          scanner_name: string | null
          scanner_phone: string | null
          user_id: string
          vulnerabilities_found: number
          website_url: string
        }
        Insert: {
          created_at?: string
          id?: string
          report_data?: Json | null
          risk_level?: string
          scan_type?: string
          scanned_at?: string
          scanner_name?: string | null
          scanner_phone?: string | null
          user_id: string
          vulnerabilities_found?: number
          website_url: string
        }
        Update: {
          created_at?: string
          id?: string
          report_data?: Json | null
          risk_level?: string
          scan_type?: string
          scanned_at?: string
          scanner_name?: string | null
          scanner_phone?: string | null
          user_id?: string
          vulnerabilities_found?: number
          website_url?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      learning_request_status:
        | "open"
        | "in_progress"
        | "completed"
        | "cancelled"
      learning_request_type: "learn" | "consulting" | "project_help"
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
      learning_request_status: [
        "open",
        "in_progress",
        "completed",
        "cancelled",
      ],
      learning_request_type: ["learn", "consulting", "project_help"],
    },
  },
} as const
