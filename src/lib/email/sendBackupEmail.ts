import { Resend } from "resend"

export async function sendBackupEmail(params: {
  to: string
  csv: string
  shopName: string
}): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) return

  const resend = new Resend(apiKey)
  const from = process.env.BACKUP_EMAIL_FROM ?? "onboarding@resend.dev"
  const today = new Date().toISOString().split("T")[0]

  await resend.emails.send({
    from,
    to: params.to,
    subject: `Copia di sicurezza ordini — ${params.shopName} (${today})`,
    html: `<p>In allegato la copia settimanale di tutti gli ordini di ${params.shopName}, aggiornata al ${today}.</p>`,
    attachments: [
      {
        filename: `ordini-${today}.csv`,
        content: Buffer.from(params.csv).toString("base64"),
      },
    ],
  })
}
