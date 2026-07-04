-- Remove real-user eDoc pilot data from staging (org membership, menu permissions, assignments).
-- Safe to re-run. Does not delete auth users or profiles.
-- After this, run seed_edoc_staging_test_accounts.sql.

DELETE FROM public.edoc_route_step_assignees
WHERE id = 'staging-edoc-assignment-001'
  AND assignee_id IN (
    SELECT id FROM public.profiles
    WHERE lower(email) IN (
      'ghinogabriel@gmail.com',
      'mmbuen@pharmaindustries.com',
      'isaiah014290118@gmail.com'
    )
  );

DELETE FROM public.edoc_organization_members
WHERE organization_id = 'staging-edoc-org'
  AND profile_id IN (
    SELECT id FROM public.profiles
    WHERE lower(email) IN (
      'ghinogabriel@gmail.com',
      'mmbuen@pharmaindustries.com',
      'isaiah014290118@gmail.com'
    )
  );

DELETE FROM public.user_menu_permissions
WHERE user_id IN (
  SELECT id FROM public.profiles
  WHERE lower(email) IN (
    'ghinogabriel@gmail.com',
    'mmbuen@pharmaindustries.com',
    'isaiah014290118@gmail.com'
  )
)
AND menu_id LIKE 'edoc-%';
