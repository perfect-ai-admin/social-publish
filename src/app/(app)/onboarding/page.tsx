"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Check, ArrowRight, ArrowLeft, Package, Link2, PenSquare, Sparkles } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createBrand } from "@/services/brands";
import { getCurrentWorkspaceId } from "@/hooks/useWorkspace";
import { PLATFORM_CAPABILITIES, type Platform } from "@/lib/platform-capabilities";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

type OnboardingStep = 1 | 2 | 3 | 4;

const steps = [
  { label: "יצירת מותג", icon: Package },
  { label: "חיבור ערוץ", icon: Link2 },
  { label: "פוסט ראשון", icon: PenSquare },
  { label: "סיום", icon: Sparkles },
];

export default function OnboardingPage() {
  const workspaceId = getCurrentWorkspaceId();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [step, setStep] = useState<OnboardingStep>(1);
  const [brandName, setBrandName] = useState("");
  const [brandTone, setBrandTone] = useState("");

  const brandMutation = useMutation({
    mutationFn: () =>
      createBrand({
        workspace_id: workspaceId!,
        name: brandName,
        slug: brandName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""),
        tone_of_voice: brandTone || undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["brands"] });
      toast.success("המותג נוצר!");
      setStep(2);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  return (
    <div className="mx-auto max-w-2xl space-y-6 py-8">
      <div className="text-center">
        <h1 className="text-3xl font-bold tracking-tight mb-2">ברוכים הבאים ל-SocialPublish</h1>
        <p className="text-muted-foreground">בואו נגדיר הכל ב-3 צעדים</p>
      </div>

      {/* Step indicators */}
      <div className="flex justify-center gap-2">
        {steps.map((s, i) => (
          <div
            key={s.label}
            className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium ${
              step > i + 1 ? "bg-green-100 text-green-700" :
              step === i + 1 ? "bg-primary text-primary-foreground" :
              "bg-muted text-muted-foreground"
            }`}
          >
            {step > i + 1 ? <Check className="h-3 w-3" /> : <s.icon className="h-3 w-3" />}
            {s.label}
          </div>
        ))}
      </div>

      {/* Step 1: Create Brand */}
      {step === 1 && (
        <Card>
          <CardHeader>
            <CardTitle>צרו את המותג הראשון</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={(e) => { e.preventDefault(); brandMutation.mutate(); }} className="space-y-4">
              <div className="space-y-2">
                <Label>שם המותג</Label>
                <Input
                  value={brandName}
                  onChange={(e) => setBrandName(e.target.value)}
                  placeholder="החברה שלי"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>טון דיבור (אופציונלי)</Label>
                <Input
                  value={brandTone}
                  onChange={(e) => setBrandTone(e.target.value)}
                  placeholder="מקצועי, ידידותי, סמכותי..."
                />
              </div>
              <Button type="submit" className="w-full gap-2" disabled={brandMutation.isPending || !brandName.trim()}>
                יצירת מותג <ArrowLeft className="h-4 w-4" />
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Step 2: Connect Channel */}
      {step === 2 && (
        <Card>
          <CardHeader>
            <CardTitle>חברו את הערוץ החברתי הראשון</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 md:grid-cols-2">
              {(["facebook", "instagram", "youtube", "telegram"] as Platform[]).map((p) => {
                const cap = PLATFORM_CAPABILITIES[p];
                return (
                  <Button
                    key={p}
                    variant="outline"
                    className="h-auto p-4 justify-start"
                    onClick={() => {
                      if (p === "facebook" || p === "instagram") {
                        window.location.href = `/api/oauth/meta?workspace_id=${workspaceId}`;
                      } else if (p === "youtube") {
                        window.location.href = `/api/oauth/google?workspace_id=${workspaceId}&platform=youtube`;
                      } else {
                        router.push("/channels");
                      }
                    }}
                  >
                    <div className="flex h-8 w-8 items-center justify-center rounded-md text-white text-xs font-bold me-3" style={{ backgroundColor: cap.color }}>
                      {cap.label[0]}
                    </div>
                    <span>{cap.label}</span>
                  </Button>
                );
              })}
            </div>
            <Button variant="link" className="gap-1.5" onClick={() => setStep(3)}>
              דלגו בינתיים <ArrowLeft className="h-3 w-3" />
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Step 3: Go create first post */}
      {step === 3 && (
        <Card>
          <CardHeader>
            <CardTitle>צרו את הפוסט הראשון</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-center">
            <p className="text-muted-foreground">
              הכל מוכן! עברו לקומפוזר כדי ליצור ולפרסם את הפוסט הראשון שלכם.
            </p>
            <div className="flex gap-3 justify-center">
              <Button className="gap-2" onClick={() => router.push("/composer")}>
                <PenSquare className="h-4 w-4" />
                יצירת פוסט ראשון
              </Button>
              <Button variant="outline" onClick={() => setStep(4)}>
                לוח בקרה
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 4: Done */}
      {step === 4 && (
        <Card>
          <CardContent className="flex flex-col items-center py-12 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-green-100 text-green-600 mb-4">
              <Check className="h-8 w-8" />
            </div>
            <h2 className="text-xl font-bold mb-2">אתם מוכנים!</h2>
            <p className="text-muted-foreground mb-6">
              סביבת העבודה שלכם מוכנה. התחילו לפרסם בכל הרשתות.
            </p>
            <Button size="lg" className="gap-2" onClick={() => router.push("/dashboard")}>
              ללוח הבקרה <ArrowLeft className="h-4 w-4" />
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
