import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { supabaseAdmin, jsonResponse, errorResponse, getCorsHeaders } from "../_shared/supabaseAdmin.ts";

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: getCorsHeaders() });

  try {
    // Auth check
    const authHeader = req.headers.get("authorization");
    if (!authHeader) return errorResponse("Unauthorized", 401);

    const { brand_id, product_id, platform, tone, goal, language = "he" } = await req.json();

    // Fetch brand context
    let brandContext = "";
    if (brand_id) {
      const { data: brand } = await supabaseAdmin.from("brands").select("*").eq("id", brand_id).single();
      if (brand) {
        brandContext = `Brand: ${brand.name}\nTone: ${brand.tone_of_voice || "professional"}\nAudience: ${brand.target_audience || "general"}`;
      }
    }

    // Fetch product context
    let productContext = "";
    if (product_id) {
      const { data: product } = await supabaseAdmin.from("products").select("*").eq("id", product_id).single();
      if (product) {
        productContext = `Product: ${product.name}\nDescription: ${product.description || ""}\nCTA: ${product.default_cta || ""}`;
      }
    }

    const anthropicKey = Deno.env.get("ANTHROPIC_API_KEY");
    const openaiKey = Deno.env.get("OPENAI_API_KEY");
    const isAnthropic = !!anthropicKey;
    const apiKey = anthropicKey || openaiKey;
    if (!apiKey) throw new Error("No AI API key configured");

    const systemPrompt = `You are a social media content expert. Generate engaging captions for social media posts.
${brandContext}
${productContext}
Platform: ${platform || "general"}
Goal: ${goal || "engagement"}
Language: ${language === "he" ? "Hebrew" : "English"}

Generate 3 caption variants. Each should include:
- Attention-grabbing hook
- Value proposition
- Call to action
- Relevant hashtags (5-8)

Format: Return each variant separated by ---`;

    let captions: string;

    if (isAnthropic) {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 2000,
          system: systemPrompt,
          messages: [{ role: "user", content: "Generate 3 caption variants as instructed." }],
        }),
      });
      const data = await res.json();
      captions = data.content?.[0]?.text || "Error generating captions";
    } else {
      const res = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          messages: [
            { role: "system", content: "You are a social media content expert." },
            { role: "user", content: systemPrompt },
          ],
          max_tokens: 2000,
        }),
      });
      const data = await res.json();
      captions = data.choices?.[0]?.message?.content || "Error generating captions";
    }

    const variants = captions.split("---").map((v: string) => v.trim()).filter(Boolean);

    return jsonResponse({ variants, raw: captions });
  } catch (err) {
    return errorResponse(err instanceof Error ? err.message : "Unknown error", 500);
  }
});
