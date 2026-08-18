# eDoc billing test matrix (blueprint §49)

Owner or QA checks. Do not mark a row done unless it was executed.

Environment: sandbox first. Repeat on live only after `go-live-checklist.md`.

## New subscription

- [ ] Free → Personal monthly
- [ ] Free → Personal annual
- [ ] Free → Professional
- [ ] Free → Business
- [ ] Successful payment (webhook activates; success page does not)
- [ ] Failed payment
- [ ] Abandoned checkout

## Renewal

- [ ] Normal renewal
- [ ] Failed renewal
- [ ] Recovery after failed payment
- [ ] Cancellation after failed payment

## Plan change

- [ ] Upgrade immediately
- [ ] Downgrade at renewal
- [ ] Downgrade blocked by seat count
- [ ] Upgrade after reaching usage limit

## Webhook

- [ ] Valid signature
- [ ] Invalid signature rejected
- [ ] Duplicate webhook returns 200 and does not double-provision
- [ ] Out-of-order webhook
- [ ] Processing failure marked FAILED
- [ ] Provider retry
- [ ] Reconcile repairs a missed `subscription.updated`

## Access

- [ ] ACTIVE
- [ ] TRIALING
- [ ] PAST_DUE (14-day grace, banner)
- [ ] PAUSED (no new sends; in-flight sign allowed)
- [ ] Scheduled cancellation
- [ ] CANCELED after period end → Free for new sends; records kept
- [ ] FREE

## Usage

- [ ] Below document limit
- [ ] At document limit
- [ ] Simultaneous last-allowance sends (only one succeeds)
- [ ] Billable seats exclude auto-added assignees
- [ ] Public `/#/verify/:code` stays free
