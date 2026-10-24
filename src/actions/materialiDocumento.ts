"use server"

import { createClient } from "@/lib/supabase/server"
import { logError } from "@/lib/logger"
import { USER_MESSAGES } from "@/lib/errors"
import { readSupplierDocument } from "@/lib/documentReader"
import {
  MAX_FILE_BYTES,
  SUPPORTED_MEDIA_TYPES,
  type DocumentoLetto,
  type SupportedMediaType,
} from "@/lib/documentoFornitore"

type LetturaResult = { ok: true; documento: DocumentoLetto } | { ok: false; error: string }

const MSG_NO_KEY = "La lettura automatica non è configurata. Puoi inserire le righe a mano."
const MSG_NO_FILE = "Nessun file ricevuto."
const MSG_FORMAT = "Formato non supportato: carica un PDF o una foto (JPG, PNG, WebP)."
const MSG_TOO_BIG = "Il file è troppo grande (massimo 4 MB). Per le foto riprova: l'app le riduce da sola."
const MSG_READ_FAILED = "Non sono riuscito a leggere il documento. Puoi inserire le righe a mano."

/** Legge un documento del fornitore con Claude. Non salva nulla: restituisce le righe da controllare. */
export async function extractDocument(formData: FormData): Promise<LetturaResult> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: USER_MESSAGES.authRequired }

  if (!process.env.ANTHROPIC_API_KEY) return { ok: false, error: MSG_NO_KEY }

  const file = formData.get("file")
  if (!(file instanceof File)) return { ok: false, error: MSG_NO_FILE }
  if (!(SUPPORTED_MEDIA_TYPES as readonly string[]).includes(file.type)) return { ok: false, error: MSG_FORMAT }
  if (file.size > MAX_FILE_BYTES) return { ok: false, error: MSG_TOO_BIG }

  try {
    const base64 = Buffer.from(await file.arrayBuffer()).toString("base64")
    const documento = await readSupplierDocument(base64, file.type as SupportedMediaType)
    return { ok: true, documento }
  } catch (error) {
    logError("extractDocument", error)
    return { ok: false, error: MSG_READ_FAILED }
  }
}
