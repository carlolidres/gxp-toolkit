# eDoc Implementation Plan

## Implemented In This Increment

- Native sidebar group and protected routes for eDoc.
- React pages for dashboard, inbox, document lists, create wizard, workspace, reports, audit, routing templates, and administration.
- Supabase migration with prefixed `edoc_*` tables, RLS helpers, storage buckets, inbox view, route RPCs, revision RPC, audit RPC, and create/send RPC.
- Edge Functions for file access, electronic signing, and certificate creation.
- Unit tests for route logic, field mapping/coordinate conversion, and PDF validation/hash utilities.

## Deferred

- Full production PDF rendering/annotation with PDF.js canvas.
- Writing real visual signatures into the uploaded source PDF rather than generating a signature record PDF.
- Reminder/escalation automation.
- Email delivery integration.
- Live credential E2E tests.
- Administrative write UI for eDoc configuration.

## Next Increment

Apply the migration in a local Supabase stack, seed test users, validate RLS denial scenarios, and replace the mock PDF preview with signed URL + PDF.js rendering.

