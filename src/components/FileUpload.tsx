"use client"

import { useState, useRef } from "react"
import { createClient } from "@/lib/supabase/client"
import { Paperclip, X, Loader2, Upload } from "lucide-react"

interface FileUploadProps {
  value: string // JSON array of {name, url} stored in file_cliente field
  onChange: (value: string) => void
}

interface AttachedFile {
  name: string
  url: string
}

function parseFiles(value: string): AttachedFile[] {
  if (!value) return []
  try {
    const parsed = JSON.parse(value)
    if (Array.isArray(parsed)) return parsed
  } catch {}
  // Fallback: treat as plain text (old format)
  return []
}

export function FileUpload({ value, onChange }: FileUploadProps) {
  const [files, setFiles] = useState<AttachedFile[]>(parseFiles(value))
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const supabase = createClient()

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const selected = Array.from(e.target.files ?? [])
    if (!selected.length) return

    setUploading(true)
    setError(null)
    const added: AttachedFile[] = []

    for (const file of selected) {
      const path = `ordini/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`
      const { data, error: uploadError } = await supabase.storage
        .from("allegati")
        .upload(path, file)

      if (uploadError) {
        setError(`Errore upload ${file.name}: ${uploadError.message}`)
        continue
      }

      const { data: { publicUrl } } = supabase.storage
        .from("allegati")
        .getPublicUrl(path)

      added.push({ name: file.name, url: publicUrl })
    }

    const updated = [...files, ...added]
    setFiles(updated)
    onChange(JSON.stringify(updated))
    setUploading(false)
    // Reset input so same file can be re-selected
    if (inputRef.current) inputRef.current.value = ""
  }

  function removeFile(index: number) {
    const updated = files.filter((_, i) => i !== index)
    setFiles(updated)
    onChange(JSON.stringify(updated))
  }

  return (
    <div className="space-y-2">
      {/* Uploaded files */}
      {files.length > 0 && (
        <ul className="space-y-1">
          {files.map((f, i) => (
            <li key={i} className="flex items-center gap-2 text-sm bg-slate-50 rounded-lg px-3 py-2 border">
              <Paperclip className="w-3 h-3 text-slate-400 shrink-0" />
              <a
                href={f.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 truncate text-blue-600 hover:underline"
              >
                {f.name}
              </a>
              <button
                type="button"
                onClick={() => removeFile(i)}
                className="text-slate-400 hover:text-red-500 shrink-0"
                aria-label="Rimuovi"
              >
                <X className="w-3 h-3" />
              </button>
            </li>
          ))}
        </ul>
      )}

      {/* Upload button */}
      <div>
        <input
          ref={inputRef}
          type="file"
          multiple
          onChange={handleFileChange}
          className="sr-only"
          id="file-upload-input"
          accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.svg,.ai,.eps,.dxf"
        />
        <label
          htmlFor="file-upload-input"
          className={`inline-flex items-center gap-2 cursor-pointer rounded-lg border border-dashed border-slate-300 px-4 py-2 text-sm text-slate-500 hover:border-slate-400 hover:text-slate-700 hover:bg-slate-50 transition-colors ${uploading ? "opacity-50 pointer-events-none" : ""}`}
        >
          {uploading ? (
            <><Loader2 className="w-4 h-4 animate-spin" />Caricamento…</>
          ) : (
            <><Upload className="w-4 h-4" />Aggiungi file</>
          )}
        </label>
      </div>

      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  )
}
