import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID!;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET!;
const REDIRECT_URI = `${process.env.NEXT_PUBLIC_APP_URL}/api/oauth/google`;

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");
  const stateParam = req.nextUrl.searchParams.get("state");

  if (!code) {
    // Initiate OAuth with CSRF nonce
    const workspaceId = req.nextUrl.searchParams.get("workspace_id") || "";
    const platform = req.nextUrl.searchParams.get("platform") || "youtube";
    const nonce = randomBytes(16).toString("hex");
    const state = `${workspaceId}:${platform}:${nonce}`;

    const scopes = platform === "google_business"
      ? "https://www.googleapis.com/auth/business.manage"
      : "https://www.googleapis.com/auth/youtube.upload https://www.googleapis.com/auth/youtube.readonly";

    const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${GOOGLE_CLIENT_ID}&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&response_type=code&scope=${encodeURIComponent(scopes)}&access_type=offline&prompt=consent&state=${state}`;

    const response = NextResponse.redirect(authUrl);
    response.cookies.set("oauth_nonce_google", nonce, {
      httpOnly: true, secure: true, sameSite: "lax", maxAge: 600, path: "/",
    });
    return response;
  }

  // Verify CSRF nonce
  const storedNonce = req.cookies.get("oauth_nonce_google")?.value;
  const parts = (stateParam || "::").split(":");
  const [workspaceId, platform, returnedNonce] = [parts[0], parts[1], parts[2]];

  if (!storedNonce || storedNonce !== returnedNonce) {
    const url = new URL("/channels", req.nextUrl.origin);
    url.searchParams.set("error", "csrf_mismatch");
    return NextResponse.redirect(url);
  }

  try {
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code, client_id: GOOGLE_CLIENT_ID, client_secret: GOOGLE_CLIENT_SECRET,
        redirect_uri: REDIRECT_URI, grant_type: "authorization_code",
      }),
    });
    const tokens = await tokenRes.json();
    if (tokens.error) throw new Error(tokens.error_description);

    const { createServiceRoleClient } = await import("@/lib/supabase/server");
    const supabase = await createServiceRoleClient();

    let accountId = "";
    let accountName = "";

    if (platform === "youtube") {
      const channelRes = await fetch(
        `https://www.googleapis.com/youtube/v3/channels?part=snippet&mine=true`,
        { headers: { Authorization: `Bearer ${tokens.access_token}` } }
      );
      const channelData = await channelRes.json();
      const channel = channelData.items?.[0];
      accountId = channel?.id || "unknown";
      accountName = channel?.snippet?.title || "YouTube Channel";
    } else if (platform === "google_business") {
      const bizRes = await fetch(
        "https://mybusinessaccountmanagement.googleapis.com/v1/accounts",
        { headers: { Authorization: `Bearer ${tokens.access_token}` } }
      );
      const bizData = await bizRes.json();
      const account = bizData.accounts?.[0];
      accountId = account?.name || `gbp-${Date.now()}`;
      accountName = account?.accountName || "Google Business";
    }

    await supabase.from("platform_connections").upsert({
      workspace_id: workspaceId,
      platform,
      platform_account_id: accountId,
      platform_account_name: accountName,
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      token_expires_at: new Date(Date.now() + (tokens.expires_in || 3600) * 1000).toISOString(),
      status: "active",
      connected_at: new Date().toISOString(),
    }, { onConflict: "workspace_id,platform,platform_account_id" });

    const url = new URL("/channels", req.nextUrl.origin);
    url.searchParams.set("connected", platform);
    const response = NextResponse.redirect(url);
    response.cookies.delete("oauth_nonce_google");
    return response;
  } catch (err) {
    const url = new URL("/channels", req.nextUrl.origin);
    url.searchParams.set("error", "oauth_failed");
    return NextResponse.redirect(url);
  }
}
