"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useParams } from "next/navigation";
import Link from "next/link";
import { useState } from "react";
import { ArrowLeft, Edit, Calendar, ArrowRightLeft } from "lucide-react";
import { cn, formatDate } from "@/lib/utils";

interface Site {
  id: string;
  code: string;
  label: string;
}

interface EmployeeSiteRecord {
  id: string;
  siteId: string;
  startDate: string;
  endDate: string | null;
  site: { code: string; label: string };
}

export default function EmployeeDetailPage() {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const [showTransfer, setShowTransfer] = useState(false);
  const [transferData, setTransferData] = useState({
    newSiteId: "",
    newPoste: "",
    effectiveDate: new Date().toISOString().split("T")[0],
  });
  const [transferError, setTransferError] = useState("");

  const { data: employee, isLoading } = useQuery({
    queryKey: ["employee", id],
    queryFn: async () => {
      const res = await fetch(`/api/employees/${id}`);
      if (!res.ok) throw new Error("Employé non trouvé");
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

  const transferMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/employees/${id}/transfer`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          newSiteId: transferData.newSiteId,
          newPoste: transferData.newPoste || undefined,
          effectiveDate: transferData.effectiveDate,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Erreur de transfert");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["employee", id] });
      queryClient.invalidateQueries({ queryKey: ["employees"] });
      queryClient.invalidateQueries({ queryKey: ["planning"] });
      setShowTransfer(false);
      setTransferError("");
    },
    onError: (err: Error) => setTransferError(err.message),
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-sm text-slate-400">Chargement...</p>
      </div>
    );
  }

  if (!employee) {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-sm text-red-500">Employé non trouvé</p>
      </div>
    );
  }

  const categorieColors: Record<string, string> = {
    SEDENTAIRE: "bg-purple-100 text-purple-700",
    TRANSPORT: "bg-blue-100 text-blue-700",
    LOGISTIQUE: "bg-emerald-100 text-emerald-700",
  };

  const activeSites = (employee.sites ?? []).filter(
    (s: EmployeeSiteRecord) => !s.endDate,
  );
  const pastSites = (employee.sites ?? []).filter(
    (s: EmployeeSiteRecord) => s.endDate,
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link
            href="/employes"
            className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">
              {employee.nom} {employee.prenom}
            </h1>
            <div className="mt-1 flex items-center gap-2">
              <span className="font-mono text-xs text-slate-400">
                #{employee.matricule}
              </span>
              <span
                className={cn(
                  "rounded-full px-2.5 py-0.5 text-xs font-medium",
                  categorieColors[employee.categorie] ??
                    "bg-slate-100 text-slate-600",
                )}
              >
                {employee.categorie}
              </span>
              <span
                className={cn(
                  "rounded-full px-2 py-0.5 text-xs font-medium",
                  employee.isActive
                    ? "bg-emerald-100 text-emerald-700"
                    : "bg-red-100 text-red-700",
                )}
              >
                {employee.isActive ? "Actif" : "Sorti"}
              </span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowTransfer(true)}
            className="inline-flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2 text-sm font-medium text-amber-700 hover:bg-amber-100"
          >
            <ArrowRightLeft className="h-4 w-4" />
            Transférer
          </button>
          <Link
            href={`/employes/${id}/modifier`}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
          >
            <Edit className="h-4 w-4" />
            Modifier
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Info card */}
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-soft lg:col-span-1">
          <h2 className="mb-4 text-sm font-semibold text-slate-900">
            Informations
          </h2>
          <dl className="space-y-3">
            {[
              ["Contrat", employee.typeContrat],
              ["Poste", employee.poste],
              ["Affectation", employee.affectationCode || "—"],
              ["Date entrée", formatDate(employee.dateEntree)],
              ["Date début", formatDate(employee.dateDebut)],
              [
                "Date sortie",
                employee.dateSortie ? formatDate(employee.dateSortie) : "—",
              ],
            ].map(([label, value]) => (
              <div key={label} className="flex justify-between">
                <dt className="text-xs text-slate-400">{label}</dt>
                <dd className="text-sm font-medium text-slate-700">{value}</dd>
              </div>
            ))}
          </dl>

          {activeSites.length > 0 && (
            <div className="mt-4 border-t border-slate-100 pt-4">
              <p className="mb-2 text-xs font-medium text-slate-500">
                Site(s) actuel(s)
              </p>
              <div className="flex flex-wrap gap-1">
                {activeSites.map((s: EmployeeSiteRecord) => (
                  <span
                    key={s.id}
                    className="rounded bg-primary-50 px-2 py-0.5 text-xs font-medium text-primary-700"
                  >
                    {s.site.code}
                    <span className="ml-1 text-primary-400">
                      depuis {formatDate(s.startDate)}
                    </span>
                  </span>
                ))}
              </div>
            </div>
          )}

          {pastSites.length > 0 && (
            <div className="mt-3">
              <p className="mb-2 text-xs font-medium text-slate-400">
                Historique sites
              </p>
              <div className="space-y-1">
                {pastSites.map((s: EmployeeSiteRecord) => (
                  <div
                    key={s.id}
                    className="flex items-center gap-2 text-xs text-slate-400"
                  >
                    <span className="rounded bg-slate-100 px-1.5 py-0.5">
                      {s.site.code}
                    </span>
                    <span>
                      {formatDate(s.startDate)} → {formatDate(s.endDate!)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {employee.note && (
            <div className="mt-4 border-t border-slate-100 pt-4">
              <p className="mb-1 text-xs text-slate-400">Note</p>
              <p className="text-sm text-slate-600">{employee.note}</p>
            </div>
          )}
        </div>

        {/* Recent entries */}
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-soft lg:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-900">
              Dernières entrées
            </h2>
            <Calendar className="h-4 w-4 text-slate-400" />
          </div>
          {employee.entries?.length > 0 ? (
            <div className="overflow-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-slate-100">
                    <th className="px-3 py-2 text-left text-slate-400">Date</th>
                    <th className="px-3 py-2 text-left text-slate-400">Jour</th>
                    <th className="px-3 py-2 text-left text-slate-400">
                      Motif
                    </th>
                    <th className="px-3 py-2 text-left text-slate-400">
                      Début
                    </th>
                    <th className="px-3 py-2 text-left text-slate-400">Fin</th>
                    <th className="px-3 py-2 text-left text-slate-400">
                      Heures
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {employee.entries.map(
                    (entry: Record<string, unknown>) => (
                      <tr
                        key={entry.id as string}
                        className="border-b border-slate-50"
                      >
                        <td className="px-3 py-2 text-slate-600">
                          {formatDate(entry.date as string)}
                        </td>
                        <td className="px-3 py-2 text-slate-500">
                          {entry.dayName as string}
                        </td>
                        <td className="px-3 py-2">
                          {entry.absenceCode ? (
                            <span
                              className="rounded px-1.5 py-0.5 text-xs font-medium text-white"
                              style={{
                                backgroundColor: (
                                  entry.absenceCode as { color: string }
                                ).color,
                              }}
                            >
                              {(entry.absenceCode as { code: string }).code}
                            </span>
                          ) : (
                            "—"
                          )}
                        </td>
                        <td className="px-3 py-2 text-slate-500">
                          {(entry.heureDebut as string) ?? "—"}
                        </td>
                        <td className="px-3 py-2 text-slate-500">
                          {(entry.heureFin as string) ?? "—"}
                        </td>
                        <td className="px-3 py-2 font-medium text-slate-700">
                          {entry.heuresDecimales != null
                            ? `${entry.heuresDecimales}h`
                            : "—"}
                        </td>
                      </tr>
                    ),
                  )}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-sm text-slate-400">
              Aucune entrée enregistrée
            </p>
          )}
        </div>
      </div>

      {/* Transfer dialog */}
      {showTransfer && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/30"
            onClick={() => setShowTransfer(false)}
          />
          <div className="fixed left-1/2 top-1/2 z-50 w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-xl border border-slate-200 bg-white p-6 shadow-elevated">
            <h3 className="text-lg font-bold text-slate-900">
              Transférer {employee.nom} {employee.prenom}
            </h3>
            <p className="mt-1 text-sm text-slate-500">
              L&apos;employé sera retiré de son site actuel à la date choisie et
              affecté au nouveau site. L&apos;historique des données passées est
              conservé.
            </p>

            {transferError && (
              <div className="mt-3 rounded-md bg-red-50 px-4 py-2 text-sm text-red-600">
                {transferError}
              </div>
            )}

            <div className="mt-4 space-y-4">
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-700">
                  Nouveau site *
                </label>
                <select
                  value={transferData.newSiteId}
                  onChange={(e) =>
                    setTransferData((prev) => ({
                      ...prev,
                      newSiteId: e.target.value,
                    }))
                  }
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20"
                >
                  <option value="">Sélectionner un site</option>
                  {sites.map((site) => (
                    <option key={site.id} value={site.id}>
                      {site.code} — {site.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-700">
                  Nouveau poste (optionnel)
                </label>
                <input
                  type="text"
                  value={transferData.newPoste}
                  onChange={(e) =>
                    setTransferData((prev) => ({
                      ...prev,
                      newPoste: e.target.value,
                    }))
                  }
                  placeholder={employee.poste}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-700">
                  Date d&apos;effet *
                </label>
                <input
                  type="date"
                  value={transferData.effectiveDate}
                  onChange={(e) =>
                    setTransferData((prev) => ({
                      ...prev,
                      effectiveDate: e.target.value,
                    }))
                  }
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20"
                />
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={() => setShowTransfer(false)}
                className="rounded-lg border border-slate-200 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50"
              >
                Annuler
              </button>
              <button
                onClick={() => transferMutation.mutate()}
                disabled={
                  !transferData.newSiteId ||
                  !transferData.effectiveDate ||
                  transferMutation.isPending
                }
                className="rounded-lg bg-amber-600 px-6 py-2 text-sm font-medium text-white hover:bg-amber-700 disabled:opacity-50"
              >
                {transferMutation.isPending
                  ? "Transfert..."
                  : "Confirmer le transfert"}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
