import { TodayBoard } from "@/components/TodayBoard"
import { buttonVariants } from "@/components/ui/button"
import Link from "next/link"
import { Plus } from "lucide-react"

export default function DashboardPage() {
  const today = new Date().toLocaleDateString("it-IT", {
    weekday: "long",
    day: "numeric",
    month: "long",
  })

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Oggi</h1>
          <p className="text-sm text-slate-500 capitalize">{today}</p>
        </div>
        <Link href="/orders/new" className={buttonVariants({ variant: "default" })}>
          <Plus className="w-4 h-4 mr-2" />
          Nuovo ordine
        </Link>
      </div>
      <TodayBoard />
    </div>
  )
}
