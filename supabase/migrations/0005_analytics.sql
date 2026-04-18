-- =============================================
-- Migration 0005: Analytics
-- =============================================

-- Post analytics: per-variant metrics
CREATE TABLE post_analytics (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  variant_id      UUID NOT NULL REFERENCES post_variants(id) ON DELETE CASCADE,
  workspace_id    UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  platform        VARCHAR(30) NOT NULL,
  fetched_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  impressions     BIGINT DEFAULT 0,
  reach           BIGINT DEFAULT 0,
  likes           BIGINT DEFAULT 0,
  comments        BIGINT DEFAULT 0,
  shares          BIGINT DEFAULT 0,
  saves           BIGINT DEFAULT 0,
  clicks          BIGINT DEFAULT 0,
  video_views     BIGINT DEFAULT 0,
  watch_time_sec  BIGINT DEFAULT 0,
  engagement_rate NUMERIC(6,4),
  raw_data        JSONB DEFAULT '{}',
  UNIQUE(variant_id, (fetched_at::date))
);

ALTER TABLE post_analytics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "members_select_analytics" ON post_analytics
  FOR SELECT USING (is_workspace_member(workspace_id));

CREATE INDEX idx_analytics_workspace ON post_analytics(workspace_id, fetched_at DESC);
CREATE INDEX idx_analytics_variant ON post_analytics(variant_id, fetched_at DESC);

-- Account analytics: follower/reach per connection
CREATE TABLE account_analytics (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  connection_id   UUID NOT NULL REFERENCES platform_connections(id) ON DELETE CASCADE,
  workspace_id    UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  date            DATE NOT NULL,
  followers       BIGINT,
  following       BIGINT,
  profile_views   BIGINT,
  reach           BIGINT,
  raw_data        JSONB DEFAULT '{}',
  UNIQUE(connection_id, date)
);

ALTER TABLE account_analytics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "members_select_account_analytics" ON account_analytics
  FOR SELECT USING (is_workspace_member(workspace_id));

CREATE INDEX idx_account_analytics_connection ON account_analytics(connection_id, date DESC);
