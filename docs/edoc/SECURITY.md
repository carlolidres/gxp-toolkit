# eDoc Security

## Authorization

- eDoc route visibility uses GxP Toolkit menu permissions.
- Backend authorization uses RLS, helper functions, and transactional RPCs.
- Assignment completion requires the authenticated profile to own the active assignment.
- Return and rejection require a reason.
- Audit events are append-only through database triggers.

## Electronic Signature

Signing requires:

- Authenticated user session.
- Active assignment.
- Password re-authentication in the Edge Function.
- Explicit consent.
- Signature meaning.
- Version hash input.
- Signature event and audit evidence.

Typed names are only visual representations; the security evidence is the authenticated, authorized, timestamped, version-bound signature event.

## Secrets

Never place service-role keys, JWT secrets, storage admin credentials, email secrets, or signing secrets in frontend code. Edge Functions read privileged secrets from Supabase function secrets.

## Compliance Notice

This module supports controlled workflow and audit patterns, but it does not claim automatic compliance with GMP, 21 CFR Part 11, EU Annex 11, GAMP 5, the Philippine Data Privacy Act, or the Electronic Commerce Act.

