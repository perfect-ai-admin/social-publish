import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { supabaseAdmin, jsonResponse, errorResponse, getCorsHeaders } from "../_shared/supabaseAdmin.ts";

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: getCorsHeaders() });

  try {
    const authHeader = req.headers.get("authorization");
    if (!authHeader) return errorResponse("Unauthorized", 401);

    // Find connections expiring within 48 hours
    const expiryThreshold = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString();

    const { data: connections, error } = await supabaseAdmin
      .from("platform_connections")
      .select("*")
      .eq("status", "active")
      .lte("token_expires_at", expiryThreshold)
      .not("refresh_token", "is", null);

    if (error) throw error;
    if (!connections?.length) return jsonResponse({ refreshed: 0, message: "No tokens expiring soon" });

    let refreshed = 0;
    let failed = 0;

    for (const conn of connections) {
      try {
        let newToken: { access_token: string; expires_in: number } | null = null;

        switch (conn.platform) {
          case "facebook":
          case "instagram":
            newToken = await refreshMetaToken(conn.access_token);
            break;
          case "youtube":
          case "google_business":
            newToken = await refreshGoogleToken(conn.refresh_token!);
            break;
          case "linkedin":
            newToken = await refreshLinkedInToken(conn.refresh_token!);
            break;
          case "tiktok":
            newToken = await refreshTikTokToken(conn.refresh_token!);
            break;
          default:
            continue;
        }

        if (newToken) {
          await supabaseAdmin.from("platform_connections").update({
            access_token: newToken.access_token,
            token_expires_at: new Date(Date.now() + newToken.expires_in * 1000).toISOString(),
            status: "active",
            last_checked_at: new Date().toISOString(),
            last_error: null,
          }).eq("id", conn.id);
          refreshed++;
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        await supabaseAdmin.from("platform_connections").update({
          status: "expired",
          last_error: msg,
          last_checked_at: new Date().toISOString(),
        }).eq("id", conn.id);
        failed++;
      }
    }

    return jsonResponse({ refreshed, failed, total: connections.length });
  } catch (err) {
    return errorResponse(err instanceof Error ? err.message : "Unknown error", 500);
  }
});

async function refreshMetaToken(currentToken: string) {
  const appId = Deno.env.get("META_APP_ID");
  const appSecret = Deno.env.get("META_APP_SECRET");
  if (!appId || !appSecret) throw new Error("META_APP_ID/SECRET not configured");

  const res = await fetch(
    `https://graph.facebook.com/v21.0/oauth/access_token?grant_type=fb_exchange_token&client_id=${appId}&client_secret=${appSecret}&fb_exchange_token=${currentToken}`
  );
  const data = await res.json();
  if (data.error) throw new Error(data.error.message);
  return { access_token: data.access_token, expires_in: data.expires_in || 5184000 };
}

async function refreshGoogleToken(refreshToken: string) {
  const clientId = Deno.env.get("GOOGLE_CLIENT_ID");
  const clientSecret = Deno.env.get("GOOGLE_CLIENT_SECRET");
  if (!clientId || !clientSecret) throw new Error("GOOGLE_CLIENT_ID/SECRET not configured");

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });
  const data = await res.json();
  if (data.error) throw new Error(data.error_description || data.error);
  return { access_token: data.access_token, expires_in: data.expires_in || 3600 };
}

async function refreshLinkedInToken(refreshToken: string) {
  const clientId = Deno.env.get("LINKEDIN_CLIENT_ID");
  const clientSecret = Deno.env.get("LINKEDIN_CLIENT_SECRET");
  if (!clientId || !clientSecret) throw new Error("LINKEDIN credentials not configured");

  const res = await fetch("https://www.linkedin.com/oauth/v2/accessToken", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
      client_id: clientId,
      client_secret: clientSecret,
    }),
  });
  const data = await res.json();
  if (data.error) throw new Error(data.error_description || data.error);
  return { access_token: data.access_token, expires_in: data.expires_in || 5184000 };
}

async function refreshTikTokToken(refreshToken: string) {
  const clientKey = Deno.env.get("TIKTOK_CLIENT_KEY");
  const clientSecret = Deno.env.get("TIKTOK_CLIENT_SECRET");
  if (!clientKey || !clientSecret) throw new Error("TIKTOK credentials not configured");

  const res = await fetch("https://open.tiktokapis.com/v2/oauth/token/", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_key: clientKey,
      client_secret: clientSecret,
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    }),
  });
  const data = await res.json();
  if (data.error) throw new Error(data.error_description || data.error);
  return { access_token: data.access_token, expires_in: data.expires_in || 86400 };
}
