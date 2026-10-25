import { OrdinatoButton } from "@/components/OrdinatoButton"
import { cn, formatDate } from "@/lib/utils"
import { computeStock, daysBetween, formatQuantita, reorderStatus, type Materiale } from "@/lib/materiali"

/** Giacenza di un materiale in magazzino, con avviso «Da riordinare» e pulsante «Ho già ordinato». `oggi` è AAAA-MM-GG. */
export function StockInfo({ materiale, oggi }: { materiale: Materiale; oggi: string }) {
  if (!materiale.in_magazzino) return null
  const giacenza = computeStock(materiale)
  const stato = reorderStatus(materiale, giacenza, oggi)

  return (
    <div className="space-y-1 text-sm">
      <p className={cn("font-semibold", giacenza <= 0 && "text-terracotta")}>
        In magazzino: {formatQuantita(giacenza)}
        {materiale.soglia !== null && (
          <span className="font-normal text-muted-foreground"> (minimo {formatQuantita(materiale.soglia)})</span>
        )}
      </p>
      {stato === "da_riordinare" && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded bg-terracotta/15 px-2 py-0.5 text-xs font-semibold text-terracotta">Da riordinare</span>
          <OrdinatoButton id={materiale.id} />
        </div>
      )}
      {stato === "ordinato" && materiale.ordinato_il && (
        <p className="text-xs text-muted-foreground">Ordinato il {formatDate(materiale.ordinato_il)} – in attesa</p>
      )}
      {stato === "ordinato_scaduto" && materiale.ordinato_il && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded bg-terracotta/15 px-2 py-0.5 text-xs font-semibold text-terracotta">
            Ordinato da {daysBetween(materiale.ordinato_il, oggi)} giorni, non è arrivato
          </span>
          <OrdinatoButton id={materiale.id} />
        </div>
      )}
    </div>
  )
}
