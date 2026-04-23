"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  Users,
  CalendarDays,
  Table2,
  ClipboardList,
  Upload,
  Truck,
  MapPin,
  Settings,
  ChevronLeft,
  ChevronRight,
  LogOut,
} from "lucide-react";
import { signOut, useSession } from "next-auth/react";
import { useState } from "react";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/employes", label: "Employés", icon: Users },
  { href: "/planning", label: "Planning", icon: CalendarDays },
  { href: "/synthese", label: "Synthèse", icon: Table2 },
  { href: "/recap", label: "Récap mensuel", icon: ClipboardList },
  { href: "/import", label: "Import", icon: Upload },
  { href: "/vehicules", label: "Véhicules", icon: Truck },
  { href: "/sites", label: "Sites", icon: MapPin },
  { href: "/parametres", label: "Paramètres", icon: Settings },
] as const;

export function Sidebar() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const [collapsed, setCollapsed] = useState(false);

  return (
    <aside
      className={cn(
        "flex h-screen flex-col border-r border-slate-200 bg-white transition-all duration-200",
        collapsed ? "w-16" : "w-56",
      )}
    >
      <div className="flex h-14 items-center justify-between border-b border-slate-200 px-3">
        {!collapsed && (
          <span className="text-sm font-bold text-primary-600">RH Dispatch</span>
        )}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
          aria-label={collapsed ? "Développer la sidebar" : "Réduire la sidebar"}
        >
          {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </button>
      </div>

      <nav className="flex-1 space-y-0.5 overflow-y-auto p-2">
        {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
          const isActive = pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                isActive
                  ? "bg-primary-50 text-primary-700"
                  : "text-slate-600 hover:bg-slate-50 hover:text-slate-900",
              )}
              title={collapsed ? label : undefined}
            >
              <Icon className="h-4 w-4 shrink-0" />
              {!collapsed && <span>{label}</span>}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-slate-200 p-2">
        {!collapsed && session?.user && (
          <div className="mb-2 px-3 py-1.5">
            <p className="text-xs font-medium text-slate-700 truncate">{session.user.name}</p>
            <p className="text-xs text-slate-400 truncate">{session.user.role}</p>
          </div>
        )}
        <button
          onClick={() => signOut({ callbackUrl: "/auth/signin" })}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-slate-500 hover:bg-slate-50 hover:text-slate-700"
          title={collapsed ? "Déconnexion" : undefined}
        >
          <LogOut className="h-4 w-4 shrink-0" />
          {!collapsed && <span>Déconnexion</span>}
        </button>
      </div>
    </aside>
  );
}
