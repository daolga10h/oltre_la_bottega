import { OrderForm } from "@/components/OrderForm"
import { createClient } from "@/lib/supabase/server"

export default async function NewOrderPage() {
  const supabase = await createClient()
  const { data: customers } = await supabase
    .from("customers")
    .select("id, name")
    .order("name")

  return (
    <div className="max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Nuovo ordine</h1>
      <OrderForm customers={customers ?? []} />
    </div>
  )
}
