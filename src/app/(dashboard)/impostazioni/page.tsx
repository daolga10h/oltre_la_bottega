import Link from "next/link"
import { createClient } from "@/lib/supabase/server"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { getOperatorNames } from "@/lib/operators"
import { OperatoriSettings } from "@/components/OperatoriSettings"

export default async function ImpostazioniPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const pinSet = Boolean(user?.user_metadata?.pin_set)
  const operatori = getOperatorNames(user)

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold">Impostazioni</h1>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Accesso con PIN</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Imposta un PIN per accedere dai tablet senza dover passare dalla posta.
          </p>
          <Link href="/setup-pin" className={cn(buttonVariants({ variant: "default" }), "w-fit")}>
            {pinSet ? "Cambia PIN" : "Imposta PIN"}
          </Link>
        </CardContent>
      </Card>

      <OperatoriSettings initialOperatori={operatori} />
    </div>
  )
}
