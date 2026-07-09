"use client"

import { useEffect, useRef, useState } from "react"
import { Calculator } from "lucide-react"
import { applyOperator, type CalculatorOperator } from "@/lib/calculator"

export function CalculatorWidget() {
  const [open, setOpen] = useState(false)
  const [display, setDisplay] = useState("0")
  const [previous, setPrevious] = useState<number | null>(null)
  const [operator, setOperator] = useState<CalculatorOperator | null>(null)
  const [overwrite, setOverwrite] = useState(true)
  const [error, setError] = useState(false)
  const panelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function onClickOutside(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener("mousedown", onClickOutside)
    return () => document.removeEventListener("mousedown", onClickOutside)
  }, [open])

  function handleDigit(d: string) {
    if (error) {
      setError(false)
      setDisplay(d)
      setOverwrite(false)
      return
    }
    if (overwrite) {
      setDisplay(d)
      setOverwrite(false)
    } else {
      setDisplay(display === "0" ? d : display + d)
    }
  }

  function handleDecimal() {
    if (error) {
      setError(false)
      setDisplay("0.")
      setOverwrite(false)
      return
    }
    if (overwrite) {
      setDisplay("0.")
      setOverwrite(false)
      return
    }
    if (!display.includes(".")) setDisplay(display + ".")
  }

  function handleOperator(op: CalculatorOperator) {
    if (error) {
      setError(false)
      setPrevious(parseFloat(display) || 0)
      setOperator(op)
      setOverwrite(true)
      return
    }
    const current = parseFloat(display)
    if (previous !== null && operator !== null && !overwrite) {
      const result = applyOperator(previous, operator, current)
      if (result === null) {
        setError(true)
        setDisplay("Errore")
        setPrevious(null)
        setOperator(null)
        setOverwrite(true)
        return
      }
      setPrevious(result)
      setDisplay(String(result))
    } else {
      setPrevious(current)
    }
    setOperator(op)
    setOverwrite(true)
  }

  function handleEquals() {
    if (error || operator === null || previous === null) return
    const current = parseFloat(display)
    const result = applyOperator(previous, operator, current)
    if (result === null) {
      setError(true)
      setDisplay("Errore")
    } else {
      setDisplay(String(result))
    }
    setPrevious(null)
    setOperator(null)
    setOverwrite(true)
  }

  function handleClear() {
    setDisplay("0")
    setPrevious(null)
    setOperator(null)
    setOverwrite(true)
    setError(false)
  }

  const digitClass =
    "h-9 rounded-lg bg-background border border-border text-sm font-medium hover:bg-muted/60"
  const opClass =
    "h-9 rounded-lg bg-honey text-bark text-sm font-semibold hover:bg-gold/40"

  return (
    <div className="fixed left-4 bottom-20 md:bottom-4 z-50">
      {open && (
        <div
          ref={panelRef}
          className="absolute bottom-full left-0 mb-2 w-56 rounded-lg border border-border bg-card shadow-[0px_8px_24px_0px_rgba(38,27,7,0.18)] p-3 space-y-2"
        >
          <div className="h-10 rounded-lg border border-border bg-background px-3 flex items-center justify-end text-lg font-semibold text-foreground overflow-hidden">
            {display}
          </div>
          <div className="grid grid-cols-4 gap-2">
            <button type="button" onClick={() => handleDigit("7")} className={digitClass}>7</button>
            <button type="button" onClick={() => handleDigit("8")} className={digitClass}>8</button>
            <button type="button" onClick={() => handleDigit("9")} className={digitClass}>9</button>
            <button type="button" onClick={() => handleOperator("÷")} className={opClass}>÷</button>

            <button type="button" onClick={() => handleDigit("4")} className={digitClass}>4</button>
            <button type="button" onClick={() => handleDigit("5")} className={digitClass}>5</button>
            <button type="button" onClick={() => handleDigit("6")} className={digitClass}>6</button>
            <button type="button" onClick={() => handleOperator("×")} className={opClass}>×</button>

            <button type="button" onClick={() => handleDigit("1")} className={digitClass}>1</button>
            <button type="button" onClick={() => handleDigit("2")} className={digitClass}>2</button>
            <button type="button" onClick={() => handleDigit("3")} className={digitClass}>3</button>
            <button type="button" onClick={() => handleOperator("-")} className={opClass}>−</button>

            <button type="button" onClick={handleClear} className="h-9 rounded-lg bg-destructive/10 text-destructive text-sm font-semibold hover:bg-destructive/20">C</button>
            <button type="button" onClick={() => handleDigit("0")} className={digitClass}>0</button>
            <button type="button" onClick={handleDecimal} className={digitClass}>.</button>
            <button type="button" onClick={() => handleOperator("+")} className={opClass}>+</button>

            <button
              type="button"
              onClick={handleEquals}
              className="col-span-4 h-9 rounded-lg bg-espresso text-cream text-sm font-semibold hover:bg-espresso/90"
            >
              =
            </button>
          </div>
        </div>
      )}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label="Calcolatrice"
        title="Calcolatrice"
        className="h-12 w-12 rounded-full bg-espresso text-cream shadow-[0px_4px_12px_0px_rgba(38,27,7,0.32)] flex items-center justify-center hover:bg-espresso/90 transition-colors"
      >
        <Calculator className="w-5 h-5" />
      </button>
    </div>
  )
}
