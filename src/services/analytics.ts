import { createClient } from "@/lib/supabase/client";

function getClient() { return createClient(); }

export interface PostAnalytics {
  id: string;
  variant_id: string;
  workspace_id: string;
  platform: string;
  fetched_at: string;
  impressions: number;
  reach: number;
  likes: number;
  comments: number;
  shares: number;
  saves: number;
  clicks: number;
  video_views: number;
  engagement_rate: number | null;
}

export interface DashboardMetrics {
  totalPublished: number;
  totalScheduled: number;
  totalFailed: number;
  totalImpressions: number;
  totalEngagement: number;
  avgEngagementRate: number;
}

export async function getDashboardMetrics(workspaceId: string): Promise<DashboardMetrics> {
  const [publishedRes, scheduledRes, failedRes, analyticsRes] = await Promise.all([
    getClient().from("posts").select("id", { count: "exact", head: true }).eq("workspace_id", workspaceId).eq("status", "published"),
    getClient().from("posts").select("id", { count: "exact", head: true }).eq("workspace_id", workspaceId).eq("status", "scheduled"),
    getClient().from("posts").select("id", { count: "exact", head: true }).eq("workspace_id", workspaceId).eq("status", "failed"),
    getClient().from("post_analytics").select("impressions, likes, comments, shares, engagement_rate").eq("workspace_id", workspaceId),
  ]);

  const analytics = analyticsRes.data ?? [];
  const totalImpressions = analytics.reduce((sum, a) => sum + (a.impressions ?? 0), 0);
  const totalEngagement = analytics.reduce((sum, a) => sum + (a.likes ?? 0) + (a.comments ?? 0) + (a.shares ?? 0), 0);
  const rates = analytics.filter((a) => a.engagement_rate != null).map((a) => a.engagement_rate!);
  const avgEngagementRate = rates.length > 0 ? rates.reduce((s, r) => s + r, 0) / rates.length : 0;

  return {
    totalPublished: publishedRes.count ?? 0,
    totalScheduled: scheduledRes.count ?? 0,
    totalFailed: failedRes.count ?? 0,
    totalImpressions,
    totalEngagement,
    avgEngagementRate,
  };
}

export async function getPostAnalytics(variantId: string) {
  const { data, error } = await getClient()
    .from("post_analytics")
    .select("*")
    .eq("variant_id", variantId)
    .order("fetched_at", { ascending: false })
    .limit(1)
    .single();
  if (error) throw error;
  return data as PostAnalytics;
}

export async function getWorkspaceAnalytics(workspaceId: string, days = 30) {
  const since = new Date(Date.now() - days * 86400000).toISOString();
  const { data, error } = await getClient()
    .from("post_analytics")
    .select("*")
    .eq("workspace_id", workspaceId)
    .gte("fetched_at", since)
    .order("fetched_at", { ascending: true });
  if (error) throw error;
  return data as PostAnalytics[];
}
