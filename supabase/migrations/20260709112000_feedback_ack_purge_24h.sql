-- After admin acknowledges (status → read), delete the message after 24 hours.
-- Addressed/rejected retention remains 3 days.

CREATE OR REPLACE FUNCTION public.purge_expired_feedback_messages()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  DELETE FROM app_feedback_messages
  WHERE status_updated_at IS NOT NULL
    AND (
      (status = 'read' AND status_updated_at < (now() - interval '24 hours'))
      OR (
        status IN ('addressed', 'rejected')
        AND status_updated_at < (now() - interval '3 days')
      )
    );
$$;

REVOKE ALL ON FUNCTION public.purge_expired_feedback_messages() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.purge_expired_feedback_messages() TO authenticated;

NOTIFY pgrst, 'reload schema';
