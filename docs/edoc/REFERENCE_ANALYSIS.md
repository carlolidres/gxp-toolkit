# eDoc Reference Analysis

## GxP Toolkit Host

- Framework: Vite, React 19, TypeScript, React Router 7, Vitest.
- Shell: existing `AppShell`, `VrmsAppLayout`, sidebar registry, topbar, theme, and toast providers.
- Auth: Supabase Auth through the existing lazy singleton in `src/lib/supabase.ts`.
- User model: Supabase `auth.users` linked to public `profiles`; menu grants are stored in `user_menu_permissions`.
- Existing collisions: GxP Toolkit already has `documents`, `workflow_steps`, `signature_requests`, and VRMS `audit_events`; eDoc therefore uses `edoc_*` database objects.
- Notifications: existing app feedback/messages pattern is present; eDoc adds `edoc_notifications` and can later bridge to app-wide message UI.

## Standalone eDoc Reference

- Frontend: React/Vite, Nhost Auth, Hasura GraphQL, TanStack Query, PDF.js, PDF-lib.
- Backend: Cloudflare Worker for privileged route, file, signing, and certificate operations.
- Storage: Cloudflare R2 private objects.
- Schema: 48-table SQLite-first design covering organizations, documents, routes, signatures, comments, notifications, audit, and settings.

## Adopted

- Five-step wizard, workflow states, route actions, field types, route completion rules, immutable versioning, audit event vocabulary, private-file pattern, and explicit signing evidence requirements.

## Reimplemented For Supabase

- Nhost Auth -> Supabase Auth.
- Hasura GraphQL -> Supabase client, RLS, views, and PostgreSQL RPC.
- Cloudflare Worker -> Supabase Edge Functions.
- Cloudflare R2 -> private Supabase Storage buckets.

