# Current Handoff

Last Updated: `2026-07-25`
Version: `v39`
Branch: `main`
Commit: pending push
Deployment: pending GitHub Pages

## Current Status

v39 release packaged: Account Settings organization/job title/signature, eDoc profile-backed signatory fields, PDF worker base-path fix, and `edoc_create_and_start_route` `v_profile_id` ambiguity fix.

## Key implementation notes

- Profile: `organization`, `job_title`, `signature_data_url` + organization options service/UI.
- Signatory completeness: `src/lib/signatoryProfileCompleteness.ts`; Account Settings banner; EdocWorkspace gate.
- PDF preview: Vite copies worker to `public/pdf.worker.min.mjs`; `usePdfDocument` uses `BASE_URL`.
- RPC fix: migration `20260725140000_fix_edoc_profile_id_ambiguity.sql` applied.

## Verification

| Check | Status | Result |
|---|---|---|
| `npm run type-check` | `PASSED` | earlier this session |
| Supabase migrations (signature/org/job_title/profile_id) | `PASSED` | applied to linked project |
| Deploy | `PENDING` | after push |

## Next Action

1. Confirm GitHub Pages deploy succeeds after push.
2. Smoke-check Account Settings + Create Document send.

## Prior stable release

- Previous: `v38` — eDoc create/routing/placement — GitHub Pages run [30007528364](https://github.com/carlolidres/gxp-toolkit/actions/runs/30007528364).
