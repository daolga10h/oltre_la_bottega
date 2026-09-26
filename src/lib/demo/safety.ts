/** Host di un indirizzo Supabase, in minuscolo, con o senza `https://`; null se manca. */
export function hostOf(url: string | undefined | null): string | null {
  if (!url) return null
  const host = url
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .split("/")[0]
    .split("?")[0]
  return host || null
}

export type SafeTargetInput = {
  /** Indirizzo del progetto che lo script sta per svuotare (DEMO_SUPABASE_URL). */
  demoUrl: string | undefined
  /** Indirizzi del progetto vero della bottega (da `.env.local` e dall'ambiente). */
  prodUrls: Array<string | undefined>
  /** Quanti ordini contiene già il database di destinazione. */
  existingOrderCount: number
  /** Il database contiene l'utente marcato `demo: true`. */
  hasDemoMarkerUser: boolean
}

/**
 * Lo script che svuota la demo si deve rifiutare di partire se il database di
 * destinazione potrebbe essere quello della bottega vera. Lancia un errore
 * (in italiano) prima che qualunque scrittura sia stata fatta.
 */
export function assertSafeTarget({ demoUrl, prodUrls, existingOrderCount, hasDemoMarkerUser }: SafeTargetInput): void {
  const demoHost = hostOf(demoUrl)
  if (!demoHost) {
    throw new Error("DEMO_SUPABASE_URL manca: non so quale database svuotare, non tocco niente.")
  }

  const prodHosts = prodUrls.map(hostOf).filter((h): h is string => h !== null)
  if (prodHosts.includes(demoHost)) {
    throw new Error(
      `DEMO_SUPABASE_URL (${demoHost}) è lo stesso progetto della bottega vera: mi fermo, non tocco niente.`
    )
  }

  if (existingOrderCount > 0 && !hasDemoMarkerUser) {
    throw new Error(
      "Il database contiene ordini ma non l'utente marcato come demo: non sembra il progetto demo, mi fermo, non tocco niente."
    )
  }
}
