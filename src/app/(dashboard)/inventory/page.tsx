import { getInventory, upsertInventoryItem } from "@/actions/inventory"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ErrorMessage } from "@/components/ErrorMessage"
import { AlertTriangle } from "lucide-react"
import { revalidatePath } from "next/cache"
import { toUserMessage } from "@/lib/errors"

export default async function InventoryPage() {
  let items: Awaited<ReturnType<typeof getInventory>> = []
  let errorMsg: string | null = null

  try {
    items = await getInventory()
  } catch (err) {
    errorMsg = toUserMessage(err)
  }

  async function addItem(formData: FormData) {
    "use server"
    await upsertInventoryItem({
      name: formData.get("name") as string,
      unit: (formData.get("unit") as string) || "pz",
      quantity_available: Number(formData.get("qty") ?? 0),
      reorder_threshold: Number(formData.get("threshold") ?? 0),
    })
    revalidatePath("/inventory")
  }

  const lowStock = items.filter(
    (i) => i.quantity_available <= i.reorder_threshold
  )

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold">Materiali</h1>

      {lowStock.length > 0 && (
        <div className="flex items-center gap-2 bg-honey border border-gold/40 rounded-lg p-3 text-sm text-bark">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          {lowStock.length} materiale/i sotto la soglia minima
        </div>
      )}

      {errorMsg && <ErrorMessage message={errorMsg} />}

      <div className="space-y-2">
        {items.length === 0 && !errorMsg && (
          <p className="text-muted-foreground text-sm">Nessun materiale ancora.</p>
        )}
        {items.map((item) => (
          <Card
            key={item.id}
            className={
              item.quantity_available <= item.reorder_threshold
                ? "border-gold/40"
                : ""
            }
          >
            <CardContent className="py-3 flex items-center justify-between">
              <div>
                <p className="font-medium text-sm">{item.name}</p>
                <p className="text-xs text-muted-foreground">
                  {item.quantity_available} {item.unit} disponibili · soglia{" "}
                  {item.reorder_threshold}
                </p>
              </div>
              {item.quantity_available <= item.reorder_threshold && (
                <AlertTriangle className="w-4 h-4 text-gold shrink-0" />
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardContent className="pt-4">
          <p className="text-sm font-medium mb-3">Aggiungi materiale</p>
          <form action={addItem} className="grid grid-cols-2 gap-3">
            <Input
              name="name"
              required
              placeholder="Nome materiale"
              className="col-span-2"
            />
            <Input
              name="qty"
              type="number"
              min="0"
              step="0.01"
              required
              placeholder="Quantità"
            />
            <Input
              name="threshold"
              type="number"
              min="0"
              step="0.01"
              placeholder="Soglia minima"
            />
            <Input name="unit" placeholder="Unità (pz, kg, m)" />
            <Button type="submit" className="col-span-2">
              Aggiungi
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
