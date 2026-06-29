"use client"

import { useEffect, useState } from "react"
import { QRCodeSVG } from "qrcode.react"

interface Props {
  orderId: string
  nome: string
  cognome: string | null
  telefono: string | null
  dataConsegna: string | null
}

export function PrintClient({ orderId, nome, cognome, telefono, dataConsegna }: Props) {
  const [url, setUrl] = useState("")

  useEffect(() => {
    const origin = window.location.origin
    setUrl(`${origin}/orders/${orderId}`)
    const timer = setTimeout(() => window.print(), 400)
    return () => clearTimeout(timer)
  }, [orderId])

  const clientName = [nome, cognome].filter(Boolean).join(" ")

  const date = dataConsegna
    ? new Date(dataConsegna).toLocaleDateString("it-IT", { day: "2-digit", month: "short", year: "numeric" })
    : null

  return (
    <div style={{
      fontFamily: "monospace",
      fontSize: "13px",
      width: "58mm",
      padding: "3mm",
      lineHeight: 1.4,
    }}>
      <p style={{ fontWeight: "bold", fontSize: "16px", margin: "0 0 4px 0" }}>{clientName}</p>
      {telefono && <p style={{ margin: "0 0 3px 0" }}>{telefono}</p>}
      {date && <p style={{ margin: "0 0 8px 0" }}>{date}</p>}
      {url && <QRCodeSVG value={url} size={90} />}
    </div>
  )
}
