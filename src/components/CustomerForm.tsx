"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { createCustomer } from "@/actions/customers"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { ErrorMessage } from "@/components/ErrorMessage"
import { toUserMessage } from "@/lib/errors"

export function CustomerForm() {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setSaving(true)
    setError(null)
    const fd = new FormData(e.currentTarget)

    try {
      const result = await createCustomer({
        name: fd.get("name") as string,
        phone: (fd.get("phone") as string) || null,
        email: (fd.get("email") as string) || null,
        notes: (fd.get("notes") as string) || null,
      })
      router.push(`/customers/${result.id}`)
      router.refresh()
    } catch (err) {
      setError(toUserMessage(err))
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 max-w-lg">
      {error && <ErrorMessage message={error} />}
      <div>
        <Label htmlFor="name">Nome *</Label>
        <Input id="name" name="name" required placeholder="es. Marco Ferretti" />
      </div>
      <div>
        <Label htmlFor="phone">Telefono</Label>
        <Input id="phone" name="phone" type="tel" placeholder="+39 333 1234567" />
      </div>
      <div>
        <Label htmlFor="email">Email</Label>
        <Input id="email" name="email" type="email" placeholder="cliente@esempio.it" />
      </div>
      <div>
        <Label htmlFor="notes">Note</Label>
        <Textarea
          id="notes"
          name="notes"
          rows={3}
          placeholder="Preferenze, informazioni utili…"
        />
      </div>
      <div className="flex gap-3">
        <Button type="submit" disabled={saving}>
          {saving ? "Salvataggio…" : "Crea cliente"}
        </Button>
        <Button type="button" variant="outline" onClick={() => router.back()}>
          Annulla
        </Button>
      </div>
    </form>
  )
}
