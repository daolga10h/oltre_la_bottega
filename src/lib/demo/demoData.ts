import { computeOrderSummary, type OrderItemInput } from "../orderItems"
import { computeSaldo } from "../orderConstants"

// Dati INVENTATI per la copia demo: nessun nome o numero appartiene a persone
// vere. I telefoni seguono il modello "333 0000xxx" e le email usano il dominio
// riservato example.com, così non possono raggiungere nessuno.

export type DemoOrderRow = {
  nome: string
  cognome: string | null
  is_ente: boolean
  azienda: string | null
  referente: string | null
  telefono: string
  email_cliente: string | null
  canale: string
  data_ordine: string
  data_consegna: string | null
  data_consegnato: string | null
  cosa_ordinato: string
  prezzo: number
  acconto: number
  saldo: number
  status: string
  preventivo: string
  bozza_grafica: string
  materiale: string
  consenso_marketing: boolean
  chiedere_recensione: boolean
  recensione_richiesta: boolean
  recensione_ricevuta: boolean
  msg_pronto_inviato: boolean
  note: string | null
  created_at: string
  updated_at: string
}

export type DemoEvent = { event_type: string; note: string; created_at: string }
export type DemoOrder = { order: DemoOrderRow; items: OrderItemInput[]; events: DemoEvent[] }
export type DemoReminder = {
  title: string
  due_at: string
  status: "attivo" | "completato"
  completed_at: string | null
}
export type DemoData = { orders: DemoOrder[]; reminders: DemoReminder[] }

const GIORNO_MS = 86_400_000

/** Giorno "AAAA-MM-GG" a `offset` giorni da oggi (stessa convenzione dell'app: data UTC di toISOString). */
export function giorno(oggi: Date, offset: number): string {
  const base = Date.UTC(oggi.getUTCFullYear(), oggi.getUTCMonth(), oggi.getUTCDate())
  return new Date(base + offset * GIORNO_MS).toISOString().slice(0, 10)
}

/** Un istante di oggi non può stare nel futuro rispetto al momento in cui si genera la demo. */
function nonFuturo(oggi: Date, iso: string): string {
  return new Date(iso).getTime() > oggi.getTime() ? oggi.toISOString() : iso
}

type Cliente = {
  nome: string
  cognome: string | null
  /** Presente = cliente ente/azienda con questo referente. */
  ente?: { referente: string }
  telefono: string
  email?: string
  canale: string
}

const CLIENTI = {
  giulia: { nome: "Giulia", cognome: "Ferri", telefono: "333 0000101", canale: "negozio" },
  marco: { nome: "Marco", cognome: "Neri", telefono: "333 0000102", canale: "telefono" },
  anna: { nome: "Anna", cognome: "Bellini", telefono: "333 0000103", canale: "WhatsApp" },
  luca: { nome: "Luca", cognome: "Conti", telefono: "333 0000104", canale: "negozio" },
  sara: { nome: "Sara", cognome: "Moretti", telefono: "333 0000105", canale: "negozio" },
  paolo: { nome: "Paolo", cognome: "Riva", telefono: "333 0000106", canale: "telefono" },
  elena: { nome: "Elena", cognome: "Costa", telefono: "333 0000107", canale: "WhatsApp" },
  davide: { nome: "Davide", cognome: "Serra", telefono: "333 0000108", canale: "negozio" },
  chiara: { nome: "Chiara", cognome: "Fontana", telefono: "333 0000109", canale: "mail", email: "chiara.fontana@example.com" },
  franco: { nome: "Franco", cognome: "Greco", telefono: "333 0000110", canale: "negozio" },
  marta: { nome: "Marta", cognome: "Leone", telefono: "333 0000111", canale: "WhatsApp" },
  andrea: { nome: "Andrea", cognome: "Sala", telefono: "333 0000112", canale: "negozio" },
  officina: { nome: "Officina Bianchi", cognome: null, ente: { referente: "Roberto Bianchi" }, telefono: "333 0000113", canale: "telefono" },
  faro: { nome: "Associazione Il Faro", cognome: null, ente: { referente: "Silvia Marchi" }, telefono: "333 0000114", canale: "negozio" },
  trattoria: { nome: "Trattoria Da Rosa", cognome: null, ente: { referente: "Rosa Lombardi" }, telefono: "333 0000115", canale: "WhatsApp" },
} satisfies Record<string, Cliente>

