"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useCallback, useRef } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { Download, Search, Filter, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";
import { format, startOfMonth, endOfMonth } from "date-fns";
import { fr } from "date-fns/locale";

interface WorkEntryRow {
  id: string;
  weekNumber: number;
  date: string;
  dayName: string;
  affectation: string | null;
  typeContrat: string;
  matricule: string;
  nomConducteur: string;
  motifAbsence: string | null;
  absenceColor: string | null;
  posteOccupe: string | null;
  heureDebut: string | null;
  heureFin: string | null;
  tempsTravail: string | null;
  heuresDecimales: number | null;
  vehicule: string | null;
  typeRoute: string | null;
  nbKm: number | null;
}

interface AbsenceCode {
  id: string;
  code: string;
  color: string;
}

const COLUMNS = [
  { key: "weekNumber", label: "Sem.", width: 55 },
  { key: "date", label: "Jour", width: 100 },
  { key: "dayName", label: "Type jour", width: 85 },
  { key: "affectation", label: "Affectation", width: 120 },
  { key: "typeContrat", label: "Contrat", width: 80 },
  { key: "matricule", label: "Matricule", width: 90 },
  { key: "nomConducteur", label: "Nom conducteur", width: 180 },
  { key: "motifAbsence", label: "Motif_Absence", width: 160 },
  { key: "posteOccupe", label: "Poste occupé", width: 140 },
  { key: "heureDebut", label: "Début", width: 70 },
  { key: "heureFin", label: "Fin", width: 70 },
  { key: "tempsTravail", label: "Temps travail", width: 100 },
  { key: "heuresDecimales", label: "H. décimales", width: 95 },
  { key: "vehicule", label: "Véhicule", width: 100 },
  { key: "typeRoute", label: "Type route", width: 100 },
  { key: "nbKm", label: "Nb km", width: 70 },
] as const;

