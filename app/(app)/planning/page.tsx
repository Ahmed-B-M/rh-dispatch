"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { ChevronLeft, ChevronRight, Save, Calendar, Copy, ClipboardPaste } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  format,
  startOfWeek,
  endOfWeek,
  addWeeks,
  subWeeks,
  getISOWeek,
} from "date-fns";
import { fr } from "date-fns/locale";

interface PlanningCell {
  date: string;
  entryId: string | null;
  absenceCodeId: string | null;
  absenceCode: string | null;
  absenceColor: string | null;
  heureDebut: string | null;
  heureFin: string | null;
  heuresDecimales: number | null;
  vehicleId: string | null;
  vehicule: string | null;
  nbKm: number | null;
  typeRoute: string | null;
}

interface PlanningRow {
  employee: {
    id: string;
    matricule: string;
    nom: string;
    prenom: string;
    categorie: string;
    typeContrat: string;
    poste: string;
  };
  cells: PlanningCell[];
}

interface AbsenceCode {
  id: string;
  code: string;
  color: string;
}

interface Site {
  id: string;
  code: string;
  label: string;
}

interface PlanningData {
  from: string;
  to: string;
  days: string[];
  matrix: PlanningRow[];
}

const DAY_LABELS = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];

export default function PlanningPage() {
  const queryClient = useQueryClient();
  const [weekStart, setWeekStart] = useState(() =>
    startOfWeek(new Date(), { weekStartsOn: 1 }),
  );
  const [filterCategorie, setFilterCategorie] = useState("");
  const [filterSiteId, setFilterSiteId] = useState("");
  const [editingPopover, setEditingPopover] = useState<{
    employeeId: string;
    date: string;
    rect: { left: number; top: number };
  } | null>(null);
  const [popoverData, setPopoverData] = useState({
    absenceCodeId: "",
    heureDebut: "",
    heureFin: "",
  });
  const [clipboard, setClipboard] = useState<{
    absenceCodeId: string;
    heureDebut: string;
    heureFin: string;
  } | null>(null);

  const weekEnd = endOfWeek(weekStart, { weekStartsOn: 1 });
  const fromStr = format(weekStart, "yyyy-MM-dd");
  const toStr = format(weekEnd, "yyyy-MM-dd");
  const weekNum = getISOWeek(weekStart);

  const { data: absenceCodes = [] } = useQuery<AbsenceCode[]>({
    queryKey: ["absenceCodes"],
    queryFn: async () => {
      const res = await fetch("/api/absence-codes");
      if (!res.ok) throw new Error(`Erreur ${res.status}`);
      return res.json();
    },
  });

  const { data: sites = [] } = useQuery<Site[]>({
    queryKey: ["sites"],
    queryFn: async () => {
      const res = await fetch("/api/sites");
      if (!res.ok) throw new Error(`Erreur ${res.status}`);
      return res.json();
    },
  });

  const { data, isLoading } = useQuery<PlanningData>({
    queryKey: ["planning", fromStr, toStr, filterCategorie, filterSiteId],
    queryFn: async () => {
      const params = new URLSearchParams({ from: fromStr, to: toStr });
      if (filterCategorie) params.set("categorie", filterCategorie);
      if (filterSiteId) params.set("siteId", filterSiteId);
      const res = await fetch(`/api/planning?${params}`);
      if (!res.ok) throw new Error(`Erreur ${res.status}`);
      return res.json();
    },
  });

  const saveMutation = useMutation({
    mutationFn: async (entry: {
      employeeId: string;
      date: string;
      absenceCodeId: string | null;
      heureDebut: string | null;
      heureFin: string | null;
    }) => {
      const res = await fetch("/api/work-entries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(entry),
      });
      if (!res.ok) throw new Error("Erreur de sauvegarde");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["planning"] });
      queryClient.invalidateQueries({ queryKey: ["workEntries"] });
      setEditingPopover(null);
    },
  });

  function handleCellClick(
    employeeId: string,
    date: string,
    cell: PlanningCell,
    e: React.MouseEvent,
  ) {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();

    setPopoverData({
      absenceCodeId: cell.absenceCodeId ?? "",
      heureDebut: cell.heureDebut ?? "",
      heureFin: cell.heureFin ?? "",
    });

    setEditingPopover({
      employeeId,
      date,
      rect: {
        left: Math.min(rect.left, window.innerWidth - 280),
        top: rect.bottom + 4,
      },
    });
  }

  function handleSaveCell() {
    if (!editingPopover) return;
    saveMutation.mutate({
      employeeId: editingPopover.employeeId,
      date: editingPopover.date,
      absenceCodeId: popoverData.absenceCodeId || null,
      heureDebut: popoverData.heureDebut || null,
      heureFin: popoverData.heureFin || null,
    });
  }

  function goToday() {
    setWeekStart(startOfWeek(new Date(), { weekStartsOn: 1 }));
  }

  const weekLabel = `Semaine ${weekNum} — ${format(weekStart, "d MMM", { locale: fr })} au ${format(weekEnd, "d MMM yyyy", { locale: fr })}`;

  return (
    <div className="flex h-full flex-col space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900">Planning</h1>
        <div className="flex items-center gap-3">
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
                {site.code}
              </option>
            ))}
          </select>
        </div>
      </div>

      {clipboard && (
        <div className="flex items-center gap-2 rounded-lg border border-primary-200 bg-primary-50 px-3 py-2 text-xs text-primary-700">
          <ClipboardPaste className="h-3.5 w-3.5" />
          <span>
            Données copiées : {absenceCodes.find((ac) => ac.id === clipboard.absenceCodeId)?.code ?? "—"}
            {clipboard.heureDebut && ` · ${clipboard.heureDebut}–${clipboard.heureFin}`}
          </span>
          <button
            onClick={() => setClipboard(null)}
            className="ml-auto text-primary-500 hover:text-primary-700"
          >
            ✕
          </button>
        </div>
      )}

      {/* Week navigator */}
      <div className="flex items-center justify-center gap-4 rounded-xl border border-slate-200 bg-white p-3 shadow-soft">
        <button
          onClick={() => setWeekStart((w) => subWeeks(w, 1))}
          className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
        <span className="min-w-[320px] text-center text-base font-semibold text-slate-900">
          {weekLabel}
        </span>
        <button
          onClick={() => setWeekStart((w) => addWeeks(w, 1))}
          className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
        >
          <ChevronRight className="h-5 w-5" />
        </button>
        <button
          onClick={goToday}
          className="ml-2 inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
        >
          <Calendar className="h-3.5 w-3.5" />
          Aujourd&apos;hui
        </button>
      </div>

      {/* Weekly grid */}
      <div className="flex-1 overflow-auto rounded-xl border border-slate-200 bg-white shadow-soft">
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <p className="text-sm text-slate-400">Chargement du planning...</p>
          </div>
        ) : !data?.matrix?.length ? (
          <div className="flex items-center justify-center py-20">
            <p className="text-sm text-slate-400">
              Aucun employé pour cette sélection
            </p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="sticky top-0 z-10 bg-slate-50">
              <tr>
                <th className="sticky left-0 z-20 bg-slate-50 px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 min-w-[200px] border-r border-slate-200">
                  Employé
                </th>
                {data.days.map((day, i) => {
                  const d = new Date(day);
                  const isWeekend = d.getDay() === 0 || d.getDay() === 6;
                  const isToday =
                    format(d, "yyyy-MM-dd") === format(new Date(), "yyyy-MM-dd");
                  return (
                    <th
                      key={day}
                      className={cn(
                        "min-w-[130px] px-2 py-3 text-center border-r border-slate-100",
                        isWeekend
                          ? "bg-slate-100/80 text-slate-400"
                          : "text-slate-600",
                        isToday && "bg-primary-50",
                      )}
                    >
                      <div className="text-xs font-semibold uppercase">
                        {DAY_LABELS[i] ?? format(d, "EEE", { locale: fr })}
                      </div>
                      <div
                        className={cn(
                          "text-lg font-bold",
                          isToday && "text-primary-600",
                        )}
                      >
                        {d.getDate()}
                      </div>
                      <div className="text-[10px] font-normal text-slate-400">
                        {format(d, "MMM", { locale: fr })}
                      </div>
                    </th>
                  );
                })}
                <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider text-slate-500 min-w-[70px]">
                  Total
                </th>
              </tr>
            </thead>
            <tbody>
              {data.matrix.map((row) => {
                const totalHours = row.cells.reduce(
                  (sum, c) => sum + (c.heuresDecimales ?? 0),
                  0,
                );
                return (
                  <tr
                    key={row.employee.id}
                    className="border-b border-slate-100 hover:bg-slate-50/30"
                  >
                    <td className="sticky left-0 z-10 bg-white px-4 py-2 border-r border-slate-200">
                      <div className="font-medium text-slate-800">
                        {row.employee.nom} {row.employee.prenom}
                      </div>
                      <div className="text-[10px] text-slate-400">
                        {row.employee.poste} · {row.employee.matricule}
                      </div>
                    </td>
                    {row.cells.map((cell) => {
                      const d = new Date(cell.date);
                      const isWeekend =
                        d.getDay() === 0 || d.getDay() === 6;
                      const isToday =
                        format(d, "yyyy-MM-dd") ===
                        format(new Date(), "yyyy-MM-dd");
                      const hasData = cell.absenceCode || cell.heureDebut;
                      return (
                        <td
                          key={cell.date}
                          className={cn(
                            "relative cursor-pointer px-1 py-1.5 text-center transition-all border-r border-slate-100",
                            isWeekend && "bg-slate-50/80",
                            isToday && "bg-primary-50/40",
                            !hasData &&
                              "hover:bg-primary-50 hover:ring-1 hover:ring-inset hover:ring-primary-200",
                          )}
                          onClick={(e) =>
                            handleCellClick(
                              row.employee.id,
                              cell.date,
                              cell,
                              e,
                            )
                          }
                        >
                          {cell.absenceCode ? (
                            <div className="flex flex-col items-center gap-0.5">
                              <span
                                className="inline-block rounded-md px-2 py-1 text-[11px] font-semibold text-white leading-tight"
                                style={{
                                  backgroundColor:
                                    cell.absenceColor ?? "#94a3b8",
                                }}
                              >
                                {cell.absenceCode.length > 10
                                  ? cell.absenceCode.substring(0, 8) + "…"
                                  : cell.absenceCode}
                              </span>
                              {cell.heureDebut && cell.heureFin && (
                                <span className="text-[10px] text-slate-500">
                                  {cell.heureDebut}–{cell.heureFin}
                                </span>
                              )}
                              {cell.heuresDecimales != null &&
                                cell.heuresDecimales > 0 && (
                                  <span className="text-[10px] font-medium text-slate-600">
                                    {cell.heuresDecimales.toFixed(1)}h
                                  </span>
                                )}
                            </div>
                          ) : (
                            <div className="h-10 flex items-center justify-center">
                              <span className="text-slate-300 text-xs">—</span>
                            </div>
                          )}
                        </td>
                      );
                    })}
                    <td className="px-3 py-2 text-center">
                      <span
                        className={cn(
                          "text-sm font-bold",
                          totalHours > 0
                            ? "text-slate-800"
                            : "text-slate-300",
                        )}
                      >
                        {totalHours > 0 ? totalHours.toFixed(1) + "h" : "—"}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Edit popover */}
      {editingPopover && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setEditingPopover(null)}
          />
          <div
            className="fixed z-50 w-72 rounded-xl border border-slate-200 bg-white p-4 shadow-elevated animate-scale-in"
            style={{
              left: editingPopover.rect.left,
              top: editingPopover.rect.top,
            }}
          >
            <p className="mb-3 text-sm font-semibold text-slate-700">
              {format(new Date(editingPopover.date), "EEEE d MMMM yyyy", {
                locale: fr,
              })}
            </p>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium text-slate-500">
                  Statut / Absence
                </label>
                <select
                  value={popoverData.absenceCodeId}
                  onChange={(e) =>
                    setPopoverData((prev) => ({
                      ...prev,
                      absenceCodeId: e.target.value,
                    }))
                  }
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20"
                >
                  <option value="">— Aucun —</option>
                  {absenceCodes.map((ac) => (
                    <option key={ac.id} value={ac.id}>
                      {ac.code}
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-slate-500">
                    Début
                  </label>
                  <input
                    type="time"
                    value={popoverData.heureDebut}
                    onChange={(e) =>
                      setPopoverData((prev) => ({
                        ...prev,
                        heureDebut: e.target.value,
                      }))
                    }
                    className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-500">
                    Fin
                  </label>
                  <input
                    type="time"
                    value={popoverData.heureFin}
                    onChange={(e) =>
                      setPopoverData((prev) => ({
                        ...prev,
                        heureFin: e.target.value,
                      }))
                    }
                    className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20"
                  />
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    setClipboard({ ...popoverData });
                  }}
                  className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-slate-200 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50"
                >
                  <Copy className="h-3.5 w-3.5" />
                  Copier
                </button>
                {clipboard && (
                  <button
                    onClick={() => {
                      setPopoverData({ ...clipboard });
                    }}
                    className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-primary-200 bg-primary-50 py-2 text-xs font-medium text-primary-700 hover:bg-primary-100"
                  >
                    <ClipboardPaste className="h-3.5 w-3.5" />
                    Coller
                  </button>
                )}
              </div>
              <button
                onClick={handleSaveCell}
                disabled={saveMutation.isPending}
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary-600 py-2.5 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50"
              >
                <Save className="h-4 w-4" />
                {saveMutation.isPending ? "Sauvegarde..." : "Enregistrer"}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
