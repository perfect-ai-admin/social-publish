-- =============================================
-- Migration 0008: Dequeue RPC + production fixes
-- =============================================

-- 1. Atomic dequeue function with FOR UPDATE SKIP LOCKED
-- Prevents concurrent publishPost invocations from double-processing
CREATE OR REPLACE FUNCTION dequeue_publish_jobs(batch_limit INT DEFAULT 10)
RETURNS SETOF publish_jobs AS $$
  UPDATE publish_jobs
  SET status = 'processing', started_at = now()
  WHERE id IN (
    SELECT id FROM publish_jobs
    WHERE status = 'queued' AND next_attempt_at <= now()
    ORDER BY next_attempt_at ASC
    FOR UPDATE SKIP LOCKED
    LIMIT batch_limit
  )
  RETURNING *;
$$ LANGUAGE sql;

-- 2. Recovery function: unstick "processing" jobs older than 2 minutes
CREATE OR REPLACE FUNCTION recover_stuck_jobs()
RETURNS INT AS $$
DECLARE
  recovered INT;
BEGIN
  UPDATE publish_jobs
  SET status = 'queued',
      attempt_number = attempt_number + 1,
      next_attempt_at = now() + interval '1 minute',
      error = 'Recovered from stuck processing state'
  WHERE status = 'processing'
    AND started_at < now() - interval '2 minutes';
  GET DIAGNOSTICS recovered = ROW_COUNT;
  RETURN recovered;
END;
$$ LANGUAGE plpgsql;

-- 3. Ensure idempotency_key has unique constraint (prevents double-publish)
-- Already UNIQUE in 0004, but add IF NOT EXISTS safety
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'publish_jobs_idempotency_key_key') THEN
    ALTER TABLE publish_jobs ADD CONSTRAINT publish_jobs_idempotency_key_key UNIQUE (idempotency_key);
  END IF;
END $$;

-- 4. Default for attempt_number and max_attempts
ALTER TABLE publish_jobs ALTER COLUMN attempt_number SET DEFAULT 1;
ALTER TABLE publish_jobs ALTER COLUMN max_attempts SET DEFAULT 4;

-- 5. Add workspace_id to publish_jobs for easier queries (populate from variant)
-- Already added in 0007, but add trigger to auto-populate
CREATE OR REPLACE FUNCTION set_publish_job_workspace()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.workspace_id IS NULL THEN
    SELECT p.workspace_id INTO NEW.workspace_id
    FROM post_variants pv
    JOIN posts p ON pv.post_id = p.id
    WHERE pv.id = NEW.variant_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_set_publish_job_workspace ON publish_jobs;
CREATE TRIGGER trg_set_publish_job_workspace
  BEFORE INSERT ON publish_jobs
  FOR EACH ROW EXECUTE FUNCTION set_publish_job_workspace();

-- 6. Cron: recover stuck jobs every 5 minutes
SELECT cron.schedule(
  'recover_stuck_jobs',
  '*/5 * * * *',
  $$ SELECT recover_stuck_jobs() $$
);
