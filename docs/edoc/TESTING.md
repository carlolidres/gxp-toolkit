# eDoc Testing

## Commands

```powershell
npm run lint
npm run typecheck
npm run test
npm run build
npx playwright test
```

## Current Automated Coverage

- Route threshold and activation rules.
- Route completion checks.
- Field type mapping by route action.
- PDF coordinate normalization and denormalization.
- PDF metadata validation, magic bytes, and SHA-256 hashing.

## Required Supabase Validation

Run after applying migrations locally:

- Cross-organization document access is denied.
- Unauthorized assignment action is denied.
- Completed/signed version updates are denied.
- Audit updates and deletes raise errors.
- Storage signed URL generation fails without document access.

## Manual Workflow

Sign in, create document, validate PDF upload, configure route, place fields, send, open inbox assignment, complete or sign, confirm audit trail and document status.

