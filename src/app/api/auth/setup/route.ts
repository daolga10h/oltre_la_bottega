import { createClient } from "@supabase/supabase-js"
import { NextResponse } from "next/server"

// Single-tenant setup endpoint: creates or updates the shop owner's PIN
// Protected by SETUP_KEY env var — set this to any secret string in .env.local
export async function POST(request: Request) {
  const setupKey = request.headers.get("x-setup-key")
  if (!setupKey || setupKey !== process.env.SETUP_KEY) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { email, pin } = await request.json()
  if (!email || !pin || !/^\d{6}$/.test(pin)) {
    return NextResponse.json({ error: "Email e PIN (6 cifre) richiesti" }, { status: 400 })
  }

  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  // Find existing user
  const { data: { users } } = await admin.auth.admin.listUsers()
  const existing = users.find((u) => u.email === email)

  if (existing) {
    await admin.auth.admin.updateUserById(existing.id, {
      password: pin,
      email_confirm: true,
    })
  } else {
    await admin.auth.admin.createUser({
      email,
      password: pin,
      email_confirm: true,
    })
  }

  return NextResponse.json({ success: true })
}
