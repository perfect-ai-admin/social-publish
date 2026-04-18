import { createClient } from "@/lib/supabase/client";

function getClient() { return createClient(); }

export interface Brand {
  id: string;
  workspace_id: string;
  name: string;
  slug: string;
  logo_url: string | null;
  primary_color: string | null;
  tone_of_voice: string | null;
  target_audience: string | null;
  brand_guidelines: string | null;
  primary_language: string;
  created_at: string;
  updated_at: string;
}

export interface Product {
  id: string;
  brand_id: string;
  workspace_id: string;
  name: string;
  description: string | null;
  category: string | null;
  price: number | null;
  currency: string;
  image_url: string | null;
  landing_page_url: string | null;
  default_cta: string | null;
  default_hashtags: string[] | null;
  tags: string[] | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export async function listBrands(workspaceId: string) {
  const { data, error } = await getClient()
    .from("brands")
    .select("*")
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return data as Brand[];
}

export async function createBrand(input: {
  workspace_id: string;
  name: string;
  slug: string;
  tone_of_voice?: string;
  target_audience?: string;
  primary_color?: string;
}) {
  const { data, error } = await getClient()
    .from("brands")
    .insert(input)
    .select()
    .single();
  if (error) throw error;
  return data as Brand;
}

export async function updateBrand(id: string, input: Partial<Brand>) {
  const { data, error } = await getClient()
    .from("brands")
    .update(input)
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data as Brand;
}

export async function deleteBrand(id: string) {
  const { error } = await getClient().from("brands").delete().eq("id", id);
  if (error) throw error;
}

export async function listProducts(brandId: string) {
  const { data, error } = await getClient()
    .from("products")
    .select("*")
    .eq("brand_id", brandId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return data as Product[];
}

export async function createProduct(input: {
  brand_id: string;
  workspace_id: string;
  name: string;
  description?: string;
  category?: string;
  price?: number;
  default_cta?: string;
  default_hashtags?: string[];
}) {
  const { data, error } = await getClient()
    .from("products")
    .insert(input)
    .select()
    .single();
  if (error) throw error;
  return data as Product;
}

export async function updateProduct(id: string, input: Partial<Product>) {
  const { data, error } = await getClient()
    .from("products")
    .update(input)
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data as Product;
}

export async function deleteProduct(id: string) {
  const { error } = await getClient().from("products").delete().eq("id", id);
  if (error) throw error;
}
