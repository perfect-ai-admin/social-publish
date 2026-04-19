import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";

const META_APP_ID = process.env.META_APP_ID!;
const REDIRECT_URI = `${process.env.NEXT_PUBLIC_APP_URL}/api/oauth/meta`;

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");
  const stateParam = req.nextUrl.searchParams.get("state");

  if (!code) {
    // Initiate OAuth flow with CSRF nonce
    const workspaceId = req.nextUrl.searchParams.get("workspace_id") || "";
    const nonce = randomBytes(16).toString("hex");
    const state = `${workspaceId}:${nonce}`;

    // Start with basic scopes (no review needed). Advanced scopes added after App Review.
    const scopes = [
      "email",
      "public_profile",
    ].join(",");

    const authUrl = `https://www.facebook.com/v21.0/dialog/oauth?client_id=${META_APP_ID}&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&scope=${scopes}&state=${state}&response_type=code`;

    const response = NextResponse.redirect(authUrl);
    // Store nonce in cookie for verification on callback
    response.cookies.set("oauth_nonce", nonce, {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      maxAge: 600, // 10 minutes
      path: "/",
    });
    return response;
  }

  // Handle callback — verify CSRF nonce
  const storedNonce = req.cookies.get("oauth_nonce")?.value;
  const [workspaceId, returnedNonce] = (stateParam || ":").split(":");

  if (!storedNonce || storedNonce !== returnedNonce) {
    const url = new URL("/channels", req.nextUrl.origin);
    url.searchParams.set("error", "csrf_mismatch");
    return NextResponse.redirect(url);
  }

  try {
    const { createServiceRoleClient } = await import("@/lib/supabase/server");
    const supabase = await createServiceRoleClient();

    const { data, error } = await supabase.functions.invoke("metaOAuthExchange", {
      body: { code, redirect_uri: REDIRECT_URI, workspace_id: workspaceId },
    });

    if (error) throw error;

    const url = new URL("/channels", req.nextUrl.origin);
    url.searchParams.set("connected", "meta");
    url.searchParams.set("count", String(data.connections?.length || 0));
    const response = NextResponse.redirect(url);
    response.cookies.delete("oauth_nonce");
    return response;
  } catch (err) {
    const url = new URL("/channels", req.nextUrl.origin);
    url.searchParams.set("error", "oauth_failed");
    return NextResponse.redirect(url);
  }
}
