"use client"

import { useEffect, useRef, useState } from "react"
import { Mic, MicOff } from "lucide-react"
import { buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"

interface SpeechRecognitionResultEvent {
  resultIndex: number
  results: ArrayLike<ArrayLike<{ transcript: string }>>
}

interface SpeechRecognitionErrorEvent {
  error: string
}

interface SpeechRecognitionLike {
  lang: string
  continuous: boolean
  interimResults: boolean
  onresult: ((event: SpeechRecognitionResultEvent) => void) | null
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null
  onend: (() => void) | null
  start: () => void
  stop: () => void
}

interface SpeechRecognitionConstructor {
  new (): SpeechRecognitionLike
}

function getSpeechRecognitionConstructor(): SpeechRecognitionConstructor | null {
  if (typeof window === "undefined") return null
  const w = window as unknown as {
    SpeechRecognition?: SpeechRecognitionConstructor
    webkitSpeechRecognition?: SpeechRecognitionConstructor
  }
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null
}

interface VoiceDictationButtonProps {
  onTranscript: (chunk: string) => void
  className?: string
}

export function VoiceDictationButton({ onTranscript, className }: VoiceDictationButtonProps) {
  const [supported, setSupported] = useState(false)
  const [listening, setListening] = useState(false)
  const [permissionDenied, setPermissionDenied] = useState(false)
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null)
  const onTranscriptRef = useRef(onTranscript)
  onTranscriptRef.current = onTranscript

  useEffect(() => {
    setSupported(getSpeechRecognitionConstructor() !== null)
  }, [])

  useEffect(() => {
    return () => {
      recognitionRef.current?.stop()
    }
  }, [])

  function stop() {
    recognitionRef.current?.stop()
  }

  function start() {
    const Constructor = getSpeechRecognitionConstructor()
    if (!Constructor) return

    const recognition = new Constructor()
    recognition.lang = "it-IT"
    recognition.continuous = true
    recognition.interimResults = false

    recognition.onresult = (event) => {
      // In modalita' continuous ogni evento porta solo le frasi nuove
      // riconosciute da resultIndex in poi: leggere l'intero event.results
      // ogni volta duplicherebbe le frasi gia' accodate in precedenza.
      const chunks: string[] = []
      for (let i = event.resultIndex; i < event.results.length; i++) {
        chunks.push(event.results[i][0].transcript)
      }
      const transcript = chunks.join(" ").trim()
      if (transcript) onTranscriptRef.current(transcript)
    }
    recognition.onerror = (event) => {
      if (event.error === "not-allowed") setPermissionDenied(true)
      setListening(false)
    }
    recognition.onend = () => setListening(false)

    recognitionRef.current = recognition
    setPermissionDenied(false)
    setListening(true)
    recognition.start()
  }

  if (!supported) return null

  return (
    <div className="inline-flex flex-col items-start gap-0.5">
      <button
        type="button"
        onClick={() => (listening ? stop() : start())}
        aria-label={listening ? "Ferma dettatura" : "Avvia dettatura"}
        aria-pressed={listening}
        className={cn(
          buttonVariants({ variant: listening ? "destructive" : "outline", size: "icon-sm" }),
          className
        )}
      >
        {listening ? <MicOff className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5" />}
      </button>
      {permissionDenied && <span className="text-xs text-destructive">Permesso microfono negato</span>}
    </div>
  )
}
