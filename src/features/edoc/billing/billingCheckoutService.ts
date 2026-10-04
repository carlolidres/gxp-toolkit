import { getSupabaseClient, isSupabaseConfigured } from '../../../lib/supabase'
import type { PaidPlanCode } from './billingCatalog'
import type { BillingProviderName } from './billingTypes'
import {
  canOpenPaddleCheckout,
  canOpenPaymongoCheckout,
  paddleClientEnv,
  paddleClientToken,
} from './billingFlags'
import { buildBillingReturnUrl } from './billingUrls'

export type CheckoutSession = {
  transactionId: string
  checkoutUrl: string
}

export async function createBillingCheckout(input: {
  planCode: PaidPlanCode
  organizationId?: string
  provider?: BillingProviderName
}): Promise<CheckoutSession> {
  const provider = input.provider ?? 'paddle'
  if (provider === 'paymongo') {
    if (!canOpenPaymongoCheckout()) {
      throw new Error('PayMongo checkout is not enabled in this environment.')
    }
  } else if (!canOpenPaddleCheckout()) {
    throw new Error('Checkout is not enabled in this environment.')
  }
  if (!isSupabaseConfigured()) {
    throw new Error('Supabase is not configured.')
  }
  const client = getSupabaseClient()
  if (!client) throw new Error('Supabase is not configured.')

  const origin = window.location.origin
  const basePath = import.meta.env.BASE_URL || '/'
  const { data, error } = await client.functions.invoke('edoc-billing-checkout', {
    body: {
      planCode: input.planCode,
      organizationId: input.organizationId,
      provider,
      successUrl: buildBillingReturnUrl(origin, basePath, 'success'),
      cancelUrl: buildBillingReturnUrl(origin, basePath, 'cancelled'),
      environment: paddleClientEnv(),
    },
  })
  if (error) throw new Error(error.message)
  const payload = data as { transactionId?: string; checkoutUrl?: string; error?: string }
  if (payload?.error) throw new Error(payload.error)
  if (provider === 'paymongo') {
    if (!payload?.checkoutUrl) throw new Error('PayMongo checkout did not return a URL.')
    return {
      transactionId: payload.transactionId ?? payload.checkoutUrl,
      checkoutUrl: payload.checkoutUrl,
    }
  }
  if (!payload?.transactionId) throw new Error('Checkout did not return a transaction.')
  return {
    transactionId: payload.transactionId,
    checkoutUrl: payload.checkoutUrl ?? '',
  }
}

type PaddleCheckout = {
  Initialize: (options: { token: string; environment: 'sandbox' | 'production' }) => void
  Checkout: {
    open: (options: {
      transactionId: string
      settings?: { displayMode?: string; theme?: string; successUrl?: string }
    }) => void
  }
}

declare global {
  interface Window {
    Paddle?: PaddleCheckout
  }
}

function loadPaddleScript(): Promise<PaddleCheckout> {
  if (window.Paddle) return Promise.resolve(window.Paddle)
  return new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>('script[data-edoc-paddle]')
    if (existing) {
      existing.addEventListener('load', () => {
        if (window.Paddle) resolve(window.Paddle)
        else reject(new Error('Paddle.js did not initialize.'))
      })
      existing.addEventListener('error', () => reject(new Error('Paddle.js failed to load.')))
      return
    }
    const script = document.createElement('script')
    script.src = 'https://cdn.paddle.com/paddle/v2/paddle.js'
    script.async = true
    script.dataset.edocPaddle = 'true'
    script.onload = () => {
      if (window.Paddle) resolve(window.Paddle)
      else reject(new Error('Paddle.js did not initialize.'))
    }
    script.onerror = () => reject(new Error('Paddle.js failed to load.'))
    document.head.appendChild(script)
  })
}

export async function openPaddleCheckout(session: CheckoutSession): Promise<void> {
  const token = paddleClientToken()
  if (!token) throw new Error('Paddle client token is missing.')
  const paddle = await loadPaddleScript()
  paddle.Initialize({ token, environment: paddleClientEnv() })
  const successUrl = buildBillingReturnUrl(window.location.origin, import.meta.env.BASE_URL || '/', 'success')
  paddle.Checkout.open({
    transactionId: session.transactionId,
    settings: { displayMode: 'overlay', theme: 'light', successUrl },
  })
}

export async function startPaidCheckout(
  planCode: PaidPlanCode,
  organizationId?: string,
  provider: BillingProviderName = 'paddle',
): Promise<void> {
  const session = await createBillingCheckout({ planCode, organizationId, provider })
  if (provider === 'paymongo') {
    window.location.assign(session.checkoutUrl)
    return
  }
  try {
    await openPaddleCheckout(session)
  } catch {
    if (session.checkoutUrl) {
      window.location.assign(session.checkoutUrl)
      return
    }
    throw new Error('Paddle checkout could not be opened.')
  }
}
