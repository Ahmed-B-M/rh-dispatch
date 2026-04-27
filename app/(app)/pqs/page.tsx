"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useMemo, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { PageHelp } from "@/components/ui/page-help";
import {
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Search,
  Save,
  CheckCircle2,
  Clock,
  Award,
  Users,
  BarChart3,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Criteria {
  id: string;
  label: string;
  amount: number;
  sortOrder: number;
}

interface EvaluationItem {
  criteriaId: string;
  achieved: boolean;
}

interface Evaluation {
  id: string;
  items: EvaluationItem[];
  validatedBy: string | null;
  comment: string | null;
}

interface PqsEmployee {
  employeeId: string;
  matricule: string;
  nom: string;
  prenom: string;
  poste: string;
  categorie: string;
  criteria: Criteria[];
  evaluation: Evaluation | null;
  totalAchieved: number;
  totalPossible: number;
}

interface PqsData {
  year: number;
  month: number;
  employees: PqsEmployee[];
}

interface Site {
  id: string;
  code: string;
  label: string;
}

interface PosteSavePayload {
  employeeId: string;
  year: number;
  month: number;
  items: EvaluationItem[];
  comment?: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const MONTHS = [
  "Janvier", "Février", "Mars", "Avril", "Mai", "Juin",
  "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre",
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function shortenLabel(label: string, max = 18): string {
  return label.length > max ? label.slice(0, max - 1) + "…" : label;
}

// ─── Page export ──────────────────────────────────────────────────────────────

export default function PqsPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center py-20">
          <p className="text-sm text-slate-400">Chargement...</p>
        </div>
      }
    >
      <PqsContent />
    </Suspense>
  );
}

// ─── Main content ─────────────────────────────────────────────────────────────

