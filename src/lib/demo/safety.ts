/**
 * Host di un indirizzo Supabase, in minuscolo, con o senza `https://`; null se manca.
 * Usa il parser URL standard, così credenziali, porta, frammento e punto finale
 * non possono mascherare un indirizzo uguale a quello vero.
 */
export function hostOf(url: string | undefined | null): string | null {
  if (!url) return null
  const testo = url.trim()
  if (!testo) return null
  try {
    const conSchema = /^[a-z][a-z0-9+.-]*:\/\//i.test(testo) ? testo : `https://${testo}`
    return new URL(conSchema).hostname.replace(/\.$/, "") || null
  } catch {
    return testo.toLowerCase()
  }
}

export type SafeTargetInput = {
  /** Indirizzo del progetto che lo script sta per svuotare (DEMO_SUPABASE_URL). */
  demoUrl: string | undefined
  /** Indirizzi del progetto vero della bottega (da `.env.local` e dall'ambiente). */
  prodUrls: Array<string | undefined>
  /** Quanti ordini contiene già il database di destinazione. */
  existingOrderCount: number
  /** Quanti utenti (Auth) contiene già il database di destinazione. */
  existingUserCount: number
  /** Il database contiene l'utente marcato `demo: true`. */
  hasDemoMarkerUser: boolean
}

/**
 * Lo script che svuota la demo si deve rifiutare di partire se il database di
 * destinazione potrebbe essere quello della bottega vera. Lancia un errore
 * (in italiano) prima che qualunque scrittura sia stata fatta.
 */
export function assertSafeTarget({
  demoUrl,
  prodUrls,
  existingOrderCount,
  existingUserCount,
  hasDemoMarkerUser,
}: SafeTargetInput): void {
  const demoHost = hostOf(demoUrl)
  if (!demoHost) {
    throw new Error("DEMO_SUPABASE_URL manca: non so quale database svuotare, non tocco niente.")
  }

  const prodHosts = prodUrls.map(hostOf).filter((h): h is string => h !== null)
  if (prodHosts.length === 0) {
    throw new Error(
      "Non trovo l'indirizzo del progetto vero (NEXT_PUBLIC_SUPABASE_URL in .env.local): non posso escludere che sia lui, non tocco niente."
    )
  }
  if (prodHosts.includes(demoHost)) {
    throw new Error(
      `DEMO_SUPABASE_URL (${demoHost}) è lo stesso progetto della bottega vera: mi fermo, non tocco niente.`
    )
  }

  // Un'istanza vera ha sempre almeno un utente; una demo appena creata non ne ha.
  if ((existingOrderCount > 0 || existingUserCount > 0) && !hasDemoMarkerUser) {
    throw new Error(
      "Il database contiene già ordini o utenti ma non l'utente marcato come demo: non sembra il progetto demo, mi fermo, non tocco niente."
    )
  }
}
