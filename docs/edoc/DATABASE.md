# eDoc Database

## Prefix Strategy

All eDoc objects use the `edoc_` prefix to avoid collisions with existing GxP Toolkit and VRMS tables.

## Core Tables

- Organization: `edoc_organizations`, `edoc_organization_members`.
- Documents: `edoc_documents`, `edoc_document_versions`, `edoc_document_files`, `edoc_document_access_grants`.
- Routing: `edoc_routing_templates`, `edoc_document_routes`, `edoc_route_steps`, `edoc_route_step_assignees`, `edoc_route_step_actions`.
- Signatures: `edoc_signature_fields`, `edoc_signature_events`, `edoc_completion_certificates`.
- Collaboration: `edoc_comments`, `edoc_notifications`.
- Compliance/system: `edoc_audit_events`, `edoc_file_access_logs`, `edoc_settings`.

## RPC Functions

- `edoc_create_and_start_route(jsonb)`
- `edoc_start_route(text)`
- `edoc_advance_route(text, text, text, text, text)`
- `edoc_return_document(text, text, text, text)`
- `edoc_complete_acknowledgment(text, text, text)`
- `edoc_create_revision(text, text)`
- `edoc_create_audit_event(...)`

## Views

- `edoc_assignment_inbox`

## Storage Buckets

- `edoc-originals`
- `edoc-versions`
- `edoc-signed`
- `edoc-attachments`
- `edoc-certificates`

