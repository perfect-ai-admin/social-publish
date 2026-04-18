-- =============================================
-- Migration 0007: Harden RLS, fix missing policies, add missing fields
-- =============================================

-- 1. Enable RLS on tables that were missing it
ALTER TABLE publish_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE publish_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE error_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE billing_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE usage_events ENABLE ROW LEVEL SECURITY;

-- 2. publish_jobs: only service role should access (cron jobs)
-- No user-facing policies needed — all access is via service role Edge Functions
-- But add a read policy so admins can see job status via the UI
CREATE POLICY "members_select_jobs" ON publish_jobs
  FOR SELECT USING (
    variant_id IN (
      SELECT pv.id FROM post_variants pv
      JOIN posts p ON pv.post_id = p.id
      WHERE is_workspace_member(p.workspace_id)
    )
  );

-- 3. publish_logs: read-only for workspace members
CREATE POLICY "members_select_publish_logs" ON publish_logs
  FOR SELECT USING (
    variant_id IN (
      SELECT pv.id FROM post_variants pv
      JOIN posts p ON pv.post_id = p.id
      WHERE is_workspace_member(p.workspace_id)
    )
  );

-- 4. error_logs: read-only for workspace members
CREATE POLICY "members_select_error_logs" ON error_logs
  FOR SELECT USING (
    workspace_id IS NULL OR is_workspace_member(workspace_id)
  );

-- 5. billing_plans: public read (plans are visible to everyone)
CREATE POLICY "public_read_plans" ON billing_plans
  FOR SELECT USING (true);

-- 6. usage_events: workspace members can read their own
CREATE POLICY "members_select_usage" ON usage_events
  FOR SELECT USING (is_workspace_member(workspace_id));

-- Service role handles inserts, but editors should be able to trigger usage tracking
CREATE POLICY "editors_insert_usage" ON usage_events
  FOR INSERT WITH CHECK (is_workspace_member(workspace_id));

-- 7. post_variants: add missing write policies
CREATE POLICY "editors_insert_variants" ON post_variants
  FOR INSERT WITH CHECK (
    post_id IN (SELECT id FROM posts WHERE workspace_role(workspace_id) IN ('owner','admin','editor'))
  );

CREATE POLICY "editors_update_variants" ON post_variants
  FOR UPDATE USING (
    post_id IN (SELECT id FROM posts WHERE workspace_role(workspace_id) IN ('owner','admin','editor'))
  );

CREATE POLICY "editors_delete_variants" ON post_variants
  FOR DELETE USING (
    post_id IN (SELECT id FROM posts WHERE workspace_role(workspace_id) IN ('owner','admin','editor'))
  );

-- 8. Add workspace_id to publish_jobs for easier RLS (denormalized)
ALTER TABLE publish_jobs ADD COLUMN IF NOT EXISTS workspace_id UUID REFERENCES workspaces(id);

-- 9. Add updated_at to media_assets for consistency
ALTER TABLE media_assets ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

-- 10. Add created_by to error_logs
ALTER TABLE error_logs ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES auth.users(id);

-- 11. Index for faster workspace-scoped queries
CREATE INDEX IF NOT EXISTS idx_posts_workspace_status ON posts(workspace_id, status);
CREATE INDEX IF NOT EXISTS idx_variants_platform ON post_variants(platform, status);
CREATE INDEX IF NOT EXISTS idx_connections_workspace_status ON platform_connections(workspace_id, status);

-- 12. Workspace delete policy (only owner can delete)
CREATE POLICY "owner_delete_workspaces" ON workspaces
  FOR DELETE USING (owner_id = auth.uid());
