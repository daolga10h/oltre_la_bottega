import { createClient } from "@/lib/supabase/server"
import { logError } from "@/lib/logger"
import { NextResponse } from "next/server"
import { hasFeature } from "@/lib/plan"
import { computeStock, reorderStatus, todayIso } from "@/lib/materiali"

export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const today = new Date().toISOString().split("T")[0]

    const [openRes, urgentRes, overdueRes, todayRes, deliveredRes, materialeDaOrdinareRes, materialeOrdinatoOggiRes, daAvvisareRes, remindersRes, materialiRes] = await Promise.all([
      supabase.from("orders").select("id", { count: "exact", head: true })
        .not("status", "in", '("consegnato")'),
      supabase.from("orders").select("id", { count: "exact", head: true })
        .eq("status", "in_lavorazione"),
      supabase.from("orders").select("id", { count: "exact", head: true })
        .lt("data_consegna", today).not("status", "in", '("consegnato")'),
      supabase.from("orders").select("id, cosa_ordinato, nome, cognome, azienda, referente, status, data_consegna")
        .eq("data_consegna", today).not("status", "in", '("consegnato")'),
      supabase.from("orders").select("id, cosa_ordinato, nome, cognome, azienda, referente")
        .eq("data_consegnato", today),
      supabase.from("orders").select("id, cosa_ordinato, nome, cognome, azienda, referente, status, data_consegna")
        .eq("materiale", "da_ordinare"),
      supabase.from("orders").select("id, cosa_ordinato, nome, cognome, azienda, referente")
        .eq("materiale", "ordinato").eq("materiale_data_ordine", today),
      supabase.from("orders").select("id, cosa_ordinato, nome, cognome, azienda, referente, status, data_consegna")
        .eq("status", "pronto").eq("msg_pronto_inviato", false),
      supabase.from("reminders").select("id, title, due_at")
        .eq("status", "attivo").lte("due_at", `${today}T23:59:59Z`).order("due_at"),
      // Materiali in magazzino per l'avviso «Da riordinare» (solo livello completo)
      hasFeature("materiali")
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ? (supabase as any)
            .from("materiali")
            .select("id, fornitore, nome, in_magazzino, carico_totale, rettifica, soglia, ordinato_il")
            .eq("in_magazzino", true)
        : Promise.resolve({ data: [] }),
    ])

    const oggiRoma = todayIso()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const riordino = ((materialiRes.data ?? []) as any[])
      .flatMap((row) => {
        const soglia = row.soglia === null || row.soglia === undefined ? null : Number(row.soglia)
        const giacenza = computeStock({ carico_totale: Number(row.carico_totale ?? 0), rettifica: Number(row.rettifica ?? 0) })
        const stato = reorderStatus({ in_magazzino: Boolean(row.in_magazzino), soglia, ordinato_il: row.ordinato_il ?? null }, giacenza, oggiRoma)
        return stato === "da_riordinare" || stato === "ordinato_scaduto"
          ? [{ id: row.id, nome: row.nome, fornitore: row.fornitore, giacenza, soglia, stato, ordinato_il: row.ordinato_il ?? null }]
          : []
      })
      .sort((a, b) => a.nome.localeCompare(b.nome))

    return NextResponse.json({
      kpi: {
        open: openRes.count ?? 0,
        urgent: urgentRes.count ?? 0,
        overdue: overdueRes.count ?? 0,
        todayDeliveries: todayRes.data?.length ?? 0,
      },
      todayOrders: todayRes.data ?? [],
      deliveredToday: deliveredRes.data ?? [],
      materialeDaOrdinare: materialeDaOrdinareRes.data ?? [],
      materialeOrdinatoOggi: materialeOrdinatoOggiRes.data ?? [],
      daAvvisare: daAvvisareRes.data ?? [],
      riordino,
      reminders: remindersRes.data ?? [],
    })
  } catch (error) {
    logError("dashboard/today", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
