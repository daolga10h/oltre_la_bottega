"use client"

import { useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"

interface Props {
  initialShopName: string
}

export function ShopNameSettings({ initialShopName }: Props) {
  const [shopName, setShopName] = useState(initialShopName)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const supabase = createClient()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const trimmed = shopName.trim()
    if (!trimmed) {
      setError("Inserisci il nome della bottega")
      return
    }

    setSaving(true)
    setError(null)
    setSaved(false)
    const { error: err } = await supabase.auth.updateUser({ data: { shop_name: trimmed } })
    setSaving(false)
    if (err) {
      setError("Errore durante il salvataggio. Riprova.")
      return
    }
    setShopName(trimmed)
    setSaved(true)
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Nome bottega</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-muted-foreground">
          Compare sull&apos;etichetta di stampa e nei messaggi WhatsApp/email al cliente.
        </p>
        <form onSubmit={handleSubmit} className="flex gap-2">
          <Input
            value={shopName}
            onChange={(e) => {
              setShopName(e.target.value)
              setSaved(false)
            }}
            placeholder="Es. Frida's Studio"
            disabled={saving}
          />
          <Button type="submit" disabled={saving}>Salva</Button>
        </form>
        {error && <p className="text-sm text-destructive">{error}</p>}
        {saved && <p className="text-sm text-sage">Salvato.</p>}
      </CardContent>
    </Card>
  )
}
