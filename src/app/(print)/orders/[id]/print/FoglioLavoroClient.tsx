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
  articoli: { cosa_ordinato: string; quantita: number }[]
  dataConsegna: string | null
  saldo: number
  shopName: string
}

/**
 * Foglio lavoro per stampante normale: mezzo foglio A4 (210×148 mm) nella metà
 * superiore della pagina, da allegare alla busta o al lavoro. Stessi dati e
 * stesso QR dell'etichetta termica, caratteri più grandi.
 */
export function FoglioLavoroClient({ orderId, nome, cognome, azienda, referente, telefono, articoli, dataConsegna, saldo, shopName }: Props) {
  const [url, setUrl] = useState("")

  useEffect(() => {
    setUrl(`${window.location.origin}/orders/${orderId}`)
    const timer = setTimeout(() => window.print(), 400)
    return () => clearTimeout(timer)
  }, [orderId])

  const clientName = [nome, cognome].filter(Boolean).join(" ")

  const date = dataConsegna
    ? new Date(dataConsegna).toLocaleDateString("it-IT", { day: "2-digit", month: "long", year: "numeric" })
    : null

  return (
    <div
      data-testid="foglio-lavoro"
      style={{
        width: "210mm",
        height: "148mm",
        boxSizing: "border-box",
        padding: "12mm",
        display: "flex",
        justifyContent: "space-between",
        gap: "12mm",
        fontFamily: "Arial, Helvetica, sans-serif",
        fontSize: "18px",
        lineHeight: 1.4,
        borderBottom: "1px dashed #999",
      }}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "10px", paddingBottom: "8px", borderBottom: "2px solid #000" }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/icon-mono.png" alt="" style={{ width: "28px", height: "28px", display: "block" }} />
          <span style={{ fontSize: "16px", fontWeight: "bold", letterSpacing: "0.5px" }}>{shopName}</span>
        </div>
        <p style={{ fontWeight: "bold", fontSize: "32px", margin: "0 0 6px 0" }}>{clientName}</p>
        {azienda && <p style={{ fontSize: "20px", margin: "0 0 4px 0" }}>{azienda}</p>}
        {referente && <p style={{ fontSize: "20px", margin: "0 0 4px 0" }}>Ref. {referente}</p>}
        {telefono && <p style={{ fontSize: "22px", margin: "0 0 12px 0" }}>{telefono}</p>}
        {articoli.length > 0 && (
          <div style={{ margin: "0 0 12px 0", fontSize: "22px" }}>
            {articoli.map((a, i) => (
              <p key={i} style={{ margin: 0 }}>
                {articoli.length > 1 ? "• " : ""}{a.cosa_ordinato}{a.quantita > 1 ? ` × ${a.quantita}` : ""}
              </p>
            ))}
          </div>
        )}
        {date && <p style={{ fontSize: "24px", fontWeight: "bold", margin: "0 0 6px 0" }}>Consegnare: {date}</p>}
        <p style={{ fontSize: "24px", fontWeight: "bold", margin: 0 }}>Da pagare: €{formatEUR(saldo)}</p>
      </div>
      <div style={{ flexShrink: 0, textAlign: "center" }}>
        {url && <QRCodeSVG value={url} size={170} />}
        <p style={{ fontSize: "12px", margin: "6px 0 0 0" }}>Scansiona per aprire la scheda</p>
      </div>
    </div>
  )
}
