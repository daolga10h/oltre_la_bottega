import { createClient } from "@/lib/supabase/server"
import { logError } from "@/lib/logger"
import { NextResponse } from "next/server"

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const q = searchParams.get("q")?.trim()

  if (!q || q.length < 2) {
    return NextResponse.json({ orders: [], customers: [] })
  }

  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ orders: [], customers: [] })

    const [ordersRes, customersRes] = await Promise.all([
      supabase
        .from("orders")
        .select("id, title, status")
        .ilike("title", `%${q}%`)
        .not("status", "eq", "annullato")
        .limit(5),
      supabase
        .from("customers")
        .select("id, name, phone")
        .ilike("name", `%${q}%`)
        .limit(5),
    ])

    return NextResponse.json({
      orders: ordersRes.data ?? [],
      customers: customersRes.data ?? [],
    })
  } catch (error) {
    logError("search", error, { q })
    return NextResponse.json({ orders: [], customers: [] })
  }
}
