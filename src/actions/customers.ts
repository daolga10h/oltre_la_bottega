"use server"

import { createClient } from "@/lib/supabase/server"
import { buildSearchOrClause } from "@/lib/search"

export type CustomerOrder = {
  id: string
  nome: string
  cognome: string | null
  azienda: string | null
  telefono: string | null
  email_cliente: string | null
  cosa_ordinato: string
  status: string
  data_ordine: string | null
  data_consegna: string | null
  data_consegnato: string | null
  prezzo: number
  acconto: number
  saldo: number
}

export type CustomerSummary = {
  nome: string
  cognome: string | null
  azienda: string | null
  telefono: string | null
  email: string | null
  consenso_marketing: boolean
  totale_ordini: number
  ultimo_ordine: string | null
}

export async function getCustomers(search?: string): Promise<CustomerSummary[]> {
  const supabase = await createClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let query = (supabase as any)
    .from("orders")
    .select("nome, cognome, azienda, telefono, email_cliente, consenso_marketing, data_ordine")
    .order("data_ordine", { ascending: false })

  if (search) {
    query = query.or(buildSearchOrClause(search, ["nome", "cognome", "telefono", "azienda"]))
  }

  const { data, error } = await query
  if (error) throw error

  const map = new Map<string, {
    nome: string; cognome: string | null; azienda: string | null; telefono: string | null
    email: string | null; consenso: boolean; count: number; lastDate: string | null
  }>()

  for (const o of data ?? []) {
    const key = o.telefono?.trim() || `${o.nome}|${o.cognome ?? ""}`
    if (!map.has(key)) {
      map.set(key, {
        nome: o.nome, cognome: o.cognome, azienda: o.azienda, telefono: o.telefono,
        email: o.email_cliente, consenso: false, count: 0, lastDate: null,
      })
    }
    const c = map.get(key)!
    c.count++
    if (!c.lastDate || (o.data_ordine && o.data_ordine > c.lastDate)) c.lastDate = o.data_ordine
    if (o.consenso_marketing) c.consenso = true
  }

  return Array.from(map.values())
    .sort((a, b) => (b.lastDate ?? "").localeCompare(a.lastDate ?? ""))
    .map((c) => ({
      nome: c.nome,
      cognome: c.cognome,
      azienda: c.azienda,
      telefono: c.telefono,
      email: c.email,
      consenso_marketing: c.consenso,
      totale_ordini: c.count,
      ultimo_ordine: c.lastDate,
    }))
}

export async function getOrdersByCustomer(nome: string, telefono?: string | null): Promise<CustomerOrder[]> {
  const supabase = await createClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let query = (supabase as any)
    .from("orders")
    .select("id, nome, cognome, telefono, email_cliente, cosa_ordinato, status, data_ordine, data_consegna, data_consegnato, prezzo, acconto, saldo")
    .order("data_ordine", { ascending: false })

  if (telefono) {
    query = query.eq("telefono", telefono)
  } else {
    query = query.ilike("nome", `%${nome.split(" ")[0]}%`)
  }

  const { data, error } = await query
  if (error) throw error
  return (data ?? []) as CustomerOrder[]
}
