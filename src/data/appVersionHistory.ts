export type AppVersionEntry = {
  version: string
  releaseDate: string
  changes: string[]
}

export const APP_DEVELOPER = 'Carlo M. Lidres'

export const APP_CURRENT_VERSION = 'v32'

/** Curated release notes — newest first. */
export const APP_VERSION_HISTORY: AppVersionEntry[] = [
  {
    version: 'v32',
    releaseDate: '2026-07-05',
    changes: [
      'APQR short IDs (4-character mixed-case alphanumeric)',
      'Scheduler refactor with inline add/edit rows',
      'Audit trail grants for client, scheduler, record, and follow-up actions',
      'Shared date input component across APQR forms',
    ],
  },
  {
    version: 'v31',
    releaseDate: '2026-07-04',
    changes: [
      'APQR Client Registry — stacked forms, searchable Account Manager combobox',
      'APQR Database — summary cards, filter/columns toolbar, sticky freeze-pane header',
      'Dashboard chart stack and KPI card responsive layout',
    ],
  },
  {
    version: 'v30',
    releaseDate: '2026-07-04',
    changes: [
      'eDoc module staging rollout — RLS validation, Edge Functions, Playwright smoke tests',
      'SQLite eDoc reference schema (19 tables) and verification scripts',
      'Disposable staging test accounts for regulated workflow checks',
    ],
  },
  {
    version: 'v28',
    releaseDate: '2026-07-03',
    changes: [
      'APQR module — Dashboard, Client Registry, Scheduler, Database, Form, Audit Trail',
      'Follow-up reminders with 7-day cycle and delay category prompts',
      'Archive-with-reason workflow and audit writes',
    ],
  },
  {
    version: 'v16',
    releaseDate: '2026-06-27',
    changes: [
      'VMP navigation group — Masterlist, Risk Assessment, Timeline, Database, Audit Trail',
      'Record details drawer with tabbed overview, documents, schedule, status, and audit',
    ],
  },
  {
    version: 'v14.5',
    releaseDate: '2026-06-25',
    changes: [
      '15-minute inactivity logout with tab-scoped sessionStorage auth',
      'Activity polling on focus, visibility, and interval checks',
      'Resilient local sign-out and permission cache cleanup',
    ],
  },
  {
    version: 'v8',
    releaseDate: '2026-06-23',
    changes: [
      'Admin default-password reset via Edge Function',
      'Forced password change gate for temporary credentials',
      'VRMS dashboard KPI sync and document preview cards',
    ],
  },
  {
    version: 'v1',
    releaseDate: '2026-06-21',
    changes: [
      'GxP Toolkit template — Vite + React + TypeScript starter',
      'VRMS sample module with mock data and SQLite schema reference',
      'Supabase-ready auth, permissions, and GitHub Pages deployment',
    ],
  },
]
