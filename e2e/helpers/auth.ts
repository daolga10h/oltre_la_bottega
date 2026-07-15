import { createClient } from "@supabase/supabase-js"
import { createServerClient } from "@supabase/ssr"
import { readFileSync, existsSync } from "fs"
import path from "path"

function loadEnvLocal() {
  const envPath = path.resolve(__dirname, "..", "..", ".env.local")
  if (!existsSync(envPath)) return
  for (const line of readFileSync(envPath, "utf-8").split("\n")) {
    const match = line.match(/^([A-Z0-9_]+)=(.*?)\r?$/)
    if (match && !(match[1] in process.env)) process.env[match[1]] = match[2].trim()
  }
}

const TEST_EMAIL = process.env.E2E_TEST_EMAIL ?? "e2e-test@oltrelabottega.local"
export const TEST_OPERATOR = "Operatore Test"

export type AuthCookie = {
  name: string
  value: string
  domain: string
  path: string
  expires: number
  httpOnly: boolean
  secure: boolean
  sameSite: "Lax" | "Strict" | "None"
}

function adminClient() {
  loadEnvLocal()
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error(
      "Flusso D richiede NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY in .env.local"
    )
  }
  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

/**
 * Autentica un utente di test tramite la Admin API di Supabase (magic link +
 * verifyOtp) e restituisce i cookie di sessione da iniettare nel browser
 * context di Playwright — evita di dover intercettare una vera email.
 */
export async function getTestAuthCookies(): Promise<AuthCookie[]> {
  const admin = adminClient()
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  if (!anonKey || !supabaseUrl) {
    throw new Error("Flusso D richiede NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local")
  }

  // Idempotente: se l'utente di test esiste già, l'errore viene ignorato.
  await admin.auth.admin
    .createUser({
      email: TEST_EMAIL,
      email_confirm: true,
      user_metadata: { shop_name: "Bottega E2E", operatori: [TEST_OPERATOR] },
    })
    .catch(() => {})

  // L'utente di test può già esistere da esecuzioni precedenti (senza
  // l'operatore, se creato prima di questo campo) — createUser sopra viene
  // ignorata in quel caso, quindi qui ci assicuriamo che l'operatore di test
  // sia comunque presente nei metadati.
  const { data: existing } = await admin.auth.admin.listUsers()
  const existingUser = existing?.users.find((u) => u.email === TEST_EMAIL)
  if (existingUser) {
    const current: string[] = Array.isArray(existingUser.user_metadata?.operatori)
      ? existingUser.user_metadata.operatori
      : []
    if (!current.includes(TEST_OPERATOR)) {
      await admin.auth.admin.updateUserById(existingUser.id, {
        user_metadata: { ...existingUser.user_metadata, operatori: [...current, TEST_OPERATOR] },
      })
    }
  }

  const { data, error } = await admin.auth.admin.generateLink({ type: "magiclink", email: TEST_EMAIL })
  if (error || !data?.properties?.hashed_token) {
    throw new Error(`Impossibile generare la sessione di test: ${error?.message ?? "hashed_token mancante"}`)
  }

  const cookies: AuthCookie[] = []
  const supabase = createServerClient(supabaseUrl, anonKey, {
    cookies: {
      getAll: () => [],
      setAll: (cookiesToSet) => {
        for (const { name, value } of cookiesToSet) {
          cookies.push({
            name,
            value,
            domain: "localhost",
            path: "/",
            expires: -1,
            httpOnly: false,
            secure: false,
            sameSite: "Lax",
          })
        }
      },
    },
  })

  const { error: verifyError } = await supabase.auth.verifyOtp({
    type: "email",
    token_hash: data.properties.hashed_token,
  })
  if (verifyError) throw new Error(`Verifica OTP fallita per l'utente di test: ${verifyError.message}`)

  return cookies
}

/** Cancella un ordine creato durante Flusso D bypassando l'app — garantisce la pulizia anche se il test fallisce a metà. */
export async function deleteTestOrder(orderId: string): Promise<void> {
  await adminClient().from("orders").delete().eq("id", orderId)
}
