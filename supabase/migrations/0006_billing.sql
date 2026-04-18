-- =============================================
-- Migration 0006: Billing
-- =============================================

-- Billing plans
CREATE TABLE billing_plans (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name                    VARCHAR(30) UNIQUE NOT NULL,
  display_name            TEXT NOT NULL,
  price_monthly           NUMERIC(10,2) NOT NULL,
  price_yearly            NUMERIC(10,2),
  currency                VARCHAR(10) DEFAULT 'USD',
  stripe_price_id_monthly TEXT,
  stripe_price_id_yearly  TEXT,
  features                JSONB DEFAULT '{}',
  limits                  JSONB DEFAULT '{}',
  is_active               BOOLEAN DEFAULT TRUE,
  sort_order              INTEGER DEFAULT 0
);

-- Seed billing plans
INSERT INTO billing_plans (name, display_name, price_monthly, price_yearly, limits, sort_order) VALUES
('starter', 'Starter', 19.00, 190.00, '{"posts_per_month": 30, "connections": 3, "brands": 1, "products": 5, "ai_credits": 50, "members": 1, "storage_mb": 500}', 1),
('pro', 'Pro', 49.00, 490.00, '{"posts_per_month": 150, "connections": 10, "brands": 5, "products": 25, "ai_credits": 300, "members": 5, "storage_mb": 5000}', 2),
('agency', 'Agency', 99.00, 990.00, '{"posts_per_month": -1, "connections": 30, "brands": 20, "products": 100, "ai_credits": 1000, "members": 20, "storage_mb": 50000}', 3),
('enterprise', 'Enterprise', 299.00, 2990.00, '{"posts_per_month": -1, "connections": -1, "brands": -1, "products": -1, "ai_credits": -1, "members": -1, "storage_mb": -1}', 4);

-- Workspace subscriptions
CREATE TABLE workspace_subscriptions (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id            UUID NOT NULL UNIQUE REFERENCES workspaces(id) ON DELETE CASCADE,
  plan_name               VARCHAR(30) NOT NULL DEFAULT 'starter',
  stripe_subscription_id  TEXT UNIQUE,
  stripe_customer_id      TEXT,
  status                  VARCHAR(30) DEFAULT 'trialing'
                          CHECK (status IN ('trialing','active','past_due','cancelled','paused')),
  current_period_start    TIMESTAMPTZ,
  current_period_end      TIMESTAMPTZ,
  cancel_at_period_end    BOOLEAN DEFAULT FALSE,
  cancelled_at            TIMESTAMPTZ,
  metadata                JSONB DEFAULT '{}',
  created_at              TIMESTAMPTZ DEFAULT now(),
  updated_at              TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE workspace_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "members_select_subscription" ON workspace_subscriptions
  FOR SELECT USING (is_workspace_member(workspace_id));

CREATE POLICY "owner_manage_subscription" ON workspace_subscriptions
  FOR ALL USING (workspace_role(workspace_id) = 'owner');

-- Usage events: metered tracking
CREATE TABLE usage_events (
  id              BIGSERIAL PRIMARY KEY,
  workspace_id    UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  event_type      VARCHAR(50) NOT NULL,
  quantity        INTEGER DEFAULT 1,
  period_month    DATE NOT NULL,
  metadata        JSONB DEFAULT '{}',
  created_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_usage_workspace_period ON usage_events(workspace_id, period_month);
CREATE INDEX idx_usage_type ON usage_events(event_type, period_month);

-- Post templates
CREATE TABLE post_templates (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id    UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  brand_id        UUID REFERENCES brands(id) ON DELETE SET NULL,
  product_id      UUID REFERENCES products(id) ON DELETE SET NULL,
  template_name   TEXT NOT NULL,
  base_caption    TEXT,
  cta             TEXT,
  hashtags        TEXT[],
  platform_overrides JSONB DEFAULT '{}',
  created_by      UUID REFERENCES auth.users(id),
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE post_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "members_select_templates" ON post_templates
  FOR SELECT USING (is_workspace_member(workspace_id));

CREATE POLICY "editors_manage_templates" ON post_templates
  FOR ALL USING (workspace_role(workspace_id) IN ('owner','admin','editor'));

CREATE TRIGGER trg_subscriptions_updated_at
  BEFORE UPDATE ON workspace_subscriptions FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_templates_updated_at
  BEFORE UPDATE ON post_templates FOR EACH ROW EXECUTE FUNCTION update_updated_at();
