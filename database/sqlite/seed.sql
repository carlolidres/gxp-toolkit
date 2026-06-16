-- GxP Toolkit — seed data aligned with src/data/mockAuth.ts and src/data/mockDocuments.ts

PRAGMA foreign_keys = ON;

-- Users (mockAuth.ts)
INSERT OR REPLACE INTO users (id, name, email, role, initials) VALUES
  ('u-1', 'Avery Morgan', 'admin@example.com',   'Admin',   'AM'),
  ('u-2', 'Jordan Lee',   'manager@example.com', 'Manager', 'JL'),
  ('u-3', 'Sam Rivera',   'editor@example.com',  'Editor',  'SR'),
  ('u-4', 'Taylor Chen',  'viewer@example.com',  'Viewer',  'TC');

-- Documents (mockDocuments.ts)
INSERT OR REPLACE INTO documents (
  id, code, title, category, owner, version, status,
  effective_date, review_date, expiry_date, controlled_copy
) VALUES
  ('d1', 'SOP-104', 'Batch Record Review',       'Standard Operating Procedure', 'Maya Chen',  '4.0', 'For Approval',      '2026-07-01', '2027-07-01', NULL,         1),
  ('d2', 'QMS-220', 'Deviation Management',      'Quality Manual',               'Jordan Lee', '2.1', 'Effective',         '2026-02-15', '2027-02-15', NULL,         1),
  ('d3', 'FRM-088', 'Equipment Cleaning Log',    'Form',                         'Priya Shah', '1.3', 'For Review',        '2026-08-01', '2027-08-01', NULL,         0),
  ('d4', 'POL-012', 'Electronic Records Policy', 'Policy',                       'Alex Brooks','3.0', 'Pending Signature', '2026-09-01', '2027-09-01', NULL,         1),
  ('d5', 'WI-450',  'Line Clearance',            'Work Instruction',             'Sam Rivera', '5.2', 'Superseded',        '2025-01-10', '2026-01-10', '2026-08-01', 0);

-- Workflow steps (mockWorkflow.ts) — linked to d1 (Batch Record Review)
INSERT OR REPLACE INTO workflow_steps (id, document_id, step_order, role, assignee, status, due_date, comments) VALUES
  ('w1', 'd1', 1, 'Document Owner', 'Maya Chen',   'Approved',    '2026-06-08', 'Draft submitted.'),
  ('w2', 'd1', 2, 'Reviewer',       'Jordan Lee',  'Approved',    '2026-06-11', 'Technical review complete.'),
  ('w3', 'd1', 3, 'QA',             'Priya Shah',  'In Progress', '2026-06-15', NULL),
  ('w4', 'd1', 4, 'Approver',       'Alex Brooks', 'Pending',     '2026-06-18', NULL);

-- Signature requests (mockSignatures.ts) — linked to d4
INSERT OR REPLACE INTO signature_requests (
  id, document_id, document_title, recipient, role, status, requested_at, completed_at
) VALUES
  ('s1', 'd4', 'Electronic Records Policy', 'Jordan Lee',  'Policy Owner',     'Signed',             '2026-06-10', '2026-06-11'),
  ('s2', 'd4', 'Electronic Records Policy', 'Priya Shah',  'Quality Approver', 'Pending Signature', '2026-06-10', NULL),
  ('s3', 'd4', 'Electronic Records Policy', 'Alex Brooks', 'Final Approver',   'Not Started',        '2026-06-10', NULL);
