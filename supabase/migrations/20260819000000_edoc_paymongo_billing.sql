-- Additive PayMongo billing fields. Paddle columns and rows are unchanged.
-- ENABLE_PAYMONGO / paymongo_checkout_enabled default off. GoTyme is not a checkout provider.

ALTER TABLE public.edoc_subscription_plans
  ADD COLUMN IF NOT EXISTS paymongo_plan_id TEXT,
  ADD COLUMN IF NOT EXISTS php_amount_minor INTEGER;

UPDATE public.edoc_subscription_plans SET php_amount_minor = 0 WHERE code = 'FREE' AND php_amount_minor IS NULL;
UPDATE public.edoc_subscription_plans SET php_amount_minor = 19900 WHERE code = 'PERSONAL_MONTHLY' AND php_amount_minor IS NULL;
UPDATE public.edoc_subscription_plans SET php_amount_minor = 238800 WHERE code = 'PERSONAL_ANNUAL' AND php_amount_minor IS NULL;
UPDATE public.edoc_subscription_plans SET php_amount_minor = 49900 WHERE code = 'PRO_MONTHLY' AND php_amount_minor IS NULL;
UPDATE public.edoc_subscription_plans SET php_amount_minor = 598800 WHERE code = 'PRO_ANNUAL' AND php_amount_minor IS NULL;
UPDATE public.edoc_subscription_plans SET php_amount_minor = 99900 WHERE code = 'BUSINESS_MONTHLY' AND php_amount_minor IS NULL;
UPDATE public.edoc_subscription_plans SET php_amount_minor = 1198800 WHERE code = 'BUSINESS_ANNUAL' AND php_amount_minor IS NULL;

ALTER TABLE public.edoc_billing_runtime
  ADD COLUMN IF NOT EXISTS paymongo_checkout_enabled BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE public.edoc_subscriptions DROP CONSTRAINT IF EXISTS edoc_subscriptions_status_check;
ALTER TABLE public.edoc_subscriptions
  ADD CONSTRAINT edoc_subscriptions_status_check CHECK (status IN (
    'FREE', 'PENDING', 'TRIALING', 'ACTIVE', 'PAST_DUE', 'PAUSED', 'CANCELED', 'EXPIRED'
  ));

CREATE UNIQUE INDEX IF NOT EXISTS idx_edoc_subscriptions_provider_sub
  ON public.edoc_subscriptions (provider, provider_subscription_id)
  WHERE provider_subscription_id IS NOT NULL;

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
  v_paymongo BOOLEAN := false;
BEGIN
  SELECT billing_enabled, free_plan_limits_enabled, paddle_checkout_enabled, paymongo_checkout_enabled
  INTO v_billing, v_free, v_checkout, v_paymongo
  FROM public.edoc_billing_runtime
  WHERE id = 'default';

  IF NOT COALESCE(v_billing, false) THEN
    RETURN false;
  END IF;
  IF COALESCE(p_treat_as_paid, false) THEN
    RETURN true;
  END IF;
  RETURN COALESCE(v_free, false) OR COALESCE(v_checkout, false) OR COALESCE(v_paymongo, false);
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

  IF v_status IN ('FREE', 'PENDING', 'PAUSED', 'EXPIRED') THEN
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
