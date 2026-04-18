"use client";

import { createClient } from "@/lib/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";

function getClient() { return createClient(); }

export interface Workspace {
  id: string;
  name: string;
  slug: string;
  plan: string;
  owner_id: string;
  logo_url: string | null;
  timezone: string;
  locale: string;
  created_at: string;
}

// Get current workspace from localStorage
export function getCurrentWorkspaceId(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("current_workspace_id");
}

export function setCurrentWorkspaceId(id: string) {
  localStorage.setItem("current_workspace_id", id);
}

// Fetch all workspaces for current user
export function useWorkspaces() {
  return useQuery({
    queryKey: ["workspaces"],
    queryFn: async () => {
      const { data, error } = await getClient()
        .from("workspaces")
        .select("*")
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data as Workspace[];
    },
  });
}

// Fetch single workspace
export function useWorkspace(workspaceId: string | null) {
  return useQuery({
    queryKey: ["workspace", workspaceId],
    queryFn: async () => {
      if (!workspaceId) return null;
      const { data, error } = await getClient()
        .from("workspaces")
        .select("*")
        .eq("id", workspaceId)
        .single();
      if (error) throw error;
      return data as Workspace;
    },
    enabled: !!workspaceId,
  });
}

// Create workspace
export function useCreateWorkspace() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: { name: string; slug: string }) => {
      const { data: { user } } = await getClient().auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data, error } = await getClient()
        .from("workspaces")
        .insert({ name: input.name, slug: input.slug, owner_id: user.id })
        .select()
        .single();
      if (error) throw error;
      return data as Workspace;
    },
    onSuccess: (workspace) => {
      queryClient.invalidateQueries({ queryKey: ["workspaces"] });
      setCurrentWorkspaceId(workspace.id);
    },
  });
}
