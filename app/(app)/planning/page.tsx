"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Save,
  Calendar,
  Copy,
  ClipboardPaste,
  Users,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  format,
  startOfWeek,
  endOfWeek,
  addWeeks,
  subWeeks,
  getISOWeek,
  eachDayOfInterval,
  isWeekend as isWeekendDay,
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

interface PosteConfig {
  id: string;
  label: string;
  mealAllowance: number;
}

interface PlanningData {
  from: string;
  to: string;
  days: string[];
  matrix: PlanningRow[];
}

const WEEKEND_INCLUSIVE_CODES = new Set([
  "Paternité",
  "Accident travail",
  "Maladie",
  "Mal. professionnelle",
  "Congés naissance",
  "Accident Trajet",
  "Mise à pied",
]);

const DAY_LABELS = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];

export default function PlanningPage() {
  const queryClient = useQueryClient();
  const [weekStart, setWeekStart] = useState(() =>
    startOfWeek(new Date(), { weekStartsOn: 1 }),
  );
  const [filterCategorie, setFilterCategorie] = useState("");
  const [filterSiteId, setFilterSiteId] = useState("");
  const [filterPoste, setFilterPoste] = useState("");
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
  const [selectedCells, setSelectedCells] = useState<Set<string>>(new Set());
  const [showBulkDialog, setShowBulkDialog] = useState(false);
  const [bulkData, setBulkData] = useState({
    employeeIds: [] as string[],
    absenceCodeId: "",
    heureDebut: "",
    heureFin: "",
    dateFrom: "",
    dateTo: "",
    allEmployees: true,
  });

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

  const { data: postes = [] } = useQuery<PosteConfig[]>({
    queryKey: ["postes"],
    queryFn: async () => {
      const res = await fetch("/api/postes");
      if (!res.ok) throw new Error(`Erreur ${res.status}`);
      return res.json();
    },
  });

  const { data, isLoading } = useQuery<PlanningData>({
    queryKey: ["planning", fromStr, toStr, filterCategorie, filterSiteId, filterPoste],
    queryFn: async () => {
      const params = new URLSearchParams({ from: fromStr, to: toStr });
      if (filterCategorie) params.set("categorie", filterCategorie);
      if (filterSiteId) params.set("siteId", filterSiteId);
      if (filterPoste) params.set("poste", filterPoste);
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
      toast.success("Cellule enregistrée");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const bulkPasteMutation = useMutation({
    mutationFn: async () => {
      if (!clipboard || selectedCells.size === 0) return;
      const entries = [...selectedCells].map((key) => {
        const sep = key.indexOf("_");
        return {
          employeeId: key.slice(0, sep),
          date: key.slice(sep + 1),
          absenceCodeId: clipboard.absenceCodeId || null,
          heureDebut: clipboard.heureDebut || null,
          heureFin: clipboard.heureFin || null,
        };
      });
      const res = await fetch("/api/work-entries/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entries }),
      });
      if (!res.ok) throw new Error("Erreur de sauvegarde en masse");
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["planning"] });
      queryClient.invalidateQueries({ queryKey: ["workEntries"] });
      setSelectedCells(new Set());
      toast.success(`Collé sur ${data?.total ?? selectedCells.size} cellule(s)`);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const bulkAbsenceMutation = useMutation({
    mutationFn: async () => {
      const absenceCode = absenceCodes.find(
        (ac) => ac.id === bulkData.absenceCodeId,
      );
      const reposCode = absenceCodes.find((ac) => ac.code === "Repos");
      const weekendInclusive =
        absenceCode != null && WEEKEND_INCLUSIVE_CODES.has(absenceCode.code);

      const days = eachDayOfInterval({
        start: new Date(bulkData.dateFrom),
        end: new Date(bulkData.dateTo),
      });

      const targetIds = bulkData.allEmployees
        ? (data?.matrix ?? []).map((r) => r.employee.id)
        : bulkData.employeeIds;

      const entries: {
        employeeId: string;
        date: string;
        absenceCodeId: string | null;
        heureDebut: string | null;
        heureFin: string | null;
      }[] = [];

      for (const empId of targetIds) {
        for (const day of days) {
          const isWe = isWeekendDay(day);
          if (isWe && !weekendInclusive) {
            entries.push({
              employeeId: empId,
              date: format(day, "yyyy-MM-dd"),
              absenceCodeId: reposCode?.id ?? null,
              heureDebut: null,
              heureFin: null,
            });
          } else {
            entries.push({
              employeeId: empId,
              date: format(day, "yyyy-MM-dd"),
              absenceCodeId: bulkData.absenceCodeId || null,
              heureDebut: bulkData.heureDebut || null,
              heureFin: bulkData.heureFin || null,
            });
          }
        }
      }

      const res = await fetch("/api/work-entries/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entries }),
      });
      if (!res.ok) throw new Error("Erreur de sauvegarde en masse");
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["planning"] });
      queryClient.invalidateQueries({ queryKey: ["workEntries"] });
      toast.success(`${data?.total ?? 0} entrée(s) appliquée(s)`);
      setShowBulkDialog(false);
      setBulkData({
        employeeIds: [],
        absenceCodeId: "",
        heureDebut: "",
        heureFin: "",
        dateFrom: "",
        dateTo: "",
        allEmployees: true,
      });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  function handleCellClick(
    employeeId: string,
    date: string,
    cell: PlanningCell,
    e: React.MouseEvent,
  ) {
    const key = `${employeeId}_${date}`;

    if (e.ctrlKey || e.metaKey) {
      setSelectedCells((prev) => {
        const next = new Set(prev);
        if (next.has(key)) next.delete(key);
        else next.add(key);
        return next;
      });
      return;
    }

    if (selectedCells.size > 0) {
      setSelectedCells(new Set());
    }

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

  function toggleEmployeeSelection(empId: string) {
    setBulkData((prev) => {
      const ids = prev.employeeIds.includes(empId)
        ? prev.employeeIds.filter((id) => id !== empId)
        : [...prev.employeeIds, empId];
      return { ...prev, employeeIds: ids };
    });
  }

  const bulkPreview = (() => {
    if (!bulkData.dateFrom || !bulkData.dateTo || !bulkData.absenceCodeId)
      return null;
    try {
      const days = eachDayOfInterval({
        start: new Date(bulkData.dateFrom),
        end: new Date(bulkData.dateTo),
      });
      const weekdays = days.filter((d) => !isWeekendDay(d)).length;
      const weekends = days.length - weekdays;
      const absenceCode = absenceCodes.find(
        (ac) => ac.id === bulkData.absenceCodeId,
      );
      const weekendInclusive =
        absenceCode != null && WEEKEND_INCLUSIVE_CODES.has(absenceCode.code);
      const empCount = bulkData.allEmployees
        ? (data?.matrix?.length ?? 0)
        : bulkData.employeeIds.length;
      return { total: days.length, weekdays, weekends, weekendInclusive, empCount };
    } catch {
      return null;
    }
  })();

  const weekLabel = `Semaine ${weekNum} — ${format(weekStart, "d MMM", { locale: fr })} au ${format(weekEnd, "d MMM yyyy", { locale: fr })}`;

  return (
    <div className="flex h-full flex-col space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900">Planning</h1>
        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              setBulkData((prev) => ({
                ...prev,
                dateFrom: fromStr,
                dateTo: toStr,
              }));
              setShowBulkDialog(true);
            }}
            className="inline-flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2 text-sm font-medium text-amber-700 hover:bg-amber-100"
          >
            <Users className="h-4 w-4" />
            Saisie en masse
          </button>
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
          <select
            value={filterPoste}
            onChange={(e) => setFilterPoste(e.target.value)}
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-primary-500"
          >
            <option value="">Tous les postes</option>
            {postes.map((poste) => (
              <option key={poste.id} value={poste.label}>
                {poste.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Clipboard banner */}
      {clipboard && (
        <div className="flex items-center gap-2 rounded-lg border border-primary-200 bg-primary-50 px-3 py-2 text-xs text-primary-700">
          <ClipboardPaste className="h-3.5 w-3.5" />
          <span>
            Données copiées :{" "}
            {absenceCodes.find((ac) => ac.id === clipboard.absenceCodeId)
              ?.code ?? "—"}
            {clipboard.heureDebut &&
              ` · ${clipboard.heureDebut}–${clipboard.heureFin}`}
          </span>
          <button
            onClick={() => setClipboard(null)}
            className="ml-auto text-primary-500 hover:text-primary-700"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* Selection banner */}
      {selectedCells.size > 0 && (
        <div className="flex items-center gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm text-amber-800">
          <span className="font-medium">
            {selectedCells.size} cellule{selectedCells.size > 1 ? "s" : ""}{" "}
            sélectionnée{selectedCells.size > 1 ? "s" : ""}
          </span>
          {clipboard && (
            <button
              onClick={() => bulkPasteMutation.mutate()}
              disabled={bulkPasteMutation.isPending}
              className="inline-flex items-center gap-1.5 rounded-lg bg-amber-600 px-4 py-1.5 text-xs font-medium text-white hover:bg-amber-700 disabled:opacity-50"
            >
              <ClipboardPaste className="h-3.5 w-3.5" />
              {bulkPasteMutation.isPending
                ? "Collage..."
                : `Coller sur ${selectedCells.size} cellule${selectedCells.size > 1 ? "s" : ""}`}
            </button>
          )}
          <button
            onClick={() => setSelectedCells(new Set())}
            className="ml-auto text-xs text-amber-600 hover:text-amber-800"
          >
            Désélectionner tout
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
                      const isWeekend = d.getDay() === 0 || d.getDay() === 6;
                      const isToday =
                        format(d, "yyyy-MM-dd") ===
                        format(new Date(), "yyyy-MM-dd");
                      const hasData = cell.absenceCode || cell.heureDebut;
                      const cellKey = `${row.employee.id}_${cell.date}`;
                      const isSelected = selectedCells.has(cellKey);
                      return (
                        <td
                          key={cell.date}
                          className={cn(
                            "relative cursor-pointer px-1 py-1.5 text-center transition-all border-r border-slate-100",
                            isWeekend && "bg-slate-50/80",
                            isToday && "bg-primary-50/40",
                            isSelected &&
                              "ring-2 ring-inset ring-amber-400 bg-amber-50/60",
                            !hasData &&
                              !isSelected &&
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

      {/* Bulk absence dialog */}
      {showBulkDialog && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/30"
            onClick={() => setShowBulkDialog(false)}
          />
          <div className="fixed left-1/2 top-1/2 z-50 w-full max-w-lg -translate-x-1/2 -translate-y-1/2 rounded-xl border border-slate-200 bg-white p-6 shadow-elevated">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-slate-900">
                Saisie en masse
              </h3>
              <button
                onClick={() => setShowBulkDialog(false)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <p className="mt-1 text-sm text-slate-500">
              Appliquer un code absence ou des horaires sur une plage de dates
              pour un ou plusieurs employés.
            </p>

            <div className="mt-5 space-y-4">
              {/* Absence code */}
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-700">
                  Code absence / statut *
                </label>
                <select
                  value={bulkData.absenceCodeId}
                  onChange={(e) =>
                    setBulkData((prev) => ({
                      ...prev,
                      absenceCodeId: e.target.value,
                    }))
                  }
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20"
                >
                  <option value="">Sélectionner</option>
                  {absenceCodes.map((ac) => (
                    <option key={ac.id} value={ac.id}>
                      {ac.code}
                    </option>
                  ))}
                </select>
              </div>

              {/* Hours (optional) */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-slate-700">
                    Heure début
                  </label>
                  <input
                    type="time"
                    value={bulkData.heureDebut}
                    onChange={(e) =>
                      setBulkData((prev) => ({
                        ...prev,
                        heureDebut: e.target.value,
                      }))
                    }
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-slate-700">
                    Heure fin
                  </label>
                  <input
                    type="time"
                    value={bulkData.heureFin}
                    onChange={(e) =>
                      setBulkData((prev) => ({
                        ...prev,
                        heureFin: e.target.value,
                      }))
                    }
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20"
                  />
                </div>
              </div>

              {/* Date range */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-slate-700">
                    Date début *
                  </label>
                  <input
                    type="date"
                    value={bulkData.dateFrom}
                    onChange={(e) =>
                      setBulkData((prev) => ({
                        ...prev,
                        dateFrom: e.target.value,
                      }))
                    }
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-slate-700">
                    Date fin *
                  </label>
                  <input
                    type="date"
                    value={bulkData.dateTo}
                    onChange={(e) =>
                      setBulkData((prev) => ({
                        ...prev,
                        dateTo: e.target.value,
                      }))
                    }
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20"
                  />
                </div>
              </div>

              {/* Employee selection */}
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <label className="text-sm font-medium text-slate-700">
                    Employés
                  </label>
                  <label className="flex items-center gap-1.5 text-xs text-slate-500">
                    <input
                      type="checkbox"
                      checked={bulkData.allEmployees}
                      onChange={(e) =>
                        setBulkData((prev) => ({
                          ...prev,
                          allEmployees: e.target.checked,
                          employeeIds: [],
                        }))
                      }
                      className="rounded border-slate-300"
                    />
                    Tous les employés affichés
                  </label>
                </div>
                {!bulkData.allEmployees && data?.matrix && (
                  <div className="max-h-40 overflow-auto rounded-lg border border-slate-200 p-2">
                    {data.matrix.map((row) => (
                      <label
                        key={row.employee.id}
                        className="flex items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-slate-50"
                      >
                        <input
                          type="checkbox"
                          checked={bulkData.employeeIds.includes(
                            row.employee.id,
                          )}
                          onChange={() =>
                            toggleEmployeeSelection(row.employee.id)
                          }
                          className="rounded border-slate-300"
                        />
                        <span className="text-slate-700">
                          {row.employee.nom} {row.employee.prenom}
                        </span>
                        <span className="text-xs text-slate-400">
                          {row.employee.poste}
                        </span>
                      </label>
                    ))}
                  </div>
                )}
              </div>

              {/* Preview */}
              {bulkPreview && (
                <div className="rounded-lg border border-slate-100 bg-slate-50 p-3 text-sm">
                  <p className="font-medium text-slate-700">
                    Aperçu : {bulkPreview.total} jour
                    {bulkPreview.total > 1 ? "s" : ""} × {bulkPreview.empCount}{" "}
                    employé{bulkPreview.empCount > 1 ? "s" : ""} ={" "}
                    <span className="text-primary-600">
                      {bulkPreview.total * bulkPreview.empCount} entrées
                    </span>
                  </p>
                  {bulkPreview.weekends > 0 && (
                    <p className="mt-1 text-xs text-slate-500">
                      {bulkPreview.weekdays} jours de semaine +{" "}
                      {bulkPreview.weekends} jours de weekend
                      {bulkPreview.weekendInclusive ? (
                        <span className="ml-1 font-medium text-amber-600">
                          → weekends inclus (7j/7)
                        </span>
                      ) : (
                        <span className="ml-1 font-medium text-blue-600">
                          → weekends en Repos automatique
                        </span>
                      )}
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={() => setShowBulkDialog(false)}
                className="rounded-lg border border-slate-200 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50"
              >
                Annuler
              </button>
              <button
                onClick={() => bulkAbsenceMutation.mutate()}
                disabled={
                  !bulkData.absenceCodeId ||
                  !bulkData.dateFrom ||
                  !bulkData.dateTo ||
                  (!bulkData.allEmployees &&
                    bulkData.employeeIds.length === 0) ||
                  bulkAbsenceMutation.isPending
                }
                className="rounded-lg bg-amber-600 px-6 py-2 text-sm font-medium text-white hover:bg-amber-700 disabled:opacity-50"
              >
                {bulkAbsenceMutation.isPending
                  ? "Application..."
                  : "Appliquer"}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
