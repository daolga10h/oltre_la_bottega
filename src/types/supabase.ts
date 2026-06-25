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
      }
      inventory_items: {
        Row: {
          id: string
          name: string
          unit: string
          quantity_available: number
          reorder_threshold: number
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          unit?: string
          quantity_available?: number
          reorder_threshold?: number
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          unit?: string
          quantity_available?: number
          reorder_threshold?: number
          updated_at?: string
        }
      }
    }
    Views: Record<string, never>
    Functions: Record<string, never>
    Enums: {
      order_status: "nuovo" | "in_lavorazione" | "pronto" | "consegnato" | "annullato"
      order_priority: "normale" | "alta" | "urgente"
      payment_status: "non_pagato" | "acconto" | "saldato"
      reminder_status: "attivo" | "completato" | "saltato"
    }
  }
}
