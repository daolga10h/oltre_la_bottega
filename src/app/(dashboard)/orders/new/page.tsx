import { OrderForm } from "@/components/OrderForm"
import { createClient } from "@/lib/supabase/server"
import { getOperatorNames } from "@/lib/operators"

export default async function NewOrderPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const operatori = getOperatorNames(user)

  return (
    <div className="max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Nuovo ordine</h1>
      <OrderForm operatori={operatori} />
    </div>
  )
}
