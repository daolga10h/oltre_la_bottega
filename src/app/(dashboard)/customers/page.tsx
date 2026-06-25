import { getCustomers } from "@/actions/customers"
import { ErrorMessage } from "@/components/ErrorMessage"
import { buttonVariants } from "@/components/ui/button"
import Link from "next/link"
import { Plus, User } from "lucide-react"
import { toUserMessage } from "@/lib/errors"
import { cn } from "@/lib/utils"

export default async function CustomersPage() {
  let customers: Awaited<ReturnType<typeof getCustomers>> = []
  let errorMsg: string | null = null

  try {
    customers = await getCustomers()
  } catch (err) {
    errorMsg = toUserMessage(err)
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Clienti</h1>
        <Link
          href="/customers/new"
          className={cn(buttonVariants({ variant: "default" }), "flex items-center gap-2")}
        >
          <Plus className="w-4 h-4" />
          Nuovo cliente
        </Link>
      </div>

      {errorMsg && <ErrorMessage message={errorMsg} />}

      {customers.length === 0 && !errorMsg ? (
        <p className="text-slate-500 text-sm">Nessun cliente ancora.</p>
      ) : (
        <div className="grid gap-3">
          {customers.map((c) => (
            <Link key={c.id} href={`/customers/${c.id}`}>
              <div className="bg-white rounded-lg border p-4 hover:shadow-sm transition-shadow flex items-center gap-3">
                <div className="bg-slate-100 rounded-full p-2 shrink-0">
                  <User className="w-4 h-4 text-slate-600" />
                </div>
                <div className="min-w-0">
                  <p className="font-medium text-sm">{c.name}</p>
                  {c.phone && (
                    <p className="text-xs text-slate-500 truncate">{c.phone}</p>
                  )}
                </div>
                {c.tags.length > 0 && (
                  <div className="ml-auto flex gap-1 shrink-0">
                    {c.tags.map((t) => (
                      <span
                        key={t}
                        className="text-xs bg-slate-100 px-2 py-0.5 rounded-full"
                      >
                        {t}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
