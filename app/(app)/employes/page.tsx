"use client";

import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import Link from "next/link";
import { Plus, Search, Filter } from "lucide-react";
import { cn, formatDate } from "@/lib/utils";
import { useSession } from "next-auth/react";

interface Employee {
  id: string;
  matricule: string;
  nom: string;
  prenom: string;
  typeContrat: string;
  categorie: string;
  poste: string;
  isActive: boolean;
  dateEntree: string;
  dateSortie: string | null;
  sites: { site: { code: string; label: string } }[];
}

export default function EmployesPage() {
  const { data: session } = useSession();
  const canManage = session?.user?.role === "ADMIN" || session?.user?.role === "RESPONSABLE";
  const [search, setSearch] = useState("");
  const [showInactive, setShowInactive] = useState(false);
  const [filterCategorie, setFilterCategorie] = useState<string>("");
  const [filterSiteId, setFilterSiteId] = useState<string>("");

  const { data: sites = [] } = useQuery<{ id: string; code: string; label: string }[]>({
    queryKey: ["sites"],
    queryFn: async () => {
      const res = await fetch("/api/sites");
      if (!res.ok) throw new Error(`Erreur ${res.status}`);
      return res.json();
    },
  });

  const { data: employees = [], isLoading } = useQuery<Employee[]>({
    queryKey: ["employees", search, showInactive, filterCategorie, filterSiteId],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      if (!showInactive) params.set("active", "true");
      if (filterCategorie) params.set("categorie", filterCategorie);
      if (filterSiteId) params.set("siteId", filterSiteId);
      const res = await fetch(`/api/employees?${params}`);
      if (!res.ok) throw new Error(`Erreur ${res.status}`);
      return res.json();
    },
  });

  const categorieColors: Record<string, string> = {
    SEDENTAIRE: "bg-purple-100 text-purple-700",
    TRANSPORT: "bg-blue-100 text-blue-700",
    LOGISTIQUE: "bg-emerald-100 text-emerald-700",
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Employés</h1>
          <p className="text-sm text-slate-500">{employees.length} employé(s) trouvé(s)</p>
        </div>
        {canManage && (
          <Link
            href="/employes/nouveau"
            className="inline-flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-primary-700"
          >
            <Plus className="h-4 w-4" />
            Ajouter
          </Link>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[250px]">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Rechercher par nom, prénom ou matricule..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-lg border border-slate-200 py-2 pl-10 pr-4 text-sm outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20"
          />
        </div>

        <select
          value={filterCategorie}
          onChange={(e) => setFilterCategorie(e.target.value)}
          className="rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-primary-500"
        >
          <option value="">Toutes catégories</option>
          <option value="SEDENTAIRE">Sédentaire</option>
          <option value="TRANSPORT">Transport</option>
          <option value="LOGISTIQUE">Logistique</option>
        </select>

        <select
          value={filterSiteId}
          onChange={(e) => setFilterSiteId(e.target.value)}
          className="rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-primary-500"
        >
          <option value="">Tous les sites</option>
          {sites.map((site) => (
            <option key={site.id} value={site.id}>
              {site.code} — {site.label}
            </option>
          ))}
        </select>

        <label className="flex items-center gap-2 text-sm text-slate-600">
          <input
            type="checkbox"
            checked={showInactive}
            onChange={(e) => setShowInactive(e.target.checked)}
            className="rounded border-slate-300"
          />
          Inclure inactifs
        </label>
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-soft">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50">
              <th className="px-4 py-3 text-left font-medium text-slate-500">Matricule</th>
              <th className="px-4 py-3 text-left font-medium text-slate-500">Nom Prénom</th>
              <th className="px-4 py-3 text-left font-medium text-slate-500">Catégorie</th>
              <th className="px-4 py-3 text-left font-medium text-slate-500">Contrat</th>
              <th className="px-4 py-3 text-left font-medium text-slate-500">Poste</th>
              <th className="px-4 py-3 text-left font-medium text-slate-500">Sites</th>
              <th className="px-4 py-3 text-left font-medium text-slate-500">Entrée</th>
              <th className="px-4 py-3 text-left font-medium text-slate-500">Statut</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={8} className="px-4 py-12 text-center text-slate-400">
                  Chargement...
                </td>
              </tr>
            ) : employees.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-12 text-center text-slate-400">
                  Aucun employé trouvé
                </td>
              </tr>
            ) : (
              employees.map((emp) => (
                <tr
                  key={emp.id}
                  className="border-b border-slate-100 hover:bg-slate-50 transition-colors"
                >
                  <td className="px-4 py-3 font-mono text-xs text-slate-500">{emp.matricule}</td>
                  <td className="px-4 py-3">
                    <Link
                      href={`/employes/${emp.id}`}
                      className="font-medium text-slate-900 hover:text-primary-600"
                    >
                      {emp.nom} {emp.prenom}
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={cn(
                        "inline-block rounded-full px-2.5 py-0.5 text-xs font-medium",
                        categorieColors[emp.categorie] ?? "bg-slate-100 text-slate-600",
                      )}
                    >
                      {emp.categorie}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-600">{emp.typeContrat}</td>
                  <td className="px-4 py-3 text-slate-600">{emp.poste}</td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {emp.sites.map((s) => (
                        <span
                          key={s.site.code}
                          className="rounded bg-slate-100 px-1.5 py-0.5 text-xs text-slate-600"
                        >
                          {s.site.code}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-slate-500 text-xs">
                    {formatDate(emp.dateEntree)}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={cn(
                        "inline-block rounded-full px-2 py-0.5 text-xs font-medium",
                        emp.isActive
                          ? "bg-emerald-100 text-emerald-700"
                          : "bg-red-100 text-red-700",
                      )}
                    >
                      {emp.isActive ? "Actif" : "Sorti"}
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
