"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { LayoutDashboard, ShoppingBag, Users, Calendar, LayoutGrid, Star } from "lucide-react"
import { cn } from "@/lib/utils"

const mainLinks = [
  { href: "/dashboard", label: "Oggi", icon: LayoutDashboard },
  { href: "/kanban", label: "Bacheca", icon: LayoutGrid },
  { href: "/orders", label: "Ordini", icon: ShoppingBag },
]

const managementLinks = [
  { href: "/agenda", label: "Agenda", icon: Calendar },
  { href: "/recensioni", label: "Recensioni", icon: Star },
  { href: "/customers", label: "Clienti", icon: Users },
]

function NavLink({ href, label, icon: Icon, pathname }: { href: string; label: string; icon: React.ElementType; pathname: string }) {
  const active = pathname.startsWith(href)
  return (
    <Link
      href={href}
      className={cn(
        "relative flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors",
        active
          ? "bg-muted text-foreground font-semibold"
          : "text-bark hover:bg-muted/60 font-normal"
      )}
    >
      {active && (
        <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-4 bg-gold rounded-r-full" />
      )}
      <Icon className="w-4 h-4 shrink-0" />
      {label}
    </Link>
  )
}

export function Sidebar() {
  const pathname = usePathname()
  return (
    <aside className="hidden md:flex flex-col w-56 border-r border-border bg-card min-h-screen">
      {/* striscia ambra in cima */}
      <div className="mx-4 h-0.5 bg-gradient-to-r from-gold to-amber rounded-b-sm" />

      <div className="flex flex-col flex-1 p-4 gap-1">
        {/* Logo */}
        <div className="flex items-center gap-2 px-2 pb-5 pt-2">
          <div className="w-6 h-6 rounded-md bg-espresso flex items-center justify-center text-[10px] font-bold text-cream shrink-0">
            OB
          </div>
          <span className="font-bold text-[15px] tracking-tight text-foreground">Oltre la Bottega</span>
        </div>

        {/* Principale */}
        <p className="px-3 mb-1 text-[10px] font-semibold uppercase tracking-widest text-warm-ash">Principale</p>
        {mainLinks.map(({ href, label, icon }) => (
          <NavLink key={href} href={href} label={label} icon={icon} pathname={pathname} />
        ))}

        {/* Gestione */}
        <p className="px-3 mt-3 mb-1 text-[10px] font-semibold uppercase tracking-widest text-warm-ash">Gestione</p>
        {managementLinks.map(({ href, label, icon }) => (
          <NavLink key={href} href={href} label={label} icon={icon} pathname={pathname} />
        ))}
      </div>
    </aside>
  )
}
