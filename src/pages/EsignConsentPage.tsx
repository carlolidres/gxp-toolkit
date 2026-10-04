import { APP_NAME } from '../config/appNavigation'
import { LegalDocumentLayout } from './legal/LegalDocumentLayout'

export function EsignConsentPage() {
  return (
    <LegalDocumentLayout
      title="Electronic signature consent"
      lead={`By creating or signing a document in ${APP_NAME} eDoc, you agree to use electronic records and signatures for that workflow.`}
    >
      <section>
        <h2>Consent</h2>
        <p>
          You consent to receive, review, and sign documents electronically in this application, and to the
          creation of a certificate of completion and related audit events for those documents.
        </p>
      </section>
      <section>
        <h2>What this is not</h2>
        <p>
          Availability of e-signature features does not by itself constitute certification or validation under
          21 CFR Part 11, Annex 11, or any other regulatory framework. The deploying organization remains
          responsible for its own validation and intended use.
        </p>
      </section>
      <section>
        <h2>Public verification</h2>
        <p>
          Anyone with a verification code or QR link may check a completed document without signing in. That
          public verify path is not paywalled.
        </p>
      </section>
      <section>
        <h2>Paper alternative</h2>
        <p>
          If your organization requires a wet-ink process instead of electronic signature, do not use eDoc for
          that record. Contact your administrator for the procedure that applies to your site.
        </p>
      </section>
    </LegalDocumentLayout>
  )
}
