"use client";

import { useQuery } from "@tanstack/react-query";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Edit, Calendar } from "lucide-react";
import { cn, formatDate } from "@/lib/utils";
import { useSession } from "next-auth/react";

export default function EmployeeDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data: session } = useSession();
  const isAdmin = session?.user?.role === "ADMIN";

  const { data: employee, isLoading } = useQuery({
    queryKey: ["employee", id],
    queryFn: async () => {
      const res = await fetch(`/api/employees/${id}`);
      if (!res.ok) throw new Error("Employé non trouvé");
      return res.json();
    },
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
              <span className="font-mono text-xs text-slate-400">#{employee.matricule}</span>
              <span
                className={cn(
                  "rounded-full px-2.5 py-0.5 text-xs font-medium",
                  categorieColors[employee.categorie] ?? "bg-slate-100 text-slate-600",
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
        <Link
          href={`/employes/${id}/modifier`}
          className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
        >
          <Edit className="h-4 w-4" />
          Modifier
        </Link>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Info card */}
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-soft lg:col-span-1">
          <h2 className="mb-4 text-sm font-semibold text-slate-900">Informations</h2>
          <dl className="space-y-3">
            {[
              ["Contrat", employee.typeContrat],
              ["Poste", employee.poste],
              ["Affectation", employee.affectationCode || "—"],
              ["Date entrée", formatDate(employee.dateEntree)],
              ["Date début", formatDate(employee.dateDebut)],
              ["Date sortie", employee.dateSortie ? formatDate(employee.dateSortie) : "—"],
            ].map(([label, value]) => (
              <div key={label} className="flex justify-between">
                <dt className="text-xs text-slate-400">{label}</dt>
                <dd className="text-sm font-medium text-slate-700">{value}</dd>
              </div>
            ))}
          </dl>

          {employee.sites?.length > 0 && (
            <div className="mt-4 border-t border-slate-100 pt-4">
              <p className="mb-2 text-xs text-slate-400">Sites</p>
              <div className="flex flex-wrap gap-1">
                {employee.sites.map((s: { site: { code: string } }) => (
                  <span
                    key={s.site.code}
                    className="rounded bg-slate-100 px-2 py-0.5 text-xs text-slate-600"
                  >
                    {s.site.code}
                  </span>
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
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-slate-900">Dernières entrées</h2>
            <Calendar className="h-4 w-4 text-slate-400" />
          </div>
          {employee.entries?.length > 0 ? (
            <div className="overflow-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-slate-100">
                    <th className="px-3 py-2 text-left text-slate-400">Date</th>
                    <th className="px-3 py-2 text-left text-slate-400">Jour</th>
                    <th className="px-3 py-2 text-left text-slate-400">Motif</th>
                    <th className="px-3 py-2 text-left text-slate-400">Début</th>
                    <th className="px-3 py-2 text-left text-slate-400">Fin</th>
                    <th className="px-3 py-2 text-left text-slate-400">Heures</th>
                  </tr>
                </thead>
                <tbody>
                  {employee.entries.map((entry: Record<string, unknown>) => (
                    <tr key={entry.id as string} className="border-b border-slate-50">
                      <td className="px-3 py-2 text-slate-600">
                        {formatDate(entry.date as string)}
                      </td>
                      <td className="px-3 py-2 text-slate-500">{entry.dayName as string}</td>
                      <td className="px-3 py-2">
                        {entry.absenceCode ? (
                          <span
                            className="rounded px-1.5 py-0.5 text-xs font-medium text-white"
                            style={{
                              backgroundColor: (entry.absenceCode as { color: string }).color,
                            }}
                          >
                            {(entry.absenceCode as { code: string }).code}
                          </span>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="px-3 py-2 text-slate-500">{(entry.heureDebut as string) ?? "—"}</td>
                      <td className="px-3 py-2 text-slate-500">{(entry.heureFin as string) ?? "—"}</td>
                      <td className="px-3 py-2 font-medium text-slate-700">
                        {entry.heuresDecimales != null ? `${entry.heuresDecimales}h` : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-sm text-slate-400">Aucune entrée enregistrée</p>
          )}
        </div>
      </div>
    </div>
  );
}
