import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";

const CLIENT_ID = process.env.REDDIT_CLIENT_ID!;
const CLIENT_SECRET = process.env.REDDIT_CLIENT_SECRET!;
const REDIRECT_URI = `${process.env.NEXT_PUBLIC_APP_URL}/api/oauth/reddit`;

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");

  if (!code) {
    if (!CLIENT_ID) return NextResponse.json({ error: "REDDIT_CLIENT_ID not configured" }, { status: 503 });
    const workspaceId = req.nextUrl.searchParams.get("workspace_id") || "";
    const nonce = randomBytes(16).toString("hex");
    const state = `${workspaceId}:${nonce}`;
    const scopes = "identity submit read";
    const authUrl = `https://www.reddit.com/api/v1/authorize?client_id=${CLIENT_ID}&response_type=code&state=${state}&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&duration=permanent&scope=${scopes}`;
    const response = NextResponse.redirect(authUrl);
    response.cookies.set("oauth_nonce_reddit", nonce, { httpOnly: true, secure: true, sameSite: "lax", maxAge: 600, path: "/" });
    return response;
  }

  const stateParam = req.nextUrl.searchParams.get("state") || ":";
  const storedNonce = req.cookies.get("oauth_nonce_reddit")?.value;
  const [workspaceId, returnedNonce] = stateParam.split(":");
  if (!storedNonce || storedNonce !== returnedNonce) {
    return NextResponse.redirect(new URL("/channels?error=csrf_mismatch", req.nextUrl.origin));
  }

  try {
    const tokenRes = await fetch("https://www.reddit.com/api/v1/access_token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded", Authorization: `Basic ${Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString("base64")}` },
      body: new URLSearchParams({ grant_type: "authorization_code", code, redirect_uri: REDIRECT_URI }),
    });
    const tokens = await tokenRes.json();
    if (tokens.error) throw new Error(tokens.error);

    const userRes = await fetch("https://oauth.reddit.com/api/v1/me", {
      headers: { Authorization: `Bearer ${tokens.access_token}`, "User-Agent": "SocialPublish/1.0" },
    });
    const user = await userRes.json();

    const { createServiceRoleClient } = await import("@/lib/supabase/server");
    const supabase = await createServiceRoleClient();
    await supabase.from("platform_connections").upsert({
      workspace_id: workspaceId, platform: "reddit",
      platform_account_id: user.id || `reddit-${Date.now()}`,
      platform_account_name: `u/${user.name}` || "Reddit",
      avatar_url: user.icon_img, access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      token_expires_at: new Date(Date.now() + (tokens.expires_in || 3600) * 1000).toISOString(),
      status: "active", connected_at: new Date().toISOString(),
    }, { onConflict: "workspace_id,platform,platform_account_id" });

    const url = new URL("/channels", req.nextUrl.origin);
    url.searchParams.set("connected", "reddit");
    const response = NextResponse.redirect(url);
    response.cookies.delete("oauth_nonce_reddit");
    return response;
  } catch {
    return NextResponse.redirect(new URL("/channels?error=oauth_failed", req.nextUrl.origin));
  }
}
