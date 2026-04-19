import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";

const CLIENT_KEY = process.env.TIKTOK_CLIENT_KEY!;
const CLIENT_SECRET = process.env.TIKTOK_CLIENT_SECRET!;
const REDIRECT_URI = `${process.env.NEXT_PUBLIC_APP_URL}/api/oauth/tiktok`;

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");

  if (!code) {
    if (!CLIENT_KEY) return NextResponse.json({ error: "TIKTOK_CLIENT_KEY not configured" }, { status: 503 });
    const workspaceId = req.nextUrl.searchParams.get("workspace_id") || "";
    const nonce = randomBytes(16).toString("hex");
    const state = `${workspaceId}:${nonce}`;
    const scopes = "user.info.basic,video.publish,video.upload";
    const authUrl = `https://www.tiktok.com/v2/auth/authorize/?client_key=${CLIENT_KEY}&scope=${scopes}&response_type=code&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&state=${state}`;
    const response = NextResponse.redirect(authUrl);
    response.cookies.set("oauth_nonce_tiktok", nonce, { httpOnly: true, secure: true, sameSite: "lax", maxAge: 600, path: "/" });
    return response;
  }

  const stateParam = req.nextUrl.searchParams.get("state") || ":";
  const storedNonce = req.cookies.get("oauth_nonce_tiktok")?.value;
  const [workspaceId, returnedNonce] = stateParam.split(":");
  if (!storedNonce || storedNonce !== returnedNonce) {
    return NextResponse.redirect(new URL("/channels?error=csrf_mismatch", req.nextUrl.origin));
  }

  try {
    const tokenRes = await fetch("https://open.tiktokapis.com/v2/oauth/token/", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ client_key: CLIENT_KEY, client_secret: CLIENT_SECRET, code, grant_type: "authorization_code", redirect_uri: REDIRECT_URI }),
    });
    const tokens = await tokenRes.json();
    if (tokens.error) throw new Error(tokens.error_description || tokens.error);

    const userRes = await fetch("https://open.tiktokapis.com/v2/user/info/?fields=display_name,avatar_url,open_id", {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });
    const userData = await userRes.json();
    const user = userData.data?.user || {};

    const { createServiceRoleClient } = await import("@/lib/supabase/server");
    const supabase = await createServiceRoleClient();
    await supabase.from("platform_connections").upsert({
      workspace_id: workspaceId, platform: "tiktok",
      platform_account_id: tokens.open_id || user.open_id || `tiktok-${Date.now()}`,
      platform_account_name: user.display_name || "TikTok Account",
      avatar_url: user.avatar_url, access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      token_expires_at: new Date(Date.now() + (tokens.expires_in || 86400) * 1000).toISOString(),
      status: "active", connected_at: new Date().toISOString(),
    }, { onConflict: "workspace_id,platform,platform_account_id" });

    const url = new URL("/channels", req.nextUrl.origin);
    url.searchParams.set("connected", "tiktok");
    const response = NextResponse.redirect(url);
    response.cookies.delete("oauth_nonce_tiktok");
    return response;
  } catch {
    return NextResponse.redirect(new URL("/channels?error=oauth_failed", req.nextUrl.origin));
  }
}