export default function SynthesePage() {
  const queryClient = useQueryClient();
  const parentRef = useRef<HTMLDivElement>(null);

  const now = new Date();
  const [dateFrom, setDateFrom] = useState(format(startOfMonth(now), "yyyy-MM-dd"));
  const [dateTo, setDateTo] = useState(format(endOfMonth(now), "yyyy-MM-dd"));
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [editingCell, setEditingCell] = useState<{ id: string; field: string } | null>(null);
  const [editValue, setEditValue] = useState("");

  const { data: absenceCodes = [] } = useQuery<AbsenceCode[]>({
    queryKey: ["absenceCodes"],
    queryFn: async () => {
      const res = await fetch("/api/absence-codes");
      return res.json();
    },
  });

  const { data, isLoading, isFetching } = useQuery<{
    rows: WorkEntryRow[];
    total: number;
    page: number;
    limit: number;
  }>({
    queryKey: ["workEntries", dateFrom, dateTo, search, page],
    queryFn: async () => {
      const params = new URLSearchParams({
        from: dateFrom,
        to: dateTo,
        page: String(page),
        limit: "1000",
      });
      if (search) params.set("search", search);
      const res = await fetch(`/api/work-entries?${params}`);
      return res.json();
    },
  });

  const rows = data?.rows ?? [];
  const total = data?.total ?? 0;

  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 36,
    overscan: 20,
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, field, value }: { id: string; field: string; value: string }) => {
      const body: Record<string, unknown> = {};
      if (field === "heureDebut" || field === "heureFin") {
        body[field] = value || null;
      } else if (field === "nbKm") {
        body[field] = value ? parseFloat(value) : null;
      } else if (field === "motifAbsence") {
        const ac = absenceCodes.find((c) => c.code === value);
        body.absenceCodeId = ac?.id ?? null;
      } else {
        body[field] = value || null;
      }
      const res = await fetch(`/api/work-entries/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error("Erreur de mise à jour");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["workEntries"] });
    },
  });

  const handleCellClick = useCallback(
    (id: string, field: string, currentValue: string | number | null) => {
      const editableFields = [
        "heureDebut", "heureFin", "motifAbsence", "affectation",
        "vehicule", "typeRoute", "nbKm",
      ];
      if (!editableFields.includes(field)) return;
      setEditingCell({ id, field });
      setEditValue(currentValue != null ? String(currentValue) : "");
    },
    [],
  );

  const handleCellBlur = useCallback(() => {
    if (editingCell) {
      updateMutation.mutate({
        id: editingCell.id,
        field: editingCell.field,
        value: editValue,
      });
      setEditingCell(null);
    }
  }, [editingCell, editValue, updateMutation]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter") handleCellBlur();
      if (e.key === "Escape") setEditingCell(null);
    },
    [handleCellBlur],
  );

  async function handleExport() {
    const params = new URLSearchParams({ from: dateFrom, to: dateTo, format: "synthesis" });
    if (search) params.set("search", search);
    window.location.href = `/api/export?${params}`;
  }

  const totalWidth = COLUMNS.reduce((sum, col) => sum + col.width, 0);

  return (
    <div className="flex h-full flex-col space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Synthèse</h1>
          <p className="text-sm text-slate-500">
            {total.toLocaleString("fr-FR")} entrée(s) — {rows.length} affichée(s)
          </p>
        </div>
        <button
          onClick={handleExport}
          className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-emerald-700"
        >
          <Download className="h-4 w-4" />
          Exporter Excel
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-soft">
        <div className="flex items-center gap-2">
          <label className="text-xs font-medium text-slate-500">Du</label>
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => { setDateFrom(e.target.value); setPage(1); }}
            className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm outline-none focus:border-primary-500"
          />
        </div>
        <div className="flex items-center gap-2">
          <label className="text-xs font-medium text-slate-500">Au</label>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => { setDateTo(e.target.value); setPage(1); }}
            className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm outline-none focus:border-primary-500"
          />
        </div>
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Rechercher..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="w-full rounded-lg border border-slate-200 py-1.5 pl-9 pr-3 text-sm outline-none focus:border-primary-500"
          />
        </div>
        {isFetching && <RefreshCw className="h-4 w-4 animate-spin text-primary-500" />}
      </div>

      {/* Virtualized Table */}
      <div className="flex-1 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-soft">
        {/* Header */}
        <div className="overflow-x-auto border-b border-slate-200 bg-slate-50">
          <div className="flex" style={{ minWidth: totalWidth }}>
            {COLUMNS.map((col) => (
              <div
                key={col.key}
                className="shrink-0 px-3 py-2.5 text-xs font-semibold uppercase tracking-wider text-slate-500"
                style={{ width: col.width }}
              >
                {col.label}
              </div>
            ))}
          </div>
        </div>

        {/* Rows */}
        <div ref={parentRef} className="overflow-auto" style={{ height: "calc(100vh - 320px)" }}>
          <div
            style={{
              height: `${virtualizer.getTotalSize()}px`,
              width: totalWidth,
              position: "relative",
            }}
          >
            {isLoading ? (
              <div className="flex items-center justify-center py-20">
                <p className="text-sm text-slate-400">Chargement des données...</p>
              </div>
            ) : rows.length === 0 ? (
              <div className="flex items-center justify-center py-20">
                <p className="text-sm text-slate-400">Aucune donnée pour cette période</p>
              </div>
            ) : (
              virtualizer.getVirtualItems().map((virtualRow) => {
                const row = rows[virtualRow.index];
                return (
                  <div
                    key={row.id}
                    className="absolute left-0 top-0 flex w-full border-b border-slate-50 hover:bg-slate-50/50"
                    style={{
                      height: virtualRow.size,
                      transform: `translateY(${virtualRow.start}px)`,
                    }}
                  >
                    {COLUMNS.map((col) => {
                      const value = row[col.key as keyof WorkEntryRow];
                      const isEditing =
                        editingCell?.id === row.id && editingCell?.field === col.key;

                      return (
                        <div
                          key={col.key}
                          className={cn(
                            "flex shrink-0 items-center px-3 text-xs",
                            [
                              "heureDebut", "heureFin", "motifAbsence",
                              "affectation", "vehicule", "typeRoute", "nbKm",
                            ].includes(col.key) && "cursor-pointer hover:bg-primary-50/50",
                          )}
                          style={{ width: col.width }}
                          onClick={() => handleCellClick(row.id, col.key, value)}
                        >
                          {isEditing ? (
                            col.key === "motifAbsence" ? (
                              <select
                                autoFocus
                                value={editValue}
                                onChange={(e) => setEditValue(e.target.value)}
                                onBlur={handleCellBlur}
                                onKeyDown={handleKeyDown}
                                className="w-full rounded border border-primary-400 px-1 py-0.5 text-xs outline-none"
                              >
                                <option value="">—</option>
                                {absenceCodes.map((ac) => (
                                  <option key={ac.id} value={ac.code}>
                                    {ac.code}
                                  </option>
                                ))}
                              </select>
                            ) : (
                              <input
                                autoFocus
                                type={col.key === "nbKm" ? "number" : "text"}
                                value={editValue}
                                onChange={(e) => setEditValue(e.target.value)}
                                onBlur={handleCellBlur}
                                onKeyDown={handleKeyDown}
                                className="w-full rounded border border-primary-400 px-1 py-0.5 text-xs outline-none"
                              />
                            )
                          ) : col.key === "motifAbsence" && value ? (
                            <span
                              className="truncate rounded px-1.5 py-0.5 text-[10px] font-medium text-white"
                              style={{ backgroundColor: row.absenceColor ?? "#94a3b8" }}
                            >
                              {String(value)}
                            </span>
                          ) : col.key === "date" && value ? (
                            <span className="text-slate-600">
                              {format(new Date(value as string), "dd/MM/yyyy")}
                            </span>
                          ) : (
                            <span className="truncate text-slate-600">
                              {value != null ? String(value) : ""}
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* Pagination */}
      {total > 1000 && (
        <div className="flex items-center justify-between text-sm text-slate-500">
          <span>
            Page {page} sur {Math.ceil(total / 1000)}
          </span>
          <div className="flex gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs disabled:opacity-50"
            >
              Précédent
            </button>
            <button
              onClick={() => setPage((p) => p + 1)}
              disabled={page * 1000 >= total}
              className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs disabled:opacity-50"
            >
              Suivant
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