type Specifica = {
  cliente: Cliente
  articolo: string
  testo?: string
  quantita: number
  prezzoUnitario: number
  status: "preventivo" | "da_fare" | "in_lavorazione" | "pronto" | "consegnato"
  /** Giorni rispetto a oggi. */
  ordine: number
  consegna: number
  /** Solo per gli ordini consegnati. */
  consegnato?: number
  acconto?: number
  preventivo?: "da_inviare" | "inviato"
  recensioneDaChiedere?: boolean
  consenso?: boolean
}

function costruisci(oggi: Date, s: Specifica): DemoOrder {
  const items: OrderItemInput[] = [
    {
      cosa_ordinato: s.articolo,
      testo_da_scrivere: s.testo ?? null,
      quantita: s.quantita,
      prezzo_unitario: s.prezzoUnitario,
    },
  ]
  const { cosaOrdinato, prezzo } = computeOrderSummary(items)
  const consegnato = s.status === "consegnato"
  const acconto = consegnato ? prezzo : s.acconto ?? 0
  const dataOrdine = giorno(oggi, s.ordine)
  const dataConsegnato = consegnato && s.consegnato !== undefined ? giorno(oggi, s.consegnato) : null
  const creato = nonFuturo(oggi, `${dataOrdine}T09:00:00Z`)
  const chiuso = dataConsegnato ? nonFuturo(oggi, `${dataConsegnato}T16:00:00Z`) : creato
  const ente = s.cliente.ente

  const events: DemoEvent[] = [{ event_type: "created", note: "Ordine creato", created_at: creato }]
  if (dataConsegnato) {
    events.push({ event_type: "status_change", note: "Consegnato al cliente", created_at: chiuso })
  }

  return {
    order: {
      nome: s.cliente.nome,
      cognome: s.cliente.cognome,
      is_ente: Boolean(ente),
      azienda: null,
      referente: ente ? ente.referente : null,
      telefono: s.cliente.telefono,
      email_cliente: s.cliente.email ?? null,
      canale: s.cliente.canale,
      data_ordine: dataOrdine,
      data_consegna: giorno(oggi, s.consegna),
      data_consegnato: dataConsegnato,
      cosa_ordinato: cosaOrdinato,
      prezzo,
      acconto,
      saldo: computeSaldo(prezzo, acconto),
      status: s.status,
      preventivo: s.preventivo ?? "non_inviare",
      bozza_grafica: "non_serve",
      materiale: "non_serve",
      consenso_marketing: s.consenso ?? false,
      chiedere_recensione: !ente && Boolean(s.recensioneDaChiedere),
      recensione_richiesta: false,
      recensione_ricevuta: false,
      msg_pronto_inviato: false,
      note: null,
      created_at: creato,
      updated_at: chiuso,
    },
    items,
    events,
  }
}

/**
 * Costruisce clienti, ordini e promemoria finti con date relative a `oggi`:
 * la pagina Oggi è sempre viva (2 consegne oggi, 1 consegnato oggi, 3 pronti da
 * avvisare, 2 in ritardo, 3 preventivi, un cliente che torna, una recensione da
 * chiedere). Funzione pura: lo stesso giorno produce sempre gli stessi dati.
 */
