import { createClient } from "@/lib/supabase/server"
import { logError } from "@/lib/logger"
import { NextResponse } from "next/server"

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const q = searchParams.get("q")?.trim()
  if (!q || q.length < 2) return NextResponse.json({ orders: [] })

  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ orders: [] })

    const { data } = await supabase
      .from("orders")
      .select("id, cosa_ordinato, nome, cognome, status")
      .or(`nome.ilike.%${q}%,cognome.ilike.%${q}%,cosa_ordinato.ilike.%${q}%,telefono.ilike.%${q}%`)
      .not("status", "eq", "consegnato")
      .limit(8)

    return NextResponse.json({ orders: data ?? [] })
  } catch (error) {
    logError("search", error, { q })
    return NextResponse.json({ orders: [] })
  }
}
