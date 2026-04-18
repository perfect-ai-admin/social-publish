import { createClient } from "@/lib/supabase/client";
import type { Platform } from "@/lib/platform-capabilities";

function getClient() { return createClient(); }

export interface Post {
  id: string;
  workspace_id: string;
  brand_id: string | null;
  product_id: string | null;
  campaign_id: string | null;
  created_by: string | null;
  title: string | null;
  base_caption: string | null;
  media_asset_ids: string[] | null;
  goal: string | null;
  status: "draft" | "scheduled" | "publishing" | "published" | "partial" | "failed" | "cancelled";
  scheduled_at: string | null;
  published_at: string | null;
  approval_status: string;
  ai_generated: boolean;
  tags: string[] | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface PostVariant {
  id: string;
  post_id: string;
  connection_id: string;
  platform: Platform;
  caption: string | null;
  hashtags: string[] | null;
  media_asset_ids: string[] | null;
  format: string;
  platform_config: Record<string, unknown>;
  status: "pending" | "queued" | "publishing" | "published" | "failed" | "skipped";
  scheduled_at: string | null;
  published_at: string | null;
  platform_post_id: string | null;
  platform_post_url: string | null;
  retry_count: number;
  last_error: string | null;
}

export async function listPosts(workspaceId: string, filters?: { status?: string; brandId?: string }) {
  let query = getClient()
    .from("posts")
    .select("*")
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: false });

  if (filters?.status) query = query.eq("status", filters.status);
  if (filters?.brandId) query = query.eq("brand_id", filters.brandId);

  const { data, error } = await query;
  if (error) throw error;
  return data as Post[];
}

export async function getPost(id: string) {
  const { data, error } = await getClient()
    .from("posts")
    .select("*")
    .eq("id", id)
    .single();
  if (error) throw error;
  return data as Post;
}

export async function createPost(input: {
  workspace_id: string;
  brand_id?: string;
  product_id?: string;
  title?: string;
  base_caption: string;
  media_asset_ids?: string[];
  goal?: string;
  scheduled_at?: string;
}) {
  const client = getClient();
  const { data: { user } } = await client.auth.getUser();
  const { data, error } = await client
    .from("posts")
    .insert({ ...input, created_by: user?.id, status: input.scheduled_at ? "scheduled" : "draft" })
    .select()
    .single();
  if (error) throw error;
  return data as Post;
}

export async function createPostVariants(
  postId: string,
  variants: Array<{
    connection_id: string;
    platform: Platform;
    caption: string;
    hashtags?: string[];
    media_asset_ids?: string[];
    format?: string;
    scheduled_at?: string;
  }>
) {
  const rows = variants.map((v) => ({ ...v, post_id: postId }));
  const { data, error } = await getClient()
    .from("post_variants")
    .insert(rows)
    .select();
  if (error) throw error;
  return data as PostVariant[];
}

export async function enqueueVariants(variantIds: string[]) {
  const jobs = variantIds.map((id) => ({
    variant_id: id,
    idempotency_key: id, // variant ID is the natural idempotency key — prevents double-publish
    status: "queued" as const,
  }));
  const { error } = await getClient().from("publish_jobs").insert(jobs);
  if (error) throw error;

  // Update variant statuses
  const { error: err2 } = await getClient()
    .from("post_variants")
    .update({ status: "queued" })
    .in("id", variantIds);
  if (err2) throw err2;
}

export async function listPostVariants(postId: string) {
  const { data, error } = await getClient()
    .from("post_variants")
    .select("*")
    .eq("post_id", postId);
  if (error) throw error;
  return data as PostVariant[];
}

export async function getCalendarPosts(workspaceId: string, start: string, end: string) {
  const { data, error } = await getClient()
    .from("posts")
    .select("*")
    .eq("workspace_id", workspaceId)
    .gte("scheduled_at", start)
    .lte("scheduled_at", end)
    .order("scheduled_at", { ascending: true });
  if (error) throw error;
  return data as Post[];
}
