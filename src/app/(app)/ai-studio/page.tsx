"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Sparkles, RefreshCw, Copy, Check, Wand2, Hash, MessageSquareQuote, ArrowRightLeft, Loader2 } from "lucide-react";
import { PLATFORM_CAPABILITIES, PLATFORMS, type Platform } from "@/lib/platform-capabilities";
import { createClient } from "@/lib/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { listBrands } from "@/services/brands";
import { getCurrentWorkspaceId } from "@/hooks/useWorkspace";
import { toast } from "sonner";

const tools = [
  { id: "caption", title: "יצירת כיתוב", icon: Sparkles, description: "יצירת כיתובים אוטומטית מהקשר המוצר" },
  { id: "rewrite", title: "כתיבה מחדש לפלטפורמה", icon: ArrowRightLeft, description: "התאמת כיתוב לפלטפורמה ספציפית" },
  { id: "hashtag", title: "מחולל האשטגים", icon: Hash, description: "יצירת אשכולות האשטגים רלוונטיים" },
  { id: "hook", title: "מחולל פתיחים", icon: MessageSquareQuote, description: "יצירת פתיחים שתופסים תשומת לב" },
  { id: "cta", title: "מחולל קריאות לפעולה", icon: Wand2, description: "יצירת הצעות לקריאות לפעולה" },
];

export default function AIStudioPage() {
  const workspaceId = getCurrentWorkspaceId();
  const [activeTool, setActiveTool] = useState("caption");
  const [input, setInput] = useState("");
  const [output, setOutput] = useState("");
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [selectedBrand, setSelectedBrand] = useState<string | null>(null);
  const [targetPlatform, setTargetPlatform] = useState<Platform>("instagram");

  const { data: brands = [] } = useQuery({
    queryKey: ["brands", workspaceId],
    queryFn: () => listBrands(workspaceId!),
    enabled: !!workspaceId,
  });

  const handleGenerate = async () => {
    if (!input.trim() && activeTool !== "caption") {
      toast.error("Please enter some text first");
      return;
    }
    setLoading(true);
    setOutput("");

    try {
      const supabase = createClient();

      if (activeTool === "caption" || activeTool === "hook" || activeTool === "cta" || activeTool === "hashtag") {
        const { data, error } = await supabase.functions.invoke("generateCaption", {
          body: {
            brand_id: selectedBrand,
            platform: targetPlatform,
            goal: activeTool === "hook" ? "Hook — attention-grabbing opening" :
                  activeTool === "cta" ? "CTA — call to action variations" :
                  activeTool === "hashtag" ? "Hashtags — relevant hashtag clusters only" :
                  "engagement",
            language: "he",
          },
        });
        if (error) throw error;
        setOutput(data?.variants?.join("\n\n---\n\n") || data?.raw || "No output generated");
      } else if (activeTool === "rewrite") {
        const { data, error } = await supabase.functions.invoke("adaptContent", {
          body: {
            caption: input,
            platforms: [targetPlatform],
            language: "he",
          },
        });
        if (error) throw error;
        setOutput(data?.adaptations?.[targetPlatform] || "No adaptation generated");
      }

      toast.success("נוצר!");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Generation failed";
      toast.error(msg);
      setOutput(`Error: ${msg}. Make sure OPENAI_API_KEY or ANTHROPIC_API_KEY is configured in Edge Function secrets.`);
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(output);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">סטודיו AI</h1>

      <div className="flex flex-wrap gap-2">
        {tools.map((tool) => (
          <Badge
            key={tool.id}
            variant={activeTool === tool.id ? "default" : "outline"}
            className="cursor-pointer px-3 py-1.5 text-sm"
            onClick={() => { setActiveTool(tool.id); setOutput(""); }}
          >
            <tool.icon className="mr-1.5 h-3.5 w-3.5" />
            {tool.title}
          </Badge>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-lg">{tools.find((t) => t.id === activeTool)?.title}</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">{tools.find((t) => t.id === activeTool)?.description}</p>

            {/* Brand selector */}
            {brands.length > 0 && (
              <div className="space-y-2">
                <Label>הקשר מותג</Label>
                <div className="flex flex-wrap gap-1">
                  <Badge variant={!selectedBrand ? "default" : "outline"} className="cursor-pointer text-xs" onClick={() => setSelectedBrand(null)}>ללא</Badge>
                  {brands.map((b) => (
                    <Badge key={b.id} variant={selectedBrand === b.id ? "default" : "outline"} className="cursor-pointer text-xs" onClick={() => setSelectedBrand(b.id)}>{b.name}</Badge>
                  ))}
                </div>
              </div>
            )}

            {/* Platform selector */}
            <div className="space-y-2">
              <Label>פלטפורמת יעד</Label>
              <div className="flex flex-wrap gap-1">
                {PLATFORMS.map((p) => (
                  <Badge key={p} variant={targetPlatform === p ? "default" : "outline"} className="cursor-pointer text-xs" onClick={() => setTargetPlatform(p)}>
                    {PLATFORM_CAPABILITIES[p].label}
                  </Badge>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label>קלט / הקשר</Label>
              <Textarea value={input} onChange={(e) => setInput(e.target.value)} placeholder="תארו את המוצר, המותג, או הדביקו תוכן קיים..." rows={5} />
            </div>

            <Button onClick={handleGenerate} disabled={loading} className="w-full">
              {loading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />מייצר...</> : <><Sparkles className="mr-2 h-4 w-4" />ייצור</>}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-lg">פלט</CardTitle>
            {output && (
              <Button variant="ghost" size="sm" onClick={handleCopy}>
                {copied ? <Check className="mr-1 h-3.5 w-3.5" /> : <Copy className="mr-1 h-3.5 w-3.5" />}
                {copied ? "הועתק" : "העתק"}
              </Button>
            )}
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex h-40 items-center justify-center">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : output ? (
              <div className="whitespace-pre-wrap rounded-lg bg-muted p-4 text-sm max-h-[500px] overflow-y-auto">{output}</div>
            ) : (
              <div className="flex h-40 items-center justify-center text-sm text-muted-foreground">
                תוכן שנוצר יופיע כאן
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
