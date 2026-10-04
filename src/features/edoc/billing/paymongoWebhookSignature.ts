/**
 * PayMongo webhook signature.
 * Header: Paymongo-Signature = t=<unix>,te=<test hmac>,li=<live hmac>
 * HMAC-SHA256(secret, `${t}.${rawBody}`)
 * https://docs.paymongo.com/docs/developer-tools-webhook-setup-management
 */

import { createHmac, timingSafeEqual } from 'node:crypto'

export const PAYMONGO_SIGNATURE_MAX_AGE_SECONDS = 300

export type PaymongoWebhookMode = 'test' | 'live'

export function parsePaymongoSignatureHeader(header: string): {
  ts: string
  testSignature: string
  liveSignature: string
} | null {
  const parts = header.split(',').map((part) => part.trim()).filter(Boolean)
  const ts = parts.find((part) => part.startsWith('t='))?.slice(2) ?? ''
  const testSignature = parts.find((part) => part.startsWith('te='))?.slice(3) ?? ''
  const liveSignature = parts.find((part) => part.startsWith('li='))?.slice(3) ?? ''
  if (!ts || (!testSignature && !liveSignature)) return null
  return { ts, testSignature, liveSignature }
}

export function verifyPaymongoWebhookSignature(input: {
  rawBody: string
  signatureHeader: string
  secret: string
  mode: PaymongoWebhookMode
  nowSeconds?: number
}): boolean {
  const secret = input.secret.trim()
  if (!secret || !input.rawBody || !input.signatureHeader) return false
  const parsed = parsePaymongoSignatureHeader(input.signatureHeader)
  if (!parsed) return false
  const tsNumber = Number(parsed.ts)
  if (!Number.isFinite(tsNumber)) return false
  const now = input.nowSeconds ?? Math.floor(Date.now() / 1000)
  if (Math.abs(now - tsNumber) > PAYMONGO_SIGNATURE_MAX_AGE_SECONDS) return false

  const expected = createHmac('sha256', secret).update(`${parsed.ts}.${input.rawBody}`, 'utf8').digest('hex')
  const provided = input.mode === 'live' ? parsed.liveSignature : parsed.testSignature
  if (!provided) return false
  const expectedBuf = Buffer.from(expected, 'utf8')
  const actualBuf = Buffer.from(provided, 'utf8')
  if (actualBuf.length !== expectedBuf.length) return false
  return timingSafeEqual(actualBuf, expectedBuf)
}
