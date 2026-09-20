export function appendDictatedText(current: string, chunk: string): string {
  const trimmedChunk = chunk.trim()
  if (!trimmedChunk) return current

  const trimmedCurrent = current.trimEnd()
  if (!trimmedCurrent) return trimmedChunk

  return `${trimmedCurrent} ${trimmedChunk}`
}
