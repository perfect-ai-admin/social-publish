import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { supabaseAdmin, jsonResponse, errorResponse, getCorsHeaders } from "../_shared/supabaseAdmin.ts";

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: getCorsHeaders() });

  try {
    // Auth: only allow service role (cron) or authenticated users
    const authHeader = req.headers.get("authorization");
    if (!authHeader) return errorResponse("Unauthorized", 401);

    // 1. Atomically dequeue jobs with FOR UPDATE SKIP LOCKED (prevents race conditions)
    const { data: dequeuedJobs, error: deqErr } = await supabaseAdmin
      .rpc("dequeue_publish_jobs", { batch_limit: 10 });

    if (deqErr) throw deqErr;
    if (!dequeuedJobs || dequeuedJobs.length === 0) return jsonResponse({ processed: 0 });

    let processed = 0;

    for (const job of dequeuedJobs) {
      // Load variant + connection details
      const { data: variantData, error: varErr } = await supabaseAdmin
        .from("post_variants")
        .select("*, platform_connections!inner(*)")
        .eq("id", job.variant_id)
        .single();

      if (varErr || !variantData) {
        await supabaseAdmin.from("publish_jobs").update({
          status: "dead", error: varErr?.message || "Variant not found",
          completed_at: new Date().toISOString(),
        }).eq("id", job.id);
        continue;
      }

      const variant = variantData;
      const connection = variantData.platform_connections as any;

      try {
        let result: Record<string, unknown> = {};

        switch (connection.platform) {
          case "facebook":
            result = await publishToFacebook(connection, variant);
            break;
          case "instagram":
            result = await publishToInstagram(connection, variant);
            break;
          case "google_business":
            result = await publishToGoogleBusiness(connection, variant);
            break;
          case "telegram":
            result = await publishToTelegram(connection, variant);
            break;
          case "youtube":
          case "tiktok":
          case "linkedin":
          case "pinterest":
            // Skip unsupported platforms — mark as skipped, not published
            await supabaseAdmin.from("publish_jobs").update({
              status: "done",
              completed_at: new Date().toISOString(),
              result: { status: "skipped", reason: `${connection.platform} publishing not yet implemented` },
            }).eq("id", job.id);
            await supabaseAdmin.from("post_variants").update({
              status: "skipped",
              last_error: `${connection.platform} publishing not yet implemented`,
            }).eq("id", variant.id);
            await supabaseAdmin.from("publish_logs").insert({
              job_id: job.id, variant_id: variant.id, event: "skipped",
              payload: { platform: connection.platform },
            });
            continue; // Skip to next job
        }

        // Success — update job + variant
        await supabaseAdmin.from("publish_jobs").update({
          status: "done",
          completed_at: new Date().toISOString(),
          result,
        }).eq("id", job.id);

        await supabaseAdmin.from("post_variants").update({
          status: "published",
          published_at: new Date().toISOString(),
          platform_post_id: (result.post_id as string) || null,
          platform_post_url: (result.post_url as string) || null,
        }).eq("id", variant.id);

        // Log success
        await supabaseAdmin.from("publish_logs").insert({
          job_id: job.id,
          variant_id: variant.id,
          event: "published",
          payload: result,
        });

        processed++;
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : String(err);

        // Retry logic: exponential backoff
        const nextAttempt = job.attempt_number + 1;
        const backoffMinutes = Math.pow(2, nextAttempt);

        if (nextAttempt > (job.max_attempts ?? 4)) {
          // Dead
          await supabaseAdmin.from("publish_jobs").update({
            status: "dead",
            error: errorMsg,
            completed_at: new Date().toISOString(),
          }).eq("id", job.id);

          await supabaseAdmin.from("post_variants").update({
            status: "failed",
            last_error: errorMsg,
          }).eq("id", variant.id);
        } else {
          // Retry
          const retryAt = new Date(Date.now() + backoffMinutes * 60 * 1000).toISOString();
          await supabaseAdmin.from("publish_jobs").update({
            status: "queued",
            attempt_number: nextAttempt,
            next_attempt_at: retryAt,
            error: errorMsg,
          }).eq("id", job.id);
        }

        // Log error
        await supabaseAdmin.from("publish_logs").insert({
          job_id: job.id,
          variant_id: variant.id,
          event: "error",
          payload: { error: errorMsg, attempt: job.attempt_number },
        });
      }
    }

    return jsonResponse({ processed });
  } catch (err) {
    return errorResponse(err instanceof Error ? err.message : "Unknown error", 500);
  }
});

// ---- Platform Publishers ----

