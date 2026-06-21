# Version 0 — Baseline Project Definition

Baseline File:

```text
agent-history/version-0-baseline.md
```

Status:

```text
[DRAFT | FOR_REVIEW | APPROVED]
```

Created Date:

```text
[YYYY-MM-DD]
```

Project Owner:

```text
[PROJECT_OWNER]
```

## Purpose

This file is the permanent approved baseline for **[PROJECT_NAME]**.

It defines the project objective, scope, business requirements, architecture, security controls, data model, workflow, verification expectations, and implementation constraints.

This file may only be revised with explicit project-owner approval. Future implementation changes must be documented through versioned handoff files.

---

# Project Information

- Project name: `[PROJECT_NAME]`
- Project folder: `[PROJECT_FOLDER_PATH]`
- Repository: `[REPOSITORY_URL_OR_NAME]`
- Project type: `[NEW_APPLICATION | MIGRATION | MODERNIZATION | ENHANCEMENT]`
- Project owner: `[PROJECT_OWNER]`
- Reviewers: `[REVIEWERS]`

# Project Objective

`[APPROVED_PROJECT_OBJECTIVE]`

# Scope

## In Scope

- `[IN_SCOPE_ITEM_1]`
- `[IN_SCOPE_ITEM_2]`
- `[IN_SCOPE_ITEM_3]`

## Out of Scope

- `[OUT_OF_SCOPE_ITEM_1]`
- `[OUT_OF_SCOPE_ITEM_2]`

# Business Goals

1. `[BUSINESS_GOAL_1]`
2. `[BUSINESS_GOAL_2]`
3. `[BUSINESS_GOAL_3]`
4. `[BUSINESS_GOAL_4]`
5. `[BUSINESS_GOAL_5]`

# Success Criteria

- `[MEASURABLE_SUCCESS_CRITERION_1]`
- `[MEASURABLE_SUCCESS_CRITERION_2]`
- `[MEASURABLE_SUCCESS_CRITERION_3]`
- `[SECURITY_OR_COMPLIANCE_CRITERION]`
- `[RELEASE_READINESS_CRITERION]`

# Users, Roles, and Permissions

| Role | Data Scope | Allowed Modules | Allowed Actions |
|---|---|---|---|
| `[ROLE_1]` | `[SCOPE]` | `[MODULES]` | `[ACTIONS]` |
| `[ROLE_2]` | `[SCOPE]` | `[MODULES]` | `[ACTIONS]` |
| `[ADMIN_ROLE]` | `[SCOPE]` | `[MODULES]` | `[ACTIONS]` |
| `[VIEWER_OR_AUDITOR_ROLE]` | `[SCOPE]` | `[MODULES]` | `[ACTIONS]` |

Authorization requirements:

- UI visibility does not replace backend enforcement.
- Direct-route access must enforce the same permissions.
- Permission and user-status changes must be auditable.
- Least-privilege access shall be applied.

# Approved Workflow

```text
[INITIATION]
  → [REVIEW]
  → [APPROVAL]
  → [IMPLEMENTATION]
  → [VERIFICATION]
  → [COMPLETION_OR_CLOSURE]
```

Approved statuses:

```text
[STATUS_1]
[STATUS_2]
[STATUS_3]
[STATUS_4]
```

Workflow rules:

- `[WORKFLOW_RULE_1]`
- `[WORKFLOW_RULE_2]`
- `[WORKFLOW_RULE_3]`
- `[WORKFLOW_RULE_4]`

# Technology Stack

## Current Source Application

- Frontend: `[CURRENT_FRONTEND]`
- Backend: `[CURRENT_BACKEND]`
- Database: `[CURRENT_DATABASE]`
- Authentication: `[CURRENT_AUTHENTICATION]`
- Hosting: `[CURRENT_HOSTING]`

## Target Application

- Frontend: `[TARGET_FRONTEND]`
- Backend: `[TARGET_BACKEND]`
- Database: `[TARGET_DATABASE]`
- Authentication: `[TARGET_AUTHENTICATION]`
- Hosting: `[TARGET_HOSTING]`
- UI framework: `[TARGET_UI_FRAMEWORK]`

# Architecture Decisions

1. `[ARCHITECTURE_DECISION_1]`
2. `[ARCHITECTURE_DECISION_2]`
3. `[ARCHITECTURE_DECISION_3]`
4. Database changes shall use version-controlled migrations.
5. Sensitive operations shall not rely exclusively on client-side validation.
6. Audit records shall be protected from unauthorized modification or deletion.
7. Existing approved behavior shall be preserved unless a change is approved and documented.
8. Deployment shall use a repeatable and verifiable process.

# Data Model

Authoritative schema location:

```text
[MIGRATIONS_OR_SCHEMA_PATH]
```

Primary entities:

| Entity | Purpose | Primary Key |
|---|---|---|
| `[ENTITY_1]` | `[PURPOSE]` | `[KEY]` |
| `[ENTITY_2]` | `[PURPOSE]` | `[KEY]` |
| `[ENTITY_3]` | `[PURPOSE]` | `[KEY]` |

