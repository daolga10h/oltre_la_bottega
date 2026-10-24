"use server"

import { revalidatePath } from "next/cache"
import { createClient } from "@/lib/supabase/server"
import { logError } from "@/lib/logger"
import { USER_MESSAGES } from "@/lib/errors"
import { applyPriceUpdate, isValidIsoDate, matchMaterial, type Materiale } from "@/lib/materiali"

// NOTE: in un file "use server" si possono esportare solo funzioni async: i tipi
// usati dai componenti (Materiale, RigaDocumento) si importano da @/lib/materiali.

type RigaDaSalvare = {
  codice: string | null
  nome: string
  unita: string | null
  prezzo: number
}

type SalvataggioResult =
  | { ok: true; nuovi: number; aggiornati: number }
  | { ok: false; error: string }

type EsitoSemplice = { ok: true } | { ok: false; error: string }

const COLUMNS =
  "id, fornitore, codice, nome, unita, prezzo_attuale, data_acquisto_attuale, prezzo_precedente, data_acquisto_precedente"
const NUOVO_PREFIX = "nuovo-"

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toMateriale(row: any): Materiale {
  return {
    id: row.id,
    fornitore: row.fornitore,
    codice: row.codice ?? null,
    nome: row.nome,
    unita: row.unita ?? null,
    prezzo_attuale: Number(row.prezzo_attuale),
    data_acquisto_attuale: row.data_acquisto_attuale,
    prezzo_precedente: row.prezzo_precedente === null || row.prezzo_precedente === undefined ? null : Number(row.prezzo_precedente),
    data_acquisto_precedente: row.data_acquisto_precedente ?? null,
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function loadAll(supabase: any): Promise<Materiale[]> {
  const { data, error } = await supabase
    .from("materiali")
    .select(COLUMNS)
    .order("fornitore", { ascending: true })
    .order("nome", { ascending: true })
  if (error) throw error
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (data ?? []).map((r: any) => toMateriale(r))
}

export async function getMaterials(): Promise<Materiale[]> {
  const supabase = await createClient()
  try {
    return await loadAll(supabase)
  } catch (error) {
    logError("getMaterials", error)
    throw new Error(USER_MESSAGES.generic)
  }
}

function pulisci(value: string | null): string | null {
  const t = value?.trim() ?? ""
  return t === "" ? null : t
}

function campi(m: Materiale) {
  return {
    fornitore: m.fornitore,
    codice: m.codice,
    nome: m.nome,
    unita: m.unita,
    prezzo_attuale: m.prezzo_attuale,
    data_acquisto_attuale: m.data_acquisto_attuale,
    prezzo_precedente: m.prezzo_precedente,
    data_acquisto_precedente: m.data_acquisto_precedente,
  }
}

function uguali(a: Materiale, b: Materiale): boolean {
  return (
    a.codice === b.codice &&
    a.unita === b.unita &&
    a.prezzo_attuale === b.prezzo_attuale &&
    a.data_acquisto_attuale === b.data_acquisto_attuale &&
    a.prezzo_precedente === b.prezzo_precedente &&
    a.data_acquisto_precedente === b.data_acquisto_precedente
  )
}

/**
 * Salva le righe confermate di un documento. Non è una transazione (due chiamate:
 * inserimenti e aggiornamenti), ma è idempotente: rilanciare lo stesso salvataggio
 * dopo un errore dà "invariato" per ciò che è già scritto e completa il resto.
 */
export async function saveMaterials(input: {
  fornitore: string
  data: string
  righe: RigaDaSalvare[]
}): Promise<SalvataggioResult> {
  const fornitore = input.fornitore.trim()
  const valido =
    fornitore !== "" &&
    isValidIsoDate(input.data) &&
    input.righe.length > 0 &&
    input.righe.every((r) => r.nome.trim() !== "" && Number.isFinite(r.prezzo) && r.prezzo >= 0)
  if (!valido) return { ok: false, error: USER_MESSAGES.validationError }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: USER_MESSAGES.authRequired }

  let esistenti: Materiale[]
  try {
    esistenti = await loadAll(supabase)
  } catch (error) {
    logError("saveMaterials", error)
    return { ok: false, error: USER_MESSAGES.saveFailed }
  }

  const lavoro = new Map<string, Materiale>(esistenti.map((m) => [m.id, m]))
  const toccati = new Set<string>()
  let contatore = 0

  for (const r of input.righe) {
    const pulita = { codice: pulisci(r.codice), nome: r.nome.trim(), unita: pulisci(r.unita), prezzo: r.prezzo }
    const trovato = matchMaterial([...lavoro.values()], fornitore, pulita)

    if (trovato) {
      const aggiornato: Materiale = {
        ...trovato,
        ...applyPriceUpdate(trovato, { prezzo: pulita.prezzo, data: input.data }),
        codice: trovato.codice ?? pulita.codice,
        unita: trovato.unita ?? pulita.unita,
      }
      if (!uguali(aggiornato, trovato)) {
        lavoro.set(trovato.id, aggiornato)
        toccati.add(trovato.id)
      }
    } else {
      contatore++
      const id = `${NUOVO_PREFIX}${contatore}`
      lavoro.set(id, {
        id,
        fornitore,
        codice: pulita.codice,
        nome: pulita.nome,
        unita: pulita.unita,
        prezzo_attuale: pulita.prezzo,
        data_acquisto_attuale: input.data,
        prezzo_precedente: null,
        data_acquisto_precedente: null,
      })
      toccati.add(id)
    }
  }

  const daInserire: ReturnType<typeof campi>[] = []
  const daAggiornare: Array<{ id: string } & ReturnType<typeof campi>> = []
  for (const id of toccati) {
    const m = lavoro.get(id)!
    if (id.startsWith(NUOVO_PREFIX)) daInserire.push(campi(m))
    else daAggiornare.push({ id: m.id, ...campi(m) })
  }

  if (daInserire.length > 0) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any).from("materiali").insert(daInserire)
    if (error) {
      logError("saveMaterials.insert", error)
      return { ok: false, error: USER_MESSAGES.saveFailed }
    }
  }
  if (daAggiornare.length > 0) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any).from("materiali").upsert(daAggiornare)
    if (error) {
      logError("saveMaterials.upsert", error)
      return { ok: false, error: USER_MESSAGES.saveFailed }
    }
  }

  revalidatePath("/materiali")
  return { ok: true, nuovi: daInserire.length, aggiornati: daAggiornare.length }
}

