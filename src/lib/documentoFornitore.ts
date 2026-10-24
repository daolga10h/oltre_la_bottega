import { isValidIsoDate, type RigaDocumento } from "@/lib/materiali"

export const SUPPORTED_MEDIA_TYPES = ["application/pdf", "image/jpeg", "image/png", "image/webp"] as const
export type SupportedMediaType = (typeof SUPPORTED_MEDIA_TYPES)[number]

// Le richieste verso Vercel hanno un tetto di 4,5 MB: si resta sotto, lasciando margine al FormData.
export const MAX_FILE_BYTES = 4_000_000

export type DocumentoLetto = {
  fornitore: string
  data: string | null // AAAA-MM-GG
  righe: RigaDocumento[]
}

function toNumberOrNull(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null
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

  const righe: RigaDocumento[] = []
  if (Array.isArray(r.righe)) {
    for (const item of r.righe) {
      if (!item || typeof item !== "object") continue
      const i = item as Record<string, unknown>
      const nome = toTextOrNull(i.nome)
      const prezzo = toNumberOrNull(i.prezzo)
      if (!nome || prezzo === null || prezzo < 0) continue
      righe.push({
        codice: toTextOrNull(i.codice),
        nome,
        unita: toTextOrNull(i.unita),
        quantita: toNumberOrNull(i.quantita),
        prezzo,
        importo: toNumberOrNull(i.importo),
      })
    }
  }

  const data = typeof r.data === "string" && isValidIsoDate(r.data) ? r.data : null
  return { fornitore: toTextOrNull(r.fornitore) ?? "", data, righe }
}
