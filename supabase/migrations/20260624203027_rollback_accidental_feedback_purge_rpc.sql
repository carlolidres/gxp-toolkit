-- Roll back Project Tracker feedback purge RPCs accidentally run on GxP Toolkit.
-- This project has no app_feedback table and no approved migration for these functions.

REVOKE ALL ON FUNCTION public.purge_expired_addressed_feedback() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.purge_expired_addressed_feedback() FROM authenticated;
REVOKE ALL ON FUNCTION public.purge_expired_addressed_feedback() FROM anon;
REVOKE ALL ON FUNCTION public.purge_expired_addressed_feedback() FROM service_role;

REVOKE ALL ON FUNCTION public.purge_expired_addressed_feedback_system() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.purge_expired_addressed_feedback_system() FROM authenticated;
REVOKE ALL ON FUNCTION public.purge_expired_addressed_feedback_system() FROM anon;
REVOKE ALL ON FUNCTION public.purge_expired_addressed_feedback_system() FROM service_role;

DROP FUNCTION IF EXISTS public.purge_expired_addressed_feedback();
DROP FUNCTION IF EXISTS public.purge_expired_addressed_feedback_system();
