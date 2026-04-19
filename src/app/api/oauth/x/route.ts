import { NextRequest, NextResponse } from "next/server";
import { randomBytes, createHash } from "crypto";

const CLIENT_ID = process.env.X_CLIENT_ID!;
const CLIENT_SECRET = process.env.X_CLIENT_SECRET!;
const REDIRECT_URI = `${process.env.NEXT_PUBLIC_APP_URL}/api/oauth/x`;

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");

  if (!code) {
    if (!CLIENT_ID) return NextResponse.json({ error: "X_CLIENT_ID not configured" }, { status: 503 });
    const workspaceId = req.nextUrl.searchParams.get("workspace_id") || "";
    const nonce = randomBytes(16).toString("hex");
    const state = `${workspaceId}:${nonce}`;
    // X uses PKCE
    const codeVerifier = randomBytes(32).toString("hex");
    const codeChallenge = createHash("sha256").update(codeVerifier).digest("base64url");
    const scopes = "tweet.read tweet.write users.read offline.access";
    const authUrl = `https://twitter.com/i/oauth2/authorize?response_type=code&client_id=${CLIENT_ID}&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&scope=${encodeURIComponent(scopes)}&state=${state}&code_challenge=${codeChallenge}&code_challenge_method=S256`;
    const response = NextResponse.redirect(authUrl);
    response.cookies.set("oauth_nonce_x", nonce, { httpOnly: true, secure: true, sameSite: "lax", maxAge: 600, path: "/" });
    response.cookies.set("oauth_verifier_x", codeVerifier, { httpOnly: true, secure: true, sameSite: "lax", maxAge: 600, path: "/" });
    return response;
  }

  const stateParam = req.nextUrl.searchParams.get("state") || ":";
  const storedNonce = req.cookies.get("oauth_nonce_x")?.value;
  const codeVerifier = req.cookies.get("oauth_verifier_x")?.value;
  const [workspaceId, returnedNonce] = stateParam.split(":");
  if (!storedNonce || storedNonce !== returnedNonce || !codeVerifier) {
    return NextResponse.redirect(new URL("/channels?error=csrf_mismatch", req.nextUrl.origin));
  }

  try {
    const tokenRes = await fetch("https://api.x.com/2/oauth2/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded", Authorization: `Basic ${Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString("base64")}` },
      body: new URLSearchParams({ code, grant_type: "authorization_code", redirect_uri: REDIRECT_URI, code_verifier: codeVerifier }),
    });
    const tokens = await tokenRes.json();
    if (tokens.error) throw new Error(tokens.error_description || tokens.error);

    const userRes = await fetch("https://api.x.com/2/users/me?user.fields=profile_image_url,name,username", {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });
    const userData = await userRes.json();
    const user = userData.data || {};

    const { createServiceRoleClient } = await import("@/lib/supabase/server");
    const supabase = await createServiceRoleClient();
    await supabase.from("platform_connections").upsert({
      workspace_id: workspaceId, platform: "x",
      platform_account_id: user.id || `x-${Date.now()}`,
      platform_account_name: `@${user.username}` || "X Account",
      avatar_url: user.profile_image_url, access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      token_expires_at: new Date(Date.now() + (tokens.expires_in || 7200) * 1000).toISOString(),
      status: "active", connected_at: new Date().toISOString(),
    }, { onConflict: "workspace_id,platform,platform_account_id" });

    const url = new URL("/channels", req.nextUrl.origin);
    url.searchParams.set("connected", "x");
    const response = NextResponse.redirect(url);
    response.cookies.delete("oauth_nonce_x");
    response.cookies.delete("oauth_verifier_x");
    return response;
  } catch {
    return NextResponse.redirect(new URL("/channels?error=oauth_failed", req.nextUrl.origin));
  }
}
