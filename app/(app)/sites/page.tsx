"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Plus, MapPin, Trash2, Users, Pencil, X, Check } from "lucide-react";
import { PageHelp } from "@/components/ui/page-help";
import { useSession } from "next-auth/react";
import { toast } from "sonner";

interface Site {
  id: string;
  code: string;
  label: string;
  isActive: boolean;
  _count: { employees: number };
}

export default function SitesPage() {
  const { data: session } = useSession();
  const canManage =
    session?.user?.role === "ADMIN" || session?.user?.role === "RESPONSABLE";
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [newCode, setNewCode] = useState("");
  const [newLabel, setNewLabel] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editCode, setEditCode] = useState("");
  const [editLabel, setEditLabel] = useState("");
  const [deleteConfirm, setDeleteConfirm] = useState<Site | null>(null);

  const { data: sites = [], isLoading } = useQuery<Site[]>({
    queryKey: ["sites"],
    queryFn: async () => {
      const res = await fetch("/api/sites");
      if (!res.ok) throw new Error(`Erreur ${res.status}`);
      return res.json();
    },
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/sites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: newCode, label: newLabel }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Erreur de création");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sites"] });
      setNewCode("");
      setNewLabel("");
      setShowForm(false);
      toast.success("Site créé");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, code, label }: { id: string; code: string; label: string }) => {
      const res = await fetch(`/api/sites/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, label }),
      });
      if (!res.ok) throw new Error("Erreur de modification");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sites"] });
      setEditingId(null);
      toast.success("Site mis à jour");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/sites/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Erreur de suppression");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sites"] });
      setDeleteConfirm(null);
      toast.success("Site supprimé");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  function startEdit(site: Site) {
    setEditingId(site.id);
    setEditCode(site.code);
    setEditLabel(site.label);
  }

  function saveEdit(id: string) {
    if (!editCode.trim() || !editLabel.trim()) return;
    updateMutation.mutate({ id, code: editCode, label: editLabel });
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Sites</h1>
            <p className="text-sm text-slate-500">{sites.length} site(s)</p>
          </div>
          <PageHelp
            title="Sites"
            description="Référentiel des sites logistiques de l'entreprise."
            sections={[
              {
                title: "Utilisation",
                items: [
                  "Les sites sont utilisés pour filtrer le planning et les rapports.",
                  "Chaque employé est rattaché à un ou plusieurs sites.",
                  "Le compteur indique le nombre d'employés actifs rattachés au site.",
                ],
              },
              {
                title: "Gestion",
                items: [
                  "Créez un site avec un code court (ex : RUNGIS) et un libellé complet.",
                  "Modifiez le libellé ou le code d'un site existant via l'icône crayon.",
                  "Un site avec des employés ne peut pas être supprimé.",
                ],
              },
            ]}
          />
        </div>
        {canManage && (
          <button
            onClick={() => setShowForm(!showForm)}
            className="inline-flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-primary-700"
          >
            <Plus className="h-4 w-4" />
            Ajouter
          </button>
        )}
      </div>

      {showForm && (
        <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-soft">
          <input
            type="text"
            placeholder="Code (ex: RUNGIS)"
            value={newCode}
            onChange={(e) => setNewCode(e.target.value.toUpperCase())}
            className="w-32 rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-primary-500"
          />
          <input
            type="text"
            placeholder="Libellé (ex: Rungis)"
            value={newLabel}
            onChange={(e) => setNewLabel(e.target.value)}
            className="flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-primary-500"
          />
          <button
            onClick={() => createMutation.mutate()}
            disabled={!newCode || !newLabel || createMutation.isPending}
            className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50"
          >
            Créer
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {isLoading ? (
          <p className="col-span-full py-10 text-center text-sm text-slate-400">
            Chargement...
          </p>
        ) : (
          sites.map((site) => (
            <div
              key={site.id}
              className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-soft"
            >
              {editingId === site.id ? (
                <div className="flex flex-1 items-center gap-2">
                  <input
                    value={editCode}
                    onChange={(e) => setEditCode(e.target.value.toUpperCase())}
                    className="w-24 rounded border border-primary-300 px-2 py-1 text-sm font-semibold outline-none focus:ring-2 focus:ring-primary-500/20"
                  />
                  <input
                    value={editLabel}
                    onChange={(e) => setEditLabel(e.target.value)}
                    className="flex-1 rounded border border-primary-300 px-2 py-1 text-sm outline-none focus:ring-2 focus:ring-primary-500/20"
                  />
                  <button
                    onClick={() => saveEdit(site.id)}
                    disabled={updateMutation.isPending}
                    className="rounded p-1.5 text-emerald-600 hover:bg-emerald-50"
                  >
                    <Check className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => setEditingId(null)}
                    className="rounded p-1.5 text-slate-400 hover:bg-slate-100"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ) : (
                <>
                  <div className="flex items-center gap-3">
                    <MapPin className="h-5 w-5 text-slate-400" />
                    <div>
                      <p className="text-sm font-semibold text-slate-700">
                        {site.code}
                      </p>
                      <p className="text-xs text-slate-400">{site.label}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="flex items-center gap-1 text-xs text-slate-400">
                      <Users className="h-3.5 w-3.5" />
                      {site._count.employees}
                    </span>
                    {canManage && (
                      <button
                        onClick={() => startEdit(site)}
                        className="rounded p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                    )}
                    {canManage && site._count.employees === 0 && (
                      <button
                        onClick={() => setDeleteConfirm(site)}
                        className="rounded p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-500"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </>
              )}
            </div>
          ))
        )}
      </div>

      {/* Delete confirmation dialog */}
      {deleteConfirm && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/30"
            onClick={() => setDeleteConfirm(null)}
          />
          <div className="fixed left-1/2 top-1/2 z-50 w-full max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-xl border border-slate-200 bg-white p-6 shadow-elevated">
            <h3 className="text-lg font-bold text-slate-900">
              Supprimer {deleteConfirm.code} ?
            </h3>
            <p className="mt-2 text-sm text-slate-500">
              Cette action est irréversible. Le site sera définitivement
              supprimé.
            </p>
            <div className="mt-5 flex justify-end gap-3">
              <button
                onClick={() => setDeleteConfirm(null)}
                className="rounded-lg border border-slate-200 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50"
              >
                Annuler
              </button>
              <button
                onClick={() => deleteMutation.mutate(deleteConfirm.id)}
                disabled={deleteMutation.isPending}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
              >
                {deleteMutation.isPending ? "Suppression..." : "Supprimer"}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
