"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Package, Pencil, Trash2 } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { listBrands, createBrand, deleteBrand } from "@/services/brands";
import { getCurrentWorkspaceId } from "@/hooks/useWorkspace";
import Link from "next/link";

export default function BrandsPage() {
  const workspaceId = getCurrentWorkspaceId();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [name, setName] = useState("");
  const [tone, setTone] = useState("");
  const [audience, setAudience] = useState("");

  const { data: brands = [] } = useQuery({
    queryKey: ["brands", workspaceId],
    queryFn: () => listBrands(workspaceId!),
    enabled: !!workspaceId,
  });

  const createMutation = useMutation({
    mutationFn: () =>
      createBrand({
        workspace_id: workspaceId!,
        name,
        slug: name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""),
        tone_of_voice: tone || undefined,
        target_audience: audience || undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["brands"] });
      setDialogOpen(false);
      setName("");
      setTone("");
      setAudience("");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteBrand,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["brands"] }),
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Brands</h1>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              New Brand
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create Brand</DialogTitle>
            </DialogHeader>
            <form
              onSubmit={(e) => { e.preventDefault(); createMutation.mutate(); }}
              className="space-y-4"
            >
              <div className="space-y-2">
                <Label>Brand Name</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} required />
              </div>
              <div className="space-y-2">
                <Label>Tone of Voice</Label>
                <Textarea
                  value={tone}
                  onChange={(e) => setTone(e.target.value)}
                  placeholder="Professional, friendly, authoritative..."
                  rows={2}
                />
              </div>
              <div className="space-y-2">
                <Label>Target Audience</Label>
                <Input
                  value={audience}
                  onChange={(e) => setAudience(e.target.value)}
                  placeholder="Small business owners, freelancers..."
                />
              </div>
              <Button type="submit" disabled={createMutation.isPending} className="w-full">
                {createMutation.isPending ? "Creating..." : "Create Brand"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {brands.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Package className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-lg font-medium">No brands yet</p>
            <p className="text-sm text-muted-foreground mb-4">Create your first brand to start publishing</p>
            <Button onClick={() => setDialogOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Create Brand
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {brands.map((brand) => (
            <Card key={brand.id} className="hover:border-primary/50 transition-colors">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-lg">{brand.name}</CardTitle>
                <div className="flex gap-1">
                  <Link href={`/brands/${brand.id}`}>
                    <Button variant="ghost" size="icon"><Pencil className="h-3.5 w-3.5" /></Button>
                  </Link>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => deleteMutation.mutate(brand.id)}
                  >
                    <Trash2 className="h-3.5 w-3.5 text-destructive" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {brand.tone_of_voice && (
                  <p className="text-xs text-muted-foreground mb-2">Tone: {brand.tone_of_voice}</p>
                )}
                {brand.target_audience && (
                  <p className="text-xs text-muted-foreground mb-2">Audience: {brand.target_audience}</p>
                )}
                <Badge variant="secondary" className="text-xs">
                  {brand.primary_language === "he" ? "Hebrew" : brand.primary_language}
                </Badge>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
