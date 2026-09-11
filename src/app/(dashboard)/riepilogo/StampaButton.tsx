"use client"

import { Printer } from "lucide-react"
import { buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export function StampaButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className={cn(buttonVariants({ variant: "outline", size: "sm" }), "print:hidden inline-flex items-center gap-1.5")}
    >
      <Printer className="w-4 h-4" />
      Stampa
    </button>
  )
}
