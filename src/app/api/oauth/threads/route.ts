import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";

// Threads uses the same Meta/Instagram OAuth - but with Threads-specific scopes
const CLIENT_ID = process.env.META_APP_ID!;
const CLIENT_SECRET = process.env.META_APP_SECRET!;
const REDIRECT_URI = `${process.env.NEXT_PUBLIC_APP_URL}/api/oauth/threads`;

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");

  if (!code) {
    if (!CLIENT_ID) return NextResponse.json({ error: "META_APP_ID not configured" }, { status: 503 });
    const workspaceId = req.nextUrl.searchParams.get("workspace_id") || "";
    const nonce = randomBytes(16).toString("hex");
    const state = `${workspaceId}:${nonce}`;
    const scopes = "threads_basic,threads_content_publish,threads_manage_insights";
    const authUrl = `https://threads.net/oauth/authorize?client_id=${CLIENT_ID}&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&scope=${scopes}&response_type=code&state=${state}`;
    const response = NextResponse.redirect(authUrl);
    response.cookies.set("oauth_nonce_threads", nonce, { httpOnly: true, secure: true, sameSite: "lax", maxAge: 600, path: "/" });
    return response;
  }

  const stateParam = req.nextUrl.searchParams.get("state") || ":";
  const storedNonce = req.cookies.get("oauth_nonce_threads")?.value;
  const [workspaceId, returnedNonce] = stateParam.split(":");
  if (!storedNonce || storedNonce !== returnedNonce) {
    return NextResponse.redirect(new URL("/channels?error=csrf_mismatch", req.nextUrl.origin));
  }

  try {
    // Exchange code for short-lived token
    const tokenRes = await fetch("https://graph.threads.net/oauth/access_token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ client_id: CLIENT_ID, client_secret: CLIENT_SECRET, grant_type: "authorization_code", redirect_uri: REDIRECT_URI, code }),
    });
    const tokens = await tokenRes.json();
    if (tokens.error) throw new Error(tokens.error.message || tokens.error);

    // Exchange for long-lived token
    const longRes = await fetch(`https://graph.threads.net/access_token?grant_type=th_exchange_token&client_secret=${CLIENT_SECRET}&access_token=${tokens.access_token}`);
    const longData = await longRes.json();
    const longToken = longData.access_token || tokens.access_token;

    // Get user info
    const userRes = await fetch(`https://graph.threads.net/v1.0/me?fields=id,username,threads_profile_picture_url&access_token=${longToken}`);
    const user = await userRes.json();

    const { createServiceRoleClient } = await import("@/lib/supabase/server");
    const supabase = await createServiceRoleClient();
    await supabase.from("platform_connections").upsert({
      workspace_id: workspaceId, platform: "threads",
      platform_account_id: user.id || `threads-${Date.now()}`,
      platform_account_name: `@${user.username}` || "Threads",
      avatar_url: user.threads_profile_picture_url, access_token: longToken,
      token_expires_at: new Date(Date.now() + (longData.expires_in || 5184000) * 1000).toISOString(),
      status: "active", connected_at: new Date().toISOString(),
    }, { onConflict: "workspace_id,platform,platform_account_id" });

    const url = new URL("/channels", req.nextUrl.origin);
    url.searchParams.set("connected", "threads");
    const response = NextResponse.redirect(url);
    response.cookies.delete("oauth_nonce_threads");
    return response;
  } catch {
    return NextResponse.redirect(new URL("/channels?error=oauth_failed", req.nextUrl.origin));
  }
}