function PqsContent() {
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();

  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [filterCategorie, setFilterCategorie] = useState("");
  const [filterSiteId, setFilterSiteId] = useState("");
  const [search, setSearch] = useState(searchParams.get("search") ?? "");

  // Local edits: employeeId → criteriaId → achieved
  const [edits, setEdits] = useState<Record<string, Record<string, boolean>>>({});
  // Collapsed poste groups
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  // Rows currently being saved
  const [savingRows, setSavingRows] = useState<Set<string>>(new Set());

  // ── Sites query ──────────────────────────────────────────────────────────
  const { data: sites = [] } = useQuery<Site[]>({
    queryKey: ["sites"],
    queryFn: async () => {
      const res = await fetch("/api/sites");
      if (!res.ok) throw new Error(`Erreur ${res.status}`);
      return res.json();
    },
  });

  // ── PQS query ────────────────────────────────────────────────────────────
  const { data, isLoading } = useQuery<PqsData>({
    queryKey: ["pqs", year, month, filterCategorie, filterSiteId],
    queryFn: async () => {
      const params = new URLSearchParams({
        year: String(year),
        month: String(month),
      });
      if (filterCategorie) params.set("categorie", filterCategorie);
      if (filterSiteId) params.set("siteId", filterSiteId);
      const res = await fetch(`/api/pqs?${params}`);
      if (!res.ok) throw new Error(`Erreur ${res.status}`);
      return res.json();
    },
  });

  // ── Save mutation ─────────────────────────────────────────────────────────
  const saveMutation = useMutation({
    mutationFn: async (payload: PosteSavePayload) => {
      const res = await fetch("/api/pqs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error(`Erreur ${res.status}`);
      return res.json() as Promise<{ id: string; success: true }>;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pqs"] });
    },
  });

  // ── Month navigation ──────────────────────────────────────────────────────
  function prevMonth() {
    if (month === 1) {
      setMonth(12);
      setYear((y) => y - 1);
    } else {
      setMonth((m) => m - 1);
    }
    setEdits({});
  }

  function nextMonth() {
    if (month === 12) {
      setMonth(1);
      setYear((y) => y + 1);
    } else {
      setMonth((m) => m + 1);
    }
    setEdits({});
  }

  // ── Edit helpers ──────────────────────────────────────────────────────────
  function getChecked(emp: PqsEmployee, criteriaId: string): boolean {
    if (edits[emp.employeeId] !== undefined && edits[emp.employeeId][criteriaId] !== undefined) {
      return edits[emp.employeeId][criteriaId];
    }
    return emp.evaluation?.items.find((i) => i.criteriaId === criteriaId)?.achieved ?? false;
  }

  function toggleCheck(employeeId: string, criteriaId: string, current: boolean) {
    setEdits((prev) => ({
      ...prev,
      [employeeId]: {
        ...(prev[employeeId] ?? {}),
        [criteriaId]: !current,
      },
    }));
  }

  function isRowDirty(emp: PqsEmployee): boolean {
    if (!edits[emp.employeeId]) return false;
    return Object.keys(edits[emp.employeeId]).length > 0;
  }

  function computeTotal(emp: PqsEmployee): number {
    return emp.criteria.reduce((sum, c) => {
      return getChecked(emp, c.id) ? sum + c.amount : sum;
    }, 0);
  }

  // ── Save one row ──────────────────────────────────────────────────────────
  async function saveRow(emp: PqsEmployee) {
    setSavingRows((s) => new Set(s).add(emp.employeeId));
    try {
      const items: EvaluationItem[] = emp.criteria.map((c) => ({
        criteriaId: c.id,
        achieved: getChecked(emp, c.id),
      }));
      await saveMutation.mutateAsync({ employeeId: emp.employeeId, year, month, items });
      setEdits((prev) => {
        const next = { ...prev };
        delete next[emp.employeeId];
        return next;
      });
      toast.success(`PQS sauvegardé pour ${emp.prenom} ${emp.nom}`);
    } catch {
      toast.error(`Échec de la sauvegarde pour ${emp.prenom} ${emp.nom}`);
    } finally {
      setSavingRows((s) => {
        const next = new Set(s);
        next.delete(emp.employeeId);
        return next;
      });
    }
  }

  // ── Save all modified rows ────────────────────────────────────────────────
  async function saveAll() {
    const employees = data?.employees ?? [];
    const dirtyEmployees = employees.filter((emp) => isRowDirty(emp));
    if (dirtyEmployees.length === 0) {
      toast.info("Aucune modification à sauvegarder");
      return;
    }
    await Promise.allSettled(dirtyEmployees.map((emp) => saveRow(emp)));
    toast.success(`${dirtyEmployees.length} évaluation${dirtyEmployees.length > 1 ? "s" : ""} sauvegardée${dirtyEmployees.length > 1 ? "s" : ""}`);
  }

  // ── Derived data ──────────────────────────────────────────────────────────
  const allEmployees = data?.employees ?? [];

  const filteredEmployees = useMemo(() => {
    if (!search.trim()) return allEmployees;
    const q = search.toLowerCase();
    return allEmployees.filter(
      (e) =>
        e.nom.toLowerCase().includes(q) ||
        e.prenom.toLowerCase().includes(q) ||
        e.matricule.includes(q) ||
        e.poste.toLowerCase().includes(q),
    );
  }, [allEmployees, search]);

  // Group by poste
  const posteGroups = useMemo(() => {
    const map = new Map<string, PqsEmployee[]>();
    for (const emp of filteredEmployees) {
      if (!emp.criteria || emp.criteria.length === 0) continue; // skip poste with 0 criteria
      const list = map.get(emp.poste) ?? [];
      list.push(emp);
      map.set(emp.poste, list);
    }
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b, "fr"));
  }, [filteredEmployees]);

  // Summary stats
  const totalValidated = allEmployees.filter((e) => e.evaluation !== null).length;
  const totalPqsAmount = allEmployees.reduce((sum, e) => sum + e.totalAchieved, 0);
  const tauxValidation =
    allEmployees.length > 0 ? Math.round((totalValidated / allEmployees.length) * 100) : 0;

  const dirtyCount = Object.keys(edits).length;

  // ── Toggle poste group ────────────────────────────────────────────────────
  function togglePoste(poste: string) {
    setCollapsed((prev) => ({ ...prev, [poste]: !prev[poste] }));
  }

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="flex h-full flex-col space-y-4">
      {/* ── Header ── */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-2">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">
              PQS — Prime Qualité de Service
            </h1>
            <p className="text-sm text-slate-500">
              Évaluation mensuelle des critères qualité —{" "}
              {filteredEmployees.length}
              {search ? ` / ${allEmployees.length}` : ""} employé
              {filteredEmployees.length !== 1 ? "s" : ""}
            </p>
          </div>
          <PageHelp
            title="Prime Qualité de Service (PQS)"
            description="Évaluez chaque mois les critères qualité par salarié et calculez leur prime mensuelle."
            sections={[
              {
                title: "Fonctionnement",
                items: [
                  "Chaque poste dispose de critères spécifiques avec un montant associé.",
                  "Cochez les critères atteints pour chaque employé.",
                  "Le total PQS est la somme des montants des critères cochés.",
                  "Cliquez « Sauvegarder » sur une ligne pour valider l'évaluation.",
                ],
              },
              {
                title: "Groupement par poste",
                items: [
                  "Les employés sont regroupés par poste car chaque poste a ses propres critères.",
                  "Cliquez sur l'en-tête d'un groupe pour le replier ou le déplier.",
                  "Le montant maximum affiché correspond à la somme de tous les critères du poste.",
                ],
              },
              {
                title: "Filtres et navigation",
                items: [
                  "Naviguez entre les mois avec les flèches ← →.",
                  "Filtrez par catégorie, site ou recherche libre.",
                  "Le bouton « Tout valider » sauvegarde toutes les lignes modifiées en une fois.",
                ],
              },
            ]}
          />
        </div>
        <div className="flex items-center gap-2">
          {dirtyCount > 0 && (
            <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-medium text-amber-700">
              {dirtyCount} modification{dirtyCount > 1 ? "s" : ""} non sauvegardée{dirtyCount > 1 ? "s" : ""}
            </span>
          )}
          <button
            onClick={saveAll}
            disabled={dirtyCount === 0}
            className={cn(
              "inline-flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition-colors",
              dirtyCount > 0
                ? "bg-primary-600 text-white hover:bg-primary-700"
                : "cursor-not-allowed bg-slate-100 text-slate-400",
            )}
          >
            <Save className="h-4 w-4" />
            Tout valider
          </button>
        </div>
      </div>

      {/* ── Month navigator + filters ── */}
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

      {/* ── Summary cards ── */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-soft">
          <div className="rounded-lg bg-emerald-50 p-2 text-emerald-600">
            <Award className="h-5 w-5" />
          </div>
          <div>
            <p className="text-xs text-slate-400">Total PQS validé</p>
            <p className="text-lg font-bold text-slate-900">
              {totalPqsAmount.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-soft">
          <div className="rounded-lg bg-primary-50 p-2 text-primary-600">
            <Users className="h-5 w-5" />
          </div>
          <div>
            <p className="text-xs text-slate-400">Employés évalués</p>
            <p className="text-lg font-bold text-slate-900">
              {totalValidated}
              <span className="ml-1 text-sm font-normal text-slate-400">
                / {allEmployees.length}
              </span>
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-soft">
          <div className="rounded-lg bg-sky-50 p-2 text-sky-600">
            <BarChart3 className="h-5 w-5" />
          </div>
          <div>
            <p className="text-xs text-slate-400">Taux de validation</p>
            <p className="text-lg font-bold text-slate-900">{tauxValidation} %</p>
          </div>
        </div>
      </div>

      {/* ── Main content ── */}
      <div className="flex-1 space-y-4 overflow-auto pb-4">
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <p className="text-sm text-slate-400">Chargement des évaluations PQS...</p>
          </div>
        ) : posteGroups.length === 0 ? (
          <div className="flex items-center justify-center rounded-xl border border-slate-200 bg-white py-20 shadow-soft">
            <p className="text-sm text-slate-400">Aucun employé avec des critères PQS pour ce mois</p>
          </div>
        ) : (
          posteGroups.map(([poste, employees]) => (
            <PosteGroup
              key={poste}
              poste={poste}
              employees={employees}
              year={year}
              month={month}
              collapsed={!!collapsed[poste]}
              savingRows={savingRows}
              getChecked={getChecked}
              toggleCheck={toggleCheck}
              isRowDirty={isRowDirty}
              computeTotal={computeTotal}
              saveRow={saveRow}
              onToggleCollapse={() => togglePoste(poste)}
            />
          ))
        )}
      </div>
    </div>
  );
}

