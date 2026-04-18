import { createClient } from "@/lib/supabase/client";
import type { Platform } from "@/lib/platform-capabilities";

function getClient() { return createClient(); }

export interface PlatformConnection {
  id: string;
  workspace_id: string;
  brand_id: string | null;
  platform: Platform;
  platform_account_id: string;
  platform_account_name: string | null;
  platform_account_type: string | null;
  avatar_url: string | null;
  status: "active" | "expired" | "revoked" | "error" | "limited";
  token_expires_at: string | null;
  scopes: string[] | null;
  last_checked_at: string | null;
  last_error: string | null;
  metadata: Record<string, unknown>;
  connected_at: string;
}

export async function listConnections(workspaceId: string) {
  const { data, error } = await getClient()
    .from("platform_connections")
    .select("*")
    .eq("workspace_id", workspaceId)
    .order("connected_at", { ascending: false });
  if (error) throw error;
  return data as PlatformConnection[];
}

export async function getConnection(id: string) {
  const { data, error } = await getClient()
    .from("platform_connections")
    .select("*")
    .eq("id", id)
    .single();
  if (error) throw error;
  return data as PlatformConnection;
}

export async function deleteConnection(id: string) {
  const { error } = await getClient()
    .from("platform_connections")
    .delete()
    .eq("id", id);
  if (error) throw error;
}

export async function updateConnectionStatus(
  id: string,
  status: PlatformConnection["status"],
  lastError?: string
) {
  const { error } = await getClient()
    .from("platform_connections")
    .update({ status, last_error: lastError ?? null, last_checked_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
}
