import {
  STATUSES_ALLOWING_IN_FLIGHT_SIGN,
  STATUSES_ALLOWING_NEW_SEND,
  type InternalSubscriptionStatus,
} from './billingTypes'

/** Paddle Billing subscription.status values → eDoc internal status. One adapter only. */
export function mapPaddleSubscriptionStatus(paddleStatus: string): InternalSubscriptionStatus {
  switch (paddleStatus.trim().toLowerCase()) {
    case 'trialing':
      return 'TRIALING'
    case 'active':
      return 'ACTIVE'
    case 'past_due':
      return 'PAST_DUE'
    case 'paused':
      return 'PAUSED'
    case 'canceled':
    case 'cancelled':
      return 'CANCELED'
    default:
      return 'EXPIRED'
  }
}

export function isInFlightSignAllowed(status: InternalSubscriptionStatus): boolean {
  return STATUSES_ALLOWING_IN_FLIGHT_SIGN.has(status)
}

export function isNewSendAllowedByStatus(status: InternalSubscriptionStatus): boolean {
  return STATUSES_ALLOWING_NEW_SEND.has(status)
}
