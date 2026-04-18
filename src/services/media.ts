import { createClient } from "@/lib/supabase/client";

function getClient() { return createClient(); }

export interface MediaAsset {
  id: string;
  workspace_id: string;
  brand_id: string | null;
  product_id: string | null;
  filename: string;
  storage_path: string;
  public_url: string;
  mime_type: string;
  size_bytes: number | null;
  width: number | null;
  height: number | null;
  duration_sec: number | null;
  alt_text: string | null;
  tags: string[] | null;
  folder: string;
  created_at: string;
}

const BUCKET = "media";
const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100MB

export async function uploadMedia(
  workspaceId: string,
  file: File,
  options?: { brandId?: string; productId?: string; tags?: string[] }
): Promise<MediaAsset> {
  if (file.size > MAX_FILE_SIZE) {
    throw new Error(`File too large. Maximum size is 100MB.`);
  }

  const allowedTypes = ["image/jpeg", "image/png", "image/gif", "image/webp", "video/mp4", "video/quicktime", "video/webm"];
  if (!allowedTypes.includes(file.type)) {
    throw new Error(`Unsupported file type: ${file.type}`);
  }

  const client = getClient();
  const ext = file.name.split(".").pop() || "bin";
  const path = `${workspaceId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

  // Upload to Supabase Storage
  const { error: uploadError } = await client.storage
    .from(BUCKET)
    .upload(path, file, { contentType: file.type, upsert: false });

  if (uploadError) throw new Error(`Upload failed: ${uploadError.message}`);

  // Get public URL
  const { data: urlData } = client.storage.from(BUCKET).getPublicUrl(path);
  const publicUrl = urlData.publicUrl;

  // Get dimensions for images
  let width: number | null = null;
  let height: number | null = null;
  if (file.type.startsWith("image/")) {
    const dims = await getImageDimensions(file);
    width = dims.width;
    height = dims.height;
  }

  // Save metadata to DB
  const { data: { user } } = await client.auth.getUser();

  const { data, error } = await client
    .from("media_assets")
    .insert({
      workspace_id: workspaceId,
      brand_id: options?.brandId || null,
      product_id: options?.productId || null,
      uploader_id: user?.id || null,
      filename: file.name,
      storage_path: path,
      public_url: publicUrl,
      mime_type: file.type,
      size_bytes: file.size,
      width,
      height,
      tags: options?.tags || null,
    })
    .select()
    .single();

  if (error) throw error;
  return data as MediaAsset;
}

export async function listMedia(workspaceId: string, options?: { brandId?: string; limit?: number }) {
  let query = getClient()
    .from("media_assets")
    .select("*")
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: false });

  if (options?.brandId) query = query.eq("brand_id", options.brandId);
  if (options?.limit) query = query.limit(options.limit);

  const { data, error } = await query;
  if (error) throw error;
  return data as MediaAsset[];
}

export async function deleteMedia(id: string) {
  const client = getClient();

  // Get storage path first
  const { data: asset } = await client
    .from("media_assets")
    .select("storage_path")
    .eq("id", id)
    .single();

  if (asset?.storage_path) {
    await client.storage.from(BUCKET).remove([asset.storage_path]);
  }

  const { error } = await client.from("media_assets").delete().eq("id", id);
  if (error) throw error;
}

function getImageDimensions(file: File): Promise<{ width: number; height: number }> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      resolve({ width: img.naturalWidth, height: img.naturalHeight });
      URL.revokeObjectURL(img.src);
    };
    img.onerror = () => resolve({ width: 0, height: 0 });
    img.src = URL.createObjectURL(file);
  });
}
