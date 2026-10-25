"use client"

import { useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { Loader2, Plus, Trash2, Upload } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ErrorMessage } from "@/components/ErrorMessage"
import { extractDocument } from "@/actions/materialiDocumento"
import { saveMaterials } from "@/actions/materiali"
import { resizeImage } from "@/lib/imageResize"
import { MAX_FILE_BYTES } from "@/lib/documentoFornitore"
import {
  checkRow,
  classifyRow,
  formatDiscounts,
  formatPrezzo,
  netPrice,
  parseDiscounts,
  parsePrice,
  round3,
  todayIso,
  type Materiale,
  type RigaDocumento,
} from "@/lib/materiali"
import { cn } from "@/lib/utils"

type RigaForm = {
  key: number
  codice: string
  nome: string
  unita: string
  quantita: number | null // solo per il controllo, non si salva
  prezzo: string // listino, prima degli sconti
  sconti: string // "50 + 20": sconti a cascata in percentuale
  importo: number | null // solo per il controllo, non si salva
}

type Fase = "chiusa" | "lettura" | "controllo"

const MSG_LETTURA_FALLITA = "Non sono riuscito a leggere il documento. Puoi inserire le righe a mano."

export function MaterialiImport({ esistenti }: { esistenti: Materiale[] }) {
  const router = useRouter()
  const fileRef = useRef<HTMLInputElement>(null)
  const prossimaChiave = useRef(1)
  const [fase, setFase] = useState<Fase>("chiusa")
  const [errore, setErrore] = useState<string | null>(null)
  const [messaggio, setMessaggio] = useState<string | null>(null)
  const [fornitore, setFornitore] = useState("")
  const [data, setData] = useState(todayIso())
  const [righe, setRighe] = useState<RigaForm[]>([])
  const [salvataggio, setSalvataggio] = useState(false)

  function nuovaRiga(): RigaForm {
    return { key: prossimaChiave.current++, codice: "", nome: "", unita: "", quantita: null, prezzo: "", sconti: "", importo: null }
  }

  function apriControllo(opzioni: { fornitore?: string; data?: string; righe?: RigaForm[]; errore?: string | null }) {
    setFornitore(opzioni.fornitore ?? "")
    setData(opzioni.data ?? todayIso())
    setRighe(opzioni.righe && opzioni.righe.length > 0 ? opzioni.righe : [nuovaRiga()])
    setErrore(opzioni.errore ?? null)
    setMessaggio(null)
    setFase("controllo")
  }

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const originale = e.target.files?.[0]
    e.target.value = ""
    if (!originale) return

    setErrore(null)
    setMessaggio(null)
    setFase("lettura")

    try {
      const file = originale.type.startsWith("image/") ? await resizeImage(originale) : originale
      if (file.size > MAX_FILE_BYTES) {
        apriControllo({ errore: "Il file è troppo grande (massimo 4 MB). Puoi inserire le righe a mano." })
        return
      }
      const fd = new FormData()
      fd.append("file", file)
      const risultato = await extractDocument(fd)
      if (!risultato.ok) {
        apriControllo({ errore: risultato.error })
        return
      }
      const { documento } = risultato
      const lette: RigaForm[] = documento.righe.map((r) => ({
        key: prossimaChiave.current++,
        codice: r.codice ?? "",
        nome: r.nome,
        unita: r.unita ?? "",
        quantita: r.quantita,
        prezzo: formatPrezzo(r.prezzo),
        sconti: formatDiscounts(r.sconti),
        importo: r.importo,
      }))
      apriControllo({
        fornitore: documento.fornitore,
        data: documento.data ?? todayIso(),
        righe: lette,
        errore: lette.length === 0 ? "Non ho trovato righe nel documento. Puoi aggiungerle a mano." : null,
      })
    } catch {
      apriControllo({ errore: MSG_LETTURA_FALLITA })
    }
  }

  function aggiorna(key: number, campo: keyof RigaForm, valore: string) {
    setRighe((rs) => rs.map((r) => (r.key === key ? { ...r, [campo]: valore } : r)))
  }

  // Il prezzo che si salva è il NETTO (listino meno gli sconti a cascata): è il costo vero.
  // Il controllo "quantità × prezzo = importo" usa il netto non arrotondato.
  function calcola(r: RigaForm): { riga: RigaDocumento; nettoEsatto: number } | null {
    const listino = parsePrice(r.prezzo)
    const sconti = parseDiscounts(r.sconti)
    if (listino === null || sconti === null || !r.nome.trim()) return null
    const nettoEsatto = netPrice(listino, sconti)
    return {
      nettoEsatto,
      riga: {
        codice: r.codice.trim() || null,
        nome: r.nome.trim(),
        unita: r.unita.trim() || null,
        quantita: r.quantita,
        prezzo: round3(nettoEsatto),
        importo: r.importo,
      },
    }
  }

  function toRigaDocumento(r: RigaForm): RigaDocumento | null {
    return calcola(r)?.riga ?? null
  }

  async function conferma() {
    setErrore(null)
    if (!fornitore.trim()) {
      setErrore("Scrivi il nome del fornitore.")
      return
    }
    const nonValide = righe.some((r) => !rigaVuota(r) && toRigaDocumento(r) === null)
    if (nonValide) {
      setErrore("Alcune righe non hanno nome, prezzo o sconti validi: correggile o toglile.")
      return
    }
    const daSalvare = righe.flatMap((r) => {
      const riga = toRigaDocumento(r)
      return riga ? [{ codice: riga.codice, nome: riga.nome, unita: riga.unita, prezzo: riga.prezzo }] : []
    })
    if (daSalvare.length === 0) {
      setErrore("Aggiungi almeno un materiale con nome e prezzo.")
      return
    }

    setSalvataggio(true)
    try {
      const esito = await saveMaterials({ fornitore, data, righe: daSalvare })
      if (!esito.ok) {
        setErrore(esito.error)
        return
      }
      setFase("chiusa")
      setMessaggio(`Salvato: ${esito.nuovi} nuovi, ${esito.aggiornati} aggiornati.`)
      router.refresh()
    } catch {
      setErrore("Impossibile salvare i dati. Controlla la connessione e riprova.")
    } finally {
      setSalvataggio(false)
    }
  }

  if (fase === "lettura") {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-3 text-sm">
        <Loader2 className="w-4 h-4 animate-spin" />
        Sto leggendo il documento…
      </div>
    )
  }

  if (fase === "chiusa") {
    return (
      <div className="space-y-3">
        <div className="flex flex-wrap gap-2">
          <input ref={fileRef} type="file" accept="application/pdf,image/*" className="hidden" onChange={onFile} />
          <Button onClick={() => fileRef.current?.click()}>
            <Upload className="w-4 h-4" /> Carica documento
          </Button>
          <Button variant="outline" onClick={() => apriControllo({})}>
            <Plus className="w-4 h-4" /> Aggiungi a mano
          </Button>
        </div>
        {messaggio && <p className="text-sm text-bark">{messaggio}</p>}
      </div>
    )
  }

  return (
    <div className="space-y-4 rounded-lg border border-border bg-card p-4">
      {errore && <ErrorMessage message={errore} />}

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <Label htmlFor="fornitore">Fornitore</Label>
          <Input id="fornitore" value={fornitore} onChange={(e) => setFornitore(e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label htmlFor="data-acquisto">Data acquisto</Label>
          <Input id="data-acquisto" type="date" value={data} onChange={(e) => setData(e.target.value)} />
        </div>
      </div>

      <div className="scroll-visibile">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              <th className="px-2 py-2">Codice</th>
              <th className="px-2 py-2">Materiale</th>
              <th className="px-2 py-2">Unità</th>
              <th className="px-2 py-2">Listino € (senza IVA)</th>
              <th className="px-2 py-2">Sconti %</th>
              <th className="px-2 py-2" title="Costo dopo gli sconti: è il prezzo che si salva">Netto €</th>
              <th className="px-2 py-2">Controllo</th>
              <th className="px-2 py-2" />
            </tr>
          </thead>
          <tbody>
            {righe.map((r) => {
              const calcolo = calcola(r)
              const riga = calcolo?.riga ?? null
              const stato = riga ? classifyRow(esistenti, fornitore, riga) : null
              const torna = riga && calcolo ? checkRow({ quantita: riga.quantita, prezzo: calcolo.nettoEsatto, importo: riga.importo }) : true
              return (
                <tr key={r.key} className="border-b last:border-0 align-top">
                  <td className="px-2 py-2 w-40">
                    <Input value={r.codice} onChange={(e) => aggiorna(r.key, "codice", e.target.value)} aria-label="Codice" />
                  </td>
                  <td className="px-2 py-2 min-w-72">
                    <Input value={r.nome} onChange={(e) => aggiorna(r.key, "nome", e.target.value)} aria-label="Materiale" />
                  </td>
                  <td className="px-2 py-2 w-20">
                    <Input value={r.unita} onChange={(e) => aggiorna(r.key, "unita", e.target.value)} aria-label="Unità" />
                  </td>
                  <td className="px-2 py-2 w-32">
                    <Input
                      inputMode="decimal"
                      value={r.prezzo}
                      onChange={(e) => aggiorna(r.key, "prezzo", e.target.value)}
                      aria-label="Prezzo"
                    />
                  </td>
                  <td className="px-2 py-2 w-28">
                    <Input
                      value={r.sconti}
                      onChange={(e) => aggiorna(r.key, "sconti", e.target.value)}
                      placeholder="es. 50 + 20"
                      aria-label="Sconti"
                    />
                  </td>
                  <td className="px-2 py-2 w-24 whitespace-nowrap font-semibold">
                    {riga ? formatPrezzo(riga.prezzo) : "—"}
                  </td>
                  <td className="px-2 py-2">
                    <div className="flex flex-col items-start gap-1">
                      {stato?.tipo === "nuovo" && <Etichetta className="bg-linen text-bark">Nuovo</Etichetta>}
                      {stato?.tipo === "invariato" && <Etichetta className="bg-muted text-muted-foreground">Invariato</Etichetta>}
                      {stato?.tipo === "variato" && (
                        <Etichetta className="bg-linen text-espresso font-semibold">Variato (era {formatPrezzo(stato.era)})</Etichetta>
                      )}
                      {!riga && !rigaVuota(r) && (
                        <Etichetta className="bg-honey text-espresso">Nome, prezzo o sconti non validi</Etichetta>
                      )}
                      {!torna && (
                        <Etichetta className="bg-honey text-espresso">
                          Non torna: {riga?.quantita} × {riga ? formatPrezzo(riga.prezzo) : ""} ≠ {riga?.importo}
                        </Etichetta>
                      )}
                    </div>
                  </td>
                  <td className="px-2 py-2">
                    <Button
                      variant="outline"
                      size="sm"
                      aria-label="Togli riga"
                      onClick={() => setRighe((rs) => rs.filter((x) => x.key !== r.key))}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button variant="outline" onClick={() => setRighe((rs) => [...rs, nuovaRiga()])}>
          <Plus className="w-4 h-4" /> Aggiungi riga
        </Button>
        <Button onClick={conferma} disabled={salvataggio}>
          {salvataggio ? "Salvo…" : "Conferma e salva"}
        </Button>
        <Button variant="outline" onClick={() => setFase("chiusa")} disabled={salvataggio}>
          Annulla
        </Button>
      </div>
    </div>
  )
}

// Una riga è vuota se non c'è scritto nulla: si ignora senza segnalare errori
function rigaVuota(r: RigaForm): boolean {
  return !r.codice.trim() && !r.nome.trim() && !r.unita.trim() && !r.prezzo.trim() && !r.sconti.trim()
}

function Etichetta({ className, children }: { className?: string; children: React.ReactNode }) {
  return <span className={cn("inline-block rounded px-2 py-0.5 text-xs", className)}>{children}</span>
}