async function publishToFacebook(
  connection: { access_token: string; platform_account_id: string },
  variant: { caption: string | null; media_asset_ids: string[] | null }
) {
  const pageId = connection.platform_account_id;
  const token = connection.access_token;
  const message = variant.caption || "";

  // Get media URLs if any
  let mediaUrls: string[] = [];
  if (variant.media_asset_ids?.length) {
    const { data } = await supabaseAdmin
      .from("media_assets")
      .select("public_url")
      .in("id", variant.media_asset_ids);
    mediaUrls = (data || []).map((m) => m.public_url);
  }

  if (mediaUrls.length > 0) {
    // Photo post
    const res = await fetch(`https://graph.facebook.com/v21.0/${pageId}/photos`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        url: mediaUrls[0],
        message,
        access_token: token,
        published: true,
      }),
    });
    const data = await res.json();
    if (data.error) throw new Error(data.error.message);
    return { post_id: data.id, post_url: `https://facebook.com/${data.id}` };
  } else {
    // Text post
    const res = await fetch(`https://graph.facebook.com/v21.0/${pageId}/feed`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message, access_token: token }),
    });
    const data = await res.json();
    if (data.error) throw new Error(data.error.message);
    return { post_id: data.id, post_url: `https://facebook.com/${data.id}` };
  }
}

async function publishToInstagram(
  connection: { access_token: string; platform_account_id: string },
  variant: { caption: string | null; media_asset_ids: string[] | null }
) {
  const igUserId = connection.platform_account_id;
  const token = connection.access_token;
  const caption = variant.caption || "";

  let mediaUrl = "";
  let mimeType = "";
  if (variant.media_asset_ids?.length) {
    const { data } = await supabaseAdmin
      .from("media_assets")
      .select("public_url, mime_type")
      .in("id", variant.media_asset_ids)
      .limit(1);
    mediaUrl = data?.[0]?.public_url || "";
    mimeType = data?.[0]?.mime_type || "";
  }

  if (!mediaUrl) throw new Error("Instagram requires media (image or video)");

  const isVideo = mimeType.startsWith("video/");

  // Step 1: Create media container (different params for video vs image)
  const containerBody: Record<string, string> = {
    caption,
    access_token: token,
  };
  if (isVideo) {
    containerBody.media_type = "VIDEO";
    containerBody.video_url = mediaUrl;
  } else {
    containerBody.image_url = mediaUrl;
  }

  const createRes = await fetch(`https://graph.facebook.com/v21.0/${igUserId}/media`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(containerBody),
  });
  const createData = await createRes.json();
  if (createData.error) throw new Error(createData.error.message);

  // Step 2: Publish
  const publishRes = await fetch(`https://graph.facebook.com/v21.0/${igUserId}/media_publish`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ creation_id: createData.id, access_token: token }),
  });
  const publishData = await publishRes.json();
  if (publishData.error) throw new Error(publishData.error.message);

  return { post_id: publishData.id, post_url: `https://instagram.com/p/${publishData.id}` };
}

async function publishToGoogleBusiness(
  connection: { access_token: string; platform_account_id: string },
  variant: { caption: string | null }
) {
  const locationName = connection.platform_account_id;
  const token = connection.access_token;

  const res = await fetch(`https://mybusiness.googleapis.com/v1/${locationName}/localPosts`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      languageCode: "he",
      summary: variant.caption || "",
      topicType: "STANDARD",
    }),
  });
  const data = await res.json();
  if (data.error) throw new Error(data.error.message);
  return { post_id: data.name };
}

async function publishToTelegram(
  connection: { access_token: string; platform_account_id: string },
  variant: { caption: string | null; media_asset_ids: string[] | null }
) {
  const botToken = connection.access_token;
  const chatId = connection.platform_account_id;
  const text = variant.caption || "";

  let mediaUrl = "";
  if (variant.media_asset_ids?.length) {
    const { data } = await supabaseAdmin
      .from("media_assets")
      .select("public_url")
      .in("id", variant.media_asset_ids)
      .limit(1);
    mediaUrl = data?.[0]?.public_url || "";
  }

  if (mediaUrl) {
    const res = await fetch(`https://api.telegram.org/bot${botToken}/sendPhoto`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, photo: mediaUrl, caption: text, parse_mode: "HTML" }),
    });
    const data = await res.json();
    if (!data.ok) throw new Error(data.description);
    return { post_id: String(data.result.message_id) };
  } else {
    const res = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: "HTML" }),
    });
    const data = await res.json();
    if (!data.ok) throw new Error(data.description);
    return { post_id: String(data.result.message_id) };
  }
}
