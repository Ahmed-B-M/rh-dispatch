"use client";

import { useQuery } from "@tanstack/react-query";
import { useSession } from "next-auth/react";
import { useState } from "react";
import { Clock, TrendingDown, Users, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { PageHelp } from "@/components/ui/page-help";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";
import type { PieLabelRenderProps } from "recharts";

interface DashboardData {
  totalHours: number;
  absenceRate: number;
  activeEmployees: number;
  avgHoursPerDay: number;
  hoursBySite: { site: string; hours: number }[];
  absenceDistribution: { code: string; count: number; color: string }[];
}

const MONTHS = [
  "Janvier", "Février", "Mars", "Avril", "Mai", "Juin",
  "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre",
];

export default function DashboardPage() {
  const { data: session } = useSession();
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);

  const { data, isLoading } = useQuery<DashboardData>({
    queryKey: ["dashboard", year, month],
    queryFn: async () => {
      const res = await fetch(`/api/dashboard?year=${year}&month=${month}`);
      if (!res.ok) throw new Error(`Erreur ${res.status}`);
      return res.json();
    },
  });

  function prevMonth() {
    if (month === 1) { setMonth(12); setYear(y => y - 1); }
    else setMonth(m => m - 1);
  }
  function nextMonth() {
    if (month === 12) { setMonth(1); setYear(y => y + 1); }
    else setMonth(m => m + 1);
  }

  const kpis = [
    {
      label: "Heures travaillées",
      value: data ? `${data.totalHours.toLocaleString("fr-FR")}h` : "—",
      icon: Clock,
      color: "text-primary-600 bg-primary-50",
    },
    {
      label: "Taux d'absence",
      value: data ? `${data.absenceRate}%` : "—",
      icon: TrendingDown,
      color: "text-amber-600 bg-amber-50",
    },
    {
      label: "Employés actifs",
      value: data ? String(data.activeEmployees) : "—",
      icon: Users,
      color: "text-emerald-600 bg-emerald-50",
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Dashboard</h1>
            <p className="text-sm text-slate-500">
              Bienvenue
              {session?.user?.name ? `, ${session.user.name}` : ""} — Vue
              d&apos;ensemble des heures et absences
            </p>
          </div>
          <PageHelp
            title="Dashboard"
            description="Vue d'ensemble des heures travaillées et des absences."
            sections={[
              {
                title: "Indicateurs",
                items: [
                  "Total des heures travaillées sur le mois sélectionné.",
                  "Les heures travaillées sont nettes de la pause configurée par poste dans Paramètres.",
                  "Taux d'absence : ratio entrées absence / total entrées.",
                  "Employés actifs : nombre de salariés avec au moins une entrée.",
                  "Moyenne d'heures par jour travaillé.",
                ],
              },
              {
                title: "Navigation",
                items: [
                  "Utilisez les flèches ← → pour changer de mois.",
                  "Le graphique « Heures par site » compare la charge entre les sites.",
                  "Le camembert « Absences » décompose les types d'absence du mois.",
                ],
              },
            ]}
          />
        </div>
        <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-1 py-1">
          <button
            onClick={prevMonth}
            className="rounded p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="min-w-[140px] text-center text-sm font-medium text-slate-700">
            {MONTHS[month - 1]} {year}
          </span>
          <button
            onClick={nextMonth}
            className="rounded p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {kpis.map((kpi) => (
          <div
            key={kpi.label}
            className="rounded-xl border border-slate-200 bg-white p-5 shadow-soft"
          >
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
                {kpi.label}
              </p>
              <div className={cn("rounded-lg p-2", kpi.color)}>
                <kpi.icon className="h-4 w-4" />
              </div>
            </div>
            <p
              className={cn(
                "mt-3 text-2xl font-bold",
                isLoading ? "animate-pulse text-slate-300" : "text-slate-900",
              )}
            >
              {kpi.value}
            </p>
            <p className="mt-1 text-xs text-slate-400">
              {MONTHS[month - 1]} {year}
            </p>
          </div>
        ))}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Hours by site */}
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-soft">
          <h2 className="mb-4 text-sm font-semibold text-slate-900">
            Heures par site / affectation
          </h2>
          {!data?.hoursBySite?.length ? (
            <p className="py-10 text-center text-sm text-slate-400">
              {isLoading ? "Chargement..." : "Aucune donnée"}
            </p>
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={data.hoursBySite}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis
                  dataKey="site"
                  tick={{ fontSize: 11, fill: "#64748b" }}
                />
                <YAxis tick={{ fontSize: 11, fill: "#64748b" }} />
                <Tooltip
                  contentStyle={{
                    borderRadius: "8px",
                    border: "1px solid #e2e8f0",
                    fontSize: "12px",
                  }}
                  formatter={(value) => [`${value}h`, "Heures"]}
                />
                <Bar
                  dataKey="hours"
                  fill="#4f46e5"
                  radius={[4, 4, 0, 0]}
                  maxBarSize={50}
                />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Absence distribution */}
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-soft">
          <h2 className="mb-4 text-sm font-semibold text-slate-900">
            Répartition des absences
          </h2>
          {!data?.absenceDistribution?.length ? (
            <p className="py-10 text-center text-sm text-slate-400">
              {isLoading ? "Chargement..." : "Aucune absence ce mois"}
            </p>
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie
                  data={data.absenceDistribution}
                  dataKey="count"
                  nameKey="code"
                  cx="50%"
                  cy="50%"
                  outerRadius={100}
                  label={(props: PieLabelRenderProps) =>
                    `${props.name ?? ""} (${props.value ?? 0})`
                  }
                  labelLine={{ strokeWidth: 1 }}
                >
                  {data.absenceDistribution.map((entry) => (
                    <Cell key={entry.code} fill={entry.color} />
                  ))}
                </Pie>
                <Legend
                  wrapperStyle={{ fontSize: "11px" }}
                  formatter={(value: string) => (
                    <span className="text-slate-600">{value}</span>
                  )}
                />
                <Tooltip
                  contentStyle={{
                    borderRadius: "8px",
                    border: "1px solid #e2e8f0",
                    fontSize: "12px",
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>
    </div>
  );
}
