import { CustomerForm } from "@/components/CustomerForm"

export default function NewCustomerPage() {
  return (
    <div className="max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Nuovo cliente</h1>
      <CustomerForm />
    </div>
  )
}
