import { APP_NAME } from '../config/appNavigation'
import { LegalDocumentLayout } from './legal/LegalDocumentLayout'

export function RefundCancelPage() {
  return (
    <LegalDocumentLayout
      title="Refunds and cancellation"
      lead={`${APP_NAME} eDoc subscriptions are billed by Paddle as merchant of record. eDoc does not store card numbers and does not take payment through Wise.`}
    >
      <section>
        <h2>Who handles payment</h2>
        <p>
          Paddle collects charges, issues receipts, calculates tax where required, and runs dunning for failed
          renewals. Refund requests follow Paddle&apos;s process. This application never sees PAN or CVV data.
        </p>
      </section>
      <section>
        <h2>Cancellation</h2>
        <p>
          Organization owners and admins may cancel at period end from Billing settings. Paid access continues
          until the current period ends. Immediate cancel is not offered in the product. After the period ends,
          the organization returns to the Free plan for new document sends.
        </p>
      </section>
      <section>
        <h2>What cancel does not do</h2>
        <p>
          Cancel does not delete Final Signed PDFs, certificates, signature events, page-integrity codes, or
          audit rows. Assignees may still complete in-flight routes. Public verification links stay available.
        </p>
      </section>
      <section>
        <h2>Failed renewal</h2>
        <p>
          If a renewal payment fails, the subscription may enter past-due status. eDoc keeps paid send access
          for 14 days while Paddle retries, then treats the organization like a canceled-after-period account
          for new sends.
        </p>
      </section>
    </LegalDocumentLayout>
  )
}
