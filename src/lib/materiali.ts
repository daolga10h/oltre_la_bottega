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

/**
 * Riga letta dal documento. Qui `prezzo` è il prezzo di LISTINO, prima degli sconti
 * a cascata (SC.1%, SC.2%…); il costo vero (`netPrice`) è quello che si salva.
 */
export type RigaLetta = RigaDocumento & { sconti: number[] }

export type StatoRiga =
  | { tipo: "nuovo" }
  | { tipo: "invariato" }
  | { tipo: "variato"; era: number }

/** Campi del magazzino di un materiale (vedi migration 20261025000001). */
export type DatiMagazzino = {
  in_magazzino: boolean
  carico_totale: number
  rettifica: number
  soglia: number | null // scorta minima
  ordinato_il: string | null // AAAA-MM-GG, data di «Ho già ordinato»
}

export type StatoScorta = "ok" | "da_riordinare" | "ordinato" | "ordinato_scaduto"

/** Giorni in cui «Ho già ordinato» sospende l'avviso «Da riordinare». */
export const GIORNI_ATTESA_ORDINE = 7

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

/** Prezzo dopo gli sconti a cascata: ogni sconto si applica al prezzo già scontato (50 poi 20 = ×0,5 ×0,8). */
export function netPrice(listino: number, sconti: number[]): number {
  return sconti.reduce((prezzo, sconto) => prezzo * (1 - sconto / 100), listino)
}

/** Arrotonda a 3 decimali, come si salvano i prezzi. */
export function round3(value: number): number {
  return Math.round(value * 1000) / 1000
}

/**
 * Legge gli sconti scritti da una persona: "50", "50+20", "50 20", "50/20", "12,5".
 * La virgola è il decimale. Vuoto = nessuno sconto; null se qualcosa non è una
 * percentuale tra 0 e 100. Gli sconti a zero si ignorano.
 */
export function parseDiscounts(value: string): number[] | null {
  const testo = value.replace(/%/g, " ").trim()
  if (!testo) return []
  const sconti: number[] = []
  for (const parte of testo.split(/[+/;\s]+/).filter(Boolean)) {
    const n = Number(parte.replace(",", "."))
    if (!Number.isFinite(n) || n < 0 || n > 100) return null
    if (n > 0) sconti.push(n)
  }
  return sconti
}

/** 50 + 20 · 12,5 */
export function formatDiscounts(sconti: number[]): string {
  return sconti.map((s) => String(s).replace(".", ",")).join(" + ")
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

/**
 * Giacenza: non è un contatore ma si calcola ogni volta (carico + rettifica − venduto).
 * `venduto` vale 0 finché gli ordini non sono collegati ai materiali.
 */
export function computeStock(m: Pick<DatiMagazzino, "carico_totale" | "rettifica">, venduto = 0): number {
  return round3(m.carico_totale + m.rettifica - venduto)
}

/** La rettifica che, con questo carico e questo venduto, porta la giacenza al valore realmente contato. */
export function rettificaPerGiacenza(reale: number, m: Pick<DatiMagazzino, "carico_totale">, venduto = 0): number {
  return round3(reale - m.carico_totale + venduto)
}

/** Giorni di calendario tra due date AAAA-MM-GG. */
export function daysBetween(da: string, a: string): number {
  return Math.round((Date.parse(`${a}T00:00:00Z`) - Date.parse(`${da}T00:00:00Z`)) / 86_400_000)
}

/** 50 · 12,5 · 0,25 (virgola, senza zeri inutili). */
export function formatQuantita(value: number): string {
  return String(round3(value)).replace(".", ",")
}

/**
 * Stato dell'avviso di riordino. `oggi` è AAAA-MM-GG (calendario di Roma, vedi `todayIso`).
 * - ok: non in magazzino, senza scorta minima, o giacenza sopra la scorta minima;
 * - da_riordinare: giacenza uguale o sotto la scorta minima;
 * - ordinato: come sopra ma «Ho già ordinato» è di meno di 7 giorni fa (avviso sospeso);
 * - ordinato_scaduto: «Ho già ordinato» da 7 giorni o più e la merce non è arrivata (l'avviso riparte).
 */
export function reorderStatus(
  m: Pick<DatiMagazzino, "in_magazzino" | "soglia" | "ordinato_il">,
  giacenza: number,
  oggi: string
): StatoScorta {
  if (!m.in_magazzino || m.soglia === null || giacenza > m.soglia) return "ok"
  if (m.ordinato_il === null) return "da_riordinare"
  return daysBetween(m.ordinato_il, oggi) < GIORNI_ATTESA_ORDINE ? "ordinato" : "ordinato_scaduto"
}
