"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ErrorMessage } from "@/components/ErrorMessage"
import { deleteMaterial, setStock, updateMaterial } from "@/actions/materiali"
import { computeStock, formatPrezzo, formatQuantita, parsePrice, type Materiale } from "@/lib/materiali"

export function MaterialeRowActions({ materiale }: { materiale: Materiale }) {
  const router = useRouter()
  const [modifica, setModifica] = useState(false)
  const [nome, setNome] = useState(materiale.nome)
  const [unita, setUnita] = useState(materiale.unita ?? "")
  const [attuale, setAttuale] = useState(formatPrezzo(materiale.prezzo_attuale))
  const [precedente, setPrecedente] = useState(
    materiale.prezzo_precedente === null ? "" : formatPrezzo(materiale.prezzo_precedente)
  )
  const [inMagazzino, setInMagazzino] = useState(materiale.in_magazzino)
  const [giacenza, setGiacenza] = useState(formatQuantita(computeStock(materiale)))
  const [soglia, setSoglia] = useState(materiale.soglia === null ? "" : formatQuantita(materiale.soglia))
  const [errore, setErrore] = useState<string | null>(null)
  const [occupato, setOccupato] = useState(false)

  // Rilegge i valori correnti ogni volta che si apre il modulo, così non restano dati vecchi
  function apri() {
    setNome(materiale.nome)
    setUnita(materiale.unita ?? "")
    setAttuale(formatPrezzo(materiale.prezzo_attuale))
    setPrecedente(materiale.prezzo_precedente === null ? "" : formatPrezzo(materiale.prezzo_precedente))
    setInMagazzino(materiale.in_magazzino)
    setGiacenza(formatQuantita(computeStock(materiale)))
    setSoglia(materiale.soglia === null ? "" : formatQuantita(materiale.soglia))
    setErrore(null)
    setModifica(true)
  }

  async function salva() {
    setErrore(null)
    const prezzoAttuale = parsePrice(attuale)
    const prezzoPrecedente = precedente.trim() === "" ? null : parsePrice(precedente)
    if (prezzoAttuale === null || (precedente.trim() !== "" && prezzoPrecedente === null)) {
      setErrore("Controlla i prezzi.")
      return
    }
    const scortaMinima = soglia.trim() === "" ? null : parsePrice(soglia)
    if (inMagazzino && soglia.trim() !== "" && scortaMinima === null) {
      setErrore("La scorta minima deve essere un numero.")
      return
    }
    const giacenzaContata = giacenza.trim() === "" ? null : parsePrice(giacenza)
    if (inMagazzino && giacenza.trim() !== "" && giacenzaContata === null) {
      setErrore("La giacenza deve essere un numero.")
      return
    }
    setOccupato(true)
    try {
      const esito = await updateMaterial(materiale.id, {
        nome,
        unita: unita.trim() || null,
        prezzo_attuale: prezzoAttuale,
        prezzo_precedente: prezzoPrecedente,
        in_magazzino: inMagazzino,
        soglia: inMagazzino ? scortaMinima : null,
      })
      if (!esito.ok) {
        setErrore(esito.error)
        return
      }
      // «Correggi giacenza»: solo se il valore scritto è diverso da quello calcolato
      if (inMagazzino && giacenzaContata !== null && giacenzaContata !== computeStock(materiale)) {
        const stock = await setStock(materiale.id, giacenzaContata)
        if (!stock.ok) {
          setErrore(stock.error)
          return
        }
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
        <Button variant="outline" size="sm" onClick={apri}>
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
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={inMagazzino} onChange={(e) => setInMagazzino(e.target.checked)} />
        Tieni in magazzino
      </label>
      {inMagazzino && (
        <div className="grid grid-cols-2 gap-2">
          <Input
            inputMode="decimal"
            value={giacenza}
            onChange={(e) => setGiacenza(e.target.value)}
            placeholder="Giacenza attuale"
            aria-label="Giacenza attuale"
          />
          <Input
            inputMode="decimal"
            value={soglia}
            onChange={(e) => setSoglia(e.target.value)}
            placeholder="Scorta minima"
            aria-label="Scorta minima"
          />
        </div>
      )}
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
