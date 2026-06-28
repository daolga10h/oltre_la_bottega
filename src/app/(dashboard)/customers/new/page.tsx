import { redirect } from "next/navigation"

export default function NewCustomerPage() {
  redirect("/orders/new")
}
