# eDoc Migration Map

| Reference eDoc | GxP Toolkit eDoc |
|---|---|
| Nhost Authentication | Supabase Authentication |
| Nhost user identity | Supabase `auth.users` linked to `profiles` |
| Hasura GraphQL | Supabase client, views, and PostgreSQL RPC |
| Hasura permissions | PostgreSQL Row-Level Security |
| Cloudflare Worker | Supabase Edge Functions |
| Cloudflare R2 | Private Supabase Storage buckets |
| Worker service-role writes | Edge Functions with `SUPABASE_SERVICE_ROLE_KEY` |
| Worker audit insert | `edoc_create_audit_event` and Edge Function inserts |
| R2 temporary URL | Supabase signed URL |
| Worker route advancement | `edoc_advance_route` transactional RPC |
| Worker signing endpoint | `edoc-sign-document` Edge Function |

## Reused GxP Toolkit Objects

- `auth.users`
- `profiles`
- `user_menu_permissions`
- Existing auth/session providers
- Existing app shell and route permission components

## New eDoc Objects

All tables, views, functions, and buckets added by `20260704100000_edoc_supabase_module.sql` are prefixed or named for eDoc.

## Known Limitations

- Signed PDF generation currently creates a signature record PDF; production stamping of the uploaded PDF is a next increment.
- Email notifications and reminder automation are not complete.
- Admin write screens are intentionally read-only/deferred until production authorization policy is confirmed.

