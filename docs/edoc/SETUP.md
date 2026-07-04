# eDoc Setup

## Environment

Frontend:

```text
VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...
```

Edge Functions:

```text
SUPABASE_URL=...
SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
```

## Apply

1. Back up the Supabase project.
2. Apply `supabase/migrations/20260704100000_edoc_supabase_module.sql`.
3. Deploy functions:

```powershell
supabase functions deploy edoc-file-access
supabase functions deploy edoc-sign-document
supabase functions deploy edoc-create-certificate
```

4. Confirm private buckets exist and are private:
   `edoc-originals`, `edoc-versions`, `edoc-signed`, `edoc-attachments`, `edoc-certificates`.
5. Add eDoc menu permissions for non-admin users through User Management.
6. Create or confirm `edoc_organization_members` rows for test users.

