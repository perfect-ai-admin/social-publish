-- =============================================
-- Migration 0003: Media Assets, Posts, Variants
-- =============================================

-- Media assets: uploaded images/videos
CREATE TABLE media_assets (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id    UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  brand_id        UUID REFERENCES brands(id) ON DELETE SET NULL,
  product_id      UUID REFERENCES products(id) ON DELETE SET NULL,
  uploader_id     UUID REFERENCES auth.users(id),
  filename        TEXT NOT NULL,
  storage_path    TEXT NOT NULL,
  public_url      TEXT NOT NULL,
  mime_type       TEXT NOT NULL,
  size_bytes      BIGINT,
  width           INTEGER,
  height          INTEGER,
  duration_sec    NUMERIC(8,2),
  alt_text        TEXT,
  tags            TEXT[],
  folder          TEXT DEFAULT 'general',
  created_at      TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE media_assets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "members_select_media" ON media_assets
  FOR SELECT USING (is_workspace_member(workspace_id));

CREATE POLICY "editors_manage_media" ON media_assets
  FOR ALL USING (workspace_role(workspace_id) IN ('owner','admin','editor'));

CREATE INDEX idx_media_workspace ON media_assets(workspace_id, created_at DESC);
CREATE INDEX idx_media_brand ON media_assets(brand_id);
CREATE INDEX idx_media_tags ON media_assets USING gin(tags);

-- Campaigns: group posts
CREATE TABLE campaigns (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id    UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  brand_id        UUID REFERENCES brands(id) ON DELETE SET NULL,
  name            TEXT NOT NULL,
  description     TEXT,
  status          VARCHAR(20) DEFAULT 'active'
                  CHECK (status IN ('draft','active','paused','completed','archived')),
  start_date      DATE,
  end_date        DATE,
  created_by      UUID REFERENCES auth.users(id),
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE campaigns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "members_select_campaigns" ON campaigns
  FOR SELECT USING (is_workspace_member(workspace_id));

CREATE POLICY "editors_manage_campaigns" ON campaigns
  FOR ALL USING (workspace_role(workspace_id) IN ('owner','admin','editor'));

-- Posts: the canonical post object
CREATE TABLE posts (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id    UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  brand_id        UUID REFERENCES brands(id) ON DELETE SET NULL,
  product_id      UUID REFERENCES products(id) ON DELETE SET NULL,
  campaign_id     UUID REFERENCES campaigns(id) ON DELETE SET NULL,
  created_by      UUID REFERENCES auth.users(id),
  title           TEXT,
  base_caption    TEXT,
  media_asset_ids UUID[],
  goal            VARCHAR(30) CHECK (goal IN (
    'awareness','engagement','lead_generation','traffic','sales','authority'
  )),
  status          VARCHAR(20) DEFAULT 'draft'
                  CHECK (status IN ('draft','scheduled','publishing','published','partial','failed','cancelled')),
  scheduled_at    TIMESTAMPTZ,
  published_at    TIMESTAMPTZ,
  approval_status VARCHAR(20) DEFAULT 'not_required'
                  CHECK (approval_status IN ('not_required','pending','approved','rejected')),
  approved_by     UUID REFERENCES auth.users(id),
  approved_at     TIMESTAMPTZ,
  ai_generated    BOOLEAN DEFAULT FALSE,
  tags            TEXT[],
  notes           TEXT,
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE posts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "members_select_posts" ON posts
  FOR SELECT USING (is_workspace_member(workspace_id));

CREATE POLICY "editors_manage_posts" ON posts
  FOR ALL USING (workspace_role(workspace_id) IN ('owner','admin','editor'));

CREATE INDEX idx_posts_workspace ON posts(workspace_id, status, scheduled_at DESC);
CREATE INDEX idx_posts_brand ON posts(brand_id, status);
CREATE INDEX idx_posts_scheduled ON posts(scheduled_at) WHERE status = 'scheduled';
CREATE INDEX idx_posts_campaign ON posts(campaign_id);

-- Post variants: one per platform per post
CREATE TABLE post_variants (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id         UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  connection_id   UUID NOT NULL REFERENCES platform_connections(id) ON DELETE CASCADE,
  platform        VARCHAR(30) NOT NULL,
  caption         TEXT,
  hashtags        TEXT[],
  media_asset_ids UUID[],
  format          VARCHAR(30) DEFAULT 'feed'
                  CHECK (format IN ('feed','story','reel','short','pin','local_post','message')),
  platform_config JSONB DEFAULT '{}',
  status          VARCHAR(20) DEFAULT 'pending'
                  CHECK (status IN ('pending','queued','publishing','published','failed','skipped')),
  scheduled_at    TIMESTAMPTZ,
  published_at    TIMESTAMPTZ,
  platform_post_id  TEXT,
  platform_post_url TEXT,
  retry_count     INTEGER DEFAULT 0,
  last_error      TEXT,
  last_attempted_at TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE post_variants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "members_select_variants" ON post_variants
  FOR SELECT USING (
    post_id IN (SELECT id FROM posts WHERE is_workspace_member(workspace_id))
  );

CREATE INDEX idx_variants_post ON post_variants(post_id);
CREATE INDEX idx_variants_status ON post_variants(status, scheduled_at)
  WHERE status IN ('pending','queued','failed');
CREATE INDEX idx_variants_connection ON post_variants(connection_id);

CREATE TRIGGER trg_posts_updated_at
  BEFORE UPDATE ON posts FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_variants_updated_at
  BEFORE UPDATE ON post_variants FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_campaigns_updated_at
  BEFORE UPDATE ON campaigns FOR EACH ROW EXECUTE FUNCTION update_updated_at();
