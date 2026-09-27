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
 * Foglio lavoro per stampante normale: tutta la larghezza di un A4 (210 mm),
 * con caratteri grandi. Il contenuto sta 20 mm dentro i bordi (lati e alto):
 * non conosciamo i margini non stampabili della stampante di ogni cliente
 * (in genere 4-6 mm), 20 mm sono abbondanti. Nessun bordo sul filo del foglio,
 * verrebbe tagliato. L'altezza segue il contenuto. Stessi dati e stesso QR
 * dell'etichetta termica.
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
        boxSizing: "border-box",
        padding: "20mm",
        fontFamily: "Arial, Helvetica, sans-serif",
        fontSize: "24px",
        lineHeight: 1.4,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: "14px", marginBottom: "28px", paddingBottom: "16px", borderBottom: "3px solid #000" }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/icon-mono.png" alt="" style={{ width: "64px", height: "64px", display: "block" }} />
        {shopName && <span style={{ fontSize: "26px", fontWeight: "bold", letterSpacing: "0.5px" }}>{shopName}</span>}
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "12mm" }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontWeight: "bold", fontSize: "44px", lineHeight: 1.2, margin: "0 0 10px 0" }}>{clientName}</p>
          {azienda && <p style={{ fontSize: "26px", margin: "0 0 6px 0" }}>{azienda}</p>}
          {referente && <p style={{ fontSize: "26px", margin: "0 0 6px 0" }}>Ref. {referente}</p>}
          {telefono && <p style={{ fontSize: "30px", margin: "0 0 24px 0" }}>{telefono}</p>}
          {articoli.length > 0 && (
            <div style={{ margin: "0 0 24px 0", fontSize: "30px" }}>
              {articoli.map((a, i) => (
                <p key={i} style={{ margin: "0 0 4px 0" }}>
                  {articoli.length > 1 ? "• " : ""}{a.cosa_ordinato}{a.quantita > 1 ? ` × ${a.quantita}` : ""}
                </p>
              ))}
            </div>
          )}
          {date && <p style={{ fontSize: "34px", fontWeight: "bold", margin: "0 0 10px 0" }}>Consegnare: {date}</p>}
          <p style={{ fontSize: "34px", fontWeight: "bold", margin: 0 }}>Da pagare: €{formatEUR(saldo)}</p>
        </div>
        <div style={{ flexShrink: 0, textAlign: "center" }}>
          {url && <QRCodeSVG value={url} size={200} />}
          <p style={{ fontSize: "14px", margin: "8px 0 0 0" }}>Scansiona per aprire la scheda</p>
        </div>
      </div>
    </div>
  )
}
