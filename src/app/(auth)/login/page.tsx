"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { getRememberedEmail } from "@/lib/device-email"
import { getPostLoginRedirect } from "@/lib/shop-name"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { MailCheck } from "lucide-react"
import { cn } from "@/lib/utils"

export default function LoginPage() {
  const [mode, setMode] = useState<"link" | "pin">("link")

  const [email, setEmail] = useState("")
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [pinEmail, setPinEmail] = useState(() => getRememberedEmail() ?? "")
  const [editingPinEmail, setEditingPinEmail] = useState(() => !getRememberedEmail())
  const [pin, setPin] = useState("")
  const [pinLoading, setPinLoading] = useState(false)
  const [pinError, setPinError] = useState<string | null>(null)

  const router = useRouter()
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

  async function handlePinSubmit(e: React.FormEvent) {
    e.preventDefault()
    setPinLoading(true)
    setPinError(null)

    const { data, error } = await supabase.auth.signInWithPassword({
      email: pinEmail,
      password: pin,
    })

    if (error) {
      setPinError("PIN errato, riprova.")
      setPin("")
      setPinLoading(false)
      return
    }

    router.push(getPostLoginRedirect(data.user))
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-sm overflow-hidden">
        <div className="h-0.5 bg-gradient-to-r from-gold to-amber" />
        <CardHeader className="items-center text-center pt-6">
          <div className="w-8 h-8 rounded-md bg-espresso flex items-center justify-center text-xs font-bold text-cream mb-2">
            OB
          </div>
          <CardTitle className="text-xl">Oltre la Bottega</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex rounded-lg border border-border p-1 mb-4">
            <button
              type="button"
              onClick={() => setMode("link")}
              className={cn(
                "flex-1 text-sm py-1.5 rounded-md transition-colors",
                mode === "link" ? "bg-muted font-semibold text-foreground" : "text-muted-foreground"
              )}
            >
              Link via email
            </button>
            <button
              type="button"
              onClick={() => setMode("pin")}
              className={cn(
                "flex-1 text-sm py-1.5 rounded-md transition-colors",
                mode === "pin" ? "bg-muted font-semibold text-foreground" : "text-muted-foreground"
              )}
            >
              PIN
            </button>
          </div>

          {mode === "link" ? (
            sent ? (
              <div className="text-center space-y-3 py-4">
                <MailCheck className="w-8 h-8 mx-auto text-gold" strokeWidth={1.5} />
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
                  <p className="text-sm text-center text-destructive">{error}</p>
                )}
              </form>
            )
          ) : (
            <form onSubmit={handlePinSubmit} className="space-y-4">
              {editingPinEmail ? (
                <div>
                  <Label htmlFor="pin-email">Email</Label>
                  <Input
                    id="pin-email"
                    type="email"
                    value={pinEmail}
                    onChange={(e) => setPinEmail(e.target.value)}
                    placeholder="nome@esempio.it"
                    required
                    autoFocus
                  />
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Accesso come <strong>{pinEmail}</strong>.{" "}
                  <button
                    type="button"
                    onClick={() => setEditingPinEmail(true)}
                    className="underline hover:text-foreground"
                  >
                    Cambia
                  </button>
                </p>
              )}
              <div>
                <Label htmlFor="pin">PIN</Label>
                <Input
                  id="pin"
                  type="password"
                  inputMode="numeric"
                  maxLength={6}
                  value={pin}
                  onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
                  placeholder="······"
                  required
                  autoFocus={!editingPinEmail}
                />
              </div>
              <Button type="submit" className="w-full" disabled={pinLoading}>
                {pinLoading ? "Accesso in corso…" : "Accedi"}
              </Button>
              {pinError && (
                <p className="text-sm text-center text-destructive">{pinError}</p>
              )}
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
