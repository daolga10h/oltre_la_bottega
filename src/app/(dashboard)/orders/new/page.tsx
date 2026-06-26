import { OrderForm } from "@/components/OrderForm"

export default function NewOrderPage() {
  return (
    <div className="max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Nuovo ordine</h1>
      <OrderForm />
    </div>
  )
}
