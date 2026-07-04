export const EDOC_MAX_PDF_BYTES = 50 * 1024 * 1024

export interface EdocFileValidationResult {
  ok: boolean
  message: string
}

export function validateEdocPdfFile(file: Pick<File, 'name' | 'type' | 'size'>): EdocFileValidationResult {
  const name = file.name.trim().toLowerCase()
  if (!name.endsWith('.pdf')) return { ok: false, message: 'Only PDF files are allowed.' }
  if (file.type && file.type !== 'application/pdf') {
    return { ok: false, message: 'The selected file must have a PDF MIME type.' }
  }
  if (file.size <= 0) return { ok: false, message: 'The selected PDF is empty.' }
  if (file.size > EDOC_MAX_PDF_BYTES) {
    return { ok: false, message: 'The selected PDF must be 50 MB or smaller.' }
  }
  return { ok: true, message: 'PDF file is valid.' }
}

export async function hasPdfSignature(file: File): Promise<boolean> {
  const header = await blobToArrayBuffer(file.slice(0, 5))
  const text = new TextDecoder().decode(header)
  return text === '%PDF-'
}

export async function sha256Hex(file: Blob): Promise<string> {
  const buffer = await blobToArrayBuffer(file)
  const hash = await crypto.subtle.digest('SHA-256', buffer)
  return [...new Uint8Array(hash)].map((byte) => byte.toString(16).padStart(2, '0')).join('')
}

function blobToArrayBuffer(blob: Blob): Promise<ArrayBuffer> {
  if ('arrayBuffer' in blob && typeof blob.arrayBuffer === 'function') {
    return blob.arrayBuffer()
  }

  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as ArrayBuffer)
    reader.onerror = () => reject(reader.error ?? new Error('Could not read file bytes.'))
    reader.readAsArrayBuffer(blob)
  })
}
