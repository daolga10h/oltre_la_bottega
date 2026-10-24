export type Materiale = {
  id: string
  fornitore: string
  codice: string | null
  nome: string
  unita: string | null
  prezzo_attuale: number
  data_acquisto_attuale: string // AAAA-MM-GG
  prezzo_precedente: number | null
  data_acquisto_precedente: string | null
}

export type PrezziMateriale = Pick<
  Materiale,
  "prezzo_attuale" | "data_acquisto_attuale" | "prezzo_precedente" | "data_acquisto_precedente"
>

/** Una riga letta da un documento del fornitore (o scritta a mano). */
export type RigaDocumento = {
  codice: string | null
  nome: string
  unita: string | null
  quantita: number | null
  prezzo: number
  importo: number | null
}

export type StatoRiga =
  | { tipo: "nuovo" }
  | { tipo: "invariato" }
  | { tipo: "variato"; era: number }

const EPSILON_PREZZO = 0.0005

export function normalizeText(value: string | null | undefined): string {
  return (value ?? "").trim().replace(/\s+/g, " ").toLowerCase()
}

/**
 * Trova il materiale già salvato a cui corrisponde una riga: stesso fornitore e
 * stesso codice. Se la riga ha un codice ma nessun materiale lo ha, si prova per
 * nome tra quelli senza codice (inseriti a mano). Se la riga non ha codice, si
 * abbina per nome.
 */
export function matchMaterial(
  esistenti: Materiale[],
  fornitore: string,
  riga: Pick<RigaDocumento, "codice" | "nome">
): Materiale | null {
  const f = normalizeText(fornitore)
  const candidati = esistenti.filter((m) => normalizeText(m.fornitore) === f)
  const codice = normalizeText(riga.codice)
  const nome = normalizeText(riga.nome)
  if (codice) {
    return (
      candidati.find((m) => normalizeText(m.codice) === codice) ??
      candidati.find((m) => !normalizeText(m.codice) && normalizeText(m.nome) === nome) ??
      null
    )
  }
  return candidati.find((m) => normalizeText(m.nome) === nome) ?? null
}

function stessoPrezzo(a: number, b: number): boolean {
  return Math.abs(a - b) < EPSILON_PREZZO
}

/**
 * Registra un nuovo acquisto sul materiale. L'attuale è sempre quello con la
 * data più recente: caricare una fattura vecchia dopo una nuova non sovrascrive
 * il prezzo attuale.
 */
export function applyPriceUpdate(
  m: PrezziMateriale,
  nuovo: { prezzo: number; data: string }
): PrezziMateriale {
  const { prezzo, data } = nuovo
  const uguale = stessoPrezzo(prezzo, m.prezzo_attuale)

  if (data >= m.data_acquisto_attuale) {
    if (uguale) return { ...pick(m), data_acquisto_attuale: data }
    return {
      prezzo_attuale: prezzo,
      data_acquisto_attuale: data,
      prezzo_precedente: m.prezzo_attuale,
      data_acquisto_precedente: m.data_acquisto_attuale,
    }
  }

  // Acquisto più vecchio di quello attuale: tocca al massimo il precedente.
  if (uguale) return pick(m)
  if (m.data_acquisto_precedente === null || data > m.data_acquisto_precedente) {
    return { ...pick(m), prezzo_precedente: prezzo, data_acquisto_precedente: data }
  }
  return pick(m)
}

function pick(m: PrezziMateriale): PrezziMateriale {
  return {
    prezzo_attuale: m.prezzo_attuale,
    data_acquisto_attuale: m.data_acquisto_attuale,
    prezzo_precedente: m.prezzo_precedente,
    data_acquisto_precedente: m.data_acquisto_precedente,
  }
}

/** true se quantità × prezzo coincide con l'importo (tolleranza 1 centesimo); true se manca un dato da confrontare. */
export function checkRow(riga: Pick<RigaDocumento, "quantita" | "prezzo" | "importo">): boolean {
  if (riga.quantita === null || riga.importo === null) return true
  return Math.abs(riga.quantita * riga.prezzo - riga.importo) <= 0.01 + 1e-9
}

/** Variazione percentuale tra precedente e attuale; null se non calcolabile. */
export function priceVariation(attuale: number, precedente: number | null): number | null {
  if (precedente === null || precedente === 0) return null
  return ((attuale - precedente) / precedente) * 100
}

export function classifyRow(
  esistenti: Materiale[],
  fornitore: string,
  riga: RigaDocumento
): StatoRiga {
  const m = matchMaterial(esistenti, fornitore, riga)
  if (!m) return { tipo: "nuovo" }
  if (stessoPrezzo(riga.prezzo, m.prezzo_attuale)) return { tipo: "invariato" }
  return { tipo: "variato", era: m.prezzo_attuale }
}

/** Legge un prezzo scritto da una persona ("14,380", "1.234,56", "€ 14.38"). null se non valido. */
export function parsePrice(value: string): number | null {
  let s = value.replace(/\s/g, "").replace("€", "")
  if (!s) return null
  if (s.includes(",")) s = s.replace(/\./g, "").replace(",", ".")
  const n = Number(s)
  return Number.isFinite(n) && n >= 0 ? n : null
}

/** Almeno 2 e al massimo 3 decimali, con la virgola: 14,38 · 14,375 · 5,00 */
export function formatPrezzo(value: number): string {
  return value.toFixed(3).replace(/0$/, "").replace(".", ",")
}

export function matchesSearch(m: Pick<Materiale, "fornitore" | "codice" | "nome">, query: string): boolean {
  const q = normalizeText(query)
  if (!q) return true
  return normalizeText(`${m.fornitore} ${m.codice ?? ""} ${m.nome}`).includes(q)
}

export function isValidIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const d = new Date(`${value}T00:00:00Z`)
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value
}

/** Oggi nel calendario di Roma, come AAAA-MM-GG. */
export function todayIso(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Rome" }).format(now)
}
