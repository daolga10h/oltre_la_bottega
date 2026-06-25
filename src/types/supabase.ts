export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      customers: {
        Row: {
          id: string
          name: string
          phone: string | null
          email: string | null
          tags: string[]
          notes: string | null
          created_at: string
        }
        Insert: {
          id?: string
          name: string
          phone?: string | null
          email?: string | null
          tags?: string[]
          notes?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          name?: string
          phone?: string | null
          email?: string | null
          tags?: string[]
          notes?: string | null
          created_at?: string
        }
        Relationships: []
      }
      orders: {
        Row: {
          id: string
          customer_id: string | null
          title: string
          description: string | null
          status: Database["public"]["Enums"]["order_status"]
          priority: Database["public"]["Enums"]["order_priority"]
          due_date: string | null
          amount_estimated: number | null
          payment_status: Database["public"]["Enums"]["payment_status"]
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          customer_id?: string | null
          title: string
          description?: string | null
          status?: Database["public"]["Enums"]["order_status"]
          priority?: Database["public"]["Enums"]["order_priority"]
          due_date?: string | null
          amount_estimated?: number | null
          payment_status?: Database["public"]["Enums"]["payment_status"]
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          customer_id?: string | null
          title?: string
          description?: string | null
          status?: Database["public"]["Enums"]["order_status"]
          priority?: Database["public"]["Enums"]["order_priority"]
          due_date?: string | null
          amount_estimated?: number | null
          payment_status?: Database["public"]["Enums"]["payment_status"]
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "orders_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          }
        ]
      }
      order_events: {
        Row: {
          id: string
          order_id: string
          event_type: string
          note: string | null
          created_at: string
        }
        Insert: {
          id?: string
          order_id: string
          event_type: string
          note?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          order_id?: string
          event_type?: string
          note?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "order_events_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          }
        ]
      }
      reminders: {
        Row: {
          id: string
          order_id: string | null
          customer_id: string | null
          title: string
          due_at: string
          status: Database["public"]["Enums"]["reminder_status"]
          created_at: string
        }
        Insert: {
          id?: string
          order_id?: string | null
          customer_id?: string | null
          title: string
          due_at: string
          status?: Database["public"]["Enums"]["reminder_status"]
          created_at?: string
        }
        Update: {
          id?: string
          order_id?: string | null
          customer_id?: string | null
          title?: string
          due_at?: string
          status?: Database["public"]["Enums"]["reminder_status"]
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "reminders_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reminders_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          }
        ]
      }
      inventory_items: {
        Row: {
          id: string
          name: string
          unit: string | null
          quantity_available: number
          reorder_threshold: number | null
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          unit?: string | null
          quantity_available?: number
          reorder_threshold?: number | null
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          unit?: string | null
          quantity_available?: number
          reorder_threshold?: number | null
          updated_at?: string
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
      order_status: "nuovo" | "in_lavorazione" | "pronto" | "consegnato" | "annullato"
      order_priority: "normale" | "alta" | "urgente"
      payment_status: "non_pagato" | "acconto" | "saldato"
      reminder_status: "attivo" | "completato" | "saltato"
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