export function buildDemoData(oggi: Date): DemoData {
  const C = CLIENTI
  const specifiche: Specifica[] = [
    // Da consegnare oggi
    { cliente: C.giulia, articolo: "Targa in plexiglass 30x10", testo: "Studio Ferri - Avvocato", quantita: 1, prezzoUnitario: 25, status: "in_lavorazione", ordine: -5, consegna: 0, acconto: 10 },
    { cliente: C.officina, articolo: "Targhe portamatricola", quantita: 2, prezzoUnitario: 18, status: "in_lavorazione", ordine: -6, consegna: 0, acconto: 15 },
    // Consegnato oggi (con recensione da chiedere)
    { cliente: C.marco, articolo: "Timbro automatico", quantita: 1, prezzoUnitario: 22, status: "consegnato", ordine: -4, consegna: 0, consegnato: 0, recensioneDaChiedere: true, consenso: true },
    // Pronti, da avvisare
    { cliente: C.anna, articolo: "Portachiavi inciso", testo: "Famiglia Bellini", quantita: 10, prezzoUnitario: 3.5, status: "pronto", ordine: -8, consegna: 1, acconto: 15 },
    { cliente: C.sara, articolo: "Coppa premiazione", quantita: 1, prezzoUnitario: 40, status: "pronto", ordine: -9, consegna: 1 },
    { cliente: C.trattoria, articolo: "Targhette tavoli numerate", quantita: 12, prezzoUnitario: 4, status: "pronto", ordine: -7, consegna: 2, acconto: 20 },
    // In ritardo
    { cliente: C.paolo, articolo: "Magliette personalizzate", quantita: 6, prezzoUnitario: 12, status: "in_lavorazione", ordine: -12, consegna: -2, acconto: 30 },
    { cliente: C.elena, articolo: "Targa in ottone", quantita: 1, prezzoUnitario: 55, status: "da_fare", ordine: -6, consegna: -1, acconto: 20 },
    // Preventivi
    { cliente: C.davide, articolo: "Insegna per negozio", quantita: 1, prezzoUnitario: 120, status: "preventivo", preventivo: "da_inviare", ordine: -1, consegna: 14 },
    { cliente: C.faro, articolo: "Coppe e medaglie", quantita: 20, prezzoUnitario: 6, status: "preventivo", preventivo: "inviato", ordine: -3, consegna: 10 },
    { cliente: C.chiara, articolo: "Bomboniere incise", quantita: 40, prezzoUnitario: 2.5, status: "preventivo", preventivo: "da_inviare", ordine: 0, consegna: 20 },
    // Da fare e in lavorazione
    { cliente: C.franco, articolo: "Timbro con logo", quantita: 1, prezzoUnitario: 28, status: "da_fare", ordine: -2, consegna: 3 },
    { cliente: C.marta, articolo: "Quadro inciso su legno", quantita: 1, prezzoUnitario: 65, status: "da_fare", ordine: -1, consegna: 5, acconto: 20 },
    { cliente: C.andrea, articolo: "Chiavi e targhetta", quantita: 1, prezzoUnitario: 18, status: "in_lavorazione", ordine: -3, consegna: 2 },
    // Un cliente che torna: Luca Conti, 3 ordini
    { cliente: C.luca, articolo: "Trofeo torneo", quantita: 1, prezzoUnitario: 45, status: "consegnato", ordine: -45, consegna: -40, consegnato: -40 },
    { cliente: C.luca, articolo: "Targa studio", quantita: 1, prezzoUnitario: 30, status: "consegnato", ordine: -22, consegna: -18, consegnato: -18 },
    { cliente: C.luca, articolo: "Timbro medico", quantita: 1, prezzoUnitario: 26, status: "da_fare", ordine: -1, consegna: 4, acconto: 10 },
    // Storico di altri clienti
    { cliente: C.giulia, articolo: "Portachiavi", quantita: 5, prezzoUnitario: 3.5, status: "consegnato", ordine: -30, consegna: -25, consegnato: -25 },
    { cliente: C.officina, articolo: "Etichette inventario", quantita: 1, prezzoUnitario: 60, status: "consegnato", ordine: -15, consegna: -12, consegnato: -12 },
  ]

  const reminders: DemoReminder[] = [
    { title: "Ordinare il cartoncino dal fornitore", due_at: `${giorno(oggi, 0)}T21:59:00Z`, status: "attivo", completed_at: null },
    { title: "Richiamare Anna Bellini: ordine pronto", due_at: `${giorno(oggi, 0)}T21:59:00Z`, status: "attivo", completed_at: null },
    { title: "Pagare la bolletta della luce", due_at: `${giorno(oggi, -1)}T09:00:00Z`, status: "attivo", completed_at: null },
    { title: "Chiamare il corriere", due_at: `${giorno(oggi, 0)}T08:00:00Z`, status: "completato", completed_at: nonFuturo(oggi, `${giorno(oggi, 0)}T08:30:00Z`) },
  ]

  return { orders: specifiche.map((s) => costruisci(oggi, s)), reminders }
}
