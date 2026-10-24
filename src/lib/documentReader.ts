import Anthropic from "@anthropic-ai/sdk"
import { parseExtraction, type DocumentoLetto, type SupportedMediaType } from "@/lib/documentoFornitore"

// Modello con visione. Cambiabile da MATERIALI_MODEL senza toccare il codice.
const DEFAULT_MODEL = "claude-sonnet-5-5"

const PROMPT = `Questo è un documento di un fornitore (fattura, DDT, listino o preventivo), \
in PDF o in foto, anche ruotato o storto. Leggilo e registra i dati con lo strumento registra_documento.

Regole:
- "fornitore" è chi EMETTE il documento (l'intestazione in alto), non il destinatario.
- "data" è la data del documento in formato AAAA-MM-GG, non la data di un ordine richiamato nel testo. Se non la leggi, null.
- Una riga per ogni articolo. Includi tutte le righe di merce o servizio, comprese eventuali spese (trasporto, imballo): le toglierà una persona.
- "prezzo" è il prezzo unitario SENZA IVA, in euro, come numero con il punto decimale (14.380 → 14.38). Se il prezzo unitario non c'è, la riga va comunque registrata solo se puoi ricavarlo con certezza da importo e quantità.
- "importo" è l'importo di riga senza IVA, come scritto sul documento. "quantita" è la quantità.
- Non inventare nulla: se un dato non si legge, usa null. Non calcolare totali del documento.`

const TOOL: Anthropic.Tool = {
  name: "registra_documento",
  description: "Registra fornitore, data e righe lette dal documento.",
  input_schema: {
    type: "object",
    properties: {
      fornitore: { type: "string", description: "Ragione sociale di chi emette il documento" },
      data: { type: ["string", "null"], description: "Data del documento, AAAA-MM-GG, oppure null" },
      righe: {
        type: "array",
        items: {
          type: "object",
          properties: {
            codice: { type: ["string", "null"], description: "Codice articolo del fornitore" },
            nome: { type: "string", description: "Descrizione dell'articolo" },
            unita: { type: ["string", "null"], description: "Unità di misura (Nr., pz, m, kg…)" },
            quantita: { type: ["number", "null"] },
            prezzo: { type: "number", description: "Prezzo unitario senza IVA, in euro" },
            importo: { type: ["number", "null"], description: "Importo di riga senza IVA" },
          },
          required: ["nome", "prezzo"],
        },
      },
    },
    required: ["fornitore", "righe"],
  },
}

/** Manda il file a Claude e restituisce le righe lette. Non salva nulla. */
export async function readSupplierDocument(
  base64: string,
  mediaType: SupportedMediaType
): Promise<DocumentoLetto> {
  // Timeout sotto i 60 s di maxDuration della pagina Materiali; nessun nuovo tentativo,
  // perché un secondo giro supererebbe comunque i 60 s.
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY, timeout: 55_000, maxRetries: 0 })

  const fileBlock: Anthropic.ContentBlockParam =
    mediaType === "application/pdf"
      ? { type: "document", source: { type: "base64", media_type: "application/pdf", data: base64 } }
      : { type: "image", source: { type: "base64", media_type: mediaType, data: base64 } }

  const response = await client.messages.create({
    model: process.env.MATERIALI_MODEL || DEFAULT_MODEL,
    max_tokens: 8000,
    tools: [TOOL],
    tool_choice: { type: "tool", name: TOOL.name },
    messages: [{ role: "user", content: [fileBlock, { type: "text", text: PROMPT }] }],
  })

  // Risposta tagliata: mancherebbero righe senza che si veda
  if (response.stop_reason === "max_tokens") {
    throw new Error("Lettura interrotta: documento troppo lungo")
  }

  const risposta = response.content.find((b) => b.type === "tool_use")
  return parseExtraction(risposta && risposta.type === "tool_use" ? risposta.input : null)
}
