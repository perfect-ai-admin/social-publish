import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { jsonResponse, errorResponse, getCorsHeaders } from "../_shared/supabaseAdmin.ts";

const PLATFORM_LIMITS: Record<string, { captionLimit: number; hashtagsOptimal: number; tips: string }> = {
  facebook: { captionLimit: 63206, hashtagsOptimal: 3, tips: "Use conversational tone, include questions" },
  instagram: { captionLimit: 2200, hashtagsOptimal: 5, tips: "Front-load the hook, use line breaks, hashtags at end" },
  tiktok: { captionLimit: 2200, hashtagsOptimal: 5, tips: "Keep it casual, use trending sounds references" },
  youtube: { captionLimit: 5000, hashtagsOptimal: 5, tips: "Use timestamps, include keywords naturally" },
  linkedin: { captionLimit: 3000, hashtagsOptimal: 3, tips: "Professional tone, add insights, use paragraph breaks" },
  pinterest: { captionLimit: 500, hashtagsOptimal: 5, tips: "Descriptive, include keywords, actionable" },
  google_business: { captionLimit: 1500, hashtagsOptimal: 0, tips: "Local focus, include CTA, mention location" },
  telegram: { captionLimit: 4096, hashtagsOptimal: 3, tips: "Supports HTML formatting, be direct" },
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: getCorsHeaders() });

  try {
    const authHeader = req.headers.get("authorization");
    if (!authHeader) return errorResponse("Unauthorized", 401);

    const { caption, platforms, language = "he" } = await req.json();

    if (!caption || !platforms?.length) {
      return errorResponse("caption and platforms[] required");
    }

    const apiKey = Deno.env.get("OPENAI_API_KEY") || Deno.env.get("ANTHROPIC_API_KEY");
    if (!apiKey) throw new Error("No AI API key configured");

    const adaptations: Record<string, string> = {};

    for (const platform of platforms) {
      const limits = PLATFORM_LIMITS[platform];
      if (!limits) {
        adaptations[platform] = caption;
        continue;
      }

      const prompt = `Adapt this social media caption for ${platform}.

Original caption:
${caption}

Rules for ${platform}:
- Max ${limits.captionLimit} characters
- Use ${limits.hashtagsOptimal} hashtags
- Tips: ${limits.tips}
- Language: ${language === "he" ? "Hebrew" : "English"}

Return ONLY the adapted caption, nothing else.`;

      const res = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          messages: [{ role: "user", content: prompt }],
          max_tokens: 1000,
        }),
      });

      const data = await res.json();
      adaptations[platform] = data.choices?.[0]?.message?.content || caption;
    }

    return jsonResponse({ adaptations });
  } catch (err) {
    return errorResponse(err instanceof Error ? err.message : "Unknown error", 500);
  }
});
