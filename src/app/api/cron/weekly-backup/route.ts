import { NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { ordersToCsv, type OrderExportRow } from "@/lib/csv"
import { sendBackupEmail } from "@/lib/email/sendBackupEmail"
import { getShopName } from "@/lib/shop-name"
import { logError, logInfo } from "@/lib/logger"

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization")
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const admin = createAdminClient()

    const { data: usersData } = await admin.auth.admin.listUsers()
    const shopUser = usersData?.users[0] ?? null
    if (!shopUser?.email) {
      logError("cron/weekly-backup", new Error("Nessun utente trovato per l'istanza"))
      return NextResponse.json({ error: "No shop user" }, { status: 500 })
    }

    const { data: orders, error } = await admin
      .from("orders")
      .select(
        "nome, cognome, telefono, email_cliente, cosa_ordinato, data_ordine, data_consegna, data_consegnato, status, operatore, prezzo, acconto, saldo, note"
      )
      .order("data_ordine", { ascending: false })

    if (error) {
      logError("cron/weekly-backup", error)
      return NextResponse.json({ error: "Internal server error" }, { status: 500 })
    }

    const csv = ordersToCsv((orders ?? []) as OrderExportRow[])
    await sendBackupEmail({
      to: shopUser.email,
      csv,
      shopName: getShopName(shopUser),
    })

    logInfo("cron/weekly-backup", "Backup settimanale inviato", { count: orders?.length ?? 0 })
    return NextResponse.json({ ok: true, count: orders?.length ?? 0 })
  } catch (error) {
    logError("cron/weekly-backup", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
