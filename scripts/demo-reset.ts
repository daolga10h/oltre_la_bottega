// Svuota e riempie di dati finti il progetto Supabase DEMO.
// Uso: npm run demo:reset   (le chiavi stanno in .env.demo.local)
import { createClient } from "@supabase/supabase-js"
import { existsSync, readFileSync } from "node:fs"
import path from "node:path"
import { parseEnvFile } from "../src/lib/demo/envFile"
import { assertSafeTarget } from "../src/lib/demo/safety"
import { buildDemoData } from "../src/lib/demo/demoData"

const radice = process.cwd()

function leggiEnv(nomeFile: string): Record<string, string> {
  const file = path.join(radice, nomeFile)
  return existsSync(file) ? parseEnvFile(readFileSync(file, "utf-8")) : {}
}

function controlla<T extends { message: string } | null>(errore: T, contesto: string): void {
  if (errore) throw new Error(`${contesto}: ${errore.message}`)
}

async function main() {
  const demo = leggiEnv(".env.demo.local")
  const vero = leggiEnv(".env.local")

  const url = demo.DEMO_SUPABASE_URL
  const chiaveServizio = demo.DEMO_SERVICE_ROLE_KEY
  const email = demo.DEMO_USER_EMAIL
  const pin = demo.DEMO_PIN
  if (!url || !chiaveServizio || !email || !pin) {
    throw new Error(
      "Mancano dei valori in .env.demo.local (servono DEMO_SUPABASE_URL, DEMO_SERVICE_ROLE_KEY, DEMO_USER_EMAIL, DEMO_PIN). Vedere docs/demo/configurazione-demo.md."
    )
  }
  if (!/^\d{6}$/.test(pin)) {
    throw new Error("DEMO_PIN deve essere di esattamente 6 cifre (il campo PIN del login ne accetta al massimo 6).")
  }

  const supabase = createClient(url.startsWith("http") ? url : `https://${url}`, chiaveServizio, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  // Solo letture, finché non abbiamo verificato che il database sia quello giusto.
  const { count, error: erroreConteggio } = await supabase.from("orders").select("id", { count: "exact" }).limit(1)
  controlla(
    erroreConteggio,
    "Non riesco a leggere il database demo (lo schema è stato creato? vedere docs/demo/configurazione-demo.md)"
  )
  const { data: elencoUtenti, error: erroreUtenti } = await supabase.auth.admin.listUsers({ perPage: 200 })
  controlla(erroreUtenti, "Non riesco a leggere gli utenti del database demo")
  const utenteDemo = elencoUtenti?.users.find((u) => u.user_metadata?.demo === true)

  assertSafeTarget({
    demoUrl: url,
    prodUrls: [vero.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_URL],
    existingOrderCount: count ?? 0,
    existingUserCount: elencoUtenti?.users.length ?? 0,
    hasDemoMarkerUser: Boolean(utenteDemo),
  })

  // Da qui in poi si scrive: il controllo di sicurezza è già passato.
  controlla((await supabase.from("reminders").delete().not("id", "is", null)).error, "Cancellazione promemoria")
  // order_items e order_events seguono con il cascade.
  controlla((await supabase.from("orders").delete().not("id", "is", null)).error, "Cancellazione ordini")

  const metadati = { shop_name: "Bottega di esempio", pin_set: true, demo: true }
  if (utenteDemo) {
    const { error } = await supabase.auth.admin.updateUserById(utenteDemo.id, {
      email,
      password: pin,
      email_confirm: true,
      user_metadata: metadati,
    })
    controlla(error, "Aggiornamento dell'utente demo")
  } else {
    const { error } = await supabase.auth.admin.createUser({
      email,
      password: pin,
      email_confirm: true,
      user_metadata: metadati,
    })
    controlla(error, "Creazione dell'utente demo")
  }

  const dati = buildDemoData(new Date())
  for (const { order, items, events } of dati.orders) {
    const { data, error } = await supabase.from("orders").insert(order).select("id").single()
    controlla(error, `Inserimento ordine di ${order.nome}`)
    const idOrdine = data!.id
    controlla(
      (await supabase.from("order_items").insert(items.map((it, i) => ({ ...it, order_id: idOrdine, posizione: i })))).error,
      `Inserimento righe di ${order.nome}`
    )
    controlla(
      (await supabase.from("order_events").insert(events.map((e) => ({ ...e, order_id: idOrdine })))).error,
      `Inserimento cronologia di ${order.nome}`
    )
  }
  controlla((await supabase.from("reminders").insert(dati.reminders)).error, "Inserimento promemoria")

  const enti = dati.orders.filter((o) => o.order.is_ente).length
  console.log(
    `Demo rinfrescata: ${dati.orders.length} ordini (di cui ${enti} di enti/aziende), ${dati.reminders.length} promemoria.`
  )
  console.log(`Accesso: ${email} con il PIN scelto in .env.demo.local.`)
}

main().catch((errore: unknown) => {
  console.error("ERRORE:", errore instanceof Error ? errore.message : errore)
  process.exit(1)
})
