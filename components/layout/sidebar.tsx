"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  Users,
  CalendarDays,
  Table2,
  ClipboardList,
  Award,
  Upload,
  Truck,
  MapPin,
  Settings,
  ChevronLeft,
  ChevronRight,
  LogOut,
} from "lucide-react";
import { signOut, useSession } from "next-auth/react";
import { useState, useMemo } from "react";

const NAV_ITEMS = [
  { href: "/dashboard",  label: "Dashboard",     icon: LayoutDashboard },
  { href: "/employes",   label: "Employés",       icon: Users },
  { href: "/planning",   label: "Planning",       icon: CalendarDays },
  { href: "/synthese",   label: "Synthèse",       icon: Table2 },
  { href: "/recap",      label: "Récap mensuel",  icon: ClipboardList },
  { href: "/pqs",        label: "PQS",            icon: Award },
  { href: "/import",     label: "Import",         icon: Upload },
  { href: "/vehicules",  label: "Véhicules",      icon: Truck },
  { href: "/sites",      label: "Sites",          icon: MapPin },
  { href: "/parametres", label: "Paramètres",     icon: Settings },
] as const;

function Initials({ name }: { name: string }) {
  const parts = name.trim().split(/\s+/);
  const letters =
    parts.length >= 2
      ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
      : name.slice(0, 2).toUpperCase();
  return (
    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary-600/80 text-[11px] font-bold text-white">
      {letters}
    </span>
  );
}

export function Sidebar() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const [collapsed, setCollapsed] = useState(false);

  const visibleItems = useMemo(() => {
    const allowed = session?.user?.allowedPages;
    if (!allowed || allowed.length === 0) return NAV_ITEMS;
    return NAV_ITEMS.filter((item) =>
      allowed.some((p) => item.href.startsWith(p)),
    );
  }, [session?.user?.allowedPages]);

  return (
    <aside
      style={{ background: "var(--color-sidebar-bg)" }}
      className={cn(
        "relative flex h-screen flex-col transition-all duration-200",
        collapsed ? "w-16" : "w-[220px]",
      )}
    >
      {/* Subtle top-edge glow */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-px"
        style={{ background: "linear-gradient(90deg, transparent, rgba(99,102,241,0.6), transparent)" }}
      />

      {/* Logo header */}
      <div
        className="flex h-14 items-center justify-between border-b px-3"
        style={{
          borderColor: "var(--color-sidebar-border)",
          background: "linear-gradient(135deg, var(--color-sidebar-header-from), var(--color-sidebar-bg))",
        }}
      >
        {!collapsed && (
          <div className="flex items-center gap-2.5 overflow-hidden">
            <Image src="/favicon.svg" alt="RH Dispatch" width={26} height={26} className="shrink-0" />
            <div className="leading-tight min-w-0">
              <p className="truncate text-[11px] font-medium tracking-widest uppercase" style={{ color: "rgba(165,180,252,0.7)" }}>
                ID Logistics
              </p>
              <p className="truncate text-sm font-bold text-white">RH Dispatch</p>
            </div>
          </div>
        )}
        {collapsed && (
          <Image src="/favicon.svg" alt="RH Dispatch" width={26} height={26} className="mx-auto" />
        )}
        <button
          onClick={() => setCollapsed(!collapsed)}
          aria-label={collapsed ? "Développer la sidebar" : "Réduire la sidebar"}
          className={cn(
            "rounded-lg p-1.5 transition-colors",
            collapsed && "mx-auto",
          )}
          style={{ color: "rgba(255,255,255,0.35)" }}
          onMouseEnter={(e) => (e.currentTarget.style.color = "white")}
          onMouseLeave={(e) => (e.currentTarget.style.color = "rgba(255,255,255,0.35)")}
        >
          {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-0.5 overflow-y-auto p-2 py-3">
        {visibleItems.map(({ href, label, icon: Icon }) => {
          const isActive = pathname === href || pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              title={collapsed ? label : undefined}
              className={cn(
                "group relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-150",
                collapsed && "justify-center px-2",
              )}
              style={{
                color: isActive
                  ? "var(--color-sidebar-text-active)"
                  : "var(--color-sidebar-text)",
                background: isActive ? "var(--color-sidebar-active-bg)" : "transparent",
              }}
              onMouseEnter={(e) => {
                if (!isActive)
                  e.currentTarget.style.background = "var(--color-sidebar-hover)";
              }}
              onMouseLeave={(e) => {
                if (!isActive) e.currentTarget.style.background = "transparent";
              }}
            >
              {/* Active left border accent */}
              {isActive && (
                <span
                  className="absolute inset-y-1 left-0 w-0.5 rounded-full"
                  style={{ background: "var(--color-sidebar-active-ring)" }}
                />
              )}
              <Icon
                className="h-4 w-4 shrink-0 transition-transform duration-150 group-hover:scale-105"
                style={{ opacity: isActive ? 1 : 0.65 }}
              />
              {!collapsed && <span className="truncate">{label}</span>}
            </Link>
          );
        })}
      </nav>

      {/* Séparateur */}
      <div className="mx-3 h-px" style={{ background: "var(--color-sidebar-border)" }} />

      {/* User footer */}
      <div className="p-2 pb-3">
        {!collapsed && session?.user && (
          <div
            className="mb-1 flex items-center gap-2.5 rounded-lg px-3 py-2"
            style={{ background: "rgba(255,255,255,0.04)" }}
          >
            <Initials name={session.user.name ?? session.user.email ?? "?"} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-semibold text-white">
                {session.user.name}
              </p>
              <p className="truncate text-[11px]" style={{ color: "rgba(255,255,255,0.4)" }}>
                {session.user.role === "ADMIN" ? "Administrateur" : "Responsable"}
              </p>
            </div>
          </div>
        )}
        {collapsed && session?.user && (
          <div className="mb-1 flex justify-center">
            <Initials name={session.user.name ?? session.user.email ?? "?"} />
          </div>
        )}
        <button
          onClick={() => signOut({ callbackUrl: "/auth/signin" })}
          title={collapsed ? "Déconnexion" : undefined}
          className={cn(
            "flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm transition-all duration-150",
            collapsed && "justify-center px-2",
          )}
          style={{ color: "rgba(255,255,255,0.35)" }}
          onMouseEnter={(e) => {
            e.currentTarget.style.color = "#f87171";
            e.currentTarget.style.background = "rgba(248,113,113,0.08)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.color = "rgba(255,255,255,0.35)";
            e.currentTarget.style.background = "transparent";
          }}
        >
          <LogOut className="h-4 w-4 shrink-0" />
          {!collapsed && <span>Déconnexion</span>}
        </button>
      </div>
    </aside>
  );
}
