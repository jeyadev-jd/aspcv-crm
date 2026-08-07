import { api } from './api'

/** Pulls the filename the server set, so downloads keep their server-side names. */
function filenameFromDisposition(disposition: string | undefined, fallback: string): string {
  if (!disposition) return fallback
  const utf8 = /filename\*=UTF-8''([^;]+)/i.exec(disposition)
  if (utf8?.[1]) return decodeURIComponent(utf8[1])
  const plain = /filename="?([^";]+)"?/i.exec(disposition)
  return plain?.[1] ?? fallback
}

/**
 * GETs a binary endpoint and saves it. Errors come back as a Blob, so the JSON
 * message is read out of it rather than showing a generic failure.
 */
export async function downloadFile(url: string, fallbackName: string): Promise<void> {
  try {
    const res = await api.get(url, { responseType: 'blob' })
    const name = filenameFromDisposition(res.headers['content-disposition'], fallbackName)
    const objectUrl = URL.createObjectURL(res.data as Blob)
    const a = document.createElement('a')
    a.href = objectUrl
    a.download = name
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(objectUrl)
  } catch (err) {
    const blob = (err as { response?: { data?: unknown } }).response?.data
    if (blob instanceof Blob) {
      const text = await blob.text()
      try {
        throw new Error((JSON.parse(text) as { error?: string }).error ?? 'Download failed')
      } catch (parseErr) {
        if (parseErr instanceof Error && parseErr.message !== 'Download failed') throw parseErr
        throw new Error('Download failed')
      }
    }
    throw err instanceof Error ? err : new Error('Download failed')
  }
}
