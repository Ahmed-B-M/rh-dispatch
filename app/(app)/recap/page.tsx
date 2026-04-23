"use client";

import { useQuery } from "@tanstack/react-query";
import { useState, useMemo, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { PageHelp } from "@/components/ui/page-help";
import {
  ChevronLeft,
  ChevronRight,
  Download,
  Moon,
  Clock,
  Utensils,
  CalendarCheck,
  Search,
  ArrowUpDown,
  ExternalLink,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface RecapRow {
  employeeId: string;
  matricule: string;
  nom: string;
  prenom: string;
  poste: string;
  categorie: string;
  typeContrat: string;
  joursTravailles: number;
  heuresTotales: number;
  heuresNuit: number;
  nbPanierRepas: number;
  tarifPanier: number;
  montantPanier: number;
}

interface RecapData {
  year: number;
  month: number;
  rows: RecapRow[];
  totals: {
    joursTravailles: number;
    heuresTotales: number;
    heuresNuit: number;
    montantPanier: number;
  };
}

interface Site {
  id: string;
  code: string;
  label: string;
}

type SortField = "nom" | "joursTravailles" | "heuresTotales" | "heuresNuit" | "montantPanier";
type SortDir = "asc" | "desc";

const MONTHS = [
  "Janvier", "Février", "Mars", "Avril", "Mai", "Juin",
  "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre",
];

const categorieColors: Record<string, string> = {
  SEDENTAIRE: "bg-purple-100 text-purple-700",
  TRANSPORT: "bg-blue-100 text-blue-700",
  LOGISTIQUE: "bg-emerald-100 text-emerald-700",
};

const contratColors: Record<string, string> = {
  CDI: "bg-emerald-100 text-emerald-700",
  CDD: "bg-amber-100 text-amber-700",
  ALTERNANCE: "bg-sky-100 text-sky-700",
};

export default function RecapPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center py-20"><p className="text-sm text-slate-400">Chargement...</p></div>}>
      <RecapContent />
    </Suspense>
  );
}

