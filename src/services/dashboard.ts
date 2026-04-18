import { createClient } from "@/lib/supabase/client";

function getClient() { return createClient(); }

export interface WorkspaceKPIs {
  totalPublished: number;
  totalScheduled: number;
  totalFailed: number;
  avgEngagementRate: number;
}

export interface TopPost {
  id: string;
  title: string | null;
  base_caption: string | null;
  status: string;
  published_at: string | null;
  platform?: string;
  impressions?: number;
  likes?: number;
  engagement_rate?: number;
}

export interface PlatformStats {
  platform: string;
  post_count: number;
  total_impressions: number;
  total_likes: number;
  avg_engagement: number;
}

export async function getWorkspaceKPIs(workspaceId: string): Promise<WorkspaceKPIs> {
  const client = getClient();

  const [publishedRes, scheduledRes, failedRes, analyticsRes] = await Promise.all([
    client.from("posts").select("id", { count: "exact", head: true })
      .eq("workspace_id", workspaceId).eq("status", "published"),
    client.from("posts").select("id", { count: "exact", head: true })
      .eq("workspace_id", workspaceId).eq("status", "scheduled"),
    client.from("posts").select("id", { count: "exact", head: true })
      .eq("workspace_id", workspaceId).eq("status", "failed"),
    client.from("post_analytics").select("engagement_rate")
      .eq("workspace_id", workspaceId),
  ]);

  const rates = (analyticsRes.data ?? [])
    .filter((a) => a.engagement_rate != null)
    .map((a) => Number(a.engagement_rate));
  const avgEngagementRate = rates.length > 0
    ? rates.reduce((s, r) => s + r, 0) / rates.length
    : 0;

  return {
    totalPublished: publishedRes.count ?? 0,
    totalScheduled: scheduledRes.count ?? 0,
    totalFailed: failedRes.count ?? 0,
    avgEngagementRate: Math.round(avgEngagementRate * 100) / 100,
  };
}

export async function getTopPosts(workspaceId: string, limit = 5): Promise<TopPost[]> {
  const { data, error } = await getClient()
    .from("posts")
    .select("id, title, base_caption, status, published_at")
    .eq("workspace_id", workspaceId)
    .eq("status", "published")
    .order("published_at", { ascending: false })
    .limit(limit);

  if (error) throw error;
  return data ?? [];
}

export async function getRecentActivity(workspaceId: string, limit = 10) {
  const { data, error } = await getClient()
    .from("posts")
    .select("id, title, base_caption, status, scheduled_at, published_at, created_at")
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw error;
  return data ?? [];
}

export async function getConnectionHealth(workspaceId: string) {
  const { data, error } = await getClient()
    .from("platform_connections")
    .select("id, platform, platform_account_name, status, token_expires_at, last_error")
    .eq("workspace_id", workspaceId);

  if (error) throw error;

  const now = new Date();
  const soon = new Date(now.getTime() + 48 * 60 * 60 * 1000);

  return (data ?? []).map((c) => ({
    ...c,
    health: c.status !== "active"
      ? "error"
      : c.token_expires_at && new Date(c.token_expires_at) < soon
        ? "expiring"
        : "healthy",
  }));
}
