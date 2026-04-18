import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { supabaseAdmin, jsonResponse, errorResponse, getCorsHeaders } from "../_shared/supabaseAdmin.ts";

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: getCorsHeaders() });

  try {
    const authHeader = req.headers.get("authorization");
    if (!authHeader) return errorResponse("Unauthorized", 401);

    // Fetch all published variants with active connections
    const { data: variants, error } = await supabaseAdmin
      .from("post_variants")
      .select(`
        id, platform, platform_post_id, post_id,
        platform_connections!inner(id, workspace_id, platform, access_token, platform_account_id, status)
      `)
      .eq("status", "published")
      .not("platform_post_id", "is", null);

    if (error) throw error;
    if (!variants?.length) return jsonResponse({ fetched: 0 });

    let fetched = 0;

    for (const variant of variants) {
      const connection = variant.platform_connections as any;
      if (connection.status !== "active") continue;

      try {
        let metrics: Record<string, number> = {};

        switch (variant.platform) {
          case "facebook":
            metrics = await fetchFacebookInsights(connection.access_token, variant.platform_post_id!);
            break;
          case "instagram":
            metrics = await fetchInstagramInsights(connection.access_token, variant.platform_post_id!);
            break;
          default:
            continue;
        }

        // Upsert analytics
        await supabaseAdmin.from("post_analytics").upsert({
          variant_id: variant.id,
          workspace_id: connection.workspace_id,
          platform: variant.platform,
          fetched_at: new Date().toISOString(),
          impressions: metrics.impressions || 0,
          reach: metrics.reach || 0,
          likes: metrics.likes || 0,
          comments: metrics.comments || 0,
          shares: metrics.shares || 0,
          saves: metrics.saves || 0,
          clicks: metrics.clicks || 0,
          video_views: metrics.video_views || 0,
          engagement_rate: metrics.engagement_rate || 0,
          raw_data: metrics,
        }, { onConflict: "variant_id,fetched_at::date" });

        fetched++;
      } catch (err) {
        console.error(`Analytics fetch error for variant ${variant.id}:`, err);
      }
    }

    return jsonResponse({ fetched });
  } catch (err) {
    return errorResponse(err instanceof Error ? err.message : "Unknown error", 500);
  }
});

async function fetchFacebookInsights(token: string, postId: string) {
  const res = await fetch(
    `https://graph.facebook.com/v21.0/${postId}?fields=insights.metric(post_impressions,post_engaged_users,post_clicks),likes.summary(true),comments.summary(true),shares&access_token=${token}`
  );
  const data = await res.json();

  const insights = data.insights?.data || [];
  const getMetric = (name: string) =>
    insights.find((i: any) => i.name === name)?.values?.[0]?.value || 0;

  return {
    impressions: getMetric("post_impressions"),
    reach: getMetric("post_engaged_users"),
    likes: data.likes?.summary?.total_count || 0,
    comments: data.comments?.summary?.total_count || 0,
    shares: data.shares?.count || 0,
    clicks: getMetric("post_clicks"),
  };
}

async function fetchInstagramInsights(token: string, postId: string) {
  const res = await fetch(
    `https://graph.facebook.com/v21.0/${postId}/insights?metric=impressions,reach,likes,comments,saved,shares&access_token=${token}`
  );
  const data = await res.json();
  const metrics: Record<string, number> = {};

  for (const item of data.data || []) {
    metrics[item.name] = item.values?.[0]?.value || 0;
  }

  return {
    impressions: metrics.impressions || 0,
    reach: metrics.reach || 0,
    likes: metrics.likes || 0,
    comments: metrics.comments || 0,
    saves: metrics.saved || 0,
    shares: metrics.shares || 0,
  };
}
