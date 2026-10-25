import { createHash } from "node:crypto"
import { normalizeText } from "@/lib/materiali"
import type { DocumentoLetto } from "@/lib/documentoFornitore"

// Solo lato server (usa node:crypto): per questo non sta in documentoFornitore.ts, che è importato anche da un componente client.

function num(v: number | null): string {
  return v === null ? "" : v.toFixed(3)
}

/**
 * Impronta del documento così come è stato LETTO (non come l'ha corretto l'utente), per riconoscere un
 * documento già caricato e non sommare due volte le quantità. Non dipende dall'ordine delle righe né da
 * maiuscole e spazi. Non contiene nulla di leggibile.
 */
export function documentFingerprint(doc: DocumentoLetto): string {
  const righe = doc.righe
    .map((r) =>
      [
        // Il nome conta solo se manca il codice: l'AI può scriverlo in modo leggermente diverso a ogni lettura.
        normalizeText(r.codice) || normalizeText(r.nome),
        num(r.quantita),
        num(r.prezzo),
        r.sconti.map((s) => s.toFixed(3)).join("+"),
        num(r.importo),
      ].join("|")
    )
    .sort()
  const testo = [normalizeText(doc.fornitore), doc.data ?? "", ...righe].join("\n")
  return createHash("sha256").update(testo).digest("hex")
}