Key relationships:

```text
[RELATIONSHIP_TREE_OR_DESCRIPTION]
```

Critical data rules:

- `[DATA_RULE_1]`
- `[DATA_RULE_2]`
- `[DATA_RULE_3]`
- `[DUPLICATE_PREVENTION_RULE]`
- `[SOFT_DELETE_OR_RETENTION_RULE]`

# Notifications

Notification triggers:

- `[TRIGGER_1]`
- `[TRIGGER_2]`
- `[TRIGGER_3]`

Recipients and escalation:

- `[RECIPIENT_OR_ESCALATION_RULE_1]`
- `[RECIPIENT_OR_ESCALATION_RULE_2]`

Duplicate-notification rule:

```text
[DUPLICATE_PREVENTION_RULE]
```

# Dashboard and Reporting

Required dashboards and KPIs:

- `[KPI_1]`
- `[KPI_2]`
- `[KPI_3]`
- `[KPI_4]`

Required reports and exports:

- `[REPORT_1]`
- `[REPORT_2]`
- Export formats: `[FORMATS]`
- Export scope: `[FILTERED_DATA | AUTHORIZED_DATASET | USER_SELECTABLE]`

# Audit Trail

Audit records shall include:

- Affected record
- Module or table
- Action
- Old value and new value, when applicable
- Responsible user
- Date and time
- Reason or comment, when required

Audit requirements:

- `[AUDIT_REQUIREMENT_1]`
- `[AUDIT_REQUIREMENT_2]`
- `[RETENTION_REQUIREMENT]`
- Audit records must not contain passwords, tokens, or restricted secrets.

# Security Requirements

1. `[AUTHENTICATION_REQUIREMENT]`
2. `[AUTHORIZATION_REQUIREMENT]`
3. `[ROW_OR_RECORD_LEVEL_SECURITY_REQUIREMENT]`
4. `[SESSION_SECURITY_REQUIREMENT]`
5. `[PASSWORD_MFA_OR_LOCKOUT_REQUIREMENT]`
6. `[INPUT_VALIDATION_REQUIREMENT]`
7. `[SECRET_STORAGE_REQUIREMENT]`
8. Do not commit real credentials or environment files.
9. Do not expose privileged credentials to browser code.
10. Rotate any exposed credential before production use.

# Migration Requirements

- Source: `[MIGRATION_SOURCE]`
- Scope: `[MIGRATION_SCOPE]`
- Mapping: `[DATA_MAPPING_PATH]`
- Duplicate handling: `[RULE]`
- Re-import behavior: `[RULE]`
- Reconciliation: `[METHOD]`
- Rollback: `[METHOD]`
- Approval evidence: `[REQUIRED_EVIDENCE]`

# Non-Functional Requirements

- Page-load target: `[TARGET]`
- Dashboard-response target: `[TARGET]`
- Supported users: `[TARGET]`
- Availability target: `[TARGET]`
- Supported browsers and devices: `[REQUIREMENT]`
- Accessibility target: `[REQUIREMENT]`
- Backup and recovery: `[REQUIREMENT]`
- Compliance and retention: `[REQUIREMENT]`

# Verification Requirements

Required checks:

- `[LINT_REQUIREMENT]`
- `[TYPECHECK_REQUIREMENT]`
- `[UNIT_TEST_REQUIREMENT]`
- `[INTEGRATION_TEST_REQUIREMENT]`
- `[SMOKE_TEST_REQUIREMENT]`
- `[SECURITY_TEST_REQUIREMENT]`
- `[MIGRATION_VERIFICATION_REQUIREMENT]`
- `[PRODUCTION_BUILD_REQUIREMENT]`
- `[USER_ACCEPTANCE_REQUIREMENT]`

# Definition of Done

A task is complete only when:

- The requested behavior is implemented.
- Applicable verification is completed.
- Relevant documentation is updated.
- The current handoff is updated.
- A versioned handoff is created when required.
- Known issues, risks, and next steps are documented.
- Git and deployment evidence is recorded when those actions were requested.

# Version Handover Workflow

Current operational status:

```text
agent-workflow/HANDOFF.md
```

Historical version handoffs:

```text
agent-history/version-X-handoff.md
```

Each historical handoff must reference this baseline and record the implementation scope, files changed, verification, known issues, commit, deployment, rollback, and next steps.

# Reviewers Feedback

- Reviewers: `[REVIEWER_LIST]`
- Comments: `[REVIEWER_COMMENTS]`

# Baseline Approval

- Baseline version: `v0`
- Status: `[DRAFT | FOR_REVIEW | APPROVED]`
- Approved by: `[APPROVER_NAME_OR_ROLE]`
- Approval date: `[YYYY-MM-DD]`

This baseline remains the permanent source of truth unless explicitly revised and approved by the project owner.
