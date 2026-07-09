"use client"

import { useEffect, useState, type ComponentType } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ErrorMessage } from "@/components/ErrorMessage"
import { toUserMessage } from "@/lib/errors"
import { Clock, CheckCircle2, Package } from "lucide-react"
import Link from "next/link"

interface KPI {
  open: number
  urgent: number
  overdue: number
  todayDeliveries: number
}

interface TodayOrder {
  id: string
  cosa_ordinato: string
  nome: string
  cognome: string | null
  status: string
  data_consegna: string | null
}

interface Reminder {
  id: string
  title: string
  due_at: string
}

interface OrderSummary {
  id: string
  cosa_ordinato: string
  nome: string
  cognome: string | null
}

interface DashboardData {
  kpi: KPI
  todayOrders: TodayOrder[]
  deliveredToday: OrderSummary[]
  materialeDaOrdinare: OrderSummary[]
  materialeOrdinatoOggi: OrderSummary[]
  reminders: Reminder[]
}

export function TodayBoard() {
  const [data, setData] = useState<DashboardData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch("/api/dashboard/today")
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`)
        return r.json()
      })
      .then((json: DashboardData) => {
        setData(json)
        setLoading(false)
      })
      .catch((err: unknown) => {
        setError(toUserMessage(err))
        setLoading(false)
      })
  }, [])

  if (loading) {
    return <p className="text-sm text-muted-foreground">Caricamento…</p>
  }
  if (error) {
    return <ErrorMessage message={error} />
  }

  const { kpi, todayOrders, deliveredToday, materialeDaOrdinare, materialeOrdinatoOggi, reminders } = data!

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard label="Ordini aperti" value={kpi.open} />
        <KpiCard label="In lavorazione" value={kpi.urgent} />
        <KpiCard label="In ritardo" value={kpi.overdue} variant={kpi.overdue > 0 ? "danger" : "default"} />
        <KpiCard label="Consegne oggi" value={kpi.todayDeliveries} variant={kpi.todayDeliveries > 0 ? "today" : "default"} />
      </div>

      <DashboardListCard
        title="Da consegnare oggi"
        items={todayOrders}
        badgeClassName="bg-muted border-border text-muted-foreground"
        chevron
      />

      <DashboardListCard
        title="Consegnati oggi"
        items={deliveredToday}
        badgeClassName="bg-sage border-[#3a5a2e]/30 text-[#3a5a2e]"
        icon={CheckCircle2}
      />

      <DashboardListCard
        title="Materiale da ordinare"
        items={materialeDaOrdinare}
        badgeClassName="bg-terracotta/15 border-terracotta/30 text-terracotta"
        chevron
      />

      <DashboardListCard
        title="Materiale ordinato oggi"
        items={materialeOrdinatoOggi}
        badgeClassName="bg-sage border-[#3a5a2e]/30 text-[#3a5a2e]"
        icon={Package}
      />

      {reminders.length > 0 && (
        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <CardTitle className="text-sm font-semibold">Promemoria di oggi</CardTitle>
            <span className="text-xs font-semibold bg-muted border border-border rounded-full px-2.5 py-0.5 text-muted-foreground">
              {reminders.length}
            </span>
          </CardHeader>
          <CardContent className="space-y-2">
            {reminders.map((r) => (
              <div key={r.id} className="flex items-center gap-3 bg-background rounded-lg px-4 py-3">
                <span className="w-1.5 h-1.5 rounded-full bg-gold ring-2 ring-gold/20 shrink-0" />
                <span className="text-sm text-bark">{r.title}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {todayOrders.length === 0 && deliveredToday.length === 0 && materialeDaOrdinare.length === 0 && materialeOrdinatoOggi.length === 0 && reminders.length === 0 && (
        <p className="text-sm text-muted-foreground">Nessuna scadenza per oggi. Ottimo lavoro!</p>
      )}
    </div>
  )
}

function DashboardListCard({
  title,
  items,
  badgeClassName,
  icon: Icon,
  chevron = false,
}: {
  title: string
  items: OrderSummary[]
  badgeClassName: string
  icon?: ComponentType<{ className?: string }>
  chevron?: boolean
}) {
  if (items.length === 0) return null

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle className="text-sm font-semibold">{title}</CardTitle>
        <span className={`text-xs font-semibold rounded-full px-2.5 py-0.5 border ${badgeClassName}`}>
          {items.length}
        </span>
      </CardHeader>
      <CardContent className="space-y-2">
        {items.map((o) => (
          <Link
            key={o.id}
            href={`/orders/${o.id}`}
            className={`flex items-center bg-background rounded-lg px-4 py-3 hover:bg-muted/60 transition-colors group ${Icon ? "gap-3" : "justify-between"}`}
          >
            {Icon && <Icon className="w-4 h-4 text-[#3a5a2e] shrink-0" />}
            <div>
              <p className="font-semibold text-sm text-foreground">{o.cosa_ordinato}</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {[o.nome, o.cognome].filter(Boolean).join(" ")}
              </p>
            </div>
            {chevron && <span className="text-muted-foreground/50 group-hover:text-muted-foreground text-sm">›</span>}
          </Link>
        ))}
      </CardContent>
    </Card>
  )
}

function KpiCard({
  label,
  value,
  variant = "default",
}: {
  label: string
  value: number
  variant?: "default" | "danger" | "today"
}) {
  return (
    <div className="relative bg-card border border-border rounded-lg px-5 py-4 overflow-hidden shadow-[0px_4px_8px_0px_rgba(59,39,22,0.06)]">
      {variant === "danger" && (
        <span className="absolute top-0 left-0 right-0 h-0.5 bg-terracotta rounded-t-lg" />
      )}
      {variant === "today" && (
        <span className="absolute top-0 left-0 right-0 h-0.5 bg-gold rounded-t-lg" />
      )}
      <p className="text-3xl font-bold tracking-tight text-foreground">{value}</p>
      <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground mt-2">{label}</p>
    </div>
  )
}
