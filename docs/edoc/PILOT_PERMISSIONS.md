# eDoc Pilot Permissions (Staging)

> **Browser smoke / Playwright:** use disposable accounts in [`STAGING_TEST_ACCOUNTS.md`](STAGING_TEST_ACCOUNTS.md) — **not** real team emails.

## Staging test accounts (Phase 4+)

| Role | Email | Org member? |
|------|-------|-------------|
| Reviewer / assignee | `edoc-reviewer@example.test` | Yes |
| Document creator | `edoc-creator@example.test` | Yes |
| RLS outsider | `edoc-outsider@example.test` | No |

Provision + seed: `npm run edoc:provision-test-users` → `npm run edoc:seed-staging-test`.

---

## Historical note — real-user pilot seed (deprecated)

`seed_edoc_pilot.sql` previously targeted real staging profiles. That seed is **deprecated** for smoke testing. To detach real users:

```powershell
npm run edoc:revert-real-user-pilot
npm run edoc:seed-staging-test
```

| Role | Email (historical — do not use for smoke) |
|------|-------------------------------------------|
| Reviewer | ghinogabriel@gmail.com |
| Creator | mmbuen@pharmaindustries.com |
| Outsider | isaiah014290118@gmail.com |

## Adjusting permissions in User Management

1. Sign in as **admin** → **User Management**
2. Select user → **Permission matrix** → toggle eDoc menus → **Save**
3. **All Documents** is off by default for non-admins. Enable **View** on `edoc-all-documents` to show it in the sidebar.
4. **Document Controller:** on the eDocuSign matrix header, check **Document Controller** then **Save**. This sets org `membership_role = controller` and grants the full eDoc menu preset (All Documents, Templates, Admin, Reports, Returned/Completed). Self-assign (admin nominating themselves) requires a confirm modal and is limited to the admin’s own Account Settings organization.
5. Pilot sidebar menus: Dashboard, My Inbox, Create Document, My Documents, All Documents (opt-in), Audit Trail.
6. Routing Templates, Reports, Administration, Returned, and Completed remain in the matrix / direct routes but are hidden from the sidebar unless granted (Document Controller grants them).

Changes write to `user_menu_permissions` and `edoc_organization_members` (same shape as seed scripts).

## External Document Controller authorization (pilot)

External detection compares normalized Account Settings `profiles.organization` between the document creator and each routing assignee (Option A). Document Controllers are resolved from the creator’s eDoc org (`edoc_organization_members.membership_role = 'controller'`, `status = 'active'`).

| Scenario | Expected behavior |
|----------|-------------------|
| All assignees same org as creator | Existing routing unchanged (no DC step). |
| Any assignee org differs + ≥1 active DC | Route prepends `step_kind = external_auth` approve step (`completion_rule = any`). DCs see inbox first; external assignees are **not** org-bootstrapped until approve. |
| Any assignee org differs + zero DCs | Send blocked; audit `external_auth_blocked_no_controller`; org peers + app Admins notified. Admin banner lists orgs missing a controller. |
| First DC approves | Sibling DC assignments invalidated; remaining DCs notified; external members bootstrapped; signatory steps activate. |
| First DC rejects (reason required) | Route/document rejected; creator + remaining DCs notified; external steps never activate. |
| Second DC acts after lock | Error: “This authorization request was already completed.” |

Client preflight: Create Document warns on external recipients and blocks when creator org is missing or no DC is listed (`edoc_list_org_document_controllers`). Workspace shows an “External document authorization” banner for `external_auth` tasks.

Audit event types (append-only `edoc_audit_events`): `external_auth_required`, `external_auth_blocked_no_controller`, `external_auth_requested`, `external_auth_approved` / `external_auth_rejected`, `external_auth_siblings_notified`, `external_auth_transmitted`, `document_controller_assigned` / `document_controller_removed`.

## Visible signature stamp + Final Signed PDF (pilot)

1. Place **Signature** fields on Create → Field placement (coordinates stored on the assignment).
2. Complete Account Settings: organization + PNG e-signature.
3. In Signing Workspace, choose a preset **Signature meaning** (Prepared by / Reviewed by / Checked by / Approved by / QA Approved / Acknowledged by), consent, re-enter password, Sign.
4. The server stamps an eSig-style block onto a cumulative signed PDF (profile PNG + name/reason/date/email). Originals are preserved.
5. When the route reaches **Completed**, `edoc-finalize-document` appends a GxP Toolkit history page from the audit trail and stores the **Final Signed PDF**.
6. Document view download prefers Final Signed PDF → Signed PDF → Original.
