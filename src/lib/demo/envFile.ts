/**
 * Legge il contenuto di un file .env: coppie CHIAVE=valore, righe vuote e
 * commenti (#) ignorati, virgolette facoltative intorno al valore. Serve agli
 * script della demo, che leggono `.env.demo.local` senza dipendenze in più.
 */
export function parseEnvFile(testo: string): Record<string, string> {
  const risultato: Record<string, string> = {}
  for (const rigaGrezza of testo.split(/\r?\n/)) {
    const riga = rigaGrezza.trim()
    if (!riga || riga.startsWith("#")) continue
    const uguale = riga.indexOf("=")
    if (uguale <= 0) continue
    const chiave = riga.slice(0, uguale).trim()
    let valore = riga.slice(uguale + 1).trim()
    const virgolettato =
      valore.length >= 2 &&
      ((valore.startsWith('"') && valore.endsWith('"')) || (valore.startsWith("'") && valore.endsWith("'")))
    if (virgolettato) valore = valore.slice(1, -1)
    risultato[chiave] = valore
  }
  return risultato
}
