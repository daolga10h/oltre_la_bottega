"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { LayoutDashboard, ShoppingBag, Users, Calendar, LayoutGrid, Star, Euro, ClipboardList } from "lucide-react"
import { cn } from "@/lib/utils"
import { hasFeature, type Feature } from "@/lib/plan"

type NavItem = { href: string; label: string; icon: React.ElementType; feature?: Feature }

const allLinks: NavItem[] = [
  { href: "/dashboard", label: "Oggi", icon: LayoutDashboard },
  { href: "/kanban", label: "Bacheca", icon: LayoutGrid },
  { href: "/orders", label: "Ordini", icon: ShoppingBag, feature: "elenco_ordini" },
  { href: "/agenda", label: "Agenda", icon: Calendar },
  { href: "/recensioni", label: "Recensioni", icon: Star },
  { href: "/pagamenti", label: "Da incassare", icon: Euro, feature: "da_incassare" },
  { href: "/riepilogo", label: "Riepilogo", icon: ClipboardList, feature: "riepilogo" },
  { href: "/customers", label: "Clienti", icon: Users },
]

const links = allLinks.filter((l) => !l.feature || hasFeature(l.feature))

export function BottomNav() {
  const pathname = usePathname()
  return (
    <nav className="md:hidden fixed bottom-0 inset-x-0 bg-card border-t border-border z-50 flex print:hidden">
      {links.map(({ href, label, icon: Icon }) => {
        const active = pathname.startsWith(href)
        return (
          <Link
            key={href}
            href={href}
            className={cn(
              "flex flex-col items-center gap-0.5 flex-1 min-w-0 py-2 text-xs transition-colors",
              active ? "text-foreground font-semibold" : "text-muted-foreground"
            )}
          >
            <Icon className={cn("w-5 h-5", active && "text-espresso")} />
            <span className="truncate max-w-full px-0.5">{label}</span>
          </Link>
        )
      })}
    </nav>
  )
}
