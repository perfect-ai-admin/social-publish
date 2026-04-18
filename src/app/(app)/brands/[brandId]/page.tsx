"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { listProducts, createProduct, deleteProduct } from "@/services/brands";
import { listPosts } from "@/services/posts";
import { getCurrentWorkspaceId } from "@/hooks/useWorkspace";
import { Plus, Package, Trash2, ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";

export default function BrandDetailPage() {
  const { brandId } = useParams<{ brandId: string }>();
  const workspaceId = getCurrentWorkspaceId();
  const queryClient = useQueryClient();

  const [productDialog, setProductDialog] = useState(false);
  const [productName, setProductName] = useState("");
  const [productDesc, setProductDesc] = useState("");
  const [productCta, setProductCta] = useState("");

  const { data: products = [] } = useQuery({
    queryKey: ["products", brandId],
    queryFn: () => listProducts(brandId),
    enabled: !!brandId,
  });

  const { data: brandPosts = [] } = useQuery({
    queryKey: ["brand-posts", workspaceId, brandId],
    queryFn: () => listPosts(workspaceId!, { brandId }),
    enabled: !!workspaceId && !!brandId,
  });

  const createMutation = useMutation({
    mutationFn: () =>
      createProduct({
        brand_id: brandId,
        workspace_id: workspaceId!,
        name: productName,
        description: productDesc || undefined,
        default_cta: productCta || undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products", brandId] });
      setProductDialog(false);
      setProductName("");
      setProductDesc("");
      setProductCta("");
      toast.success("Product created");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const deleteMutation = useMutation({
    mutationFn: deleteProduct,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products", brandId] });
      toast.success("Product deleted");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/brands">
          <Button variant="ghost" size="icon"><ArrowLeft className="h-4 w-4" /></Button>
        </Link>
        <h1 className="text-2xl font-bold">Brand Details</h1>
      </div>

      {/* Products */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Products ({products.length})</h2>
          <Dialog open={productDialog} onOpenChange={setProductDialog}>
            <DialogTrigger>
              <Button size="sm"><Plus className="mr-1 h-3 w-3" />Add Product</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Add Product</DialogTitle></DialogHeader>
              <form onSubmit={(e) => { e.preventDefault(); createMutation.mutate(); }} className="space-y-4">
                <div className="space-y-2">
                  <Label>Product Name</Label>
                  <Input value={productName} onChange={(e) => setProductName(e.target.value)} required />
                </div>
                <div className="space-y-2">
                  <Label>Description</Label>
                  <Textarea value={productDesc} onChange={(e) => setProductDesc(e.target.value)} rows={3} />
                </div>
                <div className="space-y-2">
                  <Label>Default CTA</Label>
                  <Input value={productCta} onChange={(e) => setProductCta(e.target.value)} placeholder="Learn more, Buy now..." />
                </div>
                <Button type="submit" className="w-full" disabled={createMutation.isPending}>
                  {createMutation.isPending ? "Creating..." : "Create Product"}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {products.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center py-8">
              <Package className="h-10 w-10 text-muted-foreground mb-3" />
              <p className="text-sm text-muted-foreground">No products yet</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {products.map((product) => (
              <Card key={product.id}>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium">{product.name}</CardTitle>
                  <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => {
                    if (confirm("Delete this product?")) deleteMutation.mutate(product.id);
                  }}>
                    <Trash2 className="h-3 w-3 text-destructive" />
                  </Button>
                </CardHeader>
                <CardContent>
                  {product.description && <p className="text-xs text-muted-foreground mb-2">{product.description}</p>}
                  {product.default_cta && <Badge variant="outline" className="text-[10px]">CTA: {product.default_cta}</Badge>}
                  {product.is_active ? (
                    <Badge variant="default" className="text-[10px] ml-1">Active</Badge>
                  ) : (
                    <Badge variant="secondary" className="text-[10px] ml-1">Inactive</Badge>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Brand Posts */}
      <div className="space-y-3">
        <h2 className="text-lg font-semibold">Posts ({brandPosts.length})</h2>
        {brandPosts.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center py-8">
              <p className="text-sm text-muted-foreground">No posts for this brand yet</p>
              <Link href="/composer" className="text-sm text-primary hover:underline mt-2">Create a post</Link>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {brandPosts.slice(0, 10).map((post) => (
              <div key={post.id} className="flex items-center justify-between rounded-lg border p-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{post.title || post.base_caption?.slice(0, 60) || "Untitled"}</p>
                  <p className="text-xs text-muted-foreground">
                    {post.created_at ? new Date(post.created_at).toLocaleDateString() : ""}
                  </p>
                </div>
                <Badge variant={post.status === "published" ? "default" : post.status === "failed" ? "destructive" : "outline"} className="text-xs">
                  {post.status}
                </Badge>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
