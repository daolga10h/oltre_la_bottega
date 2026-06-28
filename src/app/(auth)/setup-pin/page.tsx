"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

const EMAIL_KEY = "oltreBottegaEmail"

export default function SetupPinPage() {
  const [step, setStep] = useState<"create" | "confirm">("create")
  const [pin, setPin] = useState("")
  const [firstPin, setFirstPin] = useState("")
  const [message, setMessage] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  async function handleDigit(digit: string | number) {
    if (loading) return
    if (digit === "⌫") {
      setPin((p) => p.slice(0, -1))
      return
    }
    if (pin.length >= 6) return
    const newPin = pin + String(digit)
    setPin(newPin)

    if (newPin.length === 6) {
      if (step === "create") {
        setFirstPin(newPin)
        setPin("")
        setStep("confirm")
        setMessage(null)
      } else {
        if (newPin !== firstPin) {
          setMessage("I PIN non corrispondono. Riprova.")
          setPin("")
          setStep("create")
          setFirstPin("")
          return
        }
        setLoading(true)
        const { data: { user } } = await supabase.auth.getUser()
        if (!user?.email) {
          router.push("/login")
          return
        }
        const { error } = await supabase.auth.updateUser({ password: newPin })
        if (error) {
          setMessage("Errore durante il salvataggio del PIN. Riprova.")
          setLoading(false)
          setPin("")
          setStep("create")
          setFirstPin("")
          return
        }
        await supabase.auth.updateUser({ data: { pin_set: true } })
        localStorage.setItem(EMAIL_KEY, user.email)
        router.push("/dashboard")
      }
    }
  }

  const dots = Array.from({ length: 6 })
  const title = step === "create" ? "Crea il tuo PIN" : "Conferma il PIN"
  const subtitle =
    step === "create"
      ? "Scegli 6 cifre — le userai ogni volta per accedere"
      : "Inserisci di nuovo le stesse 6 cifre"

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle className="text-xl">{title}</CardTitle>
          <p className="text-sm text-slate-500">{subtitle}</p>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex justify-center gap-3 py-4">
            {dots.map((_, i) => (
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

          <div className="grid grid-cols-3 gap-3">
            {[1,2,3,4,5,6,7,8,9,"",0,"⌫"].map((k, i) => (
              <button
                key={i}
                type="button"
                onClick={() => k !== "" && handleDigit(k)}
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
            <p className="text-sm text-center text-red-600">{message}</p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
