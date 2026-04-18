"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Tags,
  Link2,
  PenSquare,
  Calendar,
  BarChart3,
  Sparkles,
  CreditCard,
  Settings,
  AlertTriangle,
} from "lucide-react";
import { cn } from "@/lib/utils";

const navigation = [
  { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { name: "Brands", href: "/brands", icon: Tags },
  { name: "Channels", href: "/channels", icon: Link2 },
  { name: "Compose", href: "/composer", icon: PenSquare },
  { name: "Calendar", href: "/calendar", icon: Calendar },
  { name: "Analytics", href: "/analytics", icon: BarChart3 },
  { name: "AI Studio", href: "/ai-studio", icon: Sparkles },
  { name: "Errors", href: "/errors", icon: AlertTriangle },
  { name: "Billing", href: "/billing", icon: CreditCard },
  { name: "Settings", href: "/settings", icon: Settings },
];

export function AppSidebar() {
  const pathname = usePathname();

  return (
    <aside className="flex h-full w-64 flex-col border-r bg-card">
      {/* Logo */}
      <div className="flex h-16 items-center gap-2 border-b px-6">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground font-bold text-sm">
          SP
        </div>
        <span className="text-lg font-semibold">SocialPublish</span>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-1 p-4">
        {navigation.map((item) => {
          const isActive = pathname.startsWith(item.href);
          return (
            <Link
              key={item.name}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                isActive
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              <item.icon className="h-4 w-4" />
              {item.name}
            </Link>
          );
        })}
      </nav>

      {/* Connection Health */}
      <div className="border-t p-4">
        <Link
          href="/channels"
          className="flex items-center gap-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700 hover:bg-amber-100 dark:bg-amber-950 dark:text-amber-400"
        >
          <AlertTriangle className="h-3.5 w-3.5" />
          <span>Connection Health</span>
        </Link>
      </div>
    </aside>
  );
}
