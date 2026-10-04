# Reusable prompt — Admin-approved forgot password (Gmail SMTP)

Copy the block below into a new project chat (Codex / Cursor / Claude). Replace placeholders in `[brackets]`.

---

## Agent prompt (paste this)

```text
Implement a secure admin-approved forgot-password flow for [APP_NAME] using Supabase Auth + Gmail SMTP (no Resend, no verified custom domain).

## Security requirement (do not skip)

Self-service password reset must NOT issue a temporary password immediately after the user enters an email. That is a vulnerability.

Required workflow:
1. User submits Forgot password with their email → system records a pending reset request only.
2. System notifies administrator(s) (in-app message/notification is acceptable).
3. Admin User Management page shows a "Reset Password" action ONLY for accounts with a valid pending request.
4. Admin clicks Reset Password → system generates a random 16-character temporary password (uppercase, lowercase, digits, special characters), emails it to the user's registered address via Gmail SMTP, sets must-change-password on the account, clears the pending request.
5. User signs in with the temporary password → app forces /reset-password before any other route.

## Stack assumptions

- Frontend: [e.g. Vite + React + TypeScript + HashRouter]
- Auth: Supabase email/password (profiles table linked via auth_user_id)
- Backend: Supabase Edge Functions (Deno) — never expose service role or Gmail credentials in the client
- Email: Gmail SMTP via nodemailer (`npm:nodemailer@6.x`) in the admin-approve edge function only
- Reference implementation: gxp-toolkit — supabase/functions/forgot-password, supabase/functions/admin-reset-password, ForgotPasswordPage, UserManagementPage

## Database

Add to profiles (or equivalent user profile table):
- password_reset_requested_at TIMESTAMPTZ NULL — set on forgot-password request, cleared on admin approval
- must_change_password BOOLEAN — already may exist; set true when admin approves
- password_reset_at, password_reset_by — audit fields on approval

SQLite-first if this repo uses database/sqlite/ before Supabase migration.

## Edge functions

### forgot-password (verify_jwt = false)
- POST { email }
- Validate email format
- Enumeration-safe response: always return generic success message whether account exists or not
- For valid active email/password accounts: set password_reset_requested_at, insert admin notification (e.g. app_feedback_messages with prefix "[Password reset request]")
- Do NOT change Auth password, do NOT return temporaryPassword to the client

### admin-reset-password (verify_jwt = true, admin-only via is_admin RPC or equivalent)
- POST { profileId }
- Require pending password_reset_requested_at
- Generate 16-char cryptographically random password (all character classes)
- Email FIRST via Gmail SMTP (so SMTP failure does not leave unknown password on account):
  - host: smtp.gmail.com, port: 465, secure: true
  - auth: GMAIL_USER + GMAIL_APP_PASSWORD (App Password, not normal Gmail password)
- Then: auth.admin.updateUserById password, global signOut, set must_change_password=true, clear password_reset_requested_at
- Never return temporary password in API response

## Supabase secrets (Edge Functions only — NOT VITE_*)

Set one secret per row in Dashboard → Edge Functions → Secrets (Name + Value), or CLI:

GMAIL_USER=[your@gmail.com]
GMAIL_APP_PASSWORD=[16-char Google App Password — spaces OK]
PASSWORD_RESET_FROM_EMAIL=[App Name] <[your@gmail.com]>  (optional; defaults to GxP-style from GMAIL_USER)

Google setup: 2-Step Verification ON → App passwords → https://myaccount.google.com/apppasswords

Do NOT use Resend or DEFAULT_RESET_PASSWORD for this flow unless explicitly requested.

## Frontend

- /forgot-password — request-only form; success message explains admin approval + email delivery; no temp password displayed
- /login — link to forgot-password; no inline reset
- /reset-password — mandatory when mustChangePassword after temp login (ProtectedRoute gate)
- Admin users page — show "Reset requested" badge; "Reset Password" button only when passwordResetRequestedAt is set

## Client services

- requestPasswordReset(email) → { success, message } only (no temporaryPassword)
- resetUserPassword(profileId) — admin invoke admin-reset-password
- listUsers includes password_reset_requested_at for admin UI

## Verification

- npm run build + relevant tests
- Mock mode: pending request flag + console log temp password (no real email)
- Supabase: migration applied, both functions deployed, secrets set
- Manual: forgot → admin notify → reset → Gmail inbox → temp login → forced password change

## Troubleshooting doc for owner

If "Edge Function returned a non-2xx status code":
1. Check Edge Function logs for admin-reset-password
2. Confirm secrets are separate rows (not one pasted blob with "KEY = value")
3. Confirm user had pending request and admin role
4. Gmail SMTP errors: verify App Password, same email as GMAIL_USER; check logs for ETIMEDOUT (SMTP blocked)

Update HANDOFF.md with verification results and secret names (never commit secret values).
```

---

## Short variant (quick paste)

```text
Add admin-approved forgot password to [APP_NAME]: forgot-password only sets password_reset_requested_at + notifies admin; no temp password to user. Admin Reset Password (pending only) emails random 16-char password via Gmail SMTP (nodemailer, GMAIL_USER + GMAIL_APP_PASSWORD secrets). must_change_password forces /reset-password after temp login. Supabase Edge Functions only for email; reference gxp-toolkit implementation.
```

---

## Owner checklist (after agent completes)

- [ ] Google App Password created for sending Gmail
- [ ] Supabase secrets: `GMAIL_USER`, `GMAIL_APP_PASSWORD`, optional `PASSWORD_RESET_FROM_EMAIL`
- [ ] `forgot-password` and `admin-reset-password` deployed
- [ ] Migration: `password_reset_requested_at` on profiles
- [ ] End-to-end test with a real user email
- [ ] Revoke and rotate App Password if it was ever pasted in chat or screenshots
