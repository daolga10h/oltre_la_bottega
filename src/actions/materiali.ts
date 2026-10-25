"use server"

import { randomUUID } from "node:crypto"
import { revalidatePath } from "next/cache"
import { createClient } from "@/lib/supabase/server"
import { logError } from "@/lib/logger"
import { USER_MESSAGES } from "@/lib/errors"
import {
  applyPriceUpdate,
  canonicalSupplier,
  computeStock,
  isValidIsoDate,
  matchMaterial,
  rettificaPerGiacenza,
  round3,
  todayIso,
  type Materiale,
} from "@/lib/materiali"

// NOTE: in un file "use server" si possono esportare solo funzioni async: i tipi
// usati dai componenti (Materiale, RigaDocumento) si importano da @/lib/materiali.

type RigaDaSalvare = {
  codice: string | null
  nome: string
  unita: string | null
  prezzo: number
  carica?: number | null // quantità da sommare alla giacenza (se il materiale è contato)
}

type SalvataggioResult =
  | { ok: true; nuovi: number; aggiornati: number; quantitaSaltate?: true }
  | { ok: false; error: string }

type EsitoSemplice = { ok: true } | { ok: false; error: string }

const COLUMNS =
  "id, fornitore, codice, nome, unita, prezzo_attuale, data_acquisto_attuale, prezzo_precedente, data_acquisto_precedente, in_magazzino, carico_totale, rettifica, soglia, ordinato_il"
const VIOLAZIONE_UNICITA = "23505"

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
    in_magazzino: Boolean(row.in_magazzino),
    carico_totale: Number(row.carico_totale ?? 0),
    rettifica: Number(row.rettifica ?? 0),
    soglia: row.soglia === null || row.soglia === undefined ? null : Number(row.soglia),
    ordinato_il: row.ordinato_il ?? null,
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
    in_magazzino: m.in_magazzino,
    carico_totale: m.carico_totale,
    rettifica: m.rettifica,
    soglia: m.soglia,
    ordinato_il: m.ordinato_il,
  }
}

function uguali(a: Materiale, b: Materiale): boolean {
  return (
    a.codice === b.codice &&
    a.unita === b.unita &&
    a.prezzo_attuale === b.prezzo_attuale &&
    a.data_acquisto_attuale === b.data_acquisto_attuale &&
    a.prezzo_precedente === b.prezzo_precedente &&
    a.data_acquisto_precedente === b.data_acquisto_precedente &&
    a.in_magazzino === b.in_magazzino &&
    a.carico_totale === b.carico_totale &&
    a.ordinato_il === b.ordinato_il
  )
}

/**
 * Salva le righe confermate di un documento.
 *
 * Si contano i pezzi di tutti i materiali; chi è escluso (`in_magazzino` falso) non viene toccato dalle quantità.
 * Quantità in magazzino: si sommano per le righe con `carica` > 0. Se ci sono
 * `impronte` (sempre, anche senza quantità) si registrano PRIMA di scrivere i materiali (il vincolo di unicità la rende atomica): se esiste
 * già il documento è stato caricato e le quantità si saltano, salvo `caricaComunque`. Se poi la scrittura dei
 * materiali fallisce le impronte si tolgono, così un nuovo tentativo parte pulito. I prezzi restano idempotenti.
 * I materiali (nuovi e aggiornati) si scrivono con un solo `upsert`: o tutto o niente. Il materiale escluso resta escluso
 * (si cambia dal modulo di modifica).
 */
