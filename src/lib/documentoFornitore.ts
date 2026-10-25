import { isValidIsoDate, type RigaLetta } from "@/lib/materiali"

export const SUPPORTED_MEDIA_TYPES = ["application/pdf", "image/jpeg", "image/png", "image/webp"] as const
export type SupportedMediaType = (typeof SUPPORTED_MEDIA_TYPES)[number]

// Le richieste verso Vercel hanno un tetto di 4,5 MB: si resta sotto, lasciando margine al FormData.
export const MAX_FILE_BYTES = 4_000_000

export type DocumentoLetto = {
  fornitore: string
  data: string | null // AAAA-MM-GG
  righe: RigaLetta[]
}

function toNumberOrNull(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null
}

// Righe di spedizione/trasporto: non sono materiali e non vanno mai nel listino, anche se il modello
// le registra. Si guarda solo l'inizio del nome: "Scatola per spedizione" è un articolo vero.
const RIGA_SPEDIZIONE = /^\s*((spese|costo|costi|contributo|addebito|servizio)\s+(di\s+|per\s+)?)*(spedizion[ei]|trasport[oi])\b/i

// Sconti a cascata in percentuale (SC.1, SC.2, SC.3): si tengono solo numeri tra 0 (escluso) e 100.
function toDiscounts(v: unknown): number[] {
  if (!Array.isArray(v)) return []
  return v.filter((s): s is number => typeof s === "number" && Number.isFinite(s) && s > 0 && s <= 100)
}

function toTextOrNull(v: unknown): string | null {
  if (typeof v === "number" && Number.isFinite(v)) return String(v)
  if (typeof v !== "string") return null
  const t = v.trim()
  return t === "" ? null : t
}

/**
 * Convalida l'output di Claude: non ci si fida del formato. Scarta le righe
 * inutilizzabili e restituisce sempre un documento ben formato (al limite vuoto).
 */
export function parseExtraction(raw: unknown): DocumentoLetto {
  const vuoto: DocumentoLetto = { fornitore: "", data: null, righe: [] }
  if (!raw || typeof raw !== "object") return vuoto
  const r = raw as Record<string, unknown>

  const righe: RigaLetta[] = []
  if (Array.isArray(r.righe)) {
    for (const item of r.righe) {
      if (!item || typeof item !== "object") continue
      const i = item as Record<string, unknown>
      const nome = toTextOrNull(i.nome)
      const prezzo = toNumberOrNull(i.prezzo)
      if (!nome || RIGA_SPEDIZIONE.test(nome) || prezzo === null || prezzo < 0) continue
      righe.push({
        codice: toTextOrNull(i.codice),
        nome,
        unita: toTextOrNull(i.unita),
        quantita: toNumberOrNull(i.quantita),
        prezzo,
        sconti: toDiscounts(i.sconti),
        importo: toNumberOrNull(i.importo),
      })
    }
  }

  const data = typeof r.data === "string" && isValidIsoDate(r.data) ? r.data : null
  return { fornitore: toTextOrNull(r.fornitore) ?? "", data, righe }
}
