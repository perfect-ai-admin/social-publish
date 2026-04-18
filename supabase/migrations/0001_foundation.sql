-- =============================================
-- Migration 0001: Foundation
-- workspaces, workspace_members, brands, products
-- =============================================

-- Workspaces: top-level multi-tenant unit
CREATE TABLE workspaces (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name            TEXT NOT NULL,
  slug            VARCHAR(63) UNIQUE NOT NULL,
  plan            VARCHAR(30) DEFAULT 'starter'
                  CHECK (plan IN ('starter','pro','agency','enterprise')),
  owner_id        UUID NOT NULL REFERENCES auth.users(id),
  logo_url        TEXT,
  timezone        VARCHAR(60) DEFAULT 'Asia/Jerusalem',
  locale          VARCHAR(10) DEFAULT 'he',
  stripe_customer_id TEXT,
  trial_ends_at   TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE workspaces ENABLE ROW LEVEL SECURITY;

-- Workspace members: RBAC per workspace
CREATE TABLE workspace_members (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id    UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role            VARCHAR(20) NOT NULL DEFAULT 'viewer'
                  CHECK (role IN ('owner','admin','editor','viewer')),
  invited_by      UUID REFERENCES auth.users(id),
  invited_at      TIMESTAMPTZ,
  joined_at       TIMESTAMPTZ DEFAULT now(),
  UNIQUE(workspace_id, user_id)
);

ALTER TABLE workspace_members ENABLE ROW LEVEL SECURITY;

-- Brands: a workspace can have multiple brands
CREATE TABLE brands (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id    UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  slug            VARCHAR(63) NOT NULL,
  logo_url        TEXT,
  primary_color   VARCHAR(7),
  tone_of_voice   TEXT,
  target_audience TEXT,
  brand_guidelines TEXT,
  primary_language VARCHAR(10) DEFAULT 'he',
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now(),
  UNIQUE(workspace_id, slug)
);

ALTER TABLE brands ENABLE ROW LEVEL SECURITY;

-- Products: items/services a brand sells
CREATE TABLE products (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id        UUID NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  workspace_id    UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  description     TEXT,
  category        VARCHAR(100),
  price           NUMERIC(10,2),
  currency        VARCHAR(10) DEFAULT 'ILS',
  image_url       TEXT,
  landing_page_url TEXT,
  default_cta     TEXT,
  default_hashtags TEXT[],
  tags            TEXT[],
  is_active       BOOLEAN DEFAULT TRUE,
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE products ENABLE ROW LEVEL SECURITY;

-- Helper function: check workspace membership
CREATE OR REPLACE FUNCTION is_workspace_member(ws_id UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM workspace_members
    WHERE workspace_id = ws_id AND user_id = auth.uid()
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Helper function: check workspace role
CREATE OR REPLACE FUNCTION workspace_role(ws_id UUID)
RETURNS VARCHAR AS $$
  SELECT role FROM workspace_members
  WHERE workspace_id = ws_id AND user_id = auth.uid()
  LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- RLS Policies: workspaces
CREATE POLICY "members_select_workspaces" ON workspaces
  FOR SELECT USING (is_workspace_member(id));

CREATE POLICY "owner_update_workspaces" ON workspaces
  FOR UPDATE USING (workspace_role(id) IN ('owner','admin'));

CREATE POLICY "authenticated_insert_workspaces" ON workspaces
  FOR INSERT WITH CHECK (auth.uid() = owner_id);

-- RLS Policies: workspace_members
CREATE POLICY "members_select_members" ON workspace_members
  FOR SELECT USING (is_workspace_member(workspace_id));

CREATE POLICY "admin_manage_members" ON workspace_members
  FOR ALL USING (workspace_role(workspace_id) IN ('owner','admin'));

-- RLS Policies: brands
CREATE POLICY "members_select_brands" ON brands
  FOR SELECT USING (is_workspace_member(workspace_id));

CREATE POLICY "editors_manage_brands" ON brands
  FOR ALL USING (workspace_role(workspace_id) IN ('owner','admin','editor'));

-- RLS Policies: products
CREATE POLICY "members_select_products" ON products
  FOR SELECT USING (is_workspace_member(workspace_id));

CREATE POLICY "editors_manage_products" ON products
  FOR ALL USING (workspace_role(workspace_id) IN ('owner','admin','editor'));

-- Indexes
CREATE INDEX idx_workspace_members_user ON workspace_members(user_id);
CREATE INDEX idx_workspace_members_workspace ON workspace_members(workspace_id);
CREATE INDEX idx_brands_workspace ON brands(workspace_id);
CREATE INDEX idx_products_brand ON products(brand_id);
CREATE INDEX idx_products_workspace ON products(workspace_id);

-- Trigger: auto-add owner as workspace member on workspace creation
CREATE OR REPLACE FUNCTION auto_add_workspace_owner()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO workspace_members (workspace_id, user_id, role)
  VALUES (NEW.id, NEW.owner_id, 'owner');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_auto_add_workspace_owner
  AFTER INSERT ON workspaces
  FOR EACH ROW EXECUTE FUNCTION auto_add_workspace_owner();

-- Trigger: auto-update updated_at
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_workspaces_updated_at
  BEFORE UPDATE ON workspaces FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_brands_updated_at
  BEFORE UPDATE ON brands FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_products_updated_at
  BEFORE UPDATE ON products FOR EACH ROW EXECUTE FUNCTION update_updated_at();
