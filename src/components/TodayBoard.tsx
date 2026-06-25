"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ErrorMessage } from "@/components/ErrorMessage"
import { toUserMessage } from "@/lib/errors"
import { AlertTriangle, Clock, Package, Truck } from "lucide-react"
import Link from "next/link"

interface KPI {
  open: number
  urgent: number
  overdue: number
  todayDeliveries: number
}

interface TodayOrder {
  id: string
  title: string
  priority: string
  due_date: string | null
  customers: { name: string } | null
}

interface Reminder {
  id: string
  title: string
  due_at: string
}

interface DashboardData {
  kpi: KPI
  todayOrders: TodayOrder[]
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
    return <p className="text-sm text-slate-500">Caricamento…</p>
  }
  if (error) {
    return <ErrorMessage message={error} />
  }

  const { kpi, todayOrders, reminders } = data!

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard label="Ordini aperti" value={kpi.open} icon={<Package className="w-4 h-4" />} />
        <KpiCard
          label="Urgenti"
          value={kpi.urgent}
          icon={<AlertTriangle className="w-4 h-4" />}
          variant={kpi.urgent > 0 ? "urgent" : "default"}
        />
        <KpiCard
          label="In ritardo"
          value={kpi.overdue}
          icon={<Clock className="w-4 h-4" />}
          variant={kpi.overdue > 0 ? "danger" : "default"}
        />
        <KpiCard
          label="Consegne oggi"
          value={kpi.todayDeliveries}
          icon={<Truck className="w-4 h-4" />}
          variant={kpi.todayDeliveries > 0 ? "info" : "default"}
        />
      </div>

      {todayOrders.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Consegne di oggi</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            {todayOrders.map((o) => (
              <Link
                key={o.id}
                href={`/orders/${o.id}`}
                className="flex items-center justify-between py-2 border-b last:border-0 hover:bg-slate-50 rounded px-2 -mx-2"
              >
                <div>
                  <p className="font-medium text-sm">{o.title}</p>
                  <p className="text-xs text-slate-500">
                    {o.customers?.name ?? "Cliente non indicato"}
                  </p>
                </div>
                {o.priority === "urgente" && (
                  <Badge variant="destructive">Urgente</Badge>
                )}
              </Link>
            ))}
          </CardContent>
        </Card>
      )}

      {reminders.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Promemoria di oggi</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            {reminders.map((r) => (
              <div key={r.id} className="flex items-center gap-2 py-2 border-b last:border-0">
                <Clock className="w-4 h-4 text-slate-400 shrink-0" />
                <span className="text-sm">{r.title}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {todayOrders.length === 0 && reminders.length === 0 && (
        <p className="text-sm text-slate-500">Nessuna scadenza per oggi. Ottimo lavoro!</p>
      )}
    </div>
  )
}

function KpiCard({
  label,
  value,
  icon,
  variant = "default",
}: {
  label: string
  value: number
  icon: React.ReactNode
  variant?: "default" | "urgent" | "danger" | "info"
}) {
  const colors: Record<string, string> = {
    default: "bg-white",
    urgent: "bg-amber-50 border-amber-200",
    danger: "bg-red-50 border-red-200",
    info: "bg-blue-50 border-blue-200",
  }
  return (
    <Card className={colors[variant]}>
      <CardContent className="pt-4 pb-4">
        <div className="flex items-center justify-between mb-1">
          <span className="text-slate-400">{icon}</span>
          <span className="text-2xl font-bold">{value}</span>
        </div>
        <p className="text-xs text-slate-500">{label}</p>
      </CardContent>
    </Card>
  )
}
