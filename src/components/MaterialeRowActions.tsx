"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ErrorMessage } from "@/components/ErrorMessage"
import { deleteMaterial, updateMaterial } from "@/actions/materiali"
import { formatPrezzo, parsePrice, type Materiale } from "@/lib/materiali"

export function MaterialeRowActions({ materiale }: { materiale: Materiale }) {
  const router = useRouter()
  const [modifica, setModifica] = useState(false)
  const [nome, setNome] = useState(materiale.nome)
  const [unita, setUnita] = useState(materiale.unita ?? "")
  const [attuale, setAttuale] = useState(formatPrezzo(materiale.prezzo_attuale))
  const [precedente, setPrecedente] = useState(
    materiale.prezzo_precedente === null ? "" : formatPrezzo(materiale.prezzo_precedente)
  )
  const [errore, setErrore] = useState<string | null>(null)
  const [occupato, setOccupato] = useState(false)

  async function salva() {
    setErrore(null)
    const prezzoAttuale = parsePrice(attuale)
    const prezzoPrecedente = precedente.trim() === "" ? null : parsePrice(precedente)
    if (prezzoAttuale === null || (precedente.trim() !== "" && prezzoPrecedente === null)) {
      setErrore("Controlla i prezzi.")
      return
    }
    setOccupato(true)
    try {
      const esito = await updateMaterial(materiale.id, {
        nome,
        unita: unita.trim() || null,
        prezzo_attuale: prezzoAttuale,
        prezzo_precedente: prezzoPrecedente,
      })
      if (!esito.ok) {
        setErrore(esito.error)
        return
      }
      setModifica(false)
      router.refresh()
    } catch {
      setErrore("Impossibile salvare i dati. Controlla la connessione e riprova.")
    } finally {
      setOccupato(false)
    }
  }

  async function elimina() {
    if (!window.confirm("Eliminare questo materiale dall'elenco?")) return
    setOccupato(true)
    try {
      const esito = await deleteMaterial(materiale.id)
      if (!esito.ok) {
        setErrore(esito.error)
        return
      }
      router.refresh()
    } catch {
      setErrore("Impossibile eliminare. Riprova.")
    } finally {
      setOccupato(false)
    }
  }

  if (!modifica) {
    return (
      <div className="flex gap-1">
        <Button variant="outline" size="sm" onClick={() => setModifica(true)}>
          Modifica
        </Button>
        <Button variant="outline" size="sm" onClick={elimina} disabled={occupato}>
          Elimina
        </Button>
        {errore && <ErrorMessage message={errore} className="ml-2" />}
      </div>
    )
  }

  return (
    <div className="space-y-2 min-w-56">
      {errore && <ErrorMessage message={errore} />}
      <Input value={nome} onChange={(e) => setNome(e.target.value)} aria-label="Materiale" />
      <div className="grid grid-cols-3 gap-2">
        <Input value={unita} onChange={(e) => setUnita(e.target.value)} placeholder="Unità" aria-label="Unità" />
        <Input inputMode="decimal" value={attuale} onChange={(e) => setAttuale(e.target.value)} placeholder="Attuale" aria-label="Prezzo attuale" />
        <Input inputMode="decimal" value={precedente} onChange={(e) => setPrecedente(e.target.value)} placeholder="Precedente" aria-label="Prezzo precedente" />
      </div>
      <div className="flex gap-1">
        <Button size="sm" onClick={salva} disabled={occupato}>
          Salva
        </Button>
        <Button variant="outline" size="sm" onClick={() => setModifica(false)} disabled={occupato}>
          Annulla
        </Button>
      </div>
    </div>
  )
}
