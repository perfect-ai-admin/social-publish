-- =============================================
-- Migration 0002: Platform Connections
-- =============================================

CREATE TABLE platform_connections (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id          UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  brand_id              UUID REFERENCES brands(id) ON DELETE SET NULL,
  platform              VARCHAR(30) NOT NULL
                        CHECK (platform IN (
                          'facebook','instagram','tiktok','youtube',
                          'linkedin','pinterest','google_business','telegram'
                        )),
  platform_account_id   TEXT NOT NULL,
  platform_account_name TEXT,
  platform_account_type VARCHAR(30),
  avatar_url            TEXT,
  access_token          TEXT NOT NULL,
  refresh_token         TEXT,
  token_expires_at      TIMESTAMPTZ,
  scopes                TEXT[],
  status                VARCHAR(20) DEFAULT 'active'
                        CHECK (status IN ('active','expired','revoked','error','limited')),
  last_checked_at       TIMESTAMPTZ,
  last_error            TEXT,
  metadata              JSONB DEFAULT '{}',
  connected_by          UUID REFERENCES auth.users(id),
  connected_at          TIMESTAMPTZ DEFAULT now(),
  updated_at            TIMESTAMPTZ DEFAULT now(),
  UNIQUE(workspace_id, platform, platform_account_id)
);

ALTER TABLE platform_connections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "members_select_connections" ON platform_connections
  FOR SELECT USING (is_workspace_member(workspace_id));

CREATE POLICY "admin_manage_connections" ON platform_connections
  FOR ALL USING (workspace_role(workspace_id) IN ('owner','admin'));

CREATE INDEX idx_connections_workspace ON platform_connections(workspace_id);
CREATE INDEX idx_connections_platform ON platform_connections(platform, status);
CREATE INDEX idx_connections_token_expires ON platform_connections(token_expires_at)
  WHERE status = 'active';

CREATE TRIGGER trg_connections_updated_at
  BEFORE UPDATE ON platform_connections FOR EACH ROW EXECUTE FUNCTION update_updated_at();
