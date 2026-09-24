"use client"

import { useState } from "react"
import { QRCodeSVG } from "qrcode.react"
import { QrCode } from "lucide-react"
import { Button } from "@/components/ui/button"

interface WhatsAppQrProps {
  waLink: string | null
  onDone: () => void
}

export function WhatsAppQr({ waLink, onDone }: WhatsAppQrProps) {
  const [open, setOpen] = useState(false)
  const [done, setDone] = useState(false)

  if (!waLink) return null

  function handleDone() {
    setDone(true)
    onDone()
  }

  return (
    <>
      <Button type="button" variant="outline" size="sm" className="bg-card" onClick={() => setOpen((o) => !o)}>
        <QrCode className="w-3.5 h-3.5" />QR
      </Button>
      {open && (
        <div className="basis-full flex flex-wrap items-center gap-4 pt-2">
          <div className="bg-white p-3 rounded-lg border border-border">
            <QRCodeSVG value={waLink} size={132} />
          </div>
          <div className="space-y-2">
            <p className="text-xs text-bark">
              Inquadralo col telefono: si apre la chat del cliente in WhatsApp con il messaggio già scritto.
            </p>
            <Button type="button" size="sm" disabled={done} onClick={handleDone}>
              Fatto
            </Button>
          </div>
        </div>
      )}
    </>
  )
}
