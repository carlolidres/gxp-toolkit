# eDoc Architecture

```text
Browser
  -> existing GxP Toolkit auth/session/theme/shell
  -> eDoc React pages and hooks
  -> Supabase client for authorized reads and RPC calls
  -> Edge Functions for privileged file/signature/certificate operations
      -> PostgreSQL/RLS/RPC
      -> Private Supabase Storage
```

## Trust Boundaries

- Browser code contains only public Supabase URL and anon key.
- Service-role key is used only by Edge Functions.
- RLS and RPC enforce workflow authorization; hidden UI controls are not security.
- Storage buckets are private; previews and downloads use short-lived signed URLs generated after authorization checks.

## Native Integration

eDoc reuses the current `AppShell`, `MenuPermissionRoute`, `useAuth`, `usePermissions`, `getSupabaseClient`, styling variables, and `profiles` model.

