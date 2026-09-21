"use client"

import { useEffect, useState } from "react"
import { QRCodeSVG } from "qrcode.react"
import { formatEUR } from "@/lib/utils"

interface Props {
  orderId: string
  nome: string
  cognome: string | null
  azienda: string | null
  referente: string | null
  telefono: string | null
  dataConsegna: string | null
  saldo: number
  shopName: string
}

export function PrintClient({ orderId, nome, cognome, azienda, referente, telefono, dataConsegna, saldo, shopName }: Props) {
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
      width: "62mm",
      padding: "3mm",
      lineHeight: 1.4,
    }}>
      <div style={{
        display: "flex",
        alignItems: "center",
        gap: "4px",
        marginBottom: "5px",
        paddingBottom: "4px",
        borderBottom: "1px solid #000",
      }}>
        <img src="/icon-mono.png" alt="" style={{ width: "14px", height: "14px", display: "block" }} />
        <span style={{ fontSize: "10px", fontWeight: "bold", letterSpacing: "0.3px" }}>{shopName}</span>
      </div>
      <p style={{ fontWeight: "bold", fontSize: "16px", margin: "0 0 4px 0" }}>{clientName}</p>
      {azienda && <p style={{ fontSize: "11px", margin: "0 0 3px 0" }}>{azienda}</p>}
      {referente && <p style={{ fontSize: "11px", margin: "0 0 3px 0" }}>Ref. {referente}</p>}
      {telefono && <p style={{ margin: "0 0 3px 0" }}>{telefono}</p>}
      {date && <p style={{ margin: "0 0 3px 0" }}>Consegnare: {date}</p>}
      <p style={{ fontWeight: "bold", margin: "0 0 8px 0" }}>Da pagare: €{formatEUR(saldo)}</p>
      {url && <QRCodeSVG value={url} size={90} />}
    </div>
  )
}