function RecapContent() {
  const searchParams = useSearchParams();
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [filterCategorie, setFilterCategorie] = useState("");
  const [filterSiteId, setFilterSiteId] = useState("");
  const [search, setSearch] = useState(searchParams.get("search") ?? "");
  const [sortField, setSortField] = useState<SortField>("nom");
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  const { data: sites = [] } = useQuery<Site[]>({
    queryKey: ["sites"],
    queryFn: async () => {
      const res = await fetch("/api/sites");
      if (!res.ok) throw new Error(`Erreur ${res.status}`);
      return res.json();
    },
  });

  const { data, isLoading } = useQuery<RecapData>({
    queryKey: ["recap", year, month, filterCategorie, filterSiteId],
    queryFn: async () => {
      const params = new URLSearchParams({
        year: String(year),
        month: String(month),
      });
      if (filterCategorie) params.set("categorie", filterCategorie);
      if (filterSiteId) params.set("siteId", filterSiteId);
      const res = await fetch(`/api/recap?${params}`);
      if (!res.ok) throw new Error(`Erreur ${res.status}`);
      return res.json();
    },
  });

  function prevMonth() {
    if (month === 1) {
      setMonth(12);
      setYear((y) => y - 1);
    } else {
      setMonth((m) => m - 1);
    }
  }

  function nextMonth() {
    if (month === 12) {
      setMonth(1);
      setYear((y) => y + 1);
    } else {
      setMonth((m) => m + 1);
    }
  }

  function handleExport() {
    const lastDay = new Date(year, month, 0).getDate();
    const params = new URLSearchParams({
      from: `${year}-${String(month).padStart(2, "0")}-01`,
      to: `${year}-${String(month).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`,
      format: "synthesis",
    });
    if (filterCategorie) params.set("categorie", filterCategorie);
    if (filterSiteId) params.set("siteId", filterSiteId);
    window.location.href = `/api/export?${params}`;
  }

  function toggleSort(field: SortField) {
    if (sortField === field) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDir(field === "nom" ? "asc" : "desc");
    }
  }

  const rawRows = data?.rows ?? [];
  const totals = data?.totals;

  const rows = useMemo(() => {
    let filtered = rawRows;
    if (search.trim()) {
      const q = search.toLowerCase();
      filtered = filtered.filter(
        (r) =>
          r.nom.toLowerCase().includes(q) ||
          r.prenom.toLowerCase().includes(q) ||
          r.matricule.includes(q) ||
          r.poste.toLowerCase().includes(q),
      );
    }
    const sorted = [...filtered].sort((a, b) => {
      const mul = sortDir === "asc" ? 1 : -1;
      if (sortField === "nom") {
        const cmp = a.nom.localeCompare(b.nom, "fr") || a.prenom.localeCompare(b.prenom, "fr");
        return cmp * mul;
      }
      return (a[sortField] - b[sortField]) * mul;
    });
    return sorted;
  }, [rawRows, search, sortField, sortDir]);

  return (
    <div className="flex h-full flex-col space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Récap mensuel</h1>
            <p className="text-sm text-slate-500">
              Synthèse par salarié — {rows.length}{search ? ` / ${rawRows.length}` : ""} employé{rows.length > 1 ? "s" : ""}
            </p>
          </div>
          <PageHelp
            title="Récap mensuel"
            description="Synthèse par salarié de toutes les heures et indemnités du mois."
            sections={[
              {
                title: "Lecture du tableau",
                items: [
                  "Chaque ligne = un employé avec ses totaux du mois sélectionné.",
                  "Jours travaillés, heures totales, heures nuit, repas et km.",
                  "Les heures travaillées sont nettes de la pause configurée par poste dans Paramètres.",
                  "Cliquez sur un nom pour accéder à la fiche détaillée de l'employé.",
                ],
              },
              {
                title: "Filtres et navigation",
                items: [
                  "Naviguez entre les mois avec les flèches ← →.",
                  "Filtrez par catégorie, site ou poste.",
                  "La recherche filtre les lignes par nom ou matricule en temps réel.",
                  "Cliquez sur un en-tête de colonne pour trier.",
                ],
              },
              {
                title: "Export",
                items: [
                  "Le bouton « Exporter » génère un fichier Excel du récap affiché.",
                  "Appliquez d'abord vos filtres pour n'exporter que les données souhaitées.",
                ],
              },
            ]}
          />
        </div>
        <button
          onClick={handleExport}
          className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-emerald-700"
        >
          <Download className="h-4 w-4" />
          Exporter
        </button>
      </div>

      {/* Month navigator + filters */}
      <div className="flex flex-wrap items-center gap-4 rounded-xl border border-slate-200 bg-white p-4 shadow-soft">
        <div className="flex items-center gap-2">
          <button
            onClick={prevMonth}
            className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="min-w-[150px] text-center text-sm font-semibold text-slate-900">
            {MONTHS[month - 1]} {year}
          </span>
          <button
            onClick={nextMonth}
            className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>

        <div className="h-6 w-px bg-slate-200" />

        <select
          value={filterCategorie}
          onChange={(e) => setFilterCategorie(e.target.value)}
          className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm outline-none focus:border-primary-500"
        >
          <option value="">Toutes catégories</option>
          <option value="SEDENTAIRE">Sédentaire</option>
          <option value="TRANSPORT">Transport</option>
          <option value="LOGISTIQUE">Logistique</option>
        </select>
        <select
          value={filterSiteId}
          onChange={(e) => setFilterSiteId(e.target.value)}
          className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm outline-none focus:border-primary-500"
        >
          <option value="">Tous les sites</option>
          {sites.map((site) => (
            <option key={site.id} value={site.id}>
              {site.code}
            </option>
          ))}
        </select>

        <div className="h-6 w-px bg-slate-200" />

        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher..."
            className="rounded-lg border border-slate-200 py-1.5 pl-9 pr-3 text-sm outline-none focus:border-primary-500"
          />
        </div>
      </div>

      {/* Summary cards */}
      {totals && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-soft">
            <div className="rounded-lg bg-primary-50 p-2 text-primary-600">
              <CalendarCheck className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs text-slate-400">Jours travaillés</p>
              <p className="text-lg font-bold text-slate-900">
                {totals.joursTravailles.toLocaleString("fr-FR")}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-soft">
            <div className="rounded-lg bg-blue-50 p-2 text-blue-600">
              <Clock className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs text-slate-400">Heures totales</p>
              <p className="text-lg font-bold text-slate-900">
                {totals.heuresTotales.toLocaleString("fr-FR")}h
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-soft">
            <div className="rounded-lg bg-indigo-50 p-2 text-indigo-600">
              <Moon className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs text-slate-400">Heures de nuit</p>
              <p className="text-lg font-bold text-slate-900">
                {totals.heuresNuit.toLocaleString("fr-FR")}h
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-soft">
            <div className="rounded-lg bg-amber-50 p-2 text-amber-600">
              <Utensils className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs text-slate-400">Paniers repas</p>
              <p className="text-lg font-bold text-slate-900">
                {totals.montantPanier.toLocaleString("fr-FR", {
                  minimumFractionDigits: 2,
                })}{" "}
                €
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="flex-1 overflow-auto rounded-xl border border-slate-200 bg-white shadow-soft">
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <p className="text-sm text-slate-400">Chargement du récap...</p>
          </div>
        ) : rows.length === 0 ? (
          <div className="flex items-center justify-center py-20">
            <p className="text-sm text-slate-400">
              Aucune donnée pour ce mois
            </p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="sticky top-0 z-10 bg-slate-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Matricule
                </th>
                <th
                  className="cursor-pointer px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 hover:text-slate-700"
                  onClick={() => toggleSort("nom")}
                >
                  <span className="inline-flex items-center gap-1">
                    Nom Prénom
                    <ArrowUpDown className={cn("h-3 w-3", sortField === "nom" ? "text-primary-500" : "text-slate-300")} />
                  </span>
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Poste
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Catégorie
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Contrat
                </th>
                <th
                  className="cursor-pointer px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-slate-500 hover:text-slate-700"
                  onClick={() => toggleSort("joursTravailles")}
                >
                  <span className="inline-flex items-center justify-end gap-1">
                    Jours
                    <ArrowUpDown className={cn("h-3 w-3", sortField === "joursTravailles" ? "text-primary-500" : "text-slate-300")} />
                  </span>
                </th>
                <th
                  className="cursor-pointer px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-slate-500 hover:text-slate-700"
                  onClick={() => toggleSort("heuresTotales")}
                >
                  <span className="inline-flex items-center justify-end gap-1">
                    H. totales
                    <ArrowUpDown className={cn("h-3 w-3", sortField === "heuresTotales" ? "text-primary-500" : "text-slate-300")} />
                  </span>
                </th>
                <th
                  className="cursor-pointer px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-slate-500 hover:text-slate-700"
                  onClick={() => toggleSort("heuresNuit")}
                >
                  <span className="inline-flex items-center justify-end gap-1">
                    H. nuit
                    <ArrowUpDown className={cn("h-3 w-3", sortField === "heuresNuit" ? "text-primary-500" : "text-slate-300")} />
                  </span>
                </th>
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Paniers
                </th>
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Tarif/j
                </th>
                <th
                  className="cursor-pointer px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-slate-500 hover:text-slate-700"
                  onClick={() => toggleSort("montantPanier")}
                >
                  <span className="inline-flex items-center justify-end gap-1">
                    Montant
                    <ArrowUpDown className={cn("h-3 w-3", sortField === "montantPanier" ? "text-primary-500" : "text-slate-300")} />
                  </span>
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr
                  key={row.employeeId}
                  className="border-b border-slate-100 hover:bg-slate-50/50 transition-colors"
                >
                  <td className="px-4 py-3 font-mono text-xs text-slate-500">
                    {row.matricule}
                  </td>
                  <td className="px-4 py-3">
                    <Link
                      href={`/employes/${row.employeeId}`}
                      className="group inline-flex items-center gap-1 font-medium text-slate-900 hover:text-primary-600"
                    >
                      {row.nom} {row.prenom}
                      <ExternalLink className="h-3 w-3 opacity-0 transition-opacity group-hover:opacity-100" />
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-slate-600">{row.poste}</td>
                  <td className="px-4 py-3">
                    <span
                      className={cn(
                        "inline-block rounded-full px-2.5 py-0.5 text-xs font-medium",
                        categorieColors[row.categorie] ??
                          "bg-slate-100 text-slate-600",
                      )}
                    >
                      {row.categorie}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={cn(
                        "inline-block rounded-full px-2 py-0.5 text-xs font-medium",
                        contratColors[row.typeContrat] ?? "bg-slate-100 text-slate-600",
                      )}
                    >
                      {row.typeContrat}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right font-medium text-slate-700">
                    {row.joursTravailles}
                  </td>
                  <td className="px-4 py-3 text-right font-medium text-slate-700">
                    {row.heuresTotales > 0
                      ? `${row.heuresTotales.toFixed(1)}h`
                      : "—"}
                  </td>
                  <td
                    className={cn(
                      "px-4 py-3 text-right font-medium",
                      row.heuresNuit > 0
                        ? "text-indigo-600"
                        : "text-slate-300",
                    )}
                  >
                    {row.heuresNuit > 0
                      ? `${row.heuresNuit.toFixed(1)}h`
                      : "—"}
                  </td>
                  <td className="px-4 py-3 text-right text-slate-600">
                    {row.nbPanierRepas}
                  </td>
                  <td className="px-4 py-3 text-right text-slate-400">
                    {row.tarifPanier > 0
                      ? `${row.tarifPanier.toFixed(2)} €`
                      : "—"}
                  </td>
                  <td
                    className={cn(
                      "px-4 py-3 text-right font-bold",
                      row.montantPanier > 0
                        ? "text-amber-600"
                        : "text-slate-300",
                    )}
                  >
                    {row.montantPanier > 0
                      ? `${row.montantPanier.toFixed(2)} €`
                      : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
            {totals && (
              <tfoot>
                <tr className="bg-slate-50 font-bold">
                  <td colSpan={5} className="px-4 py-3 text-sm text-slate-700">
                    TOTAL ({rows.length} salarié{rows.length > 1 ? "s" : ""})
                  </td>
                  <td className="px-4 py-3 text-right text-slate-900">
                    {rows.reduce((s, r) => s + r.joursTravailles, 0)}
                  </td>
                  <td className="px-4 py-3 text-right text-slate-900">
                    {rows.reduce((s, r) => s + r.heuresTotales, 0).toFixed(1)}h
                  </td>
                  <td className="px-4 py-3 text-right text-indigo-600">
                    {rows.reduce((s, r) => s + r.heuresNuit, 0).toFixed(1)}h
                  </td>
                  <td className="px-4 py-3 text-right" />
                  <td className="px-4 py-3 text-right" />
                  <td className="px-4 py-3 text-right text-amber-600">
                    {rows.reduce((s, r) => s + r.montantPanier, 0).toFixed(2)} €
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        )}
      </div>
    </div>
  );
}