export async function saveMaterials(input: {
  fornitore: string
  data: string
  righe: RigaDaSalvare[]
  impronte?: string[]
  caricaComunque?: boolean
}): Promise<SalvataggioResult> {
  const fornitoreLetto = input.fornitore.trim()
  const valido =
    fornitoreLetto !== "" &&
    isValidIsoDate(input.data) &&
    input.righe.length > 0 &&
    input.righe.every(
      (r) =>
        r.nome.trim() !== "" &&
        Number.isFinite(r.prezzo) &&
        r.prezzo >= 0 &&
        (r.carica === undefined || r.carica === null || (Number.isFinite(r.carica) && r.carica >= 0))
    )
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

  // Il fornitore può essere scritto in modo diverso sul documento: si usa il nome già in elenco.
  const fornitore = canonicalSupplier(fornitoreLetto, [...new Set(esistenti.map((m) => m.fornitore))])

  const daSommare = input.righe.some((r) => (r.carica ?? 0) > 0)
  let sommaQuantita = daSommare
  let improntaRegistrata = false
  const impronte = input.impronte ?? []
  if (impronte.length > 0) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any).from("documenti_caricati").insert(impronte.map((impronta) => ({ impronta })))
    if (!error) {
      improntaRegistrata = true
    } else if (error.code === VIOLAZIONE_UNICITA) {
      if (!input.caricaComunque) sommaQuantita = false
    } else {
      logError("saveMaterials.impronta", error)
      return { ok: false, error: USER_MESSAGES.saveFailed }
    }
  }
  const quantitaSaltate = daSommare && !sommaQuantita

  async function annullaImpronta() {
    if (!improntaRegistrata) return
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any).from("documenti_caricati").delete().in("impronta", impronte)
  }

  const lavoro = new Map<string, Materiale>(esistenti.map((m) => [m.id, m]))
  const toccati = new Set<string>()
  const nuoviId = new Set<string>()

  for (const r of input.righe) {
    const pulita = { codice: pulisci(r.codice), nome: r.nome.trim(), unita: pulisci(r.unita), prezzo: r.prezzo }
    const richiesta = sommaQuantita ? Math.max(r.carica ?? 0, 0) : 0
    const trovato = matchMaterial([...lavoro.values()], fornitore, pulita)

    if (trovato) {
      const aggiungi = trovato.in_magazzino ? richiesta : 0
      const aggiornato: Materiale = {
        ...trovato,
        ...applyPriceUpdate(trovato, { prezzo: pulita.prezzo, data: input.data }),
        codice: trovato.codice ?? pulita.codice,
        unita: trovato.unita ?? pulita.unita,
        in_magazzino: trovato.in_magazzino,
        carico_totale: round3(trovato.carico_totale + aggiungi),
        ordinato_il: aggiungi > 0 ? null : trovato.ordinato_il,
      }
      if (!uguali(aggiornato, trovato)) {
        lavoro.set(trovato.id, aggiornato)
        toccati.add(trovato.id)
      }
    } else {
      const id = randomUUID()
      nuoviId.add(id)
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
        in_magazzino: true,
        carico_totale: round3(richiesta),
        rettifica: 0,
        soglia: null,
        ordinato_il: null,
      })
      toccati.add(id)
    }
  }

  const daScrivere = [...toccati].map((id) => ({ id, ...campi(lavoro.get(id)!) }))
  if (daScrivere.length > 0) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any).from("materiali").upsert(daScrivere)
    if (error) {
      logError("saveMaterials.upsert", error)
      await annullaImpronta()
      return { ok: false, error: USER_MESSAGES.saveFailed }
    }
  }
  const nuovi = daScrivere.filter((m) => nuoviId.has(m.id)).length

  revalidatePath("/materiali")
  return {
    ok: true,
    nuovi,
    aggiornati: daScrivere.length - nuovi,
    ...(quantitaSaltate ? { quantitaSaltate: true as const } : {}),
  }
}

/** Correzione diretta dei campi di un materiale (non registra un acquisto: nessuna logica di storico). */
export async function updateMaterial(
  id: string,
  dati: {
    nome: string
    unita: string | null
    prezzo_attuale: number
    prezzo_precedente: number | null
    in_magazzino?: boolean
    soglia?: number | null // scorta minima; null = nessuna
  }
): Promise<EsitoSemplice> {
  const nome = dati.nome.trim()
  const valido =
    nome !== "" &&
    Number.isFinite(dati.prezzo_attuale) &&
    dati.prezzo_attuale >= 0 &&
    (dati.prezzo_precedente === null || (Number.isFinite(dati.prezzo_precedente) && dati.prezzo_precedente >= 0)) &&
    (dati.soglia === undefined || dati.soglia === null || (Number.isFinite(dati.soglia) && dati.soglia >= 0))
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
      ...(dati.in_magazzino !== undefined ? { in_magazzino: dati.in_magazzino } : {}),
      ...(dati.soglia !== undefined ? { soglia: dati.soglia } : {}),
    })
    .eq("id", id)
  if (error) {
    logError("updateMaterial", error, { id })
    return { ok: false, error: USER_MESSAGES.saveFailed }
  }
  revalidatePath("/materiali")
  revalidatePath("/dashboard")
  return { ok: true }
}

/**
 * «Correggi giacenza»: si scrive quanti pezzi ci sono davvero e l'app calcola la rettifica.
 * Il venduto vale 0 finché gli ordini non sono collegati ai materiali (Lavoro 2: andrà passato qui).
 */
export async function setStock(id: string, reale: number): Promise<EsitoSemplice> {
  if (!Number.isFinite(reale) || reale < 0) return { ok: false, error: USER_MESSAGES.validationError }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: USER_MESSAGES.authRequired }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error: readError } = await (supabase as any).from("materiali").select("carico_totale, rettifica").eq("id", id).single()
  if (readError || !data) {
    logError("setStock.read", readError ?? new Error("materiale non trovato"), { id })
    return { ok: false, error: USER_MESSAGES.saveFailed }
  }

  const carico_totale = Number(data.carico_totale)
  const rettifica = rettificaPerGiacenza(reale, { carico_totale })
  // Se la giacenza corretta supera quella calcolata la merce è arrivata: «Ho già ordinato» non serve più.
  const arrivata = reale > computeStock({ carico_totale, rettifica: Number(data.rettifica ?? 0) })
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any)
    .from("materiali")
    .update(arrivata ? { rettifica, ordinato_il: null } : { rettifica })
    .eq("id", id)
  if (error) {
    logError("setStock.update", error, { id })
    return { ok: false, error: USER_MESSAGES.saveFailed }
  }
  revalidatePath("/materiali")
  revalidatePath("/dashboard")
  return { ok: true }
}

/** «Ho già ordinato»: segna la data di oggi; per 7 giorni l'avviso «Da riordinare» è sospeso. */
export async function markOrdered(id: string): Promise<EsitoSemplice> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: USER_MESSAGES.authRequired }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any).from("materiali").update({ ordinato_il: todayIso() }).eq("id", id)
  if (error) {
    logError("markOrdered", error, { id })
    return { ok: false, error: USER_MESSAGES.saveFailed }
  }
  revalidatePath("/materiali")
  revalidatePath("/dashboard")
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
  revalidatePath("/dashboard")
  return { ok: true }
}
