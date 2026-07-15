"use client"

import { useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { X } from "lucide-react"
import { addOperatorName, removeOperatorName } from "@/lib/operators"

interface Props {
  initialOperatori: string[]
}

export function OperatoriSettings({ initialOperatori }: Props) {
  const [operatori, setOperatori] = useState(initialOperatori)
  const [nome, setNome] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const supabase = createClient()

  async function persist(next: string[]): Promise<boolean> {
    setSaving(true)
    setError(null)
    const { error: err } = await supabase.auth.updateUser({ data: { operatori: next } })
    setSaving(false)
    if (err) {
      setError("Errore durante il salvataggio. Riprova.")
      return false
    }
    setOperatori(next)
    return true
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    const next = addOperatorName(operatori, nome)
    if (next === operatori) {
      setError(nome.trim() ? "Questo nome è già in elenco." : null)
      return
    }
    const success = await persist(next)
    if (success) {
      setNome("")
    }
  }

  async function handleRemove(name: string) {
    await persist(removeOperatorName(operatori, name))
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Operatori</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-muted-foreground">
          Elenco dei nomi selezionabili come &quot;chi ha preso l&apos;ordine&quot; nel form nuovo ordine.
        </p>
        {operatori.length > 0 && (
          <ul className="flex flex-wrap gap-2">
            {operatori.map((o) => (
              <li key={o} className="flex items-center gap-1 rounded-full border border-border bg-muted px-3 py-1 text-sm">
                {o}
                <button
                  type="button"
                  onClick={() => handleRemove(o)}
                  disabled={saving}
                  aria-label={`Rimuovi ${o}`}
                  className="text-muted-foreground hover:text-foreground"
                >
                  <X className="w-3 h-3" />
                </button>
              </li>
            ))}
          </ul>
        )}
        <form onSubmit={handleAdd} className="flex gap-2">
          <Input
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            placeholder="Nome operatore"
            disabled={saving}
          />
          <Button type="submit" disabled={saving}>Aggiungi</Button>
        </form>
        {error && <p className="text-sm text-destructive">{error}</p>}
      </CardContent>
    </Card>
  )
}
