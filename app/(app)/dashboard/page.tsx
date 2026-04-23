"use client";

import { useSession } from "next-auth/react";

export default function DashboardPage() {
  const { data: session } = useSession();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Dashboard</h1>
        <p className="text-sm text-slate-500">
          Bienvenue{session?.user?.name ? `, ${session.user.name}` : ""} — Vue d&apos;ensemble des heures et absences
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: "Heures travaillées", value: "—", sub: "Ce mois" },
          { label: "Taux d'absence", value: "—", sub: "Ce mois" },
          { label: "Employés actifs", value: "—", sub: "Total" },
          { label: "Heures moy./jour", value: "—", sub: "Ce mois" },
        ].map((kpi) => (
          <div
            key={kpi.label}
            className="rounded-xl border border-slate-200 bg-white p-5 shadow-soft"
          >
            <p className="text-xs font-medium uppercase tracking-wide text-slate-400">{kpi.label}</p>
            <p className="mt-2 text-2xl font-bold text-slate-900">{kpi.value}</p>
            <p className="mt-1 text-xs text-slate-400">{kpi.sub}</p>
          </div>
        ))}
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-soft">
        <p className="text-sm text-slate-400">Les graphiques seront disponibles après l&apos;import des données.</p>
      </div>
    </div>
  );
}
