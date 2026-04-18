"use client";

import { createClient } from "@/lib/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";

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

// Fetch all workspaces + auto-select first if none selected
export function useWorkspaces() {
  const query = useQuery({
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

  // Auto-select first workspace if none in localStorage
  useEffect(() => {
    if (query.data && query.data.length > 0 && !getCurrentWorkspaceId()) {
      setCurrentWorkspaceId(query.data[0].id);
      window.location.reload(); // reload so all components pick up the new ID
    }
  }, [query.data]);

  return query;
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

// Hook: ensures workspace is loaded — use in app layout
export function useEnsureWorkspace() {
  const { data: workspaces } = useWorkspaces();
  const currentId = getCurrentWorkspaceId();

  useEffect(() => {
    // If we have workspaces but no current selection, auto-select
    if (workspaces && workspaces.length > 0 && !currentId) {
      setCurrentWorkspaceId(workspaces[0].id);
      window.location.reload();
    }
  }, [workspaces, currentId]);

  return currentId;
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
