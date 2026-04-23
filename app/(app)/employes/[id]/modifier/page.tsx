"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useParams, useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";

interface Site {
  id: string;
  code: string;
  label: string;
}

export default function ModifierEmployePage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [error, setError] = useState("");

  const [form, setForm] = useState({
    matricule: "",
    nom: "",
    prenom: "",
    typeContrat: "CDI",
    categorie: "TRANSPORT",
    poste: "",
    affectationCode: "",
    dateDebut: "",
    dateEntree: "",
    dateFin: "",
    dateSortie: "",
    isActive: true,
    note: "",
    siteIds: [] as string[],
  });

  const { data: employee, isLoading } = useQuery({
    queryKey: ["employee", id],
    queryFn: async () => {
      const res = await fetch(`/api/employees/${id}`);
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

  useEffect(() => {
    if (employee) {
      setForm({
        matricule: employee.matricule,
        nom: employee.nom,
        prenom: employee.prenom,
        typeContrat: employee.typeContrat,
        categorie: employee.categorie,
        poste: employee.poste,
        affectationCode: employee.affectationCode ?? "",
        dateDebut: employee.dateDebut?.split("T")[0] ?? "",
        dateEntree: employee.dateEntree?.split("T")[0] ?? "",
        dateFin: employee.dateFin?.split("T")[0] ?? "",
        dateSortie: employee.dateSortie?.split("T")[0] ?? "",
        isActive: employee.isActive,
        note: employee.note ?? "",
        siteIds: employee.sites?.map((s: { site: { id: string } }) => s.site.id) ?? [],
      });
    }
  }, [employee]);

  const mutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/employees/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          affectationCode: form.affectationCode || null,
          dateFin: form.dateFin || null,
          dateSortie: form.dateSortie || null,
        }),
      });
      if (!res.ok) throw new Error("Erreur de modification");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["employee", id] });
      queryClient.invalidateQueries({ queryKey: ["employees"] });
      toast.success("Employé mis à jour");
      router.push(`/employes/${id}`);
    },
    onError: (err: Error) => { setError(err.message); toast.error(err.message); },
  });

  function updateField(field: string, value: unknown) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  function toggleSite(siteId: string) {
    setForm((prev) => ({
      ...prev,
      siteIds: prev.siteIds.includes(siteId)
        ? prev.siteIds.filter((s) => s !== siteId)
        : [...prev.siteIds, siteId],
    }));
  }

  if (isLoading) {
    return <div className="py-20 text-center text-sm text-slate-400">Chargement...</div>;
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="flex items-center gap-4">
        <Link href={`/employes/${id}`} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Modifier l&apos;employé</h1>
          <p className="text-sm text-slate-500">
            {form.nom} {form.prenom} — #{form.matricule}
          </p>
        </div>
      </div>

      <form
        onSubmit={(e) => { e.preventDefault(); mutation.mutate(); }}
        className="space-y-6 rounded-xl border border-slate-200 bg-white p-6 shadow-soft"
      >
        {error && <div className="rounded-md bg-red-50 px-4 py-3 text-sm text-red-600">{error}</div>}

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-slate-700">Matricule</label>
            <input
              value={form.matricule}
              onChange={(e) => updateField("matricule", e.target.value)}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-slate-700">Poste</label>
            <input
              value={form.poste}
              onChange={(e) => updateField("poste", e.target.value)}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-slate-700">Nom</label>
            <input
              value={form.nom}
              onChange={(e) => updateField("nom", e.target.value)}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-slate-700">Prénom</label>
            <input
              value={form.prenom}
              onChange={(e) => updateField("prenom", e.target.value)}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-slate-700">Type contrat</label>
            <select
              value={form.typeContrat}
              onChange={(e) => updateField("typeContrat", e.target.value)}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            >
              <option value="CDI">CDI</option>
              <option value="CDD">CDD</option>
              <option value="ALTERNANCE">Alternance</option>
            </select>
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-slate-700">Catégorie</label>
            <select
              value={form.categorie}
              onChange={(e) => updateField("categorie", e.target.value)}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            >
              <option value="SEDENTAIRE">Sédentaire</option>
              <option value="TRANSPORT">Transport</option>
              <option value="LOGISTIQUE">Logistique</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-slate-700">Date début contrat</label>
            <input
              type="date"
              value={form.dateDebut}
              onChange={(e) => updateField("dateDebut", e.target.value)}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-primary-500"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-slate-700">
              Date fin contrat {form.typeContrat !== "CDI" && <span className="text-red-500">*</span>}
            </label>
            <input
              type="date"
              value={form.dateFin}
              onChange={(e) => updateField("dateFin", e.target.value)}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-primary-500"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-slate-700">Date entrée</label>
            <input
              type="date"
              value={form.dateEntree}
              onChange={(e) => updateField("dateEntree", e.target.value)}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-primary-500"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-slate-700">Date sortie</label>
            <input
              type="date"
              value={form.dateSortie}
              onChange={(e) => updateField("dateSortie", e.target.value)}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-primary-500"
            />
          </div>
        </div>

        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={form.isActive}
              onChange={(e) => updateField("isActive", e.target.checked)}
              className="rounded border-slate-300"
            />
            Employé actif
          </label>
        </div>

        <div className="space-y-1.5">
          <label className="text-sm font-medium text-slate-700">Sites</label>
          <div className="flex flex-wrap gap-2">
            {sites.map((site) => (
              <button
                key={site.id}
                type="button"
                onClick={() => toggleSite(site.id)}
                className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
                  form.siteIds.includes(site.id)
                    ? "border-primary-500 bg-primary-50 text-primary-700"
                    : "border-slate-200 text-slate-600 hover:border-slate-300"
                }`}
              >
                {site.code}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="text-sm font-medium text-slate-700">Note</label>
          <textarea
            value={form.note}
            onChange={(e) => updateField("note", e.target.value)}
            rows={3}
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20"
          />
        </div>

        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={() => router.back()}
            className="rounded-lg border border-slate-200 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50"
          >
            Annuler
          </button>
          <button
            type="submit"
            disabled={mutation.isPending}
            className="rounded-lg bg-primary-600 px-6 py-2 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50"
          >
            {mutation.isPending ? "Sauvegarde..." : "Enregistrer"}
          </button>
        </div>
      </form>
    </div>
  );
}
