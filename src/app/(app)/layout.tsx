"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";
import { AppSidebar } from "@/components/layout/AppSidebar";
import { TopBar } from "@/components/layout/TopBar";
import { useEnsureWorkspace } from "@/hooks/useWorkspace";

function WorkspaceGuard({ children }: { children: React.ReactNode }) {
  useEnsureWorkspace();
  return <>{children}</>;
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60 * 1000,
            refetchOnWindowFocus: false,
          },
        },
      })
  );

  return (
    <QueryClientProvider client={queryClient}>
      <WorkspaceGuard>
        <div className="flex h-screen">
          <AppSidebar />
          <div className="flex flex-1 flex-col overflow-hidden">
            <TopBar />
            <main className="flex-1 overflow-auto p-6 bg-[#FAFAFA]">{children}</main>
          </div>
        </div>
      </WorkspaceGuard>
    </QueryClientProvider>
  );
}
