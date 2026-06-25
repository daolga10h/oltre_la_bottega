"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { LayoutDashboard, ShoppingBag, Users, Calendar } from "lucide-react"
import { cn } from "@/lib/utils"

const links = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/orders", label: "Ordini", icon: ShoppingBag },
  { href: "/customers", label: "Clienti", icon: Users },
  { href: "/agenda", label: "Agenda", icon: Calendar },
]

export function Sidebar() {
  const pathname = usePathname()
  return (
    <aside className="hidden md:flex flex-col w-56 border-r bg-white min-h-screen p-4 gap-1">
      <div className="font-semibold text-lg mb-6 px-2">Oltre la Bottega</div>
      {links.map(({ href, label, icon: Icon }) => (
        <Link
          key={href}
          href={href}
          className={cn(
            "flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors",
            pathname.startsWith(href)
              ? "bg-slate-100 text-slate-900"
              : "text-slate-600 hover:bg-slate-50"
          )}
        >
          <Icon className="w-4 h-4" />
          {label}
        </Link>
      ))}
    </aside>
  )
}
