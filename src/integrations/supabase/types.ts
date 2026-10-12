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
      admin_activity: {
        Row: {
          action: string
          actor_email: string | null
          actor_id: string | null
          created_at: string
          details: Json
          entity: string
          entity_id: string | null
          id: number
        }
        Insert: {
          action: string
          actor_email?: string | null
          actor_id?: string | null
          created_at?: string
          details?: Json
          entity: string
          entity_id?: string | null
          id?: never
        }
        Update: {
          action?: string
          actor_email?: string | null
          actor_id?: string | null
          created_at?: string
          details?: Json
          entity?: string
          entity_id?: string | null
          id?: never
        }
        Relationships: []
      }
      customer_contacts: {
        Row: { phone: string; updated_at: string; user_id: string }
        Insert: { phone: string; updated_at?: string; user_id: string }
        Update: { phone?: string; updated_at?: string; user_id?: string }
        Relationships: []
      }
      customer_profiles: {
        Row: { country: string; created_at: string; customer_number: string; full_name: string; updated_at: string; user_id: string }
        Insert: { country: string; created_at?: string; customer_number?: string; full_name: string; updated_at?: string; user_id: string }
        Update: { country?: string; created_at?: string; customer_number?: string; full_name?: string; updated_at?: string; user_id?: string }
        Relationships: []
      }
      inquiries: {
        Row: { country: string | null; created_at: string; email: string | null; id: string; kind: string; message: string | null; name: string; payload: Json; status: Database["public"]["Enums"]["inquiry_status"]; updated_at: string; user_id: string | null }
        Insert: { country?: string | null; created_at?: string; email?: string | null; id?: string; kind: string; message?: string | null; name: string; payload?: Json; status?: Database["public"]["Enums"]["inquiry_status"]; updated_at?: string; user_id?: string | null }
        Update: { country?: string | null; created_at?: string; email?: string | null; id?: string; kind?: string; message?: string | null; name?: string; payload?: Json; status?: Database["public"]["Enums"]["inquiry_status"]; updated_at?: string; user_id?: string | null }
        Relationships: []
      }
      inquiry_contacts: {
        Row: { inquiry_id: string; whatsapp: string }
        Insert: { inquiry_id: string; whatsapp: string }
        Update: { inquiry_id?: string; whatsapp?: string }
        Relationships: []
      }
      reservations: {
        Row: { created_at: string; customer_id: string; id: string; note: string | null; status: Database["public"]["Enums"]["reservation_status"]; updated_at: string; vehicle_id: string }
        Insert: { created_at?: string; customer_id: string; id?: string; note?: string | null; status?: Database["public"]["Enums"]["reservation_status"]; updated_at?: string; vehicle_id: string }
        Update: { created_at?: string; customer_id?: string; id?: string; note?: string | null; status?: Database["public"]["Enums"]["reservation_status"]; updated_at?: string; vehicle_id?: string }
        Relationships: [
          { foreignKeyName: "reservations_vehicle_id_fkey"; columns: ["vehicle_id"]; isOneToOne: false; referencedRelation: "vehicles"; referencedColumns: ["id"] },
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
      vehicle_images: {
        Row: {
          created_at: string
          height: number | null
          id: string
          is_primary: boolean
          original_name: string | null
          position: number
          size_bytes: number | null
          storage_path: string
          thumb_path: string | null
          vehicle_id: string
          width: number | null
        }
        Insert: {
          created_at?: string
          height?: number | null
          id?: string
          is_primary?: boolean
          original_name?: string | null
          position?: number
          size_bytes?: number | null
          storage_path: string
          thumb_path?: string | null
          vehicle_id: string
          width?: number | null
        }
        Update: {
          created_at?: string
          height?: number | null
          id?: string
          is_primary?: boolean
          original_name?: string | null
          position?: number
          size_bytes?: number | null
          storage_path?: string
          thumb_path?: string | null
          vehicle_id?: string
          width?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "vehicle_images_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      vehicles: {
        Row: {
          auction_grade: string | null
          body_type: string | null
          chassis_number: string | null
          created_at: string
          created_by: string | null
          currency: string
          description: string | null
          drivetrain: string | null
          engine_cc: number | null
          exterior_color: string | null
          featured: boolean
          fuel: string | null
          id: string
          interior_color: string | null
          location: string | null
          make: string
          mileage: number
          mileage_unit: string
          model: string
          price: number
          primary_image_path: string | null
          primary_thumb_path: string | null
          publish_state: Database["public"]["Enums"]["publish_state"]
          search_text: string | null
          shipping_info: string | null
          slug: string | null
          status: Database["public"]["Enums"]["vehicle_status"]
          stock_id: string
          transmission: string | null
          updated_at: string
          variant: string | null
          year: number
        }
        Insert: {
          auction_grade?: string | null
          body_type?: string | null
          chassis_number?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string
          description?: string | null
          drivetrain?: string | null
          engine_cc?: number | null
          exterior_color?: string | null
          featured?: boolean
          fuel?: string | null
          id?: string
          interior_color?: string | null
          location?: string | null
          make: string
          mileage: number
          mileage_unit?: string
          model: string
          price: number
          primary_image_path?: string | null
          primary_thumb_path?: string | null
          publish_state?: Database["public"]["Enums"]["publish_state"]
          search_text?: string | null
          shipping_info?: string | null
          slug?: string | null
          status?: Database["public"]["Enums"]["vehicle_status"]
          stock_id: string
          transmission?: string | null
          updated_at?: string
          variant?: string | null
          year: number
        }
        Update: {
          auction_grade?: string | null
          body_type?: string | null
          chassis_number?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string
          description?: string | null
          drivetrain?: string | null
          engine_cc?: number | null
          exterior_color?: string | null
          featured?: boolean
          fuel?: string | null
          id?: string
          interior_color?: string | null
          location?: string | null
          make?: string
          mileage?: number
          mileage_unit?: string
          model?: string
          price?: number
          primary_image_path?: string | null
          primary_thumb_path?: string | null
          publish_state?: Database["public"]["Enums"]["publish_state"]
          search_text?: string | null
          shipping_info?: string | null
          slug?: string | null
          status?: Database["public"]["Enums"]["vehicle_status"]
          stock_id?: string
          transmission?: string | null
          updated_at?: string
          variant?: string | null
          year?: number
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      cancel_reservation: { Args: { _reservation_id: string }; Returns: undefined }
      complete_customer_profile: { Args: { _country: string; _full_name: string; _phone: string }; Returns: undefined }
      reserve_vehicle: { Args: { _note?: string; _vehicle_id: string }; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_admin: { Args: { _user_id: string }; Returns: boolean }
      vehicle_facets: {
        Args: never
        Returns: {
          make: string
          model: string
        }[]
      }
    }
    Enums: {
      app_role: "super_admin" | "inventory_manager"
      inquiry_status: "new" | "contacted" | "closed"
      publish_state: "draft" | "published" | "archived"
      reservation_status: "pending" | "confirmed" | "cancelled" | "completed"
      vehicle_status: "available" | "reserved" | "sold"
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
      app_role: ["super_admin", "inventory_manager"],
      inquiry_status: ["new", "contacted", "closed"],
      publish_state: ["draft", "published", "archived"],
      reservation_status: ["pending", "confirmed", "cancelled", "completed"],
      vehicle_status: ["available", "reserved", "sold"],
    },
  },
} as const
