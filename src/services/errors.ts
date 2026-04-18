import { createClient } from "@/lib/supabase/client";

function getClient() { return createClient(); }

export interface ErrorLogEntry {
  id: number;
  workspace_id: string | null;
  connection_id: string | null;
  variant_id: string | null;
  error_type: string;
  error_code: string | null;
  error_message: string | null;
  context: Record<string, unknown>;
  resolved: boolean;
  resolved_at: string | null;
  created_at: string;
}

export interface FailedJob {
  id: string;
  variant_id: string;
  status: string;
  attempt_number: number;
  max_attempts: number;
  error: string | null;
  next_attempt_at: string | null;
  created_at: string;
}

export async function getErrorLogs(workspaceId: string, limit = 50) {
  const { data, error } = await getClient()
    .from("error_logs")
    .select("*")
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data as ErrorLogEntry[];
}

export async function getFailedJobs(workspaceId: string, limit = 50) {
  const { data, error } = await getClient()
    .from("publish_jobs")
    .select("*")
    .eq("workspace_id", workspaceId)
    .in("status", ["failed", "dead"])
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data as FailedJob[];
}

export async function getExpiredConnections(workspaceId: string) {
  const { data, error } = await getClient()
    .from("platform_connections")
    .select("id, platform, platform_account_name, status, token_expires_at, last_error")
    .eq("workspace_id", workspaceId)
    .neq("status", "active");
  if (error) throw error;
  return data ?? [];
}

export async function resolveError(errorId: number) {
  const { error } = await getClient()
    .from("error_logs")
    .update({ resolved: true, resolved_at: new Date().toISOString() })
    .eq("id", errorId);
  if (error) throw error;
}
