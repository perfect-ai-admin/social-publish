"use client";

import { useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { PLATFORM_CAPABILITIES, type Platform, PLATFORMS } from "@/lib/platform-capabilities";
import { Sparkles, Send, Clock, Upload, X, Image as ImageIcon, Loader2, ArrowLeft, ArrowRight, Check } from "lucide-react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { listConnections, type PlatformConnection } from "@/services/channels";
import { listBrands, listProducts, type Brand, type Product } from "@/services/brands";
import { createPost, createPostVariants, enqueueVariants } from "@/services/posts";
import { uploadMedia, type MediaAsset } from "@/services/media";
import { getCurrentWorkspaceId } from "@/hooks/useWorkspace";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

type Step = 1 | 2 | 3 | 4 | 5 | 6 | 7;
const STEP_LABELS = ["מותג", "מוצר", "פלטפורמות", "מדיה", "כיתוב", "תצוגה מקדימה", "פרסום"];

export default function ComposerPage() {
  const workspaceId = getCurrentWorkspaceId();
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState<Step>(1);
  const [selectedBrand, setSelectedBrand] = useState<string | null>(null);
  const [selectedProduct, setSelectedProduct] = useState<string | null>(null);
  const [selectedConnections, setSelectedConnections] = useState<PlatformConnection[]>([]);
  const [uploadedMedia, setUploadedMedia] = useState<MediaAsset[]>([]);
  const [uploading, setUploading] = useState(false);
  const [caption, setCaption] = useState("");
  const [hashtags, setHashtags] = useState("");
  const [scheduleDate, setScheduleDate] = useState("");
  const [scheduleTime, setScheduleTime] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [title, setTitle] = useState("");

  // Data queries
  const { data: brands = [] } = useQuery({
    queryKey: ["brands", workspaceId],
    queryFn: () => listBrands(workspaceId!),
    enabled: !!workspaceId,
  });

  const { data: products = [] } = useQuery({
    queryKey: ["products", selectedBrand],
    queryFn: () => listProducts(selectedBrand!),
    enabled: !!selectedBrand,
  });

  const { data: connections = [] } = useQuery({
    queryKey: ["connections", workspaceId],
    queryFn: () => listConnections(workspaceId!),
    enabled: !!workspaceId,
  });

  const activeConnections = connections.filter((c) => c.status === "active");

  // Publish mutation
  const publishMutation = useMutation({
    mutationFn: async (mode: "now" | "schedule") => {
      if (!workspaceId) throw new Error("אין סביבת עבודה");
      if (selectedConnections.length === 0) throw new Error("לא נבחרו פלטפורמות");
      if (!caption.trim()) throw new Error("כיתוב הוא שדה חובה");

      const scheduledAt = mode === "schedule" && scheduleDate && scheduleTime
        ? new Date(`${scheduleDate}T${scheduleTime}`).toISOString()
        : undefined;

      if (mode === "schedule" && scheduledAt && new Date(scheduledAt) <= new Date()) {
        throw new Error("זמן התזמון חייב להיות בעתיד");
      }

      // 1. Create post
      const post = await createPost({
        workspace_id: workspaceId,
        brand_id: selectedBrand || undefined,
        product_id: selectedProduct || undefined,
        title: title || undefined,
        base_caption: caption,
        media_asset_ids: uploadedMedia.map((m) => m.id),
        scheduled_at: scheduledAt,
      });

      // 2. Create variants per connection
      const variants = await createPostVariants(
        post.id,
        selectedConnections.map((conn) => ({
          connection_id: conn.id,
          platform: conn.platform,
          caption: caption + (hashtags ? `\n\n${hashtags}` : ""),
          media_asset_ids: uploadedMedia.map((m) => m.id),
          scheduled_at: scheduledAt,
        }))
      );

      // 3. Enqueue for publishing (if immediate)
      if (mode === "now") {
        await enqueueVariants(variants.map((v) => v.id));
      }

      return { post, variants, mode };
    },
    onSuccess: ({ mode }) => {
      toast.success(mode === "now" ? "הפוסט בתור לפרסום!" : "הפוסט תוזמן!");
      router.push(mode === "now" ? "/dashboard" : "/calendar");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  // File upload handler
  const handleFileUpload = async (files: FileList | null) => {
    if (!files || !workspaceId) return;
    setUploading(true);
    try {
      for (const file of Array.from(files)) {
        const asset = await uploadMedia(workspaceId, file, { brandId: selectedBrand || undefined });
        setUploadedMedia((prev) => [...prev, asset]);
      }
      toast.success(`${files.length} קבצים הועלו`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "העלאה נכשלה");
    } finally {
      setUploading(false);
    }
  };

  // AI caption generation
  const handleAIGenerate = async () => {
    setAiLoading(true);
    try {
      const supabase = createClient();
      const { data, error } = await supabase.functions.invoke("generateCaption", {
        body: {
          brand_id: selectedBrand,
          product_id: selectedProduct,
          platform: selectedConnections[0]?.platform || "general",
          goal: "engagement",
          language: "he",
        },
      });
      if (error) throw error;
      if (data?.variants?.[0]) {
        setCaption(data.variants[0]);
        toast.success("כיתוב נוצר!");
      }
    } catch (err) {
      toast.error("יצירת AI נכשלה");
    } finally {
      setAiLoading(false);
    }
  };

  const toggleConnection = (conn: PlatformConnection) => {
    setSelectedConnections((prev) =>
      prev.find((c) => c.id === conn.id)
        ? prev.filter((c) => c.id !== conn.id)
        : [...prev, conn]
    );
  };

  const canProceed = () => {
    switch (step) {
      case 1: return true; // brand is optional
      case 2: return true; // product is optional
      case 3: return selectedConnections.length > 0;
      case 4: return !mediaRequired; // block if platform requires media and none uploaded
      case 5: return caption.trim().length > 0;
      case 6: return true;
      case 7: return true;
      default: return false;
    }
  };

  // Validate caption against platform limits
  const captionWarnings = selectedConnections
    .map((c) => {
      const cap = PLATFORM_CAPABILITIES[c.platform];
      const fullLen = caption.length + (hashtags ? hashtags.length + 2 : 0);
      if (fullLen > cap.captionLimit) {
        return `${cap.label}: ${fullLen}/${cap.captionLimit} chars (too long)`;
      }
      return null;
    })
    .filter(Boolean);

  // Check if media is required
  const mediaRequired = selectedConnections.some((c) => {
    const cap = PLATFORM_CAPABILITIES[c.platform];
    return !cap.supportsText && uploadedMedia.length === 0;
  });

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <h1 className="text-2xl font-bold">יצירת פוסט</h1>

      {/* Step indicators */}
      <div className="flex gap-1">
        {STEP_LABELS.map((label, i) => (
          <button
            key={label}
            onClick={() => setStep((i + 1) as Step)}
            className={`flex items-center gap-1 rounded-full px-3 py-1 text-xs font-medium transition-colors ${
              step === i + 1
                ? "bg-primary text-primary-foreground"
                : i + 1 < step
                  ? "bg-primary/20 text-primary"
                  : "bg-muted text-muted-foreground"
            }`}
          >
            {i + 1 < step ? <Check className="h-3 w-3" /> : <span>{i + 1}</span>}
            <span className="hidden sm:inline">{label}</span>
          </button>
        ))}
      </div>

      {/* Step 1: Brand */}
      {step === 1 && (
        <Card>
          <CardHeader><CardTitle>בחרו מותג (אופציונלי)</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <button
              onClick={() => { setSelectedBrand(null); setStep(2); }}
              className={`w-full rounded-lg border p-3 text-left hover:bg-muted ${!selectedBrand ? "border-primary bg-primary/5" : ""}`}
            >
              <p className="font-medium">ללא מותג ספציפי</p>
              <p className="text-xs text-muted-foreground">פוסט ללא הקשר מותג</p>
            </button>
            {brands.map((brand) => (
              <button
                key={brand.id}
                onClick={() => { setSelectedBrand(brand.id); setStep(2); }}
                className={`w-full rounded-lg border p-3 text-left hover:bg-muted ${selectedBrand === brand.id ? "border-primary bg-primary/5" : ""}`}
              >
                <p className="font-medium">{brand.name}</p>
                {brand.tone_of_voice && <p className="text-xs text-muted-foreground">טון: {brand.tone_of_voice}</p>}
              </button>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Step 2: Product */}
      {step === 2 && (
        <Card>
          <CardHeader><CardTitle>בחרו מוצר (אופציונלי)</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <button
              onClick={() => { setSelectedProduct(null); setStep(3); }}
              className={`w-full rounded-lg border p-3 text-left hover:bg-muted ${!selectedProduct ? "border-primary bg-primary/5" : ""}`}
            >
              <p className="font-medium">ללא מוצר ספציפי</p>
            </button>
            {products.map((product) => (
              <button
                key={product.id}
                onClick={() => { setSelectedProduct(product.id); setStep(3); }}
                className={`w-full rounded-lg border p-3 text-left hover:bg-muted ${selectedProduct === product.id ? "border-primary bg-primary/5" : ""}`}
              >
                <p className="font-medium">{product.name}</p>
                {product.description && <p className="text-xs text-muted-foreground truncate">{product.description}</p>}
              </button>
            ))}
            {selectedBrand && products.length === 0 && (
              <p className="text-sm text-muted-foreground">אין מוצרים למותג זה. ניתן לדלג על שלב זה.</p>
            )}
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setStep(1)}><ArrowLeft className="mr-1 h-3 w-3" />חזרה</Button>
              <Button onClick={() => setStep(3)}>דלג <ArrowRight className="ml-1 h-3 w-3" /></Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 3: Platforms */}
      {step === 3 && (
        <Card>
          <CardHeader><CardTitle>בחרו פלטפורמות</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {activeConnections.length === 0 ? (
              <div className="text-center py-6">
                <p className="text-muted-foreground mb-2">אין ערוצים מחוברים</p>
                <Button variant="link" onClick={() => router.push("/channels")}>חברו ערוץ קודם</Button>
              </div>
            ) : (
              <>
                {activeConnections.map((conn) => {
                  const cap = PLATFORM_CAPABILITIES[conn.platform];
                  const isSelected = selectedConnections.some((c) => c.id === conn.id);
                  return (
                    <label key={conn.id} className={`flex cursor-pointer items-center gap-3 rounded-lg border p-3 hover:bg-muted ${isSelected ? "border-primary bg-primary/5" : ""}`}>
                      <Checkbox checked={isSelected} onCheckedChange={() => toggleConnection(conn)} />
                      <div className="flex h-8 w-8 items-center justify-center rounded-md text-white text-xs font-bold" style={{ backgroundColor: cap.color }}>
                        {cap.label[0]}
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-medium">{conn.platform_account_name || cap.label}</p>
                        <p className="text-xs text-muted-foreground">{cap.label} · {cap.captionLimit.toLocaleString()} chars</p>
                      </div>
                    </label>
                  );
                })}
              </>
            )}
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setStep(2)}><ArrowLeft className="mr-1 h-3 w-3" />חזרה</Button>
              <Button disabled={selectedConnections.length === 0} onClick={() => setStep(4)}>
                הבא <ArrowRight className="ml-1 h-3 w-3" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 4: Media */}
      {step === 4 && (
        <Card>
          <CardHeader><CardTitle>העלאת מדיה</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,video/*"
              multiple
              className="hidden"
              onChange={(e) => handleFileUpload(e.target.files)}
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="flex h-32 w-full items-center justify-center rounded-lg border-2 border-dashed text-muted-foreground hover:border-primary hover:text-primary transition-colors"
            >
              {uploading ? (
                <div className="flex items-center gap-2"><Loader2 className="h-5 w-5 animate-spin" />מעלה...</div>
              ) : (
                <div className="text-center">
                  <Upload className="mx-auto h-6 w-6 mb-1" />
                  <p className="text-sm">לחצו להעלאה (עד 100MB)</p>
                  <p className="text-xs">תמונות וסרטונים</p>
                </div>
              )}
            </button>

            {uploadedMedia.length > 0 && (
              <div className="grid grid-cols-3 gap-2">
                {uploadedMedia.map((asset) => (
                  <div key={asset.id} className="relative rounded-lg border overflow-hidden">
                    {asset.mime_type.startsWith("image/") ? (
                      <img src={asset.public_url} alt={asset.filename} className="h-24 w-full object-cover" />
                    ) : (
                      <div className="flex h-24 items-center justify-center bg-muted">
                        <ImageIcon className="h-8 w-8 text-muted-foreground" />
                      </div>
                    )}
                    <button
                      onClick={() => setUploadedMedia((prev) => prev.filter((m) => m.id !== asset.id))}
                      className="absolute top-1 right-1 rounded-full bg-black/50 p-0.5 text-white hover:bg-black/70"
                    >
                      <X className="h-3 w-3" />
                    </button>
                    <p className="truncate px-1 py-0.5 text-[10px]">{asset.filename}</p>
                  </div>
                ))}
              </div>
            )}

            {mediaRequired && (
              <p className="text-sm text-amber-600">חלק מהפלטפורמות הנבחרות דורשות מדיה</p>
            )}

            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setStep(3)}><ArrowLeft className="mr-1 h-3 w-3" />חזרה</Button>
              <Button disabled={mediaRequired} onClick={() => setStep(5)}>הבא <ArrowRight className="ml-1 h-3 w-3" /></Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 5: Caption */}
      {step === 5 && (
        <Card>
          <CardHeader><CardTitle>כתבו כיתוב</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>כותרת (פנימית)</Label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="כותרת פנימית לפוסט..." />
            </div>
            <div className="space-y-2">
              <Label>כיתוב</Label>
              <Textarea value={caption} onChange={(e) => setCaption(e.target.value)} placeholder="כתבו את הכיתוב לפוסט..." rows={6} />
              <div className="flex items-center justify-between">
                <p className="text-xs text-muted-foreground">{caption.length} תווים</p>
                <Button variant="outline" size="sm" onClick={handleAIGenerate} disabled={aiLoading}>
                  {aiLoading ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <Sparkles className="mr-1 h-3 w-3" />}
                  יצירת AI
                </Button>
              </div>
              {captionWarnings.map((w, i) => (
                <p key={i} className="text-xs text-amber-600">{w}</p>
              ))}
            </div>
            <div className="space-y-2">
              <Label>האשטגים</Label>
              <Input value={hashtags} onChange={(e) => setHashtags(e.target.value)} placeholder="#business #marketing #growth" />
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setStep(4)}><ArrowLeft className="mr-1 h-3 w-3" />חזרה</Button>
              <Button disabled={!caption.trim()} onClick={() => setStep(6)}>תצוגה מקדימה <ArrowRight className="ml-1 h-3 w-3" /></Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 6: Preview */}
      {step === 6 && (
        <Card>
          <CardHeader><CardTitle>תצוגה מקדימה</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              {selectedConnections.map((conn) => {
                const cap = PLATFORM_CAPABILITIES[conn.platform];
                const fullCaption = caption + (hashtags ? `\n\n${hashtags}` : "");
                const isTooLong = fullCaption.length > cap.captionLimit;
                return (
                  <Card key={conn.id} className={isTooLong ? "border-amber-300" : ""}>
                    <CardHeader className="pb-2">
                      <div className="flex items-center gap-2">
                        <div className="flex h-6 w-6 items-center justify-center rounded text-white text-[10px] font-bold" style={{ backgroundColor: cap.color }}>
                          {cap.label[0]}
                        </div>
                        <CardTitle className="text-sm">{conn.platform_account_name || cap.label}</CardTitle>
                      </div>
                    </CardHeader>
                    <CardContent>
                      {uploadedMedia[0]?.mime_type.startsWith("image/") && (
                        <img src={uploadedMedia[0].public_url} alt="" className="rounded mb-2 max-h-32 w-full object-cover" />
                      )}
                      <p className="text-sm whitespace-pre-wrap">{fullCaption.slice(0, cap.captionLimit)}</p>
                      {isTooLong && <p className="text-[10px] text-amber-600 mt-1">הכיתוב ייחתך ({fullCaption.length}/{cap.captionLimit})</p>}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setStep(5)}><ArrowLeft className="mr-1 h-3 w-3" />חזרה</Button>
              <Button onClick={() => setStep(7)}>תזמון ופרסום <ArrowRight className="ml-1 h-3 w-3" /></Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 7: Publish */}
      {step === 7 && (
        <Card>
          <CardHeader><CardTitle>תזמון ופרסום</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-lg border p-4 space-y-3">
              <p className="text-sm font-medium">סיכום</p>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <span className="text-muted-foreground">פלטפורמות:</span>
                <span>{selectedConnections.map((c) => PLATFORM_CAPABILITIES[c.platform].label).join(", ")}</span>
                <span className="text-muted-foreground">מדיה:</span>
                <span>{uploadedMedia.length} קבצים</span>
                <span className="text-muted-foreground">Caption:</span>
                <span>{caption.length} chars</span>
              </div>
            </div>

            <div className="space-y-2">
              <Label>תזמון לזמן מאוחר יותר (אופציונלי)</Label>
              <div className="flex gap-2">
                <Input type="date" value={scheduleDate} onChange={(e) => setScheduleDate(e.target.value)} />
                <Input type="time" value={scheduleTime} onChange={(e) => setScheduleTime(e.target.value)} />
              </div>
            </div>

            <div className="flex gap-3">
              <Button
                className="flex-1"
                disabled={publishMutation.isPending}
                onClick={() => publishMutation.mutate("now")}
              >
                {publishMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
                פרסם עכשיו
              </Button>
              <Button
                variant="outline"
                className="flex-1"
                disabled={publishMutation.isPending || !scheduleDate || !scheduleTime}
                onClick={() => publishMutation.mutate("schedule")}
              >
                <Clock className="mr-2 h-4 w-4" />
                תזמן
              </Button>
            </div>

            <Button variant="ghost" onClick={() => setStep(6)}><ArrowLeft className="mr-1 h-3 w-3" />חזרה לתצוגה מקדימה</Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