/** Correzione diretta dei campi di un materiale (non registra un acquisto: nessuna logica di storico). */
export async function updateMaterial(
  id: string,
  dati: { nome: string; unita: string | null; prezzo_attuale: number; prezzo_precedente: number | null }
): Promise<EsitoSemplice> {
  const nome = dati.nome.trim()
  const valido =
    nome !== "" &&
    Number.isFinite(dati.prezzo_attuale) &&
    dati.prezzo_attuale >= 0 &&
    (dati.prezzo_precedente === null || (Number.isFinite(dati.prezzo_precedente) && dati.prezzo_precedente >= 0))
  if (!valido) return { ok: false, error: USER_MESSAGES.validationError }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: USER_MESSAGES.authRequired }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any)
    .from("materiali")
    .update({
      nome,
      unita: pulisci(dati.unita),
      prezzo_attuale: dati.prezzo_attuale,
      prezzo_precedente: dati.prezzo_precedente,
      ...(dati.prezzo_precedente === null ? { data_acquisto_precedente: null } : {}),
    })
    .eq("id", id)
  if (error) {
    logError("updateMaterial", error, { id })
    return { ok: false, error: USER_MESSAGES.saveFailed }
  }
  revalidatePath("/materiali")
  return { ok: true }
}

export async function deleteMaterial(id: string): Promise<EsitoSemplice> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: USER_MESSAGES.authRequired }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any).from("materiali").delete().eq("id", id)
  if (error) {
    logError("deleteMaterial", error, { id })
    return { ok: false, error: USER_MESSAGES.saveFailed }
  }
  revalidatePath("/materiali")
  return { ok: true }
}
