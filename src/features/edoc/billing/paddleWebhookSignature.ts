/**
 * Paddle Billing webhook signature (C6). HMAC-SHA256 over `${ts}:${rawBody}`.
 * https://developer.paddle.com/webhooks/about/signature-verification
 */

import { createHmac, timingSafeEqual } from 'node:crypto'

/** Replay window. Paddle examples use 5s; 5 minutes tolerates Edge clock skew. */
export const PADDLE_SIGNATURE_MAX_AGE_SECONDS = 300

export function parsePaddleSignatureHeader(header: string): { ts: string; signatures: string[] } | null {
  const parts = header.split(';').map((part) => part.trim()).filter(Boolean)
  const ts = parts.find((part) => part.startsWith('ts='))?.slice(3) ?? ''
  const signatures = parts.filter((part) => part.startsWith('h1=')).map((part) => part.slice(3))
  if (!ts || signatures.length === 0) return null
  return { ts, signatures }
}

export function verifyPaddleWebhookSignature(input: {
  rawBody: string
  signatureHeader: string
  secret: string
  nowSeconds?: number
}): boolean {
  const secret = input.secret.trim()
  if (!secret || !input.rawBody || !input.signatureHeader) return false
  const parsed = parsePaddleSignatureHeader(input.signatureHeader)
  if (!parsed) return false
  const tsNumber = Number(parsed.ts)
  if (!Number.isFinite(tsNumber)) return false
  const now = input.nowSeconds ?? Math.floor(Date.now() / 1000)
  if (Math.abs(now - tsNumber) > PADDLE_SIGNATURE_MAX_AGE_SECONDS) return false

  const expected = createHmac('sha256', secret).update(`${parsed.ts}:${input.rawBody}`, 'utf8').digest('hex')
  const expectedBuf = Buffer.from(expected, 'utf8')
  return parsed.signatures.some((signature) => {
    const actual = Buffer.from(signature, 'utf8')
    if (actual.length !== expectedBuf.length) return false
    return timingSafeEqual(actual, expectedBuf)
  })
}
