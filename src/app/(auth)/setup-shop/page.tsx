"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ErrorMessage } from "@/components/ErrorMessage"

export default function SetupShopPage() {
  const [shopName, setShopName] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()
  const supabase = createClient()

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const trimmed = shopName.trim()
    if (!trimmed) {
      setError("Inserisci il nome della bottega")
      return
    }

    setLoading(true)
    setError(null)

    try {
      const { error: err } = await supabase.auth.updateUser({ data: { shop_name: trimmed } })
      if (err) throw err
      router.push("/dashboard")
    } catch (err) {
      setError("Errore durante il salvataggio. Riprova.")
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle className="text-xl">Benvenuto</CardTitle>
          <p className="text-sm text-muted-foreground">Come si chiama la tua bottega?</p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && <ErrorMessage message={error} />}
            <div>
              <Label htmlFor="shopName">Nome della bottega</Label>
              <Input
                id="shopName"
                name="shopName"
                autoFocus
                required
                placeholder="Es. Frida's Studio"
                value={shopName}
                onChange={(e) => setShopName(e.target.value)}
                disabled={loading}
              />
            </div>
            <Button type="submit" disabled={loading} className="w-full">
              {loading ? "Salvataggio…" : "Continua"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
