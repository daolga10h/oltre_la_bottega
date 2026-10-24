/**
 * Riduce una foto prima dell'invio: le foto da telefono pesano 3–8 MB e Vercel
 * rifiuta richieste sopra i 4,5 MB. Il lato lungo scende a 2000 px (restano
 * leggibili anche i caratteri piccoli di una fattura) e il file diventa un JPEG.
 * Se qualcosa non funziona restituisce il file originale: sarà il server a
 * decidere se è utilizzabile.
 */
export async function resizeImage(file: File, maxSide = 2000, quality = 0.85): Promise<File> {
  try {
    const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" })
    const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height))
    const width = Math.round(bitmap.width * scale)
    const height = Math.round(bitmap.height * scale)

    const canvas = document.createElement("canvas")
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext("2d")
    if (!ctx) return file
    ctx.drawImage(bitmap, 0, 0, width, height)
    bitmap.close()

    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", quality))
    if (!blob) return file
    return new File([blob], file.name.replace(/\.[^.]+$/, "") + ".jpg", { type: "image/jpeg" })
  } catch {
    return file
  }
}
