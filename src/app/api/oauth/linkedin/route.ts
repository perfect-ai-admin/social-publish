import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";

const CLIENT_ID = process.env.LINKEDIN_CLIENT_ID!;
const CLIENT_SECRET = process.env.LINKEDIN_CLIENT_SECRET!;
const REDIRECT_URI = `${process.env.NEXT_PUBLIC_APP_URL}/api/oauth/linkedin`;

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");

  if (!code) {
    if (!CLIENT_ID) return NextResponse.json({ error: "LINKEDIN_CLIENT_ID not configured" }, { status: 503 });
    const workspaceId = req.nextUrl.searchParams.get("workspace_id") || "";
    const nonce = randomBytes(16).toString("hex");
    const state = `${workspaceId}:${nonce}`;
    const scopes = "openid profile w_member_social r_basicprofile";
    const authUrl = `https://www.linkedin.com/oauth/v2/authorization?response_type=code&client_id=${CLIENT_ID}&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&scope=${encodeURIComponent(scopes)}&state=${state}`;
    const response = NextResponse.redirect(authUrl);
    response.cookies.set("oauth_nonce_linkedin", nonce, { httpOnly: true, secure: true, sameSite: "lax", maxAge: 600, path: "/" });
    return response;
  }

  const stateParam = req.nextUrl.searchParams.get("state") || ":";
  const storedNonce = req.cookies.get("oauth_nonce_linkedin")?.value;
  const [workspaceId, returnedNonce] = stateParam.split(":");
  if (!storedNonce || storedNonce !== returnedNonce) {
    return NextResponse.redirect(new URL("/channels?error=csrf_mismatch", req.nextUrl.origin));
  }

  try {
    const tokenRes = await fetch("https://www.linkedin.com/oauth/v2/accessToken", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ grant_type: "authorization_code", code, client_id: CLIENT_ID, client_secret: CLIENT_SECRET, redirect_uri: REDIRECT_URI }),
    });
    const tokens = await tokenRes.json();
    if (tokens.error) throw new Error(tokens.error_description || tokens.error);

    const profileRes = await fetch("https://api.linkedin.com/v2/userinfo", {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });
    const profile = await profileRes.json();

    const { createServiceRoleClient } = await import("@/lib/supabase/server");
    const supabase = await createServiceRoleClient();
    await supabase.from("platform_connections").upsert({
      workspace_id: workspaceId, platform: "linkedin",
      platform_account_id: profile.sub || `linkedin-${Date.now()}`,
      platform_account_name: profile.name || "LinkedIn Profile",
      avatar_url: profile.picture, access_token: tokens.access_token,
      token_expires_at: new Date(Date.now() + (tokens.expires_in || 5184000) * 1000).toISOString(),
      status: "active", connected_at: new Date().toISOString(),
    }, { onConflict: "workspace_id,platform,platform_account_id" });

    const url = new URL("/channels", req.nextUrl.origin);
    url.searchParams.set("connected", "linkedin");
    const response = NextResponse.redirect(url);
    response.cookies.delete("oauth_nonce_linkedin");
    return response;
  } catch {
    return NextResponse.redirect(new URL("/channels?error=oauth_failed", req.nextUrl.origin));
  }
}
