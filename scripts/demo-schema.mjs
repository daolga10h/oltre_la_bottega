// Concatena le migration in un unico file SQL da incollare nel SQL Editor del
// progetto Supabase DEMO. Uso: npm run demo:schema
import { readdirSync, readFileSync, writeFileSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const radice = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const cartella = path.join(radice, "supabase", "migrations")
// Superata: la v2 cancella e ricrea tutte le tabelle, come già fatto per la bottega vera.
const SUPERATA = "20260625000001_initial_schema.sql"

const file = readdirSync(cartella)
  .filter((f) => f.endsWith(".sql") && f !== SUPERATA)
  .sort()

const righe = [
  "-- Schema completo per il progetto DEMO di Oltre la Bottega.",
  "-- Generato da scripts/demo-schema.mjs. Incollare tutto nel SQL Editor di Supabase ed eseguire,",
  "-- UNA SOLA VOLTA e SOLO su un progetto vuoto. La prima migration cancella e ricrea le tabelle:",
  "-- non eseguire mai questo file sul progetto della bottega vera.",
  "",
]
for (const f of file) {
  righe.push(`-- ===== ${f} =====`, readFileSync(path.join(cartella, f), "utf-8").trim(), "")
}

const destinazione = path.join(radice, "demo-schema.sql")
writeFileSync(destinazione, righe.join("\n"), "utf-8")
console.log(`Scritto ${destinazione} (${file.length} migration, da ${file[0]} a ${file[file.length - 1]}).`)
