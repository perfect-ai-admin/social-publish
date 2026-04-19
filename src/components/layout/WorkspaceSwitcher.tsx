"use client";

import { useState } from "react";
import { Check, ChevronsUpDown, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  useWorkspaces,
  getCurrentWorkspaceId,
  setCurrentWorkspaceId,
} from "@/hooks/useWorkspace";

export function WorkspaceSwitcher() {
  const [open, setOpen] = useState(false);
  const { data: workspaces } = useWorkspaces();
  const currentId = getCurrentWorkspaceId();
  const current = workspaces?.find((w) => w.id === currentId) ?? workspaces?.[0];

  const handleSelect = (id: string) => {
    setCurrentWorkspaceId(id);
    setOpen(false);
    window.location.reload();
  };

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between rounded-md border px-3 py-2 text-sm hover:bg-muted"
      >
        <span className="truncate">{current?.name ?? "בחרו סביבת עבודה"}</span>
        <ChevronsUpDown className="ms-2 h-4 w-4 shrink-0 opacity-50" />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute end-0 top-full z-50 mt-1 w-[240px] rounded-xl border border-gray-200/60 bg-popover p-2 shadow-[0_8px_16px_-4px_rgb(0_0_0_/0.08),0_4px_8px_-2px_rgb(0_0_0_/0.04)]">
            <div className="space-y-1">
              {workspaces?.map((ws) => (
                <button
                  key={ws.id}
                  onClick={() => handleSelect(ws.id)}
                  className={cn(
                    "flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm hover:bg-muted",
                    ws.id === currentId && "bg-muted font-medium"
                  )}
                >
                  {ws.id === currentId && <Check className="h-3.5 w-3.5" />}
                  <span className={ws.id !== currentId ? "ps-5" : ""}>
                    {ws.name}
                  </span>
                </button>
              ))}
              <hr className="my-2" />
              <button className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm text-primary hover:bg-muted">
                <Plus className="h-3.5 w-3.5" />
                סביבת עבודה חדשה
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
