import { createClient } from "@supabase/supabase-js"

/**
 * Client con service role, per contesti senza sessione utente (es. cron job)
 * dove `src/lib/supabase/server.ts` (basato sui cookie di sessione) non è utilizzabile.
 */
export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}