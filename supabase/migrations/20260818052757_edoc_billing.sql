-- eDoc billing catalog + subscription cache (Paddle). SQLite-first in database/sqlite/edoc_schema.sql.
-- C1: these tables must never delete signed-document evidence.
-- C4/C16: clients may read own org billing; only Edge (service_role) writes from Paddle.

CREATE TABLE IF NOT EXISTS public.edoc_subscription_plans (
  id TEXT PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  billing_interval TEXT NOT NULL CHECK (billing_interval IN ('none', 'month', 'year')),
  paddle_product_id TEXT,
  paddle_price_id TEXT,
  amount_minor INTEGER,
  currency TEXT NOT NULL DEFAULT 'USD',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.edoc_plan_entitlements (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  plan_id TEXT NOT NULL REFERENCES public.edoc_subscription_plans(id) ON DELETE CASCADE,
  entitlement_key TEXT NOT NULL,
  value_type TEXT NOT NULL CHECK (value_type IN ('numeric', 'boolean', 'text')),
  numeric_value INTEGER,
  boolean_value BOOLEAN,
  text_value TEXT,
  UNIQUE (plan_id, entitlement_key)
);

CREATE TABLE IF NOT EXISTS public.edoc_billing_customers (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  organization_id TEXT NOT NULL UNIQUE REFERENCES public.edoc_organizations(id) ON DELETE CASCADE,
  provider TEXT NOT NULL DEFAULT 'paddle',
  provider_customer_id TEXT NOT NULL UNIQUE,
  email TEXT,
  country_code TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.edoc_subscriptions (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  organization_id TEXT NOT NULL REFERENCES public.edoc_organizations(id) ON DELETE CASCADE,
  plan_id TEXT NOT NULL REFERENCES public.edoc_subscription_plans(id),
  provider TEXT NOT NULL DEFAULT 'paddle',
  provider_customer_id TEXT,
  provider_subscription_id TEXT UNIQUE,
  status TEXT NOT NULL CHECK (status IN (
    'FREE', 'TRIALING', 'ACTIVE', 'PAST_DUE', 'PAUSED', 'CANCELED', 'EXPIRED'
  )),
  current_period_start TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ,
  scheduled_change_type TEXT,
  scheduled_change_at TIMESTAMPTZ,
  cancel_at_period_end BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_edoc_subscriptions_org
  ON public.edoc_subscriptions (organization_id);

CREATE TABLE IF NOT EXISTS public.edoc_usage_counters (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  organization_id TEXT NOT NULL REFERENCES public.edoc_organizations(id) ON DELETE CASCADE,
  metric_key TEXT NOT NULL,
  period_start TIMESTAMPTZ NOT NULL,
  period_end TIMESTAMPTZ NOT NULL,
  used_quantity INTEGER NOT NULL DEFAULT 0,
  UNIQUE (organization_id, metric_key, period_start, period_end)
);

CREATE INDEX IF NOT EXISTS idx_edoc_usage_org_metric
  ON public.edoc_usage_counters (organization_id, metric_key);

CREATE TABLE IF NOT EXISTS public.edoc_billing_events (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  provider TEXT NOT NULL DEFAULT 'paddle',
  provider_event_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  received_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  processed_at TIMESTAMPTZ,
  processing_status TEXT NOT NULL CHECK (processing_status IN (
    'RECEIVED', 'PROCESSING', 'PROCESSED', 'FAILED', 'IGNORED'
  )),
  payload_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  UNIQUE (provider, provider_event_id)
);

CREATE INDEX IF NOT EXISTS idx_edoc_billing_events_status
  ON public.edoc_billing_events (processing_status, received_at);

CREATE TABLE IF NOT EXISTS public.edoc_billing_transactions (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  organization_id TEXT NOT NULL REFERENCES public.edoc_organizations(id),
  provider TEXT NOT NULL DEFAULT 'paddle',
  provider_transaction_id TEXT NOT NULL UNIQUE,
  amount_minor INTEGER,
  currency TEXT,
  status TEXT,
  occurred_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Catalog (sandbox price IDs recorded 2026-08-18). LIVE IDs must not be stored here.
INSERT INTO public.edoc_subscription_plans (
  id, code, name, billing_interval, paddle_price_id, amount_minor, currency, is_active
) VALUES
  ('edoc-plan-free', 'FREE', 'Free', 'none', NULL, 0, 'USD', true),
  ('edoc-plan-personal-month', 'PERSONAL_MONTHLY', 'Personal', 'month', 'pri_01m09kd9fw8tpbeyrcnsrzy4ea', 599, 'USD', true),
  ('edoc-plan-personal-year', 'PERSONAL_ANNUAL', 'Personal', 'year', 'pri_01m09kem1734t13qt18y2xn75x', 5990, 'USD', true),
  ('edoc-plan-pro-month', 'PRO_MONTHLY', 'Professional', 'month', 'pri_01m09kvd9rxggqb1jf49aknn4k', 1299, 'USD', true),
  ('edoc-plan-pro-year', 'PRO_ANNUAL', 'Professional', 'year', 'pri_01m09kwn51w0ej0ptxstf5jwxx', 12990, 'USD', true),
  ('edoc-plan-biz-month', 'BUSINESS_MONTHLY', 'Business', 'month', 'pri_01m09m0pt9rmyp7fweexttyd4b', 2999, 'USD', true),
  ('edoc-plan-biz-year', 'BUSINESS_ANNUAL', 'Business', 'year', 'pri_01m09m1t2zg6t1pp8ppnwa1858', 29990, 'USD', true)
ON CONFLICT (id) DO UPDATE SET
  paddle_price_id = EXCLUDED.paddle_price_id,
  amount_minor = EXCLUDED.amount_minor,
  updated_at = now();

INSERT INTO public.edoc_plan_entitlements (id, plan_id, entitlement_key, value_type, numeric_value) VALUES
  ('edoc-ent-free-docs', 'edoc-plan-free', 'DOCUMENTS_PER_MONTH', 'numeric', 3),
  ('edoc-ent-free-seats', 'edoc-plan-free', 'USERS_PER_ORG', 'numeric', 1),
  ('edoc-ent-per-m-docs', 'edoc-plan-personal-month', 'DOCUMENTS_PER_MONTH', 'numeric', 25),
  ('edoc-ent-per-m-seats', 'edoc-plan-personal-month', 'USERS_PER_ORG', 'numeric', 1),
  ('edoc-ent-per-y-docs', 'edoc-plan-personal-year', 'DOCUMENTS_PER_MONTH', 'numeric', 25),
  ('edoc-ent-per-y-seats', 'edoc-plan-personal-year', 'USERS_PER_ORG', 'numeric', 1),
  ('edoc-ent-pro-m-docs', 'edoc-plan-pro-month', 'DOCUMENTS_PER_MONTH', 'numeric', 100),
  ('edoc-ent-pro-m-seats', 'edoc-plan-pro-month', 'USERS_PER_ORG', 'numeric', 1),
  ('edoc-ent-pro-y-docs', 'edoc-plan-pro-year', 'DOCUMENTS_PER_MONTH', 'numeric', 100),
  ('edoc-ent-pro-y-seats', 'edoc-plan-pro-year', 'USERS_PER_ORG', 'numeric', 1),
  ('edoc-ent-biz-m-docs', 'edoc-plan-biz-month', 'DOCUMENTS_PER_MONTH', 'numeric', 300),
  ('edoc-ent-biz-m-seats', 'edoc-plan-biz-month', 'USERS_PER_ORG', 'numeric', 5),
  ('edoc-ent-biz-y-docs', 'edoc-plan-biz-year', 'DOCUMENTS_PER_MONTH', 'numeric', 300),
  ('edoc-ent-biz-y-seats', 'edoc-plan-biz-year', 'USERS_PER_ORG', 'numeric', 5)
ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.edoc_subscription_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.edoc_plan_entitlements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.edoc_billing_customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.edoc_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.edoc_usage_counters ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.edoc_billing_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.edoc_billing_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "eDoc billing plans read"
  ON public.edoc_subscription_plans FOR SELECT TO authenticated
  USING (is_active);

CREATE POLICY "eDoc billing entitlements read"
  ON public.edoc_plan_entitlements FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.edoc_subscription_plans p
      WHERE p.id = plan_id AND p.is_active
    )
  );

CREATE POLICY "eDoc billing customers org read"
  ON public.edoc_billing_customers FOR SELECT TO authenticated
  USING (public.edoc_is_org_member(organization_id));

CREATE POLICY "eDoc subscriptions org read"
  ON public.edoc_subscriptions FOR SELECT TO authenticated
  USING (public.edoc_is_org_member(organization_id));

CREATE POLICY "eDoc usage org read"
  ON public.edoc_usage_counters FOR SELECT TO authenticated
  USING (public.edoc_is_org_member(organization_id));

CREATE POLICY "eDoc billing transactions org read"
  ON public.edoc_billing_transactions FOR SELECT TO authenticated
  USING (public.edoc_is_org_member(organization_id));

-- Webhook payloads are not client-readable (C17).
REVOKE ALL ON public.edoc_billing_events FROM PUBLIC, anon, authenticated;

GRANT SELECT ON public.edoc_subscription_plans TO authenticated;
GRANT SELECT ON public.edoc_plan_entitlements TO authenticated;
GRANT SELECT ON public.edoc_billing_customers TO authenticated;
GRANT SELECT ON public.edoc_subscriptions TO authenticated;
GRANT SELECT ON public.edoc_usage_counters TO authenticated;
GRANT SELECT ON public.edoc_billing_transactions TO authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.edoc_subscription_plans TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.edoc_plan_entitlements TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.edoc_billing_customers TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.edoc_subscriptions TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.edoc_usage_counters TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.edoc_billing_events TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.edoc_billing_transactions TO service_role;
