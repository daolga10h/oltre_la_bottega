import { createClient } from "@/lib/supabase/server"
import { logError } from "@/lib/logger"
import { NextResponse } from "next/server"

export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const today = new Date().toISOString().split("T")[0]

    const [openRes, urgentRes, overdueRes, todayRes, remindersRes] = await Promise.all([
      supabase
        .from("orders")
        .select("id", { count: "exact", head: true })
        .not("status", "in", '("consegnato","annullato")'),
      supabase
        .from("orders")
        .select("id", { count: "exact", head: true })
        .eq("priority", "urgente")
        .not("status", "in", '("consegnato","annullato")'),
      supabase
        .from("orders")
        .select("id", { count: "exact", head: true })
        .lt("due_date", today)
        .not("status", "in", '("consegnato","annullato")'),
      supabase
        .from("orders")
        .select("id, title, status, priority, due_date, customers(name)")
        .eq("due_date", today)
        .not("status", "in", '("consegnato","annullato")')
        .order("priority"),
      supabase
        .from("reminders")
        .select("id, title, due_at")
        .eq("status", "attivo")
        .lte("due_at", `${today}T23:59:59Z`)
        .order("due_at"),
    ])

    return NextResponse.json({
      kpi: {
        open: openRes.count ?? 0,
        urgent: urgentRes.count ?? 0,
        overdue: overdueRes.count ?? 0,
        todayDeliveries: todayRes.data?.length ?? 0,
      },
      todayOrders: todayRes.data ?? [],
      reminders: remindersRes.data ?? [],
    })
  } catch (error) {
    logError("dashboard/today", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
