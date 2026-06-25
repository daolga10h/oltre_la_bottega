"use client"

import { useState, useEffect, useRef } from "react"
import { createClient } from "@/lib/supabase/client"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"

const EMAIL_KEY = "oltreBottegaEmail"

type Screen = "email" | "pin"

export default function LoginPage() {
  const [screen, setScreen] = useState<Screen>("email")
  const [savedEmail, setSavedEmail] = useState("")
  const [email, setEmail] = useState("")
  const [pin, setPin] = useState("")
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<{ text: string; error: boolean } | null>(null)
  const pinInputRef = useRef<HTMLInputElement>(null)
  const supabase = createClient()

  useEffect(() => {
    const stored = localStorage.getItem(EMAIL_KEY)
    if (stored) {
      setSavedEmail(stored)
      setScreen("pin")
    }
  }, [])

  useEffect(() => {
    if (screen === "pin") {
      setTimeout(() => pinInputRef.current?.focus(), 100)
    }
  }, [screen])

  async function handleEmailSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setMessage(null)
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${location.origin}/auth/callback` },
    })
    if (error) {
      setMessage({ text: "Si è verificato un errore. Riprova.", error: true })
    } else {
      setMessage({
        text: "Controlla la tua email — ti abbiamo inviato un link per accedere.",
        error: false,
      })
    }
    setLoading(false)
  }

  async function handlePinSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (pin.length !== 6) return
    setLoading(true)
    setMessage(null)
    const { error } = await supabase.auth.signInWithPassword({
      email: savedEmail,
      password: pin,
    })
    if (error) {
      setMessage({ text: "PIN non corretto. Riprova.", error: true })
      setPin("")
      setTimeout(() => pinInputRef.current?.focus(), 100)
    } else {
      window.location.href = "/dashboard"
    }
    setLoading(false)
  }

  function forgotPin() {
    localStorage.removeItem(EMAIL_KEY)
    setSavedEmail("")
    setPin("")
    setScreen("email")
    setMessage(null)
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
      <Card className="w-full max-w-sm">
        {screen === "email" ? (
          <>
            <CardHeader>
              <CardTitle className="text-xl">Oltre la Bottega</CardTitle>
              <p className="text-sm text-slate-500">
                Inserisci la tua email per ricevere il link di accesso
              </p>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleEmailSubmit} className="space-y-4">
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
                {message && (
                  <p className={`text-sm text-center ${message.error ? "text-red-600" : "text-slate-500"}`}>
                    {message.text}
                  </p>
                )}
              </form>
            </CardContent>
          </>
        ) : (
          <>
            <CardHeader>
              <CardTitle className="text-xl">Bentornata</CardTitle>
              <p className="text-sm text-slate-500">Inserisci il tuo PIN per accedere</p>
            </CardHeader>
            <CardContent>
              <form onSubmit={handlePinSubmit} className="space-y-6">
                <div className="flex justify-center gap-3 py-4">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <div
                      key={i}
                      className={`w-4 h-4 rounded-full border-2 transition-colors ${
                        i < pin.length
                          ? "bg-slate-900 border-slate-900"
                          : "border-slate-300"
                      }`}
                    />
                  ))}
                </div>
                <input
                  ref={pinInputRef}
                  type="number"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  value={pin}
                  onChange={(e) => {
                    const val = e.target.value.replace(/\D/g, "").slice(0, 6)
                    setPin(val)
                    if (val.length === 6) {
                      setTimeout(() => {
                        const form = e.target.closest("form")
                        form?.requestSubmit()
                      }, 100)
                    }
                  }}
                  maxLength={6}
                  className="sr-only"
                  aria-label="PIN"
                  autoComplete="current-password"
                />
                <div className="grid grid-cols-3 gap-3">
                  {[1,2,3,4,5,6,7,8,9,"",0,"⌫"].map((k, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => {
                        if (k === "⌫") {
                          setPin((p) => p.slice(0, -1))
                        } else if (k !== "" && pin.length < 6) {
                          const newPin = pin + String(k)
                          setPin(newPin)
                          if (newPin.length === 6) {
                            setTimeout(() => {
                              supabase.auth
                                .signInWithPassword({ email: savedEmail, password: newPin })
                                .then(({ error }) => {
                                  if (error) {
                                    setMessage({ text: "PIN non corretto. Riprova.", error: true })
                                    setPin("")
                                  } else {
                                    window.location.href = "/dashboard"
                                  }
                                  setLoading(false)
                                })
                              setLoading(true)
                            }, 150)
                          }
                        }
                      }}
                      disabled={loading || k === ""}
                      className={`h-14 rounded-xl text-xl font-medium transition-colors ${
                        k === ""
                          ? "invisible"
                          : k === "⌫"
                          ? "bg-slate-100 hover:bg-slate-200 text-slate-600"
                          : "bg-slate-100 hover:bg-slate-200 active:bg-slate-300"
                      }`}
                    >
                      {k}
                    </button>
                  ))}
                </div>
                {message && (
                  <p className={`text-sm text-center ${message.error ? "text-red-600" : "text-slate-500"}`}>
                    {message.text}
                  </p>
                )}
                <button
                  type="button"
                  onClick={forgotPin}
                  className="w-full text-xs text-slate-400 hover:text-slate-600 text-center pt-2"
                >
                  PIN dimenticato? Usa il link via email
                </button>
              </form>
            </CardContent>
          </>
        )}
      </Card>
    </div>
  )
}
