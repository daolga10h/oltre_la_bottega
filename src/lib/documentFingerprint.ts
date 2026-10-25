import { createHash } from "node:crypto"
import { normalizeText, supplierKey } from "@/lib/materiali"
import type { DocumentoLetto } from "@/lib/documentoFornitore"

// Solo lato server (usa node:crypto): per questo non sta in documentoFornitore.ts, che è importato anche da un componente client.

/** SHA-256 dei byte del file ricevuto: riconosce lo stesso file caricato due volte, senza passare dall'AI. */
export function fileFingerprint(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex")
}

/**
 * Impronta GROSSOLANA del contenuto così come è stato LETTO: prima parola del fornitore, data e codici
 * (o nomi, se manca il codice). Volutamente senza quantità, prezzi, sconti e importi: sono i dati che l'AI
 * legge in modo leggermente diverso a ogni lettura. Non dipende da ordine, maiuscole e spazi.
 */
export function documentFingerprint(doc: DocumentoLetto): string {
  const righe = doc.righe.map((r) => normalizeText(r.codice) || normalizeText(r.nome)).sort()
  const testo = [supplierKey(doc.fornitore)[0] ?? "", doc.data ?? "", ...righe].join("\n")
  return createHash("sha256").update(testo).digest("hex")
}
