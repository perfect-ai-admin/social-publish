import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { supabaseAdmin, jsonResponse, errorResponse, getCorsHeaders } from "../_shared/supabaseAdmin.ts";

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: getCorsHeaders() });

  try {
    const authHeader = req.headers.get("authorization");
    if (!authHeader) return errorResponse("Unauthorized", 401);

    const { code, redirect_uri, workspace_id, brand_id } = await req.json();

    const appId = Deno.env.get("META_APP_ID")!;
    const appSecret = Deno.env.get("META_APP_SECRET")!;

    // 1. Exchange code for short-lived token
    const tokenRes = await fetch(
      `https://graph.facebook.com/v21.0/oauth/access_token?client_id=${appId}&redirect_uri=${encodeURIComponent(redirect_uri)}&client_secret=${appSecret}&code=${code}`
    );
    const tokenData = await tokenRes.json();
    if (tokenData.error) throw new Error(tokenData.error.message);

    // 2. Exchange for long-lived token (60 days)
    const longRes = await fetch(
      `https://graph.facebook.com/v21.0/oauth/access_token?grant_type=fb_exchange_token&client_id=${appId}&client_secret=${appSecret}&fb_exchange_token=${tokenData.access_token}`
    );
    const longData = await longRes.json();
    if (longData.error) throw new Error(longData.error.message);

    const longLivedToken = longData.access_token;
    const expiresIn = longData.expires_in || 5184000;

    // 3. Discover Pages
    const pagesRes = await fetch(
      `https://graph.facebook.com/v21.0/me/accounts?access_token=${longLivedToken}&fields=id,name,access_token,picture`
    );
    const pagesData = await pagesRes.json();
    const pages = pagesData.data || [];

    const connections = [];

    for (const page of pages) {
      // Save Facebook Page connection
      const { data: fbConn, error: fbErr } = await supabaseAdmin
        .from("platform_connections")
        .upsert({
          workspace_id,
          brand_id: brand_id || null,
          platform: "facebook",
          platform_account_id: page.id,
          platform_account_name: page.name,
          platform_account_type: "page",
          avatar_url: page.picture?.data?.url || null,
          access_token: page.access_token,
          token_expires_at: new Date(Date.now() + expiresIn * 1000).toISOString(),
          scopes: ["pages_manage_posts", "pages_read_engagement"],
          status: "active",
          connected_at: new Date().toISOString(),
        }, { onConflict: "workspace_id,platform,platform_account_id" })
        .select()
        .single();

      if (fbConn) connections.push(fbConn);

      // 4. Discover connected Instagram Business Account
      const igRes = await fetch(
        `https://graph.facebook.com/v21.0/${page.id}?fields=instagram_business_account&access_token=${page.access_token}`
      );
      const igData = await igRes.json();

      if (igData.instagram_business_account) {
        const igId = igData.instagram_business_account.id;
        const igInfoRes = await fetch(
          `https://graph.facebook.com/v21.0/${igId}?fields=username,profile_picture_url&access_token=${page.access_token}`
        );
        const igInfo = await igInfoRes.json();

        const { data: igConn } = await supabaseAdmin
          .from("platform_connections")
          .upsert({
            workspace_id,
            brand_id: brand_id || null,
            platform: "instagram",
            platform_account_id: igId,
            platform_account_name: igInfo.username || `IG-${igId}`,
            platform_account_type: "business",
            avatar_url: igInfo.profile_picture_url || null,
            access_token: page.access_token,
            token_expires_at: new Date(Date.now() + expiresIn * 1000).toISOString(),
            scopes: ["instagram_content_publish", "instagram_basic"],
            status: "active",
            connected_at: new Date().toISOString(),
          }, { onConflict: "workspace_id,platform,platform_account_id" })
          .select()
          .single();

        if (igConn) connections.push(igConn);
      }
    }

    return jsonResponse({ connections, pages_found: pages.length });
  } catch (err) {
    return errorResponse(err instanceof Error ? err.message : "Unknown error", 500);
  }
});
