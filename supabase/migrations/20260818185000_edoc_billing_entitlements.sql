-- Phase 4: eDoc document quota + billable seat limits.
-- Enforcement is Postgres-only (C11). Signing / finalize paths are not gated (C2).
-- VRMS/APQR are not billed (C22). Existing signed records are never deleted (C1).

ALTER TABLE public.edoc_organization_members
  ADD COLUMN IF NOT EXISTS counts_toward_seat BOOLEAN NOT NULL DEFAULT false;

UPDATE public.edoc_organization_members
SET counts_toward_seat = true
WHERE membership_role IN ('owner', 'admin', 'controller');

CREATE TABLE IF NOT EXISTS public.edoc_billing_runtime (
  id TEXT PRIMARY KEY CHECK (id = 'default'),
  billing_enabled BOOLEAN NOT NULL DEFAULT false,
  free_plan_limits_enabled BOOLEAN NOT NULL DEFAULT false,
  paddle_checkout_enabled BOOLEAN NOT NULL DEFAULT false,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO public.edoc_billing_runtime (id, billing_enabled, free_plan_limits_enabled, paddle_checkout_enabled)
VALUES ('default', false, false, false)
ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.edoc_billing_runtime ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "eDoc billing runtime read" ON public.edoc_billing_runtime;
CREATE POLICY "eDoc billing runtime read"
  ON public.edoc_billing_runtime FOR SELECT TO authenticated
  USING (true);

GRANT SELECT ON public.edoc_billing_runtime TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.edoc_billing_runtime TO service_role;

CREATE OR REPLACE FUNCTION public.edoc_should_enforce_limits(p_treat_as_paid BOOLEAN)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
DECLARE
  v_billing BOOLEAN := false;
  v_free BOOLEAN := false;
  v_checkout BOOLEAN := false;
BEGIN
  SELECT billing_enabled, free_plan_limits_enabled, paddle_checkout_enabled
  INTO v_billing, v_free, v_checkout
  FROM public.edoc_billing_runtime
  WHERE id = 'default';

  IF NOT COALESCE(v_billing, false) THEN
    RETURN false;
  END IF;
  IF COALESCE(p_treat_as_paid, false) THEN
    RETURN true;
  END IF;
  RETURN COALESCE(v_free, false) OR COALESCE(v_checkout, false);
END;
$$;

CREATE OR REPLACE FUNCTION public.edoc_entitlement_context(p_organization_id TEXT)
RETURNS TABLE (
  effective_plan_id TEXT,
  effective_plan_code TEXT,
  subscription_status TEXT,
  documents_limit INTEGER,
  seats_limit INTEGER,
  period_start TIMESTAMPTZ,
  period_end TIMESTAMPTZ,
  treat_as_paid BOOLEAN
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
DECLARE
  v_now TIMESTAMPTZ := now();
  v_cal_start TIMESTAMPTZ;
  v_cal_end TIMESTAMPTZ;
  v_plan_id TEXT;
  v_plan_code TEXT;
  v_status TEXT;
  v_period_start TIMESTAMPTZ;
  v_period_end TIMESTAMPTZ;
  v_effective_plan_id TEXT;
  v_docs INTEGER;
  v_seats INTEGER;
BEGIN
  v_cal_start := date_trunc('month', v_now AT TIME ZONE 'utc') AT TIME ZONE 'utc';
  v_cal_end := (date_trunc('month', v_now AT TIME ZONE 'utc') + INTERVAL '1 month') AT TIME ZONE 'utc';

  SELECT s.plan_id, p.code, s.status, s.current_period_start, s.current_period_end
  INTO v_plan_id, v_plan_code, v_status, v_period_start, v_period_end
  FROM public.edoc_subscriptions s
  JOIN public.edoc_subscription_plans p ON p.id = s.plan_id
  WHERE s.organization_id = p_organization_id;

  IF v_plan_id IS NULL THEN
    v_plan_id := 'edoc-plan-free';
    v_plan_code := 'FREE';
    v_status := 'FREE';
    v_period_start := v_cal_start;
    v_period_end := v_cal_end;
  END IF;

  v_effective_plan_id := v_plan_id;

  IF v_status IN ('FREE', 'PAUSED', 'EXPIRED') THEN
    v_effective_plan_id := 'edoc-plan-free';
  ELSIF v_status = 'CANCELED' THEN
    IF v_period_end IS NULL OR v_now >= v_period_end THEN
      v_effective_plan_id := 'edoc-plan-free';
    END IF;
  ELSIF v_status = 'PAST_DUE' THEN
    IF v_period_end IS NOT NULL AND v_now > (v_period_end + INTERVAL '14 days') THEN
      v_effective_plan_id := 'edoc-plan-free';
    END IF;
  END IF;

  IF v_effective_plan_id = 'edoc-plan-free' OR v_period_start IS NULL OR v_period_end IS NULL THEN
    v_period_start := v_cal_start;
    v_period_end := v_cal_end;
  END IF;

  SELECT p.code INTO v_plan_code
  FROM public.edoc_subscription_plans p
  WHERE p.id = v_effective_plan_id;

  SELECT e.numeric_value INTO v_docs
  FROM public.edoc_plan_entitlements e
  WHERE e.plan_id = v_effective_plan_id AND e.entitlement_key = 'DOCUMENTS_PER_MONTH';

  SELECT e.numeric_value INTO v_seats
  FROM public.edoc_plan_entitlements e
  WHERE e.plan_id = v_effective_plan_id AND e.entitlement_key = 'USERS_PER_ORG';

  effective_plan_id := v_effective_plan_id;
  effective_plan_code := COALESCE(v_plan_code, 'FREE');
  subscription_status := COALESCE(v_status, 'FREE');
  documents_limit := COALESCE(v_docs, 0);
  seats_limit := COALESCE(v_seats, 0);
  period_start := v_period_start;
  period_end := v_period_end;
  treat_as_paid := v_effective_plan_id IS DISTINCT FROM 'edoc-plan-free';
  RETURN NEXT;
END;
$$;

CREATE OR REPLACE FUNCTION public.edoc_consume_document_send(p_organization_id TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
DECLARE
  v_ctx RECORD;
  v_used INTEGER;
BEGIN
  IF p_organization_id IS NULL OR btrim(p_organization_id) = '' THEN
    RAISE EXCEPTION 'Organization is required.';
  END IF;

  PERFORM 1 FROM public.edoc_subscriptions WHERE organization_id = p_organization_id FOR UPDATE;

  SELECT * INTO v_ctx FROM public.edoc_entitlement_context(p_organization_id);
  IF v_ctx IS NULL THEN
    RAISE EXCEPTION 'EDOC_DOCUMENT_QUOTA: Your monthly document allowance has been reached.';
  END IF;

  IF NOT public.edoc_should_enforce_limits(v_ctx.treat_as_paid) THEN
    RETURN;
  END IF;

  INSERT INTO public.edoc_usage_counters (
    organization_id, metric_key, period_start, period_end, used_quantity
  )
  VALUES (
    p_organization_id, 'DOCUMENTS_SENT', v_ctx.period_start, v_ctx.period_end, 0
  )
  ON CONFLICT (organization_id, metric_key, period_start, period_end) DO NOTHING;

  SELECT used_quantity INTO v_used
  FROM public.edoc_usage_counters
  WHERE organization_id = p_organization_id
    AND metric_key = 'DOCUMENTS_SENT'
    AND period_start = v_ctx.period_start
    AND period_end = v_ctx.period_end
  FOR UPDATE;

  IF COALESCE(v_used, 0) + 1 > v_ctx.documents_limit THEN
    BEGIN
      PERFORM public.edoc_create_audit_event(
        p_organization_id,
        'document_send_blocked_quota',
        'organization',
        p_organization_id,
        NULL,
        NULL,
        'Monthly document allowance reached',
        NULL,
        jsonb_build_object(
          'plan_code', v_ctx.effective_plan_code,
          'used', COALESCE(v_used, 0),
          'limit', v_ctx.documents_limit
        )
      );
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;
    RAISE EXCEPTION 'EDOC_DOCUMENT_QUOTA: Your monthly document allowance has been reached.';
  END IF;

  UPDATE public.edoc_usage_counters
  SET used_quantity = used_quantity + 1
  WHERE organization_id = p_organization_id
    AND metric_key = 'DOCUMENTS_SENT'
    AND period_start = v_ctx.period_start
    AND period_end = v_ctx.period_end;
END;
$$;

CREATE OR REPLACE FUNCTION public.edoc_assert_billable_seat(p_organization_id TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
DECLARE
  v_ctx RECORD;
  v_used INTEGER;
BEGIN
  PERFORM 1 FROM public.edoc_organization_members
  WHERE organization_id = p_organization_id
  FOR UPDATE;

  SELECT * INTO v_ctx FROM public.edoc_entitlement_context(p_organization_id);
  IF v_ctx IS NULL THEN
    RETURN;
  END IF;

  IF NOT public.edoc_should_enforce_limits(v_ctx.treat_as_paid) THEN
    RETURN;
  END IF;

  SELECT count(*)::integer INTO v_used
  FROM public.edoc_organization_members
  WHERE organization_id = p_organization_id
    AND status = 'active'
    AND counts_toward_seat = true;

  IF COALESCE(v_used, 0) + 1 > v_ctx.seats_limit THEN
    BEGIN
      PERFORM public.edoc_create_audit_event(
        p_organization_id,
        'seat_add_blocked_quota',
        'organization',
        p_organization_id,
        NULL,
        NULL,
        'Billable seat allowance reached',
        NULL,
        jsonb_build_object(
          'plan_code', v_ctx.effective_plan_code,
          'used', COALESCE(v_used, 0),
          'limit', v_ctx.seats_limit
        )
      );
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;
    RAISE EXCEPTION $err$EDOC_SEAT_LIMIT: This plan's seat allowance has been reached.$err$;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.edoc_trg_consume_document_send()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
BEGIN
  IF TG_OP = 'INSERT' AND NEW.status = 'ready_for_routing' THEN
    PERFORM public.edoc_consume_document_send(NEW.organization_id);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS edoc_documents_consume_send ON public.edoc_documents;
CREATE TRIGGER edoc_documents_consume_send
  BEFORE INSERT ON public.edoc_documents
  FOR EACH ROW
  EXECUTE FUNCTION public.edoc_trg_consume_document_send();

CREATE OR REPLACE FUNCTION public.edoc_trg_organization_member_seats()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
DECLARE
  v_was_billable BOOLEAN := false;
BEGIN
  IF NEW.membership_role IN ('owner', 'admin', 'controller') THEN
    NEW.counts_toward_seat := true;
  ELSIF TG_OP = 'UPDATE'
    AND OLD.membership_role IN ('owner', 'admin', 'controller')
    AND NEW.membership_role NOT IN ('owner', 'admin', 'controller') THEN
    NEW.counts_toward_seat := false;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    v_was_billable := COALESCE(OLD.counts_toward_seat, false) AND OLD.status = 'active';
  END IF;

  IF NEW.counts_toward_seat = true
     AND NEW.status = 'active'
     AND NOT v_was_billable THEN
    PERFORM public.edoc_assert_billable_seat(NEW.organization_id);
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS edoc_organization_members_seat_guard ON public.edoc_organization_members;
CREATE TRIGGER edoc_organization_members_seat_guard
  BEFORE INSERT OR UPDATE ON public.edoc_organization_members
  FOR EACH ROW
  EXECUTE FUNCTION public.edoc_trg_organization_member_seats();

CREATE OR REPLACE FUNCTION public.edoc_billing_entitlement_snapshot()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
DECLARE
  v_profile_id TEXT := public.edoc_current_profile_id();
  v_org_id TEXT;
  v_ctx RECORD;
  v_used INTEGER := 0;
  v_seats INTEGER := 0;
BEGIN
  IF v_profile_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  SELECT organization_id INTO v_org_id
  FROM public.edoc_organization_members
  WHERE profile_id = v_profile_id AND status = 'active'
  LIMIT 1;

  IF v_org_id IS NULL THEN
    RETURN jsonb_build_object('organizationId', NULL, 'limitsActive', false);
  END IF;

  SELECT * INTO v_ctx FROM public.edoc_entitlement_context(v_org_id);

  SELECT COALESCE(used_quantity, 0) INTO v_used
  FROM public.edoc_usage_counters
  WHERE organization_id = v_org_id
    AND metric_key = 'DOCUMENTS_SENT'
    AND period_start = v_ctx.period_start
    AND period_end = v_ctx.period_end;

  SELECT count(*)::integer INTO v_seats
  FROM public.edoc_organization_members
  WHERE organization_id = v_org_id
    AND status = 'active'
    AND counts_toward_seat = true;

  RETURN jsonb_build_object(
    'organizationId', v_org_id,
    'limitsActive', public.edoc_should_enforce_limits(v_ctx.treat_as_paid),
    'planCode', v_ctx.effective_plan_code,
    'status', v_ctx.subscription_status,
    'documentsLimit', v_ctx.documents_limit,
    'documentsUsed', COALESCE(v_used, 0),
    'seatsLimit', v_ctx.seats_limit,
    'seatsUsed', COALESCE(v_seats, 0)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.edoc_should_enforce_limits(BOOLEAN) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.edoc_entitlement_context(TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.edoc_consume_document_send(TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.edoc_assert_billable_seat(TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.edoc_trg_consume_document_send() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.edoc_trg_organization_member_seats() FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.edoc_billing_entitlement_snapshot() TO authenticated;

NOTIFY pgrst, 'reload schema';
