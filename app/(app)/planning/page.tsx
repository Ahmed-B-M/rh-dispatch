"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useRef } from "react";
import { ChevronLeft, ChevronRight, Save } from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

interface PlanningCell {
  date: string;
  entryId: string | null;
  absenceCode: string | null;
  absenceColor: string | null;
  heureDebut: string | null;
  heureFin: string | null;
  heuresDecimales: number | null;
  vehicule: string | null;
  nbKm: number | null;
}

interface PlanningRow {
  employee: {
    id: string;
    matricule: string;
    nom: string;
    prenom: string;
    categorie: string;
    typeContrat: string;
  };
  cells: PlanningCell[];
}

interface AbsenceCode {
  id: string;
  code: string;
  color: string;
}

interface PlanningData {
  year: number;
  month: number;
  days: string[];
  matrix: PlanningRow[];
}

export default function PlanningPage() {
  const queryClient = useQueryClient();
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [filterCategorie, setFilterCategorie] = useState("");
  const [editingPopover, setEditingPopover] = useState<{
    employeeId: string;
    date: string;
    x: number;
    y: number;
  } | null>(null);
  const [popoverData, setPopoverData] = useState({
    absenceCodeId: "",
    heureDebut: "",
    heureFin: "",
  });

  const { data: absenceCodes = [] } = useQuery<AbsenceCode[]>({
    queryKey: ["absenceCodes"],
    queryFn: async () => {
      const res = await fetch("/api/absence-codes");
      if (!res.ok) throw new Error(`Erreur ${res.status}`);
      return res.json();
    },
  });

  const { data, isLoading } = useQuery<PlanningData>({
    queryKey: ["planning", year, month, filterCategorie],
    queryFn: async () => {
      const params = new URLSearchParams({
        year: String(year),
        month: String(month),
      });
      if (filterCategorie) params.set("categorie", filterCategorie);
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
      setEditingPopover(null);
    },
  });

  function prevMonth() {
    if (month === 1) {
      setMonth(12);
      setYear(year - 1);
    } else {
      setMonth(month - 1);
    }
  }

  function nextMonth() {
    if (month === 12) {
      setMonth(1);
      setYear(year + 1);
    } else {
      setMonth(month + 1);
    }
  }

  function handleCellClick(employeeId: string, date: string, e: React.MouseEvent) {
    const rect = (e.target as HTMLElement).getBoundingClientRect();
    const cell = data?.matrix
      .find((r) => r.employee.id === employeeId)
      ?.cells.find((c) => c.date === date);

    setPopoverData({
      absenceCodeId: cell?.absenceCode
        ? absenceCodes.find((ac) => ac.code === cell.absenceCode)?.id ?? ""
        : "",
      heureDebut: cell?.heureDebut ?? "",
      heureFin: cell?.heureFin ?? "",
    });

    setEditingPopover({ employeeId, date, x: rect.left, y: rect.bottom + 4 });
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

  const monthLabel = format(new Date(year, month - 1), "MMMM yyyy", { locale: fr });

  return (
    <div className="flex h-full flex-col space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900">Planning</h1>
        <select
          value={filterCategorie}
          onChange={(e) => setFilterCategorie(e.target.value)}
          className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
        >
          <option value="">Toutes catégories</option>
          <option value="SEDENTAIRE">Sédentaire</option>
          <option value="TRANSPORT">Transport</option>
          <option value="LOGISTIQUE">Logistique</option>
        </select>
      </div>

      {/* Month navigator */}
      <div className="flex items-center justify-center gap-4 rounded-xl border border-slate-200 bg-white p-3 shadow-soft">
        <button
          onClick={prevMonth}
          className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
        <span className="min-w-[180px] text-center text-lg font-semibold capitalize text-slate-900">
          {monthLabel}
        </span>
        <button
          onClick={nextMonth}
          className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
        >
          <ChevronRight className="h-5 w-5" />
        </button>
      </div>

      {/* Calendar grid */}
      <div className="flex-1 overflow-auto rounded-xl border border-slate-200 bg-white shadow-soft">
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <p className="text-sm text-slate-400">Chargement du planning...</p>
          </div>
        ) : !data?.matrix?.length ? (
          <div className="flex items-center justify-center py-20">
            <p className="text-sm text-slate-400">Aucun employé pour cette sélection</p>
          </div>
        ) : (
          <table className="w-full text-xs">
            <thead className="sticky top-0 z-10 bg-slate-50">
              <tr>
                <th className="sticky left-0 z-20 bg-slate-50 px-3 py-2 text-left font-semibold text-slate-500 min-w-[160px]">
                  Employé
                </th>
                {data.days.map((day) => {
                  const d = new Date(day);
                  const isWeekend = d.getDay() === 0 || d.getDay() === 6;
                  return (
                    <th
                      key={day}
                      className={cn(
                        "min-w-[38px] px-1 py-2 text-center font-medium",
                        isWeekend ? "bg-slate-100 text-slate-400" : "text-slate-500",
                      )}
                    >
                      <div>{d.getDate()}</div>
                      <div className="text-[9px] font-normal">
                        {format(d, "EEE", { locale: fr })}
                      </div>
                    </th>
                  );
                })}
                <th className="px-3 py-2 text-center font-semibold text-slate-500 min-w-[60px]">
                  Total h
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
                  <tr key={row.employee.id} className="border-b border-slate-50">
                    <td className="sticky left-0 z-10 bg-white px-3 py-1.5 font-medium text-slate-700 whitespace-nowrap">
                      {row.employee.nom} {row.employee.prenom}
                    </td>
                    {row.cells.map((cell) => {
                      const isWeekend =
                        new Date(cell.date).getDay() === 0 ||
                        new Date(cell.date).getDay() === 6;
                      return (
                        <td
                          key={cell.date}
                          className={cn(
                            "cursor-pointer px-0.5 py-1 text-center transition-colors hover:ring-1 hover:ring-primary-300",
                            isWeekend && "bg-slate-50",
                          )}
                          onClick={(e) =>
                            handleCellClick(row.employee.id, cell.date, e)
                          }
                        >
                          {cell.absenceCode && (
                            <div
                              className="mx-auto h-6 w-full max-w-[34px] rounded text-[9px] font-medium text-white flex items-center justify-center leading-none"
                              style={{ backgroundColor: cell.absenceColor ?? "#94a3b8" }}
                              title={`${cell.absenceCode}${cell.heuresDecimales ? ` — ${cell.heuresDecimales}h` : ""}`}
                            >
                              {cell.absenceCode.substring(0, 3)}
                            </div>
                          )}
                        </td>
                      );
                    })}
                    <td className="px-3 py-1.5 text-center font-semibold text-slate-700">
                      {totalHours > 0 ? totalHours.toFixed(1) : "—"}
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
            className="fixed z-50 w-64 rounded-xl border border-slate-200 bg-white p-4 shadow-elevated animate-scale-in"
            style={{ left: editingPopover.x, top: editingPopover.y }}
          >
            <p className="mb-3 text-xs font-semibold text-slate-500">
              {format(new Date(editingPopover.date), "EEEE d MMMM", { locale: fr })}
            </p>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-slate-500">Code absence</label>
                <select
                  value={popoverData.absenceCodeId}
                  onChange={(e) =>
                    setPopoverData((prev) => ({ ...prev, absenceCodeId: e.target.value }))
                  }
                  className="mt-1 w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm outline-none focus:border-primary-500"
                >
                  <option value="">— Aucun —</option>
                  {absenceCodes.map((ac) => (
                    <option key={ac.id} value={ac.id}>
                      {ac.code}
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs text-slate-500">Début</label>
                  <input
                    type="time"
                    value={popoverData.heureDebut}
                    onChange={(e) =>
                      setPopoverData((prev) => ({ ...prev, heureDebut: e.target.value }))
                    }
                    className="mt-1 w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm outline-none focus:border-primary-500"
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-500">Fin</label>
                  <input
                    type="time"
                    value={popoverData.heureFin}
                    onChange={(e) =>
                      setPopoverData((prev) => ({ ...prev, heureFin: e.target.value }))
                    }
                    className="mt-1 w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm outline-none focus:border-primary-500"
                  />
                </div>
              </div>
              <button
                onClick={handleSaveCell}
                disabled={saveMutation.isPending}
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary-600 py-2 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50"
              >
                <Save className="h-3.5 w-3.5" />
                {saveMutation.isPending ? "Sauvegarde..." : "Enregistrer"}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
