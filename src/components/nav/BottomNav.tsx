"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { LayoutDashboard, ShoppingBag, Users, Calendar, LayoutGrid } from "lucide-react"
import { cn } from "@/lib/utils"

const links = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/orders", label: "Ordini", icon: ShoppingBag },
  { href: "/customers", label: "Clienti", icon: Users },
  { href: "/agenda", label: "Agenda", icon: Calendar },
  { href: "/kanban", label: "Stati lavoro", icon: LayoutGrid },
]

export function BottomNav() {
  const pathname = usePathname()
  return (
    <nav className="md:hidden fixed bottom-0 inset-x-0 bg-white border-t z-50 flex">
      {links.map(({ href, label, icon: Icon }) => (
        <Link
          key={href}
          href={href}
          className={cn(
            "flex flex-col items-center gap-0.5 flex-1 py-2 text-xs",
            pathname.startsWith(href)
              ? "text-slate-900 font-medium"
              : "text-slate-500"
          )}
        >
          <Icon className="w-5 h-5" />
          {label}
        </Link>
      ))}
    </nav>
  )
}
