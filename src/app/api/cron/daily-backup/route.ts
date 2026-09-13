import { NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { ordersToCsv, type OrderExportRow } from "@/lib/csv"
import { sendBackupEmail } from "@/lib/email/sendBackupEmail"
import { getShopName } from "@/lib/shop-name"
import { logError, logInfo } from "@/lib/logger"

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET
  const authHeader = request.headers.get("authorization")
  if (!secret || authHeader !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const backupEmailTo = process.env.BACKUP_EMAIL_TO
  if (!backupEmailTo) {
    logError("cron/daily-backup", new Error("BACKUP_EMAIL_TO non configurata"))
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }

  try {
    const admin = createAdminClient()

    const { data: usersData, error: usersError } = await admin.auth.admin.listUsers()
    if (usersError) {
      logError("cron/daily-backup", usersError)
    }
    const shopUser =
      usersData?.users.find((u) => u.email?.toLowerCase() === backupEmailTo.toLowerCase()) ?? null

    const { data: orders, error } = await admin
      .from("orders")
      .select(
        "nome, cognome, telefono, email_cliente, cosa_ordinato, data_ordine, data_consegna, data_consegnato, status, operatore, prezzo, acconto, saldo, note"
      )
      .order("data_ordine", { ascending: false })

    if (error) {
      logError("cron/daily-backup", error)
      return NextResponse.json({ error: "Internal server error" }, { status: 500 })
    }

    const csv = ordersToCsv((orders ?? []) as OrderExportRow[])
    await sendBackupEmail({
      to: backupEmailTo,
      csv,
      shopName: getShopName(shopUser),
    })

    logInfo("cron/daily-backup", "Backup giornaliero inviato", { count: orders?.length ?? 0 })
    return NextResponse.json({ ok: true, count: orders?.length ?? 0 })
  } catch (error) {
    logError("cron/daily-backup", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
