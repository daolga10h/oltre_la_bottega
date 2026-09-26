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
  /** Nome della bottega da mostrare accanto al logo; null = solo il logo (livello base). */
  shopName: string | null
}

/**
 * Foglio lavoro per stampante normale: 150 mm di larghezza centrati su un A4
 * (210 mm), quindi 30 mm di margine per lato e in alto. Non conosciamo i margini
 * non stampabili della stampante di ogni cliente: 30 mm sono abbondanti.
 * L'altezza segue il contenuto. Stessi dati e stesso QR dell'etichetta termica,
 * caratteri più grandi.
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
        width: "150mm",
        margin: "30mm 30mm 0 30mm",
        boxSizing: "border-box",
        padding: "8mm",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "flex-start",
        gap: "8mm",
        fontFamily: "Arial, Helvetica, sans-serif",
        fontSize: "18px",
        lineHeight: 1.4,
        border: "1px dashed #999",
      }}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "10px", paddingBottom: "8px", borderBottom: "2px solid #000" }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/icon-mono.png" alt="" style={{ width: "40px", height: "40px", display: "block" }} />
          {shopName && <span style={{ fontSize: "16px", fontWeight: "bold", letterSpacing: "0.5px" }}>{shopName}</span>}
        </div>
        <p style={{ fontWeight: "bold", fontSize: "28px", margin: "0 0 6px 0" }}>{clientName}</p>
        {azienda && <p style={{ fontSize: "18px", margin: "0 0 4px 0" }}>{azienda}</p>}
        {referente && <p style={{ fontSize: "18px", margin: "0 0 4px 0" }}>Ref. {referente}</p>}
        {telefono && <p style={{ fontSize: "20px", margin: "0 0 12px 0" }}>{telefono}</p>}
        {articoli.length > 0 && (
          <div style={{ margin: "0 0 12px 0", fontSize: "20px" }}>
            {articoli.map((a, i) => (
              <p key={i} style={{ margin: 0 }}>
                {articoli.length > 1 ? "• " : ""}{a.cosa_ordinato}{a.quantita > 1 ? ` × ${a.quantita}` : ""}
              </p>
            ))}
          </div>
        )}
        {date && <p style={{ fontSize: "22px", fontWeight: "bold", margin: "0 0 6px 0" }}>Consegnare: {date}</p>}
        <p style={{ fontSize: "22px", fontWeight: "bold", margin: 0 }}>Da pagare: €{formatEUR(saldo)}</p>
      </div>
      <div style={{ flexShrink: 0, textAlign: "center" }}>
        {url && <QRCodeSVG value={url} size={130} />}
        <p style={{ fontSize: "11px", margin: "6px 0 0 0" }}>Scansiona per aprire la scheda</p>
      </div>
    </div>
  )
}
