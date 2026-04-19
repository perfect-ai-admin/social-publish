import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";

const CLIENT_ID = process.env.PINTEREST_CLIENT_ID!;
const CLIENT_SECRET = process.env.PINTEREST_CLIENT_SECRET!;
const REDIRECT_URI = `${process.env.NEXT_PUBLIC_APP_URL}/api/oauth/pinterest`;

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");

  if (!code) {
    if (!CLIENT_ID) return NextResponse.json({ error: "PINTEREST_CLIENT_ID not configured" }, { status: 503 });
    const workspaceId = req.nextUrl.searchParams.get("workspace_id") || "";
    const nonce = randomBytes(16).toString("hex");
    const state = `${workspaceId}:${nonce}`;
    const scopes = "pins:read,pins:write,boards:read,boards:write,user_accounts:read";
    const authUrl = `https://www.pinterest.com/oauth/?client_id=${CLIENT_ID}&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&response_type=code&scope=${scopes}&state=${state}`;
    const response = NextResponse.redirect(authUrl);
    response.cookies.set("oauth_nonce_pinterest", nonce, { httpOnly: true, secure: true, sameSite: "lax", maxAge: 600, path: "/" });
    return response;
  }

  const stateParam = req.nextUrl.searchParams.get("state") || ":";
  const storedNonce = req.cookies.get("oauth_nonce_pinterest")?.value;
  const [workspaceId, returnedNonce] = stateParam.split(":");
  if (!storedNonce || storedNonce !== returnedNonce) {
    return NextResponse.redirect(new URL("/channels?error=csrf_mismatch", req.nextUrl.origin));
  }

  try {
    const tokenRes = await fetch("https://api.pinterest.com/v5/oauth/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded", Authorization: `Basic ${Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString("base64")}` },
      body: new URLSearchParams({ grant_type: "authorization_code", code, redirect_uri: REDIRECT_URI }),
    });
    const tokens = await tokenRes.json();
    if (tokens.error) throw new Error(tokens.message || tokens.error);

    const userRes = await fetch("https://api.pinterest.com/v5/user_account", {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });
    const user = await userRes.json();

    const { createServiceRoleClient } = await import("@/lib/supabase/server");
    const supabase = await createServiceRoleClient();
    await supabase.from("platform_connections").upsert({
      workspace_id: workspaceId, platform: "pinterest",
      platform_account_id: user.username || `pinterest-${Date.now()}`,
      platform_account_name: user.business_name || user.username || "Pinterest",
      avatar_url: user.profile_image, access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      token_expires_at: new Date(Date.now() + (tokens.expires_in || 2592000) * 1000).toISOString(),
      status: "active", connected_at: new Date().toISOString(),
    }, { onConflict: "workspace_id,platform,platform_account_id" });

    const url = new URL("/channels", req.nextUrl.origin);
    url.searchParams.set("connected", "pinterest");
    const response = NextResponse.redirect(url);
    response.cookies.delete("oauth_nonce_pinterest");
    return response;
  } catch {
    return NextResponse.redirect(new URL("/channels?error=oauth_failed", req.nextUrl.origin));
  }
}
