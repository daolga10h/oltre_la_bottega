/**
 * Legge il contenuto di un file .env: coppie CHIAVE=valore, righe vuote e
 * commenti (#) ignorati, prefisso `export` e virgolette facoltativi, commenti in
 * coda alla riga tagliati come fanno Next.js e dotenv. Serve agli script della
 * demo, che leggono `.env.demo.local` senza dipendenze in più.
 */
export function parseEnvFile(testo: string): Record<string, string> {
  const risultato: Record<string, string> = {}
  for (const rigaGrezza of testo.split(/\r?\n/)) {
    const riga = rigaGrezza.trim()
    if (!riga || riga.startsWith("#")) continue
    const uguale = riga.indexOf("=")
    if (uguale <= 0) continue
    const chiave = riga
      .slice(0, uguale)
      .trim()
      .replace(/^export\s+/, "")
    if (!chiave) continue
    const grezzo = riga.slice(uguale + 1).trim()
    const apertura = grezzo[0]
    let valore: string
    if (apertura === '"' || apertura === "'") {
      // Tra virgolette: si prende il testo fino alla virgoletta di chiusura, il resto è un commento.
      const chiusura = grezzo.indexOf(apertura, 1)
      valore = chiusura === -1 ? grezzo.slice(1) : grezzo.slice(1, chiusura)
    } else {
      // Senza virgolette: un commento inizia al primo `#` preceduto da uno spazio.
      valore = grezzo.split(/\s+#/)[0].trim()
    }
    risultato[chiave] = valore
  }
  return risultato
}
