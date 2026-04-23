"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useMemo, useRef, useEffect } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Save,
  Calendar,
  Copy,
  ClipboardPaste,
  Users,
  X,
  Search,
  Pencil,
  ChevronDown,
  Check,
  Trash2,
  ArrowRight,
  RefreshCw,
} from "lucide-react";
import { PageHelp } from "@/components/ui/page-help";
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
  isWeekendInclusive: boolean;
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
  pauseMinutes: number;
}

interface PlanningData {
  from: string;
  to: string;
  days: string[];
  matrix: PlanningRow[];
}

type EditingPopover =
  | { mode: "cell"; employeeId: string; date: string; rect: { left: number; top: number } }
  | { mode: "selection"; rect: { left: number; top: number } }
  | null;

const DAY_LABELS = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];

const TIME_PRESETS = [
  { label: "6h–14h",  start: "06:00", end: "14:00" },
  { label: "8h–17h",  start: "08:00", end: "17:00" },
  { label: "10h–19h", start: "10:00", end: "19:00" },
  { label: "14h–22h", start: "14:00", end: "22:00" },
] as const;

function computeDuration(start: string, end: string, pauseMinutes = 0): string | null {
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  if (isNaN(sh) || isNaN(sm) || isNaN(eh) || isNaN(em)) return null;
  const diff = Math.max(0, eh * 60 + em - (sh * 60 + sm) - pauseMinutes);
  if (diff <= 0) return null;
  const h = Math.floor(diff / 60);
  const m = diff % 60;
  return `${h}h${m > 0 ? String(m).padStart(2, "0") : ""}`;
}

function computeDurationDecimal(start: string, end: string): number | null {
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  if (isNaN(sh) || isNaN(sm) || isNaN(eh) || isNaN(em)) return null;
  const diff = eh * 60 + em - (sh * 60 + sm);
  return diff <= 0 ? null : parseFloat((diff / 60).toFixed(2));
}

