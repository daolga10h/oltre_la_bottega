import { createClient } from "@/lib/supabase/server"
import { logError } from "@/lib/logger"
import { NextResponse } from "next/server"

export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const today = new Date().toISOString().split("T")[0]

    const [openRes, urgentRes, overdueRes, todayRes, deliveredRes, remindersRes] = await Promise.all([
      supabase.from("orders").select("id", { count: "exact", head: true })
        .not("status", "in", '("consegnato")'),
      supabase.from("orders").select("id", { count: "exact", head: true })
        .eq("status", "in_lavorazione"),
      supabase.from("orders").select("id", { count: "exact", head: true })
        .lt("data_consegna", today).not("status", "in", '("consegnato")'),
      supabase.from("orders").select("id, cosa_ordinato, nome, cognome, status, data_consegna")
        .eq("data_consegna", today).not("status", "in", '("consegnato")'),
      supabase.from("orders").select("id, cosa_ordinato, nome, cognome")
        .eq("data_consegnato", today),
      supabase.from("reminders").select("id, title, due_at")
        .eq("status", "attivo").lte("due_at", `${today}T23:59:59Z`).order("due_at"),
    ])

    return NextResponse.json({
      kpi: {
        open: openRes.count ?? 0,
        urgent: urgentRes.count ?? 0,
        overdue: overdueRes.count ?? 0,
        todayDeliveries: todayRes.data?.length ?? 0,
      },
      todayOrders: todayRes.data ?? [],
      deliveredToday: deliveredRes.data ?? [],
      reminders: remindersRes.data ?? [],
    })
  } catch (error) {
    logError("dashboard/today", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
