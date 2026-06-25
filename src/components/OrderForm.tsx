"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { createOrder } from "@/actions/orders"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { ErrorMessage } from "@/components/ErrorMessage"
import { toUserMessage } from "@/lib/errors"

interface CustomerOption {
  id: string
  name: string
}

export function OrderForm({ customers }: { customers: CustomerOption[] }) {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [customerId, setCustomerId] = useState<string>("")
  const [priority, setPriority] = useState<string>("normale")

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setSaving(true)
    setError(null)
    const fd = new FormData(e.currentTarget)

    try {
      const result = await createOrder({
        title: fd.get("title") as string,
        customer_id: customerId || null,
        description: (fd.get("description") as string) || null,
        priority: priority as "normale" | "alta" | "urgente",
        due_date: (fd.get("due_date") as string) || null,
        amount_estimated: fd.get("amount_estimated")
          ? Number(fd.get("amount_estimated"))
          : null,
        payment_status: "non_pagato",
      })
      router.push(`/orders/${result.id}`)
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
        <Label htmlFor="title">Lavorazione *</Label>
        <Input
          id="title"
          name="title"
          required
          placeholder="es. Riparazione borsa pelle"
        />
      </div>

      <div>
        <Label htmlFor="customer">Cliente</Label>
        <Select value={customerId} onValueChange={(v) => setCustomerId(v ?? "")}>
          <SelectTrigger id="customer">
            <SelectValue placeholder="Seleziona cliente (opzionale)" />
          </SelectTrigger>
          <SelectContent>
            {customers.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <Label htmlFor="due_date">Data consegna</Label>
          <Input id="due_date" name="due_date" type="date" />
        </div>
        <div>
          <Label htmlFor="priority">Priorità</Label>
          <Select value={priority} onValueChange={(v) => setPriority(v ?? "normale")}>
            <SelectTrigger id="priority">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="normale">Normale</SelectItem>
              <SelectItem value="alta">Alta</SelectItem>
              <SelectItem value="urgente">Urgente</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div>
        <Label htmlFor="amount_estimated">Prezzo stimato (€)</Label>
        <Input
          id="amount_estimated"
          name="amount_estimated"
          type="number"
          step="0.01"
          min="0"
          placeholder="0.00"
        />
      </div>

      <div>
        <Label htmlFor="description">Note</Label>
        <Textarea
          id="description"
          name="description"
          rows={3}
          placeholder="Dettagli sulla lavorazione…"
        />
      </div>

      <div className="flex gap-3">
        <Button type="submit" disabled={saving}>
          {saving ? "Salvataggio…" : "Crea ordine"}
        </Button>
        <Button type="button" variant="outline" onClick={() => router.back()}>
          Annulla
        </Button>
      </div>
    </form>
  )
}