export default function PlanningPage() {
  const queryClient = useQueryClient();

  const [weekStart, setWeekStart] = useState(() =>
    startOfWeek(new Date(), { weekStartsOn: 1 }),
  );
  const [filterCategorie, setFilterCategorie] = useState("");
  const [filterSiteId, setFilterSiteId] = useState("");
  const [filterPostes, setFilterPostes] = useState<string[]>([]);
  const [showPosteDropdown, setShowPosteDropdown] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const [editingPopover, setEditingPopover] = useState<EditingPopover>(null);
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
  const [lastClickedCell, setLastClickedCell] = useState<{
    employeeId: string;
    date: string;
  } | null>(null);

  const [rowClipboard, setRowClipboard] = useState<Array<{
    absenceCodeId: string | null;
    heureDebut: string | null;
    heureFin: string | null;
  }> | null>(null);
  const [isImportingPrev, setIsImportingPrev] = useState(false);
  const [showWeekend, setShowWeekend] = useState(true);
  const [compact, setCompact] = useState(false);

  // Drag-to-select refs (mutable, no re-render needed)
  const hasDraggedRef = useRef(false);
  const dragStartRef = useRef<{ employeeId: string; date: string } | null>(null);
  // Ref to always call latest handleSavePopover from keydown
  const handleSaveRef = useRef<() => void>(() => {});

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

  const posteDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (posteDropdownRef.current && !posteDropdownRef.current.contains(e.target as Node)) {
        setShowPosteDropdown(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setEditingPopover(null);
        setSelectedCells(new Set());
      }
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSaveRef.current();
      }
    }
    function handleMouseUp() {
      dragStartRef.current = null;
    }
    document.addEventListener("keydown", handleKey);
    document.addEventListener("mouseup", handleMouseUp);
    return () => {
      document.removeEventListener("keydown", handleKey);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, []);

  const weekEnd = endOfWeek(weekStart, { weekStartsOn: 1 });
  const fromStr = format(weekStart, "yyyy-MM-dd");
  const toStr = format(weekEnd, "yyyy-MM-dd");
  const weekNum = getISOWeek(weekStart);
  const planningQueryKey = ["planning", fromStr, toStr, filterCategorie, filterSiteId, filterPostes.join(",")];

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
    queryKey: planningQueryKey,
    queryFn: async () => {
      const params = new URLSearchParams({ from: fromStr, to: toStr });
      if (filterCategorie) params.set("categorie", filterCategorie);
      if (filterSiteId) params.set("siteId", filterSiteId);
      filterPostes.forEach((p) => params.append("poste", p));
      const res = await fetch(`/api/planning?${params}`);
      if (!res.ok) throw new Error(`Erreur ${res.status}`);
      return res.json();
    },
  });

  const filteredMatrix = useMemo(() => {
    if (!data?.matrix) return [];
    if (!searchQuery.trim()) return data.matrix;
    const q = searchQuery.toLowerCase();
    return data.matrix.filter((row) =>
      `${row.employee.nom} ${row.employee.prenom} ${row.employee.matricule}`
        .toLowerCase()
        .includes(q),
    );
  }, [data?.matrix, searchQuery]);

  const displayedDays = useMemo(
    () => (data?.days ?? []).filter((d) => showWeekend || new Date(d).getDay() % 6 !== 0),
    [data?.days, showWeekend],
  );

  const durationPreview = useMemo(() => {
    if (!popoverData.heureDebut || !popoverData.heureFin) return null;
    const employeePoste = editingPopover?.mode === "cell"
      ? filteredMatrix.find((r) => r.employee.id === editingPopover.employeeId)?.employee.poste
      : undefined;
    const pauseMinutes = employeePoste
      ? (postes.find((p) => p.label === employeePoste)?.pauseMinutes ?? 0)
      : 0;
    return computeDuration(popoverData.heureDebut, popoverData.heureFin, pauseMinutes);
  }, [popoverData.heureDebut, popoverData.heureFin, editingPopover, filteredMatrix, postes]);

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
    onMutate: async (entry) => {
      await queryClient.cancelQueries({ queryKey: planningQueryKey });
      const previous = queryClient.getQueryData<PlanningData>(planningQueryKey);

      const ac = absenceCodes.find((a) => a.id === entry.absenceCodeId);
      const heuresDecimales =
        entry.heureDebut && entry.heureFin
          ? computeDurationDecimal(entry.heureDebut, entry.heureFin)
          : null;

      queryClient.setQueryData<PlanningData>(planningQueryKey, (old) => {
        if (!old) return old;
        return {
          ...old,
          matrix: old.matrix.map((row) => {
            if (row.employee.id !== entry.employeeId) return row;
            return {
              ...row,
              cells: row.cells.map((cell) => {
                if (cell.date !== entry.date) return cell;
                return {
                  ...cell,
                  absenceCodeId: entry.absenceCodeId,
                  absenceCode: ac?.code ?? null,
                  absenceColor: ac?.color ?? null,
                  heureDebut: entry.heureDebut,
                  heureFin: entry.heureFin,
                  heuresDecimales,
                };
              }),
            };
          }),
        };
      });

      return { previous };
    },
    onError: (err: Error, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(planningQueryKey, context.previous);
      }
      toast.error(err.message);
    },
    onSuccess: () => {
      setEditingPopover(null);
      toast.success("Cellule enregistrée");
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: planningQueryKey });
      queryClient.invalidateQueries({ queryKey: ["workEntries"] });
    },
  });

  const bulkSaveMutation = useMutation({
    mutationFn: async (
      entries: Array<{
        employeeId: string;
        date: string;
        absenceCodeId: string | null;
        heureDebut: string | null;
        heureFin: string | null;
      }>,
    ) => {
      const res = await fetch("/api/work-entries/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entries }),
      });
      if (!res.ok) throw new Error("Erreur de sauvegarde en masse");
      return res.json();
    },
    onSuccess: (result, entries) => {
      queryClient.invalidateQueries({ queryKey: planningQueryKey });
      queryClient.invalidateQueries({ queryKey: ["workEntries"] });
      setSelectedCells(new Set());
      setEditingPopover(null);
      toast.success(`${result?.total ?? entries.length} entrée(s) sauvegardée(s)`);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const bulkAbsenceMutation = useMutation({
    mutationFn: async () => {
      const absenceCode = absenceCodes.find((ac) => ac.id === bulkData.absenceCodeId);
      const reposCode = absenceCodes.find((ac) => ac.code === "Repos");
      const weekendInclusive = absenceCode?.isWeekendInclusive ?? false;

      const days = eachDayOfInterval({
        start: new Date(bulkData.dateFrom),
        end: new Date(bulkData.dateTo),
      });

      const targetIds = bulkData.allEmployees
        ? (data?.matrix ?? []).map((r) => r.employee.id)
        : bulkData.employeeIds;

      const entries: Array<{
        employeeId: string;
        date: string;
        absenceCodeId: string | null;
        heureDebut: string | null;
        heureFin: string | null;
      }> = [];

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
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: planningQueryKey });
      queryClient.invalidateQueries({ queryKey: ["workEntries"] });
      toast.success(`${result?.total ?? 0} entrée(s) appliquée(s)`);
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

  function computeRangeSelection(
    from: { employeeId: string; date: string },
    to: { employeeId: string; date: string },
  ): Set<string> {
    const empIds = filteredMatrix.map((r) => r.employee.id);
    const days = displayedDays;
    const fromEmpIdx = empIds.indexOf(from.employeeId);
    const toEmpIdx = empIds.indexOf(to.employeeId);
    const fromDayIdx = days.indexOf(from.date);
    const toDayIdx = days.indexOf(to.date);
    if (fromEmpIdx === -1 || toEmpIdx === -1 || fromDayIdx === -1 || toDayIdx === -1) {
      return new Set();
    }
    const minEmp = Math.min(fromEmpIdx, toEmpIdx);
    const maxEmp = Math.max(fromEmpIdx, toEmpIdx);
    const minDay = Math.min(fromDayIdx, toDayIdx);
    const maxDay = Math.max(fromDayIdx, toDayIdx);
    const selected = new Set<string>();
    for (let e = minEmp; e <= maxEmp; e++) {
      for (let d = minDay; d <= maxDay; d++) {
        const empId = empIds[e];
        const day = days[d];
        if (empId && day) selected.add(`${empId}_${day}`);
      }
    }
    return selected;
  }

  function handleCellMouseDown(employeeId: string, date: string, e: React.MouseEvent) {
    if (e.ctrlKey || e.metaKey || e.shiftKey || e.button !== 0) return;
    hasDraggedRef.current = false;
    dragStartRef.current = { employeeId, date };
  }

  function handleCellMouseEnter(employeeId: string, date: string) {
    if (!dragStartRef.current) return;
    if (dragStartRef.current.employeeId === employeeId && dragStartRef.current.date === date) return;
    hasDraggedRef.current = true;
    setEditingPopover(null);
    const range = computeRangeSelection(dragStartRef.current, { employeeId, date });
    setSelectedCells(range);
    setLastClickedCell({ employeeId, date });
  }

  function handleCellClick(
    employeeId: string,
    date: string,
    cell: PlanningCell,
    e: React.MouseEvent,
  ) {
    // Ignore click if it ended a drag
    if (hasDraggedRef.current) {
      hasDraggedRef.current = false;
      return;
    }

    const key = `${employeeId}_${date}`;

    if (e.ctrlKey || e.metaKey) {
      setSelectedCells((prev) => {
        const next = new Set(prev);
        if (next.has(key)) next.delete(key);
        else next.add(key);
        return next;
      });
      setLastClickedCell({ employeeId, date });
      return;
    }

    if (e.shiftKey && lastClickedCell) {
      const range = computeRangeSelection(lastClickedCell, { employeeId, date });
      setSelectedCells(range);
      return;
    }

    if (selectedCells.size > 0) setSelectedCells(new Set());

    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    setPopoverData({
      absenceCodeId: cell.absenceCodeId ?? "",
      heureDebut: cell.heureDebut ?? "",
      heureFin: cell.heureFin ?? "",
    });
    setEditingPopover({
      mode: "cell",
      employeeId,
      date,
      rect: {
        left: Math.min(rect.left, window.innerWidth - 290),
        top: Math.min(rect.bottom + 4, window.innerHeight - 320),
      },
    });
    setLastClickedCell({ employeeId, date });
  }

  function handleOpenSelectionEdit(e: React.MouseEvent<HTMLButtonElement>) {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    setPopoverData({ absenceCodeId: "", heureDebut: "", heureFin: "" });
    setEditingPopover({
      mode: "selection",
      rect: {
        left: Math.min(rect.left, window.innerWidth - 290),
        top: Math.min(rect.bottom + 4, window.innerHeight - 320),
      },
    });
  }

  function handleSavePopover() {
    if (!editingPopover) return;

    if (editingPopover.mode === "cell") {
      saveMutation.mutate({
        employeeId: editingPopover.employeeId,
        date: editingPopover.date,
        absenceCodeId: popoverData.absenceCodeId || null,
        heureDebut: popoverData.heureDebut || null,
        heureFin: popoverData.heureFin || null,
      });
    } else {
      const entries = [...selectedCells].map((key) => {
        const sep = key.indexOf("_");
        return {
          employeeId: key.slice(0, sep),
          date: key.slice(sep + 1),
          absenceCodeId: popoverData.absenceCodeId || null,
          heureDebut: popoverData.heureDebut || null,
          heureFin: popoverData.heureFin || null,
        };
      });
      bulkSaveMutation.mutate(entries);
    }
  }

  function handlePasteOnSelection() {
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
    bulkSaveMutation.mutate(entries);
  }

  function handleCopyRow(empId: string) {
    const row = filteredMatrix.find((r) => r.employee.id === empId);
    if (!row) return;
    const snapshot = row.cells.map((c) => ({
      absenceCodeId: c.absenceCodeId,
      heureDebut: c.heureDebut,
      heureFin: c.heureFin,
    }));
    setRowClipboard(snapshot);
    toast.success(`Semaine de ${row.employee.nom} copiée`);
  }

  function handlePasteRow(empId: string) {
    if (!rowClipboard || !data?.days) return;
    const entries = rowClipboard.map((item, i) => ({
      employeeId: empId,
      date: data.days[i],
      absenceCodeId: item.absenceCodeId,
      heureDebut: item.heureDebut,
      heureFin: item.heureFin,
    }));
    bulkSaveMutation.mutate(entries);
  }

  function handleClearRow(empId: string) {
    if (!data?.days) return;
    const entries = data.days.map((day) => ({
      employeeId: empId,
      date: day,
      absenceCodeId: null,
      heureDebut: null,
      heureFin: null,
    }));
    bulkSaveMutation.mutate(entries);
  }

  function handleFillFromMonday(empId: string) {
    const row = filteredMatrix.find((r) => r.employee.id === empId);
    if (!row || !data?.days) return;
    const monCell = row.cells.find((c) => c.date === data.days[0]);
    if (!monCell?.absenceCodeId) { toast.error("Lundi vide — rien à propager"); return; }
    const weekdays = data.days.filter((_, i) => i < 5);
    const entries = weekdays.map((day) => ({
      employeeId: empId,
      date: day,
      absenceCodeId: monCell.absenceCodeId,
      heureDebut: monCell.heureDebut,
      heureFin: monCell.heureFin,
    }));
    bulkSaveMutation.mutate(entries);
  }

  async function handleImportPrevWeek() {
    if (!data?.days) return;
    setIsImportingPrev(true);
    try {
      const prevWeekStart = subWeeks(weekStart, 1);
      const prevWeekEnd = endOfWeek(prevWeekStart, { weekStartsOn: 1 });
      const params = new URLSearchParams({
        from: format(prevWeekStart, "yyyy-MM-dd"),
        to: format(prevWeekEnd, "yyyy-MM-dd"),
      });
      if (filterCategorie) params.set("categorie", filterCategorie);
      if (filterSiteId) params.set("siteId", filterSiteId);
      filterPostes.forEach((p) => params.append("poste", p));

      const res = await fetch(`/api/planning?${params}`);
      if (!res.ok) throw new Error("Erreur réseau");
      const prevData: PlanningData = await res.json();

      const entries: Array<{
        employeeId: string; date: string;
        absenceCodeId: string | null; heureDebut: string | null; heureFin: string | null;
      }> = [];

      for (const prevRow of prevData.matrix) {
        const curRow = data.matrix.find((r) => r.employee.id === prevRow.employee.id);
        if (!curRow) continue;
        prevRow.cells.forEach((prevCell, i) => {
          const curDay = data.days[i];
          if (!curDay) return;
          const curCell = curRow.cells.find((c) => c.date === curDay);
          if (!curCell?.absenceCode && prevCell.absenceCodeId) {
            entries.push({
              employeeId: prevRow.employee.id,
              date: curDay,
              absenceCodeId: prevCell.absenceCodeId,
              heureDebut: prevCell.heureDebut,
              heureFin: prevCell.heureFin,
            });
          }
        });
      }

      if (entries.length === 0) { toast.info("Aucune cellule vide à reconduire"); return; }
      bulkSaveMutation.mutate(entries);
    } catch {
      toast.error("Impossible de charger la semaine précédente");
    } finally {
      setIsImportingPrev(false);
    }
  }

  function handleClearCell(employeeId: string, date: string, e: React.MouseEvent) {
    e.stopPropagation();
    saveMutation.mutate({ employeeId, date, absenceCodeId: null, heureDebut: null, heureFin: null });
  }

  function goToday() {
    setWeekStart(startOfWeek(new Date(), { weekStartsOn: 1 }));
  }

  function togglePosteFilter(label: string) {
    setFilterPostes((prev) =>
      prev.includes(label) ? prev.filter((p) => p !== label) : [...prev, label],
    );
  }

  function toggleEmployeeSelection(empId: string) {
    setBulkData((prev) => {
      const ids = prev.employeeIds.includes(empId)
        ? prev.employeeIds.filter((id) => id !== empId)
        : [...prev.employeeIds, empId];
      return { ...prev, employeeIds: ids };
    });
  }

  function getCompletenessColor(cells: PlanningCell[], days: string[]): string {
    const workDays = days.filter((d) => {
      const dow = new Date(d).getDay();
      return dow !== 0 && dow !== 6;
    });
    if (workDays.length === 0) return "bg-slate-200";
    const filled = workDays.filter((d) => cells.find((c) => c.date === d)?.absenceCode !== null).length;
    const ratio = filled / workDays.length;
    if (ratio === 0) return "bg-slate-200";
    if (ratio < 1) return "bg-amber-400";
    return "bg-emerald-500";
  }

  function getCompletenessLabel(cells: PlanningCell[], days: string[]): string {
    const workDays = days.filter((d) => {
      const dow = new Date(d).getDay();
      return dow !== 0 && dow !== 6;
    });
    const filled = workDays.filter((d) => cells.find((c) => c.date === d)?.absenceCode !== null).length;
    return `${filled}/${workDays.length}j`;
  }

  const dailyTotals = useMemo(() => {
    if (!data?.days || !filteredMatrix.length) return {} as Record<string, number>;
    return Object.fromEntries(
      data.days.map((day) => [
        day,
        filteredMatrix.reduce((sum, row) => {
          const cell = row.cells.find((c) => c.date === day);
          return sum + (cell?.heuresDecimales ?? 0);
        }, 0),
      ]),
    );
  }, [data?.days, filteredMatrix]);

  const bulkPreview = useMemo(() => {
    if (!bulkData.dateFrom || !bulkData.dateTo || !bulkData.absenceCodeId) return null;
    try {
      const days = eachDayOfInterval({
        start: new Date(bulkData.dateFrom),
        end: new Date(bulkData.dateTo),
      });
      const weekdays = days.filter((d) => !isWeekendDay(d)).length;
      const weekends = days.length - weekdays;
      const absenceCode = absenceCodes.find((ac) => ac.id === bulkData.absenceCodeId);
      const weekendInclusive = absenceCode?.isWeekendInclusive ?? false;
      const empCount = bulkData.allEmployees
        ? (data?.matrix?.length ?? 0)
        : bulkData.employeeIds.length;
      return { total: days.length, weekdays, weekends, weekendInclusive, empCount };
    } catch {
      return null;
    }
  }, [bulkData.dateFrom, bulkData.dateTo, bulkData.absenceCodeId, bulkData.allEmployees, bulkData.employeeIds, absenceCodes, data?.matrix]);

  const weekLabel = `Semaine ${weekNum} — ${format(weekStart, "d MMM", { locale: fr })} au ${format(weekEnd, "d MMM yyyy", { locale: fr })}`;
  const isPendingSave = saveMutation.isPending || bulkSaveMutation.isPending;

  // Keep save ref updated every render so keydown handler always calls latest version
  handleSaveRef.current = handleSavePopover;

  return (
    <div className="flex h-full flex-col space-y-3">
      {/* Header */}
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="text-2xl font-bold text-slate-900">Planning</h1>
        <PageHelp
          title="Planning hebdomadaire"
          description="Saisie et consultation des horaires et absences par semaine."
          sections={[
            {
              title: "Navigation",
              items: [
                "Utilisez les flèches ← → pour changer de semaine.",
                "Cliquez sur « Aujourd'hui » pour revenir à la semaine en cours.",
                "Filtrez par catégorie, site ou postes (multi-sélection) pour affiner l'affichage.",
                "La barre de recherche filtre les lignes en temps réel sans rechargement.",
                "Le bouton Lun–Dim / Lun–Ven masque ou affiche les colonnes week-end.",
                "Le bouton « Compact » réduit la hauteur des lignes pour afficher plus d'employés.",
              ],
            },
            {
              title: "Saisie individuelle",
              items: [
                "Cliquez sur une cellule pour ouvrir le panneau d'édition.",
                "Choisissez un code absence, puis les heures début/fin (optionnelles).",
                "La durée affichée dans le popover est déjà nette de la pause configurée pour le poste.",
                "Appuyez sur Entrée pour sauvegarder, Échap pour fermer sans sauvegarder.",
                "Le bouton « Copier » enregistre la cellule dans le presse-papier pour la coller ailleurs.",
              ],
            },
            {
              title: "Actions par ligne",
              items: [
                "Survolez un nom pour faire apparaître les actions rapides de la ligne.",
                "Icône flèche : propage lundi sur toute la semaine (lun–ven).",
                "Icône copie : copie toute la semaine dans le presse-papier ligne.",
                "Icône coller : colle la semaine copiée sur cette ligne.",
                "Icône poubelle : efface toutes les cellules de la semaine pour cet employé.",
              ],
            },
            {
              title: "Sélection multiple",
              items: [
                "Glissez la souris sur plusieurs cellules pour les sélectionner en un geste.",
                "Ctrl+clic (ou ⌘+clic sur Mac) pour sélectionner/désélectionner des cellules une à une.",
                "Shift+clic pour sélectionner une plage rectangulaire entre deux cellules.",
                "Cliquez « Modifier X cellules » pour appliquer les mêmes données à toute la sélection.",
                "Avec un presse-papier actif, cliquez « Coller » pour répliquer la cellule copiée.",
              ],
            },
            {
              title: "Reconduire / Saisie en masse",
              items: [
                "« Reconduire » copie les cellules vides de la semaine précédente sans écraser l'existant.",
                "« Saisie en masse » applique un code sur une plage de dates pour un ou plusieurs employés.",
                "Les weekends reçoivent automatiquement « Repos » sauf pour les codes médicaux (Maladie, Accident travail…).",
              ],
            },
            {
              title: "Indicateurs",
              items: [
                "Le point coloré à gauche du nom indique la complétude de la semaine : gris (vide), orange (partiel), vert (complet).",
                "La colonne « Total » affiche le cumul brut d'heures saisies pour la semaine.",
              ],
            },
          ]}
          shortcuts={[
            { key: "Clic simple", action: "Ouvrir l'édition d'une cellule" },
            { key: "Entrée", action: "Sauvegarder le popover ouvert" },
            { key: "Glisser-déposer", action: "Sélectionner une plage de cellules" },
            { key: "Ctrl+clic", action: "Sélectionner/désélectionner une cellule" },
            { key: "Shift+clic", action: "Sélectionner une plage rectangulaire" },
            { key: "F1", action: "Ouvrir/fermer ce panneau d'aide" },
            { key: "Échap", action: "Fermer le popover ou ce panneau" },
          ]}
        />
        <div className="mr-auto" />

        {/* Search */}
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Rechercher un employé…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-9 w-52 rounded-lg border border-slate-200 pl-8 pr-3 text-sm outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20"
          />
        </div>

        {/* Catégorie */}
        <select
          value={filterCategorie}
          onChange={(e) => setFilterCategorie(e.target.value)}
          className="h-9 rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-primary-500"
        >
          <option value="">Toutes catégories</option>
          <option value="SEDENTAIRE">Sédentaire</option>
          <option value="TRANSPORT">Transport</option>
          <option value="LOGISTIQUE">Logistique</option>
        </select>

        {/* Site */}
        <select
          value={filterSiteId}
          onChange={(e) => setFilterSiteId(e.target.value)}
          className="h-9 rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-primary-500"
        >
          <option value="">Tous les sites</option>
          {sites.map((site) => (
            <option key={site.id} value={site.id}>
              {site.code}
            </option>
          ))}
        </select>

        {/* Poste multi-select */}
        <div className="relative" ref={posteDropdownRef}>
          <button
            onClick={() => setShowPosteDropdown((v) => !v)}
            className={cn(
              "flex h-9 items-center gap-2 rounded-lg border px-3 text-sm transition-colors",
              filterPostes.length > 0
                ? "border-primary-300 bg-primary-50 text-primary-700"
                : "border-slate-200 text-slate-600 hover:bg-slate-50",
            )}
          >
            {filterPostes.length === 0
              ? "Tous les postes"
              : filterPostes.length === 1
                ? filterPostes[0]
                : `${filterPostes.length} postes`}
            <ChevronDown className="h-3.5 w-3.5 opacity-60" />
          </button>
          {showPosteDropdown && (
            <div className="absolute right-0 top-full z-30 mt-1 w-64 rounded-xl border border-slate-200 bg-white py-1 shadow-elevated">
              <button
                onClick={() => setFilterPostes([])}
                className={cn(
                  "flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-slate-50",
                  filterPostes.length === 0 && "text-primary-600 font-medium",
                )}
              >
                <Check className={cn("h-3.5 w-3.5", filterPostes.length === 0 ? "opacity-100 text-primary-600" : "opacity-0")} />
                Tous les postes
              </button>
              <div className="mx-2 my-1 border-t border-slate-100" />
              {postes.map((poste) => {
                const active = filterPostes.includes(poste.label);
                return (
                  <button
                    key={poste.id}
                    onClick={() => togglePosteFilter(poste.label)}
                    className="flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-slate-50"
                  >
                    <Check className={cn("h-3.5 w-3.5 text-primary-600", active ? "opacity-100" : "opacity-0")} />
                    <span className={active ? "font-medium text-primary-700" : "text-slate-700"}>
                      {poste.label}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Reconduire semaine précédente */}
        <button
          onClick={handleImportPrevWeek}
          disabled={isImportingPrev || isLoading}
          title="Copie les cellules vides depuis la semaine précédente"
          className="flex h-9 items-center gap-2 rounded-lg border border-indigo-200 bg-indigo-50 px-4 text-sm font-medium text-indigo-700 hover:bg-indigo-100 disabled:opacity-50"
        >
          <RefreshCw className={cn("h-4 w-4", isImportingPrev && "animate-spin")} />
          Reconduire
        </button>

        {/* Saisie en masse */}
        <button
          onClick={() => {
            setBulkData((prev) => ({ ...prev, dateFrom: fromStr, dateTo: toStr }));
            setShowBulkDialog(true);
          }}
          className="flex h-9 items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 text-sm font-medium text-amber-700 hover:bg-amber-100"
        >
          <Users className="h-4 w-4" />
          Saisie en masse
        </button>
      </div>

      {/* Clipboard banner */}
      {clipboard && (
        <div className="flex items-center gap-2 rounded-lg border border-primary-200 bg-primary-50 px-3 py-2 text-xs text-primary-700">
          <ClipboardPaste className="h-3.5 w-3.5 shrink-0" />
          <span>
            Presse-papier :{" "}
            <strong>{absenceCodes.find((ac) => ac.id === clipboard.absenceCodeId)?.code ?? "—"}</strong>
            {clipboard.heureDebut && ` · ${clipboard.heureDebut}–${clipboard.heureFin}`}
          </span>
          <button onClick={() => setClipboard(null)} className="ml-auto text-primary-500 hover:text-primary-700">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* Selection banner */}
      {selectedCells.size > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-800">
          <span className="font-medium">
            {selectedCells.size} cellule{selectedCells.size > 1 ? "s" : ""} sélectionnée{selectedCells.size > 1 ? "s" : ""}
          </span>
          <span className="text-xs text-amber-600">· Shift+clic pour étendre, Ctrl+clic pour ajouter</span>
          <div className="ml-auto flex items-center gap-2">
            <button
              onClick={handleOpenSelectionEdit}
              className="flex items-center gap-1.5 rounded-lg bg-primary-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-primary-700"
            >
              <Pencil className="h-3.5 w-3.5" />
              Modifier {selectedCells.size} cellule{selectedCells.size > 1 ? "s" : ""}
            </button>
            {clipboard && (
              <button
                onClick={handlePasteOnSelection}
                disabled={bulkSaveMutation.isPending}
                className="flex items-center gap-1.5 rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-amber-700 disabled:opacity-50"
              >
                <ClipboardPaste className="h-3.5 w-3.5" />
                Coller
              </button>
            )}
            <button
              onClick={() => setSelectedCells(new Set())}
              className="text-xs text-amber-600 hover:text-amber-800"
            >
              Tout désélectionner
            </button>
          </div>
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
          className="ml-2 flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
        >
          <Calendar className="h-3.5 w-3.5" />
          Aujourd&apos;hui
        </button>

        <div className="ml-auto flex items-center gap-1.5">
          {/* Weekend toggle */}
          <button
            onClick={() => setShowWeekend((v) => !v)}
            title={showWeekend ? "Masquer samedi/dimanche" : "Afficher samedi/dimanche"}
            className={cn(
              "rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors",
              showWeekend
                ? "border-slate-200 text-slate-500 hover:bg-slate-50"
                : "border-primary-300 bg-primary-50 text-primary-700",
            )}
          >
            {showWeekend ? "Lun–Dim" : "Lun–Ven"}
          </button>
          {/* Compact view toggle */}
          <button
            onClick={() => setCompact((v) => !v)}
            title={compact ? "Vue normale" : "Vue compacte"}
            className={cn(
              "rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors",
              compact
                ? "border-primary-300 bg-primary-50 text-primary-700"
                : "border-slate-200 text-slate-500 hover:bg-slate-50",
            )}
          >
            {compact ? "Compact ✓" : "Compact"}
          </button>
        </div>
      </div>

      {/* Weekly grid */}
      <div className="flex-1 overflow-auto rounded-xl border border-slate-200 bg-white shadow-soft">
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <p className="text-sm text-slate-400">Chargement du planning…</p>
          </div>
        ) : !filteredMatrix.length ? (
          <div className="flex items-center justify-center py-20">
            <p className="text-sm text-slate-400">
              {searchQuery ? `Aucun résultat pour "${searchQuery}"` : "Aucun employé pour cette sélection"}
            </p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="sticky top-0 z-10 bg-slate-50">
              <tr>
                <th className="sticky left-0 z-20 min-w-[220px] border-r border-slate-200 bg-slate-50 px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Employé
                </th>
                {displayedDays.map((day) => {
                  const d = new Date(day);
                  const dow = d.getDay(); // 0=Sun,1=Mon,...,6=Sat
                  const isWeekend = dow === 0 || dow === 6;
                  const isToday = format(d, "yyyy-MM-dd") === format(new Date(), "yyyy-MM-dd");
                  // DAY_LABELS is Mon-indexed: dow 1→0,2→1,...,0→6
                  const labelIdx = dow === 0 ? 6 : dow - 1;
                  return (
                    <th
                      key={day}
                      className={cn(
                        "border-r border-slate-100 px-2 text-center",
                        compact ? "min-w-[110px] py-2" : "min-w-[130px] py-3",
                        isWeekend ? "bg-slate-100/80 text-slate-400" : "text-slate-600",
                        isToday && "bg-primary-50",
                      )}
                    >
                      <div className="text-xs font-semibold uppercase">
                        {DAY_LABELS[labelIdx]}
                      </div>
                      <div className={cn("font-bold", compact ? "text-base" : "text-lg", isToday && "text-primary-600")}>
                        {d.getDate()}
                      </div>
                      {!compact && (
                        <div className="text-[10px] font-normal text-slate-400">
                          {format(d, "MMM", { locale: fr })}
                        </div>
                      )}
                    </th>
                  );
                })}
                <th className="min-w-[80px] px-3 py-3 text-center text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Total
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredMatrix.map((row) => {
                const totalHours = row.cells.reduce((sum, c) => sum + (c.heuresDecimales ?? 0), 0);
                const completenessColor = getCompletenessColor(row.cells, data?.days ?? []);
                const completenessLabel = getCompletenessLabel(row.cells, data?.days ?? []);
                return (
                  <tr key={row.employee.id} className="group/row border-b border-slate-100 hover:bg-slate-50/30">
                    <td className="sticky left-0 z-10 border-r border-slate-200 bg-white px-3 py-2">
                      <div className="flex items-center gap-2">
                        <span
                          className={cn("h-2 w-2 shrink-0 rounded-full", completenessColor)}
                          title={completenessLabel}
                        />
                        <div className="min-w-0 flex-1">
                          <div className="truncate font-medium text-slate-800">
                            {row.employee.nom} {row.employee.prenom}
                          </div>
                          <div className="text-[10px] text-slate-400">
                            {row.employee.poste} · {row.employee.matricule}
                          </div>
                        </div>
                        {/* Row-level actions — visible on hover */}
                        <div className="hidden shrink-0 items-center gap-0.5 group-hover/row:flex">
                          <button
                            onClick={() => handleFillFromMonday(row.employee.id)}
                            title="Propager lundi → lun–ven"
                            className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                          >
                            <ArrowRight className="h-3 w-3" />
                          </button>
                          <button
                            onClick={() => handleCopyRow(row.employee.id)}
                            title="Copier la semaine"
                            className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                          >
                            <Copy className="h-3 w-3" />
                          </button>
                          {rowClipboard && (
                            <button
                              onClick={() => handlePasteRow(row.employee.id)}
                              title="Coller la semaine copiée"
                              className="rounded p-1 text-primary-400 hover:bg-primary-50 hover:text-primary-600"
                            >
                              <ClipboardPaste className="h-3 w-3" />
                            </button>
                          )}
                          <button
                            onClick={() => handleClearRow(row.employee.id)}
                            title="Effacer toute la semaine"
                            className="rounded p-1 text-slate-400 hover:bg-red-50 hover:text-red-500"
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                        </div>
                      </div>
                    </td>
                    {row.cells.filter((c) => displayedDays.includes(c.date)).map((cell) => {
                      const d = new Date(cell.date);
                      const isWeekend = d.getDay() === 0 || d.getDay() === 6;
                      const isToday = format(d, "yyyy-MM-dd") === format(new Date(), "yyyy-MM-dd");
                      const hasData = cell.absenceCode || cell.heureDebut;
                      const cellKey = `${row.employee.id}_${cell.date}`;
                      const isSelected = selectedCells.has(cellKey);
                      return (
                        <td
                          key={cell.date}
                          onMouseDown={(e) => handleCellMouseDown(row.employee.id, cell.date, e)}
                          onMouseEnter={() => handleCellMouseEnter(row.employee.id, cell.date)}
                          className={cn(
                            "group/cell relative cursor-pointer border-r border-slate-100 px-1 text-center transition-all select-none",
                            compact ? "py-0.5" : "py-1.5",
                            isWeekend && "bg-slate-50/80",
                            isToday && "bg-primary-50/40",
                            isSelected && "ring-2 ring-inset ring-amber-400 bg-amber-50/60",
                            !hasData && !isSelected && "hover:bg-primary-50 hover:ring-1 hover:ring-inset hover:ring-primary-200",
                            hasData && !isSelected && "hover:bg-slate-50",
                          )}
                          onClick={(e) => handleCellClick(row.employee.id, cell.date, cell, e)}
                        >
                          {cell.absenceCode ? (
                            <div className="flex flex-col items-center gap-0.5">
                              <span
                                className="inline-block rounded-md px-2 py-1 text-[11px] font-semibold leading-tight text-white"
                                style={{ backgroundColor: cell.absenceColor ?? "#94a3b8" }}
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
                              {cell.heuresDecimales != null && cell.heuresDecimales > 0 && (
                                <span className="text-[10px] font-medium text-slate-600">
                                  {cell.heuresDecimales.toFixed(1)}h
                                </span>
                              )}
                              {/* Quick-clear button */}
                              <button
                                className="absolute right-0.5 top-0.5 hidden h-4 w-4 items-center justify-center rounded-full bg-slate-200/80 text-slate-500 hover:bg-red-100 hover:text-red-600 group-hover/cell:flex"
                                onClick={(e) => handleClearCell(row.employee.id, cell.date, e)}
                                title="Effacer"
                              >
                                <X className="h-2.5 w-2.5" />
                              </button>
                            </div>
                          ) : (
                            <div className="flex h-10 items-center justify-center">
                              <span className="text-xs text-slate-200 group-hover/cell:text-primary-300">+</span>
                            </div>
                          )}
                        </td>
                      );
                    })}
                    <td className="px-3 py-2 text-center">
                      <span className={cn("text-sm font-bold", totalHours > 0 ? "text-slate-800" : "text-slate-300")}>
                        {totalHours > 0 ? totalHours.toFixed(1) + "h" : "—"}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-slate-200 bg-slate-50/80">
                <td className="sticky left-0 z-10 border-r border-slate-200 bg-slate-50 px-4 py-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Totaux
                </td>
                {displayedDays.map((day) => {
                  const total = dailyTotals[day] ?? 0;
                  const d = new Date(day);
                  const isWeekend = d.getDay() === 0 || d.getDay() === 6;
                  return (
                    <td
                      key={day}
                      className={cn(
                        "border-r border-slate-100 px-2 py-2 text-center",
                        isWeekend && "bg-slate-100/60",
                      )}
                    >
                      {total > 0 ? (
                        <span className="text-xs font-bold text-slate-700">{total.toFixed(1)}h</span>
                      ) : (
                        <span className="text-xs text-slate-300">—</span>
                      )}
                    </td>
                  );
                })}
                <td className="px-3 py-2 text-center">
                  <span className="text-xs font-bold text-primary-600">
                    {Object.values(dailyTotals).reduce((a, b) => a + b, 0).toFixed(1)}h
                  </span>
                </td>
              </tr>
            </tfoot>
          </table>
        )}
      </div>

      {/* Edit popover (single cell or selection) */}
      {editingPopover && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setEditingPopover(null)} />
          <div
            className="fixed z-50 w-80 rounded-xl border border-slate-200 bg-white shadow-elevated animate-scale-in"
            style={{ left: editingPopover.rect.left, top: editingPopover.rect.top }}
          >
            {/* Popover header */}
            <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
              <p className="text-sm font-semibold text-slate-700">
                {editingPopover.mode === "cell"
                  ? format(new Date(editingPopover.date), "EEEE d MMMM", { locale: fr })
                  : `Modifier ${selectedCells.size} cellule${selectedCells.size > 1 ? "s" : ""}`}
              </p>
              <button
                onClick={() => setEditingPopover(null)}
                className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-4 p-4">
              {/* Visual absence code picker */}
              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-400">Statut</p>
                <div className="flex flex-wrap gap-1.5">
                  {/* "Effacer" chip */}
                  <button
                    onClick={() => setPopoverData((prev) => ({ ...prev, absenceCodeId: "" }))}
                    className={cn(
                      "rounded-md border-2 px-2.5 py-1 text-[11px] font-semibold transition-all",
                      !popoverData.absenceCodeId
                        ? "border-slate-400 bg-slate-100 text-slate-600 ring-2 ring-slate-400/30"
                        : "border-slate-200 bg-white text-slate-400 hover:border-slate-300 hover:bg-slate-50",
                    )}
                  >
                    Aucun
                  </button>
                  {absenceCodes.map((ac) => {
                    const isActive = popoverData.absenceCodeId === ac.id;
                    return (
                      <button
                        key={ac.id}
                        onClick={() => setPopoverData((prev) => ({ ...prev, absenceCodeId: ac.id }))}
                        title={ac.code}
                        className={cn(
                          "rounded-md border-2 px-2.5 py-1 text-[11px] font-semibold text-white transition-all",
                          isActive ? "scale-105 border-white shadow-md ring-2 ring-offset-1" : "border-transparent opacity-80 hover:opacity-100 hover:scale-105",
                        )}
                        style={{
                          backgroundColor: ac.color ?? "#94a3b8",
                          ...(isActive ? { ringColor: ac.color ?? "#94a3b8" } : {}),
                        }}
                      >
                        {ac.code.length > 12 ? ac.code.slice(0, 10) + "…" : ac.code}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Time presets */}
              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-400">Horaires</p>
                <div className="mb-2 flex gap-1.5 flex-wrap">
                  {TIME_PRESETS.map((p) => {
                    const isActive = popoverData.heureDebut === p.start && popoverData.heureFin === p.end;
                    return (
                      <button
                        key={p.label}
                        onClick={() =>
                          setPopoverData((prev) => ({
                            ...prev,
                            heureDebut: isActive ? "" : p.start,
                            heureFin: isActive ? "" : p.end,
                          }))
                        }
                        className={cn(
                          "rounded-md border px-2.5 py-1 text-[11px] font-semibold transition-all",
                          isActive
                            ? "border-primary-400 bg-primary-50 text-primary-700"
                            : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50",
                        )}
                      >
                        {p.label}
                      </button>
                    );
                  })}
                  {(popoverData.heureDebut || popoverData.heureFin) && (
                    <button
                      onClick={() => setPopoverData((prev) => ({ ...prev, heureDebut: "", heureFin: "" }))}
                      className="rounded-md border border-slate-200 px-2 py-1 text-[11px] text-slate-400 hover:text-red-500"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  )}
                </div>
                {/* Manual time inputs */}
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10px] font-medium text-slate-400">Début</label>
                    <input
                      type="time"
                      value={popoverData.heureDebut}
                      onChange={(e) => setPopoverData((prev) => ({ ...prev, heureDebut: e.target.value }))}
                      className="mt-0.5 w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-medium text-slate-400">Fin</label>
                    <input
                      type="time"
                      value={popoverData.heureFin}
                      onChange={(e) => setPopoverData((prev) => ({ ...prev, heureFin: e.target.value }))}
                      className="mt-0.5 w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20"
                    />
                  </div>
                </div>
                {durationPreview && (
                  <p className="mt-1.5 text-center text-xs font-semibold text-primary-600">
                    = {durationPreview}
                  </p>
                )}
              </div>

              {/* Copy / Paste — only in single-cell mode */}
              {editingPopover.mode === "cell" && (
                <div className="flex gap-2">
                  <button
                    onClick={() => setClipboard({ ...popoverData })}
                    className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-slate-200 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
                  >
                    <Copy className="h-3.5 w-3.5" />
                    Copier
                  </button>
                  {clipboard && (
                    <button
                      onClick={() => setPopoverData({ ...clipboard })}
                      className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-primary-200 bg-primary-50 py-1.5 text-xs font-medium text-primary-700 hover:bg-primary-100"
                    >
                      <ClipboardPaste className="h-3.5 w-3.5" />
                      Coller
                    </button>
                  )}
                </div>
              )}

              <button
                onClick={handleSavePopover}
                disabled={isPendingSave}
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary-600 py-2.5 text-sm font-semibold text-white hover:bg-primary-700 disabled:opacity-50"
              >
                <Save className="h-4 w-4" />
                {isPendingSave ? "Sauvegarde…" : "Enregistrer"}
              </button>

              {/* Fill full week — cell mode only */}
              {editingPopover?.mode === "cell" && popoverData.absenceCodeId && data?.days && (
                <button
                  onClick={() => {
                    const weekdays = data.days.filter((d) => {
                      const dow = new Date(d).getDay();
                      return dow !== 0 && dow !== 6;
                    });
                    const entries = weekdays.map((day) => ({
                      employeeId: (editingPopover as { mode: "cell"; employeeId: string; date: string; rect: { left: number; top: number } }).employeeId,
                      date: day,
                      absenceCodeId: popoverData.absenceCodeId || null,
                      heureDebut: popoverData.heureDebut || null,
                      heureFin: popoverData.heureFin || null,
                    }));
                    bulkSaveMutation.mutate(entries);
                  }}
                  disabled={bulkSaveMutation.isPending}
                  className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-slate-200 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50"
                >
                  <ArrowRight className="h-3.5 w-3.5" />
                  Appliquer à toute la semaine (lun–ven)
                </button>
              )}
            </div>
          </div>
        </>
      )}

      {/* Bulk absence dialog */}
      {showBulkDialog && (
        <>
          <div className="fixed inset-0 z-40 bg-black/30" onClick={() => setShowBulkDialog(false)} />
          <div className="fixed left-1/2 top-1/2 z-50 w-full max-w-lg -translate-x-1/2 -translate-y-1/2 rounded-xl border border-slate-200 bg-white p-6 shadow-elevated">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-slate-900">Saisie en masse</h3>
              <button
                onClick={() => setShowBulkDialog(false)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <p className="mt-1 text-sm text-slate-500">
              Appliquer un code absence ou des horaires sur une plage de dates pour un ou plusieurs employés.
            </p>

            <div className="mt-5 space-y-4">
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-700">Code absence / statut *</label>
                <select
                  value={bulkData.absenceCodeId}
                  onChange={(e) => setBulkData((prev) => ({ ...prev, absenceCodeId: e.target.value }))}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20"
                >
                  <option value="">Sélectionner</option>
                  {absenceCodes.map((ac) => (
                    <option key={ac.id} value={ac.id}>{ac.code}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-slate-700">Heure début</label>
                  <input
                    type="time"
                    value={bulkData.heureDebut}
                    onChange={(e) => setBulkData((prev) => ({ ...prev, heureDebut: e.target.value }))}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-primary-500"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-slate-700">Heure fin</label>
                  <input
                    type="time"
                    value={bulkData.heureFin}
                    onChange={(e) => setBulkData((prev) => ({ ...prev, heureFin: e.target.value }))}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-primary-500"
                  />
                </div>
              </div>

              {bulkData.heureDebut && bulkData.heureFin && computeDuration(bulkData.heureDebut, bulkData.heureFin) && (
                <p className="text-center text-xs font-medium text-primary-600">
                  = {computeDuration(bulkData.heureDebut, bulkData.heureFin)}
                </p>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-slate-700">Date début *</label>
                  <input
                    type="date"
                    value={bulkData.dateFrom}
                    onChange={(e) => setBulkData((prev) => ({ ...prev, dateFrom: e.target.value }))}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-primary-500"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-slate-700">Date fin *</label>
                  <input
                    type="date"
                    value={bulkData.dateTo}
                    onChange={(e) => setBulkData((prev) => ({ ...prev, dateTo: e.target.value }))}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-primary-500"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <label className="text-sm font-medium text-slate-700">Employés</label>
                  <label className="flex items-center gap-1.5 text-xs text-slate-500">
                    <input
                      type="checkbox"
                      checked={bulkData.allEmployees}
                      onChange={(e) =>
                        setBulkData((prev) => ({ ...prev, allEmployees: e.target.checked, employeeIds: [] }))
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
                          checked={bulkData.employeeIds.includes(row.employee.id)}
                          onChange={() => toggleEmployeeSelection(row.employee.id)}
                          className="rounded border-slate-300"
                        />
                        <span className="text-slate-700">
                          {row.employee.nom} {row.employee.prenom}
                        </span>
                        <span className="text-xs text-slate-400">{row.employee.poste}</span>
                      </label>
                    ))}
                  </div>
                )}
              </div>

              {bulkPreview && (
                <div className="rounded-lg border border-slate-100 bg-slate-50 p-3 text-sm">
                  <p className="font-medium text-slate-700">
                    Aperçu : {bulkPreview.total} jour{bulkPreview.total > 1 ? "s" : ""} ×{" "}
                    {bulkPreview.empCount} employé{bulkPreview.empCount > 1 ? "s" : ""} ={" "}
                    <span className="text-primary-600">
                      {bulkPreview.total * bulkPreview.empCount} entrées
                    </span>
                  </p>
                  {bulkPreview.weekends > 0 && (
                    <p className="mt-1 text-xs text-slate-500">
                      {bulkPreview.weekdays} jours de semaine + {bulkPreview.weekends} weekends
                      {bulkPreview.weekendInclusive ? (
                        <span className="ml-1 font-medium text-amber-600">→ weekends inclus (7j/7)</span>
                      ) : (
                        <span className="ml-1 font-medium text-blue-600">→ weekends en Repos automatique</span>
                      )}
                    </p>
                  )}
                </div>
              )}
            </div>

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
                  (!bulkData.allEmployees && bulkData.employeeIds.length === 0) ||
                  bulkAbsenceMutation.isPending
                }
                className="rounded-lg bg-amber-600 px-6 py-2 text-sm font-medium text-white hover:bg-amber-700 disabled:opacity-50"
              >
                {bulkAbsenceMutation.isPending ? "Application…" : "Appliquer"}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
