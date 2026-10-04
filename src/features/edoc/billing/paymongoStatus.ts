import type { InternalSubscriptionStatus } from './billingTypes'

/** PayMongo subscription.status → eDoc internal status. One adapter only. */
export function mapPaymongoSubscriptionStatus(paymongoStatus: string): InternalSubscriptionStatus {
  switch (paymongoStatus.trim().toLowerCase()) {
    case 'incomplete':
      return 'PENDING'
    case 'incomplete_cancelled':
    case 'incomplete_canceled':
      return 'EXPIRED'
    case 'active':
      return 'ACTIVE'
    case 'past_due':
      return 'PAST_DUE'
    case 'unpaid':
      return 'PAST_DUE'
    case 'paused':
      return 'PAUSED'
    case 'cancelled':
    case 'canceled':
      return 'CANCELED'
    default:
      return 'EXPIRED'
  }
}
