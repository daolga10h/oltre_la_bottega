export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  public: {
    Tables: {
      orders: {
        Row: {
          id: string
          nome: string
          cognome: string | null
          telefono: string | null
          email_cliente: string | null
          canale: string
          data_ordine: string | null
          data_consegna: string | null
          data_consegnato: string | null
          cosa_ordinato: string
          testo_da_scrivere: string | null
          tipo_lavorazione: string | null
          quantita: number
          bozza_grafica: string
          foto_oggetto: string | null
          file_cliente: string | null
          note: string | null
          status: string
          prezzo: number
          acconto: number
          saldo: number
          chiedere_recensione: boolean
          recensione_richiesta: boolean
          recensione_ricevuta: boolean
          msg_pronto_inviato: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          nome: string
          cognome?: string | null
          telefono?: string | null
          email_cliente?: string | null
          canale?: string
          data_ordine?: string | null
          data_consegna?: string | null
          data_consegnato?: string | null
          cosa_ordinato: string
          testo_da_scrivere?: string | null
          tipo_lavorazione?: string | null
          quantita?: number
          bozza_grafica?: string
          foto_oggetto?: string | null
          file_cliente?: string | null
          note?: string | null
          status?: string
          prezzo?: number
          acconto?: number
          saldo?: number
          chiedere_recensione?: boolean
          recensione_richiesta?: boolean
          recensione_ricevuta?: boolean
          msg_pronto_inviato?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          nome?: string
          cognome?: string | null
          telefono?: string | null
          email_cliente?: string | null
          canale?: string
          data_ordine?: string | null
          data_consegna?: string | null
          data_consegnato?: string | null
          cosa_ordinato?: string
          testo_da_scrivere?: string | null
          tipo_lavorazione?: string | null
          quantita?: number
          bozza_grafica?: string
          foto_oggetto?: string | null
          file_cliente?: string | null
          note?: string | null
          status?: string
          prezzo?: number
          acconto?: number
          saldo?: number
          chiedere_recensione?: boolean
          recensione_richiesta?: boolean
          recensione_ricevuta?: boolean
          msg_pronto_inviato?: boolean
          created_at?: string
          updated_at?: string
        }
      }
      order_events: {
        Row: { id: string; order_id: string; event_type: string; note: string | null; created_at: string }
        Insert: { id?: string; order_id: string; event_type: string; note?: string | null; created_at?: string }
        Update: { id?: string; order_id?: string; event_type?: string; note?: string | null; created_at?: string }
      }
      reminders: {
        Row: { id: string; order_id: string | null; title: string; due_at: string; status: string; created_at: string }
        Insert: { id?: string; order_id?: string | null; title: string; due_at: string; status?: string; created_at?: string }
        Update: { id?: string; order_id?: string | null; title?: string; due_at?: string; status?: string; created_at?: string }
      }
      inventory_items: {
        Row: { id: string; name: string; unit: string; quantity_available: number; reorder_threshold: number; updated_at: string }
        Insert: { id?: string; name: string; unit?: string; quantity_available?: number; reorder_threshold?: number; updated_at?: string }
        Update: { id?: string; name?: string; unit?: string; quantity_available?: number; reorder_threshold?: number; updated_at?: string }
      }
    }
    Views: Record<string, never>
    Functions: Record<string, never>
    Enums: Record<string, never>
  }
}
