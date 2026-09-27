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
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
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
      admin_audit_log: {
        Row: {
          action: string
          actor: string | null
          after: Json | null
          at: string
          before: Json | null
          id: number
          record_id: string | null
          table_name: string
        }
        Insert: {
          action: string
          actor?: string | null
          after?: Json | null
          at?: string
          before?: Json | null
          id?: never
          record_id?: string | null
          table_name: string
        }
        Update: {
          action?: string
          actor?: string | null
          after?: Json | null
          at?: string
          before?: Json | null
          id?: never
          record_id?: string | null
          table_name?: string
        }
        Relationships: []
      }
      ban_list_entries: {
        Row: {
          card_code: string
          created_at: string
          effective_from: string
          id: number
          kind: string
          max_copies: number | null
          pair_code: string | null
          source: string | null
          updated_at: string
        }
        Insert: {
          card_code: string
          created_at?: string
          effective_from: string
          id?: never
          kind: string
          max_copies?: number | null
          pair_code?: string | null
          source?: string | null
          updated_at?: string
        }
        Update: {
          card_code?: string
          created_at?: string
          effective_from?: string
          id?: never
          kind?: string
          max_copies?: number | null
          pair_code?: string | null
          source?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      card_explanations: {
        Row: {
          body: string
          card_code: string
          created_at: string
          updated_at: string
        }
        Insert: {
          body?: string
          card_code: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          body?: string
          card_code?: string
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      card_faqs: {
        Row: {
          card_code: string
          created_at: string
          items: Json
          updated_at: string
        }
        Insert: {
          card_code: string
          created_at?: string
          items?: Json
          updated_at?: string
        }
        Update: {
          card_code?: string
          created_at?: string
          items?: Json
          updated_at?: string
        }
        Relationships: []
      }
      cardmarket_products: {
        Row: {
          card_code: string
          created_at: string
          id_expansion: number
          id_product: number
          low: number | null
          name: string
          trend: number | null
          updated_at: string
        }
        Insert: {
          card_code: string
          created_at?: string
          id_expansion: number
          id_product: number
          low?: number | null
          name: string
          trend?: number | null
          updated_at?: string
        }
        Update: {
          card_code?: string
          created_at?: string
          id_expansion?: number
          id_product?: number
          low?: number | null
          name?: string
          trend?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      cards: {
        Row: {
          attributes: string[]
          block: string | null
          card_code: string
          category: string
          colors: string[]
          cost: number | null
          counter: number | null
          created_at: string
          effect: string | null
          keywords: string[]
          life: number | null
          name: string
          power: number | null
          trigger: string | null
          types: string[]
          updated_at: string
        }
        Insert: {
          attributes?: string[]
          block?: string | null
          card_code: string
          category: string
          colors?: string[]
          cost?: number | null
          counter?: number | null
          created_at?: string
          effect?: string | null
          keywords?: string[]
          life?: number | null
          name: string
          power?: number | null
          trigger?: string | null
          types?: string[]
          updated_at?: string
        }
        Update: {
          attributes?: string[]
          block?: string | null
          card_code?: string
          category?: string
          colors?: string[]
          cost?: number | null
          counter?: number | null
          created_at?: string
          effect?: string | null
          keywords?: string[]
          life?: number | null
          name?: string
          power?: number | null
          trigger?: string | null
          types?: string[]
          updated_at?: string
        }
        Relationships: []
      }
      collection_entries: {
        Row: {
          created_at: string
          language: string
          print_id: string
          quantity: number
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          language?: string
          print_id: string
          quantity: number
          updated_at?: string
          user_id?: string
        }
        Update: {
          created_at?: string
          language?: string
          print_id?: string
          quantity?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "collection_entries_print_id_fkey"
            columns: ["print_id"]
            isOneToOne: false
            referencedRelation: "printings"
            referencedColumns: ["print_id"]
          },
        ]
      }
      deck_cards: {
        Row: {
          card_code: string
          deck_id: string
          print_id: string | null
          quantity: number
        }
        Insert: {
          card_code: string
          deck_id: string
          print_id?: string | null
          quantity: number
        }
        Update: {
          card_code?: string
          deck_id?: string
          print_id?: string | null
          quantity?: number
        }
        Relationships: [
          {
            foreignKeyName: "deck_cards_card_code_fkey"
            columns: ["card_code"]
            isOneToOne: false
            referencedRelation: "cards"
            referencedColumns: ["card_code"]
          },
          {
            foreignKeyName: "deck_cards_deck_id_fkey"
            columns: ["deck_id"]
            isOneToOne: false
            referencedRelation: "decks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deck_cards_print_id_fkey"
            columns: ["print_id"]
            isOneToOne: false
            referencedRelation: "printings"
            referencedColumns: ["print_id"]
          },
        ]
      }
      decks: {
        Row: {
          created_at: string
          format: string
          id: string
          leader_code: string
          leader_print_id: string | null
          name: string
          share_token: string | null
          updated_at: string
          user_id: string
          visibility: string
        }
        Insert: {
          created_at?: string
          format?: string
          id?: string
          leader_code: string
          leader_print_id?: string | null
          name: string
          share_token?: string | null
          updated_at?: string
          user_id?: string
          visibility?: string
        }
        Update: {
          created_at?: string
          format?: string
          id?: string
          leader_code?: string
          leader_print_id?: string | null
          name?: string
          share_token?: string | null
          updated_at?: string
          user_id?: string
          visibility?: string
        }
        Relationships: [
          {
            foreignKeyName: "decks_leader_code_fkey"
            columns: ["leader_code"]
            isOneToOne: false
            referencedRelation: "cards"
            referencedColumns: ["card_code"]
          },
          {
            foreignKeyName: "decks_leader_print_id_fkey"
            columns: ["leader_print_id"]
            isOneToOne: false
            referencedRelation: "printings"
            referencedColumns: ["print_id"]
          },
        ]
      }
      explanation_reports: {
        Row: {
          card_code: string
          created_at: string
          id: number
          kind: string
          note: string | null
          reason: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          card_code: string
          created_at?: string
          id?: never
          kind: string
          note?: string | null
          reason?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Update: {
          card_code?: string
          created_at?: string
          id?: never
          kind?: string
          note?: string | null
          reason?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      job_runs: {
        Row: {
          error: string | null
          finished_at: string | null
          id: number
          job: string
          started_at: string
          stats: Json
          status: string
        }
        Insert: {
          error?: string | null
          finished_at?: string | null
          id?: never
          job: string
          started_at?: string
          stats?: Json
          status?: string
        }
        Update: {
          error?: string | null
          finished_at?: string | null
          id?: never
          job?: string
          started_at?: string
          stats?: Json
          status?: string
        }
        Relationships: []
      }
      mapping_overrides: {
        Row: {
          created_at: string
          marketplace: string
          note: string | null
          print_id: string
          product_id: number | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          marketplace: string
          note?: string | null
          print_id: string
          product_id?: number | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          marketplace?: string
          note?: string | null
          print_id?: string
          product_id?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "mapping_overrides_print_id_fkey"
            columns: ["print_id"]
            isOneToOne: false
            referencedRelation: "printings"
            referencedColumns: ["print_id"]
          },
        ]
      }
      price_mappings: {
        Row: {
          confidence: string
          marketplace: string
          print_id: string
          product_id: number
          source: string
          updated_at: string
        }
        Insert: {
          confidence: string
          marketplace: string
          print_id: string
          product_id: number
          source: string
          updated_at?: string
        }
        Update: {
          confidence?: string
          marketplace?: string
          print_id?: string
          product_id?: number
          source?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "price_mappings_print_id_fkey"
            columns: ["print_id"]
            isOneToOne: false
            referencedRelation: "printings"
            referencedColumns: ["print_id"]
          },
        ]
      }
      price_snapshots: {
        Row: {
          day: string
          low: number | null
          marketplace: string
          print_id: string
          trend: number | null
        }
        Insert: {
          day: string
          low?: number | null
          marketplace: string
          print_id: string
          trend?: number | null
        }
        Update: {
          day?: string
          low?: number | null
          marketplace?: string
          print_id?: string
          trend?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "price_snapshots_print_id_fkey"
            columns: ["print_id"]
            isOneToOne: false
            referencedRelation: "printings"
            referencedColumns: ["print_id"]
          },
        ]
      }
      printing_prices: {
        Row: {
          low: number | null
          marketplace: string
          price_date: string | null
          print_id: string
          product_id: number | null
          trend: number | null
          updated_at: string
        }
        Insert: {
          low?: number | null
          marketplace: string
          price_date?: string | null
          print_id: string
          product_id?: number | null
          trend?: number | null
          updated_at?: string
        }
        Update: {
          low?: number | null
          marketplace?: string
          price_date?: string | null
          print_id?: string
          product_id?: number | null
          trend?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "printing_prices_print_id_fkey"
            columns: ["print_id"]
            isOneToOne: false
            referencedRelation: "printings"
            referencedColumns: ["print_id"]
          },
        ]
      }
      printings: {
        Row: {
          card_code: string
          created_at: string
          image_synced_at: string | null
          print_id: string
          rarity: string
          series_id: number
          updated_at: string
        }
        Insert: {
          card_code: string
          created_at?: string
          image_synced_at?: string | null
          print_id: string
          rarity: string
          series_id: number
          updated_at?: string
        }
        Update: {
          card_code?: string
          created_at?: string
          image_synced_at?: string | null
          print_id?: string
          rarity?: string
          series_id?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "printings_card_code_fkey"
            columns: ["card_code"]
            isOneToOne: false
            referencedRelation: "cards"
            referencedColumns: ["card_code"]
          },
          {
            foreignKeyName: "printings_series_id_fkey"
            columns: ["series_id"]
            isOneToOne: false
            referencedRelation: "sets"
            referencedColumns: ["series_id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          id: string
          updated_at: string
          username: string
        }
        Insert: {
          created_at?: string
          id: string
          updated_at?: string
          username: string
        }
        Update: {
          created_at?: string
          id?: string
          updated_at?: string
          username?: string
        }
        Relationships: []
      }
      set_recipes: {
        Row: {
          cards: Json
          created_at: string
          set_code: string
          source: string
          updated_at: string
        }
        Insert: {
          cards: Json
          created_at?: string
          set_code: string
          source: string
          updated_at?: string
        }
        Update: {
          cards?: Json
          created_at?: string
          set_code?: string
          source?: string
          updated_at?: string
        }
        Relationships: []
      }
      sets: {
        Row: {
          code: string
          created_at: string
          name: string
          product_type: string | null
          series_id: number
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          name: string
          product_type?: string | null
          series_id: number
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          name?: string
          product_type?: string | null
          series_id?: number
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      aggiungi_copie: { Args: { p_righe: Json }; Returns: number }
      cambia_carte_mazzo: {
        Args: { p_card_code: string; p_deck_id: string; p_delta: number }
        Returns: number
      }
      cambia_copie: {
        Args: { p_delta: number; p_language: string; p_print_id: string }
        Returns: number
      }
      crea_link_mazzo: { Args: { p_deck_id: string }; Returns: string }
      duplica_mazzo: { Args: { p_deck_id: string }; Returns: string }
      elimina_account: {
        Args: { conferma_username: string }
        Returns: undefined
      }
      mazzo_condiviso: { Args: { p_token: string }; Returns: Json }
      revoca_link_mazzo: { Args: { p_deck_id: string }; Returns: undefined }
      stato_admin: { Args: never; Returns: string }
    }
    Enums: {
      [_ in never]: never
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
} as const

