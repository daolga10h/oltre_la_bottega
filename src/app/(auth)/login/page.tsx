"use client"

import { useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"

export default function LoginPage() {
  const [email, setEmail] = useState("")
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const supabase = createClient()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${location.origin}/auth/callback` },
    })

    if (error) {
      setError("Si è verificato un errore. Riprova tra qualche secondo.")
    } else {
      setSent(true)
    }
    setLoading(false)
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle className="text-xl">Oltre la Bottega</CardTitle>
          {!sent && (
            <p className="text-sm text-muted-foreground">
              Inserisci la tua email per accedere
            </p>
          )}
        </CardHeader>
        <CardContent>
          {sent ? (
            <div className="text-center space-y-3 py-4">
              <p className="text-2xl">📧</p>
              <p className="font-medium">Controlla la tua email</p>
              <p className="text-sm text-muted-foreground">
                Ti abbiamo inviato un link a <strong>{email}</strong>.
                Clicca il link per entrare.
              </p>
              <button
                onClick={() => { setSent(false); setEmail("") }}
                className="text-xs text-muted-foreground hover:text-foreground underline mt-2"
              >
                Usa un&apos;altra email
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="nome@esempio.it"
                  required
                  autoFocus
                />
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? "Invio in corso…" : "Invia link di accesso"}
              </Button>
              {error && (
                <p className="text-sm text-center text-red-600">{error}</p>
              )}
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
