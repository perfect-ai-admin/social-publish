"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Plus, Package, Pencil, Trash2, X, Loader2 } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { listBrands, createBrand, deleteBrand } from "@/services/brands";
import { useEnsureWorkspace } from "@/hooks/useWorkspace";
import { toast } from "sonner";
import Link from "next/link";

export default function BrandsPage() {
  const workspaceId = useEnsureWorkspace();
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [tone, setTone] = useState("");
  const [audience, setAudience] = useState("");

  const { data: brands = [], isLoading } = useQuery({
    queryKey: ["brands", workspaceId],
    queryFn: () => listBrands(workspaceId!),
    enabled: !!workspaceId,
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      if (!workspaceId) throw new Error("לא נבחרה סביבת עבודה — רעננו את הדף");
      if (!name.trim()) throw new Error("שם המותג הוא שדה חובה");
      const asciiSlug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
      const slug = asciiSlug || `brand-${Date.now()}`;
      return createBrand({
        workspace_id: workspaceId,
        name: name.trim(),
        slug,
        tone_of_voice: tone.trim() || undefined,
        target_audience: audience.trim() || undefined,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["brands"] });
      setShowForm(false);
      setName("");
      setTone("");
      setAudience("");
      toast.success("המותג נוצר בהצלחה!");
    },
    onError: (err: Error) => {
      toast.error(err.message || "יצירת המותג נכשלה");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteBrand,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["brands"] });
      toast.success("המותג נמחק");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  if (!workspaceId && !isLoading) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold tracking-tight">מותגים</h1>
        <Card>
          <CardContent className="py-12 text-center">
            <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-muted-foreground" />
            <p className="text-muted-foreground">טוען סביבת עבודה...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">מותגים</h1>
        {!showForm && (
          <Button className="gap-2" onClick={() => setShowForm(true)}>
            <Plus className="h-4 w-4" />
            מותג חדש
          </Button>
        )}
      </div>

      {/* Inline create form */}
      {showForm && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle>יצירת מותג חדש</CardTitle>
            <Button variant="ghost" size="icon" onClick={() => setShowForm(false)}>
              <X className="h-4 w-4" />
            </Button>
          </CardHeader>
          <CardContent>
            <form
              onSubmit={(e) => { e.preventDefault(); createMutation.mutate(); }}
              className="space-y-4"
            >
              <div className="space-y-2">
                <Label>שם המותג *</Label>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="לדוגמה: פרפקט וואן"
                  required
                  autoFocus
                />
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>טון דיבור</Label>
                  <Textarea
                    value={tone}
                    onChange={(e) => setTone(e.target.value)}
                    placeholder="מקצועי, ידידותי, סמכותי..."
                    rows={2}
                  />
                </div>
                <div className="space-y-2">
                  <Label>קהל יעד</Label>
                  <Input
                    value={audience}
                    onChange={(e) => setAudience(e.target.value)}
                    placeholder="בעלי עסקים קטנים, פרילנסרים..."
                  />
                </div>
              </div>
              <div className="flex gap-2">
                <Button type="submit" className="gap-2" disabled={createMutation.isPending || !name.trim()}>
                  {createMutation.isPending ? (
                    <><Loader2 className="h-4 w-4 animate-spin" />יוצר...</>
                  ) : (
                    "יצירת מותג"
                  )}
                </Button>
                <Button type="button" variant="outline" onClick={() => setShowForm(false)}>
                  ביטול
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Brand list */}
      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Card key={i}><CardContent className="p-6"><div className="h-20 animate-pulse rounded bg-muted" /></CardContent></Card>
          ))}
        </div>
      ) : brands.length === 0 && !showForm ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-muted mb-4">
              <Package className="h-7 w-7 text-gray-400" strokeWidth={1.5} />
            </div>
            <p className="text-lg font-bold text-gray-900">אין מותגים עדיין</p>
            <p className="text-sm text-gray-500 mb-4">צרו את המותג הראשון כדי להתחיל לפרסם</p>
            <Button className="gap-2" onClick={() => setShowForm(true)}>
              <Plus className="h-4 w-4" />
              יצירת מותג
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {brands.map((brand) => (
            <Card key={brand.id} className="shadow-[0_1px_2px_0_rgb(0_0_0_/0.04),0_1px_3px_0_rgb(0_0_0_/0.08)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_8px_16px_-4px_rgb(0_0_0_/0.08),0_4px_8px_-2px_rgb(0_0_0_/0.04)] hover:border-primary/50">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-lg">{brand.name}</CardTitle>
                <div className="flex gap-1">
                  <Link href={`/brands/${brand.id}`}>
                    <Button variant="ghost" size="icon"><Pencil className="h-3.5 w-3.5" /></Button>
                  </Link>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => {
                      if (confirm("למחוק את המותג?")) deleteMutation.mutate(brand.id);
                    }}
                  >
                    <Trash2 className="h-3.5 w-3.5 text-destructive" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {brand.tone_of_voice && (
                  <p className="text-xs text-muted-foreground mb-2">טון: {brand.tone_of_voice}</p>
                )}
                {brand.target_audience && (
                  <p className="text-xs text-muted-foreground mb-2">קהל: {brand.target_audience}</p>
                )}
                <Badge variant="secondary" className="text-xs">
                  {brand.primary_language === "he" ? "עברית" : brand.primary_language}
                </Badge>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
