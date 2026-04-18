-- =============================================
-- Migration 0004: Publishing Engine
-- =============================================

-- Publish jobs: queue table
CREATE TABLE publish_jobs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  variant_id      UUID NOT NULL REFERENCES post_variants(id) ON DELETE CASCADE,
  idempotency_key TEXT UNIQUE NOT NULL,
  status          VARCHAR(20) DEFAULT 'queued'
                  CHECK (status IN ('queued','processing','done','failed','dead')),
  attempt_number  INTEGER DEFAULT 1,
  max_attempts    INTEGER DEFAULT 4,
  next_attempt_at TIMESTAMPTZ DEFAULT now(),
  started_at      TIMESTAMPTZ,
  completed_at    TIMESTAMPTZ,
  result          JSONB,
  error           TEXT,
  created_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_jobs_queued ON publish_jobs(next_attempt_at)
  WHERE status = 'queued';
CREATE INDEX idx_jobs_variant ON publish_jobs(variant_id, status);

-- Publish logs: append-only audit trail
CREATE TABLE publish_logs (
  id          BIGSERIAL PRIMARY KEY,
  job_id      UUID REFERENCES publish_jobs(id),
  variant_id  UUID REFERENCES post_variants(id),
  event       VARCHAR(50) NOT NULL,
  payload     JSONB DEFAULT '{}',
  created_at  TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_publish_logs_variant ON publish_logs(variant_id, created_at DESC);

-- Error logs: system-wide error tracking
CREATE TABLE error_logs (
  id              BIGSERIAL PRIMARY KEY,
  workspace_id    UUID REFERENCES workspaces(id),
  connection_id   UUID REFERENCES platform_connections(id),
  variant_id      UUID REFERENCES post_variants(id),
  error_type      VARCHAR(50) NOT NULL,
  error_code      VARCHAR(50),
  error_message   TEXT,
  context         JSONB DEFAULT '{}',
  resolved        BOOLEAN DEFAULT FALSE,
  resolved_at     TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_error_logs_workspace ON error_logs(workspace_id, created_at DESC);
CREATE INDEX idx_error_logs_unresolved ON error_logs(workspace_id)
  WHERE resolved = FALSE;

-- Audit logs: who did what
CREATE TABLE audit_logs (
  id              BIGSERIAL PRIMARY KEY,
  workspace_id    UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  actor_user_id   UUID REFERENCES auth.users(id),
  action          VARCHAR(100) NOT NULL,
  entity_type     VARCHAR(50),
  entity_id       UUID,
  metadata        JSONB DEFAULT '{}',
  created_at      TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "members_select_audit" ON audit_logs
  FOR SELECT USING (is_workspace_member(workspace_id));

CREATE INDEX idx_audit_workspace ON audit_logs(workspace_id, created_at DESC);

-- Notifications
CREATE TABLE notifications (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id    UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id         UUID REFERENCES auth.users(id),
  type            VARCHAR(50) NOT NULL,
  title           TEXT NOT NULL,
  message         TEXT,
  link            TEXT,
  read            BOOLEAN DEFAULT FALSE,
  created_at      TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own_notifications" ON notifications
  FOR ALL USING (user_id = auth.uid());

CREATE INDEX idx_notifications_user ON notifications(user_id, read, created_at DESC);
