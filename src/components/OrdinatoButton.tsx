"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { markOrdered } from "@/actions/materiali"

/** «Ho già ordinato»: sospende per 7 giorni l'avviso «Da riordinare». `onDone` sostituisce il refresh della pagina. */
export function OrdinatoButton({ id, onDone }: { id: string; onDone?: () => void }) {
  const router = useRouter()
  const [occupato, setOccupato] = useState(false)
  const [errore, setErrore] = useState<string | null>(null)

  async function click() {
    setOccupato(true)
    setErrore(null)
    try {
      const esito = await markOrdered(id)
      if (!esito.ok) {
        setErrore(esito.error)
        return
      }
      if (onDone) onDone()
      else router.refresh()
    } catch {
      setErrore("Impossibile salvare. Riprova.")
    } finally {
      setOccupato(false)
    }
  }

  return (
    <span className="inline-flex flex-col items-start gap-1">
      <Button variant="outline" size="sm" onClick={click} disabled={occupato}>
        {occupato ? "Salvo…" : "Ho già ordinato"}
      </Button>
      {errore && <span className="text-xs text-destructive">{errore}</span>}
    </span>
  )
}