// ─── PosteGroup component ──────────────────────────────────────────────────────

interface PosteGroupProps {
  poste: string;
  employees: PqsEmployee[];
  year: number;
  month: number;
  collapsed: boolean;
  savingRows: Set<string>;
  getChecked: (emp: PqsEmployee, criteriaId: string) => boolean;
  toggleCheck: (employeeId: string, criteriaId: string, current: boolean) => void;
  isRowDirty: (emp: PqsEmployee) => boolean;
  computeTotal: (emp: PqsEmployee) => number;
  saveRow: (emp: PqsEmployee) => Promise<void>;
  onToggleCollapse: () => void;
}

function PosteGroup({
  poste,
  employees,
  collapsed,
  savingRows,
  getChecked,
  toggleCheck,
  isRowDirty,
  computeTotal,
  saveRow,
  onToggleCollapse,
}: PosteGroupProps) {
  // All employees in this group share the same criteria set (same poste)
  const criteria = employees[0]?.criteria ?? [];
  if (criteria.length === 0) return null;

  const sortedCriteria = [...criteria].sort((a, b) => a.sortOrder - b.sortOrder);
  const maxPqs = sortedCriteria.reduce((s, c) => s + c.amount, 0);

  const validatedCount = employees.filter((e) => e.evaluation !== null).length;
  const dirtyCount = employees.filter(isRowDirty).length;

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-soft">
      {/* Group header */}
      <button
        onClick={onToggleCollapse}
        className="flex w-full items-center justify-between bg-slate-50 px-4 py-3 text-left transition-colors hover:bg-slate-100"
      >
        <div className="flex items-center gap-3">
          {collapsed ? (
            <ChevronDown className="h-4 w-4 flex-shrink-0 text-slate-400" />
          ) : (
            <ChevronUp className="h-4 w-4 flex-shrink-0 text-slate-400" />
          )}
          <span className="font-semibold text-slate-800">{poste}</span>
          <span className="rounded-full bg-slate-200 px-2 py-0.5 text-xs font-medium text-slate-600">
            {employees.length} employé{employees.length !== 1 ? "s" : ""}
          </span>
          <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700">
            Max {maxPqs.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €
          </span>
          {validatedCount > 0 && (
            <span className="rounded-full bg-primary-100 px-2 py-0.5 text-xs font-medium text-primary-700">
              {validatedCount}/{employees.length} validé{validatedCount !== 1 ? "s" : ""}
            </span>
          )}
          {dirtyCount > 0 && (
            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">
              {dirtyCount} modifié{dirtyCount !== 1 ? "s" : ""}
            </span>
          )}
        </div>
      </button>

      {/* Table */}
      {!collapsed && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50/70">
              <tr>
                <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Matricule
                </th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Nom Prénom
                </th>
                {sortedCriteria.map((c) => (
                  <th
                    key={c.id}
                    className="px-3 py-2.5 text-center text-xs font-semibold uppercase tracking-wider text-slate-500"
                    title={`${c.label} — ${c.amount.toFixed(2)} €`}
                  >
                    <span className="block max-w-[90px] truncate" title={c.label}>
                      {shortenLabel(c.label)}
                    </span>
                    <span className="mt-0.5 block text-[10px] font-normal normal-case tracking-normal text-slate-400">
                      {c.amount.toFixed(2)} €
                    </span>
                  </th>
                ))}
                <th className="px-4 py-2.5 text-right text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Total
                </th>
                <th className="px-4 py-2.5 text-center text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Statut
                </th>
                <th className="px-4 py-2.5 text-right text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Action
                </th>
              </tr>
            </thead>
            <tbody>
              {employees.map((emp) => {
                const total = computeTotal(emp);
                const dirty = isRowDirty(emp);
                const saving = savingRows.has(emp.employeeId);
                const validated = emp.evaluation !== null && !dirty;

                return (
                  <tr
                    key={emp.employeeId}
                    className={cn(
                      "border-t border-slate-100 transition-colors",
                      dirty ? "bg-amber-50/40" : "hover:bg-slate-50/50",
                    )}
                  >
                    {/* Matricule */}
                    <td className="px-4 py-3 font-mono text-xs text-slate-500">
                      {emp.matricule}
                    </td>

                    {/* Nom Prénom */}
                    <td className="whitespace-nowrap px-4 py-3 font-medium text-slate-900">
                      {emp.nom} {emp.prenom}
                    </td>

                    {/* Criteria checkboxes */}
                    {sortedCriteria.map((c) => {
                      const checked = getChecked(emp, c.id);
                      return (
                        <td key={c.id} className="px-3 py-3 text-center">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggleCheck(emp.employeeId, c.id, checked)}
                            className="h-4 w-4 cursor-pointer rounded accent-primary-600"
                            title={`${c.label} — ${c.amount.toFixed(2)} €`}
                          />
                        </td>
                      );
                    })}

                    {/* Total */}
                    <td className="whitespace-nowrap px-4 py-3 text-right">
                      <span
                        className={cn(
                          "font-bold",
                          total > 0 ? "text-emerald-600" : "text-slate-300",
                        )}
                      >
                        {total > 0
                          ? `${total.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`
                          : "—"}
                      </span>
                    </td>

                    {/* Statut */}
                    <td className="px-4 py-3 text-center">
                      {dirty ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-700">
                          <Clock className="h-3 w-3" />
                          Modifié
                        </span>
                      ) : validated ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-medium text-emerald-700">
                          <CheckCircle2 className="h-3 w-3" />
                          Validé
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-500">
                          <Clock className="h-3 w-3" />
                          En attente
                        </span>
                      )}
                    </td>

                    {/* Action */}
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => saveRow(emp)}
                        disabled={saving || (!dirty && emp.evaluation !== null)}
                        className={cn(
                          "inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors",
                          saving
                            ? "cursor-wait bg-slate-100 text-slate-400"
                            : dirty
                              ? "bg-primary-600 text-white hover:bg-primary-700"
                              : emp.evaluation === null
                                ? "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                                : "cursor-default bg-emerald-50 text-emerald-600",
                        )}
                      >
                        {saving ? (
                          <>
                            <Loader2 className="h-3 w-3 animate-spin" />
                            Sauvegarde…
                          </>
                        ) : emp.evaluation !== null && !dirty ? (
                          <>
                            <CheckCircle2 className="h-3 w-3" />
                            Validé
                          </>
                        ) : (
                          <>
                            <Save className="h-3 w-3" />
                            Sauvegarder
                          </>
                        )}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
            {/* Group footer with totals */}
            <tfoot>
              <tr className="border-t border-slate-200 bg-slate-50 font-semibold">
                <td colSpan={2 + sortedCriteria.length} className="px-4 py-2.5 text-xs text-slate-500">
                  TOTAL GROUPE ({employees.length} employé{employees.length !== 1 ? "s" : ""})
                </td>
                <td className="px-4 py-2.5 text-right">
                  <span className="font-bold text-emerald-700">
                    {employees
                      .reduce((sum, emp) => sum + computeTotal(emp), 0)
                      .toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}{" "}
                    €
                  </span>
                </td>
                <td colSpan={2} />
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  );
}
