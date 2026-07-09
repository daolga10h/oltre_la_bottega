"use client"

import { useState, useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import { Input } from "@/components/ui/input"
import { Search } from "lucide-react"
import { useDebounce } from "@/lib/hooks/useDebounce"

interface SearchResult {
  orders: Array<{ id: string; cosa_ordinato: string; nome: string; cognome: string | null; status: string }>
}

export function SearchBar() {
  const [query, setQuery] = useState("")
  const [results, setResults] = useState<SearchResult | null>(null)
  const [open, setOpen] = useState(false)
  const debouncedQuery = useDebounce(query, 300)
  const router = useRouter()
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (debouncedQuery.length < 2) {
      setResults(null)
      return
    }
    fetch(`/api/search?q=${encodeURIComponent(debouncedQuery)}`)
      .then((r) => r.json())
      .then((data: SearchResult) => setResults(data))
      .catch(() => {})
  }, [debouncedQuery])

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (!containerRef.current?.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClick)
    return () => document.removeEventListener("mousedown", handleClick)
  }, [])

  const hasResults = results && results.orders.length > 0

  function navigate(href: string) {
    router.push(href)
    setOpen(false)
    setQuery("")
  }

  return (
    <div ref={containerRef} className="relative w-full max-w-sm">
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
      <Input
        value={query}
        onChange={(e) => {
          setQuery(e.target.value)
          setOpen(true)
        }}
        onFocus={() => setOpen(true)}
        placeholder="Cerca ordini, clienti…"
        className="pl-9"
      />
      {open && hasResults && (
        <div className="absolute top-full mt-1 w-full bg-card border border-border rounded-lg shadow-[0px_4px_8px_0px_rgba(59,39,22,0.08)] z-50 overflow-hidden">
          <p className="px-3 py-1.5 text-xs font-semibold text-muted-foreground bg-background uppercase tracking-widest">
            Ordini
          </p>
          {results!.orders.map((o) => (
            <button
              key={o.id}
              className="w-full px-3 py-2 text-sm text-left hover:bg-muted/40"
              onClick={() => navigate(`/orders/${o.id}`)}
            >
              <span className="font-medium">{o.cosa_ordinato}</span>
              <span className="text-muted-foreground ml-2 text-xs">
                {[o.nome, o.cognome].filter(Boolean).join(" ")}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
