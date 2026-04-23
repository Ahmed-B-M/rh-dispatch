"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useSession } from "next-auth/react";
import { Plus, Shield, UserPlus, Trash2, Briefcase, Pencil, Check, X } from "lucide-react";
import { PageHelp } from "@/components/ui/page-help";
import { toast } from "sonner";

interface UserItem {
  id: string;
  name: string;
  email: string;
  role: string;
  sites: { site: { id: string; code: string; label: string } }[];
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
  isActive: boolean;
}

export default function ParametresPage() {
  const { data: session } = useSession();
  const isAdmin = session?.user?.role === "ADMIN";
  const queryClient = useQueryClient();

  const [showUserForm, setShowUserForm] = useState(false);
  const [newUser, setNewUser] = useState({
    name: "",
    email: "",
    password: "",
    role: "RESPONSABLE" as string,
    siteIds: [] as string[],
  });

  const [showPosteForm, setShowPosteForm] = useState(false);
  const [newPoste, setNewPoste] = useState({ label: "", mealAllowance: "", pauseMinutes: "" });
  const [editingPosteId, setEditingPosteId] = useState<string | null>(null);
  const [editPoste, setEditPoste] = useState({ label: "", mealAllowance: "", pauseMinutes: "" });
  const [deletePosteConfirm, setDeletePosteConfirm] = useState<PosteConfig | null>(null);

  const { data: users = [] } = useQuery<UserItem[]>({
    queryKey: ["users"],
    queryFn: async () => {
      const res = await fetch("/api/users");
      if (!res.ok) return [];
      return res.json();
    },
    enabled: isAdmin,
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

  const createUserMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newUser),
      });
      if (!res.ok) throw new Error("Erreur de création");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
      setNewUser({ name: "", email: "", password: "", role: "RESPONSABLE", siteIds: [] });
      setShowUserForm(false);
      toast.success("Utilisateur créé");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const createPosteMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/postes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          label: newPoste.label,
          mealAllowance: parseFloat(newPoste.mealAllowance) || 0,
          pauseMinutes: parseInt(newPoste.pauseMinutes, 10) || 0,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Erreur");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["postes"] });
      setNewPoste({ label: "", mealAllowance: "", pauseMinutes: "" });
      setShowPosteForm(false);
      toast.success("Poste créé");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const updatePosteMutation = useMutation({
    mutationFn: async ({ id, label, mealAllowance, pauseMinutes }: { id: string; label: string; mealAllowance: number; pauseMinutes: number }) => {
      const res = await fetch(`/api/postes/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label, mealAllowance, pauseMinutes }),
      });
      if (!res.ok) throw new Error("Erreur de modification");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["postes"] });
      setEditingPosteId(null);
      toast.success("Poste mis à jour");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const deletePosteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/postes/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Erreur de suppression");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["postes"] });
      setDeletePosteConfirm(null);
      toast.success("Poste supprimé");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  function toggleSite(siteId: string) {
    setNewUser((prev) => ({
      ...prev,
      siteIds: prev.siteIds.includes(siteId)
        ? prev.siteIds.filter((id) => id !== siteId)
        : [...prev.siteIds, siteId],
    }));
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center gap-2">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Paramètres</h1>
          <p className="text-sm text-slate-500">
            Gestion des postes, paniers repas et utilisateurs
          </p>
        </div>
        <PageHelp
          title="Paramètres"
          description="Configuration des postes, indemnités et accès utilisateurs."
          sections={[
            {
              title: "Postes & Paniers repas",
              items: [
                "Chaque poste a un montant de panier repas journalier associé.",
                "Ces montants sont utilisés dans le calcul du Récap mensuel.",
                "Le temps de pause (en minutes) est déduit automatiquement des heures travaillées pour ce poste.",
                "Laissez la pause à 0 si le poste n'a pas de coupure réglementaire.",
                "Modifiez ou désactivez un poste sans perdre l'historique.",
              ],
            },
            {
              title: "Utilisateurs (admin uniquement)",
              items: [
                "Créez des comptes avec le rôle ADMIN ou RESPONSABLE.",
                "Un responsable ne voit que les données des sites qui lui sont assignés.",
                "Modifiez les sites autorisés d'un utilisateur via l'icône crayon.",
                "La suppression d'un utilisateur est irréversible.",
              ],
            },
          ]}
        />
      </div>

      {/* Postes section — visible to all authenticated users */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
            <Briefcase className="h-5 w-5 text-amber-500" />
            Postes &amp; Paniers repas ({postes.length})
          </h2>
          <button
            onClick={() => setShowPosteForm(!showPosteForm)}
            className="inline-flex items-center gap-2 rounded-lg bg-amber-600 px-4 py-2 text-sm font-medium text-white hover:bg-amber-700"
          >
            <Plus className="h-4 w-4" />
            Ajouter un poste
          </button>
        </div>

        <p className="text-xs text-slate-400">
          Configurez le montant du panier repas par poste. Le nom doit correspondre
          exactement au poste de l&apos;employé pour que le calcul du récap mensuel fonctionne.
        </p>

        {showPosteForm && (
          <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-soft">
            <input
              type="text"
              placeholder="Intitulé du poste"
              value={newPoste.label}
              onChange={(e) =>
                setNewPoste((p) => ({ ...p, label: e.target.value }))
              }
              className="flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-primary-500"
            />
            <div className="flex items-center gap-1">
              <input
                type="number"
                step="0.01"
                min="0"
                placeholder="0.00"
                value={newPoste.mealAllowance}
                onChange={(e) =>
                  setNewPoste((p) => ({ ...p, mealAllowance: e.target.value }))
                }
                className="w-24 rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-primary-500"
              />
              <span className="text-xs text-slate-400">€/j</span>
            </div>
            <div className="flex items-center gap-1">
              <input
                type="number"
                step="1"
                min="0"
                placeholder="0"
                value={newPoste.pauseMinutes}
                onChange={(e) =>
                  setNewPoste((p) => ({ ...p, pauseMinutes: e.target.value }))
                }
                className="w-20 rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-primary-500"
              />
              <span className="text-xs text-slate-400">min pause</span>
            </div>
            <button
              onClick={() => createPosteMutation.mutate()}
              disabled={
                !newPoste.label.trim() || createPosteMutation.isPending
              }
              className="rounded-lg bg-amber-600 px-4 py-2 text-sm font-medium text-white hover:bg-amber-700 disabled:opacity-50"
            >
              Créer
            </button>
          </div>
        )}

        <div className="space-y-2">
          {postes.map((poste) => (
            <div
              key={poste.id}
              className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-5 py-3 shadow-soft"
            >
              {editingPosteId === poste.id ? (
                <div className="flex flex-1 items-center gap-3">
                  <input
                    value={editPoste.label}
                    onChange={(e) =>
                      setEditPoste((p) => ({ ...p, label: e.target.value }))
                    }
                    className="flex-1 rounded border border-primary-300 px-2 py-1 text-sm outline-none focus:ring-2 focus:ring-primary-500/20"
                  />
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      step="0.01"
                      value={editPoste.mealAllowance}
                      onChange={(e) =>
                        setEditPoste((p) => ({
                          ...p,
                          mealAllowance: e.target.value,
                        }))
                      }
                      className="w-24 rounded border border-primary-300 px-2 py-1 text-sm outline-none focus:ring-2 focus:ring-primary-500/20"
                    />
                    <span className="text-xs text-slate-400">€/j</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      step="1"
                      min="0"
                      value={editPoste.pauseMinutes}
                      onChange={(e) =>
                        setEditPoste((p) => ({
                          ...p,
                          pauseMinutes: e.target.value,
                        }))
                      }
                      className="w-20 rounded border border-primary-300 px-2 py-1 text-sm outline-none focus:ring-2 focus:ring-primary-500/20"
                    />
                    <span className="text-xs text-slate-400">min</span>
                  </div>
                  <button
                    onClick={() =>
                      updatePosteMutation.mutate({
                        id: poste.id,
                        label: editPoste.label,
                        mealAllowance: parseFloat(editPoste.mealAllowance) || 0,
                        pauseMinutes: parseInt(editPoste.pauseMinutes, 10) || 0,
                      })
                    }
                    className="rounded p-1.5 text-emerald-600 hover:bg-emerald-50"
                  >
                    <Check className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => setEditingPosteId(null)}
                    className="rounded p-1.5 text-slate-400 hover:bg-slate-100"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ) : (
                <>
                  <div>
                    <p className="text-sm font-medium text-slate-900">
                      {poste.label}
                    </p>
                    <p className="text-xs text-slate-400">
                      Panier repas : {Number(poste.mealAllowance).toFixed(2)} €/jour
                      {(poste.pauseMinutes ?? 0) > 0 && ` · Pause : ${poste.pauseMinutes} min`}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-700">
                      {Number(poste.mealAllowance).toFixed(2)} €
                    </span>
                    {(poste.pauseMinutes ?? 0) > 0 && (
                      <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600">
                        {poste.pauseMinutes} min pause
                      </span>
                    )}
                    <button
                      onClick={() => {
                        setEditingPosteId(poste.id);
                        setEditPoste({
                          label: poste.label,
                          mealAllowance: String(poste.mealAllowance),
                          pauseMinutes: String(poste.pauseMinutes ?? 0),
                        });
                      }}
                      className="rounded p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => setDeletePosteConfirm(poste)}
                      className="rounded p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-500"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </>
              )}
            </div>
          ))}
          {postes.length === 0 && (
            <p className="py-6 text-center text-sm text-slate-400">
              Aucun poste configuré. Ajoutez les postes de vos employés pour
              activer le calcul des paniers repas dans le récap mensuel.
            </p>
          )}
        </div>
      </section>

      {/* Users section — admin only */}
      {isAdmin && (
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
              <Shield className="h-5 w-5 text-primary-500" />
              Utilisateurs ({users.length})
            </h2>
            <button
              onClick={() => setShowUserForm(!showUserForm)}
              className="inline-flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700"
            >
              <UserPlus className="h-4 w-4" />
              Nouvel utilisateur
            </button>
          </div>

          {showUserForm && (
            <div className="space-y-4 rounded-xl border border-slate-200 bg-white p-6 shadow-soft">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-slate-700">
                    Nom
                  </label>
                  <input
                    value={newUser.name}
                    onChange={(e) =>
                      setNewUser((p) => ({ ...p, name: e.target.value }))
                    }
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-primary-500"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-slate-700">
                    Email
                  </label>
                  <input
                    type="email"
                    value={newUser.email}
                    onChange={(e) =>
                      setNewUser((p) => ({ ...p, email: e.target.value }))
                    }
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-primary-500"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-slate-700">
                    Mot de passe
                  </label>
                  <input
                    type="password"
                    value={newUser.password}
                    onChange={(e) =>
                      setNewUser((p) => ({ ...p, password: e.target.value }))
                    }
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-primary-500"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-slate-700">
                    Rôle
                  </label>
                  <select
                    value={newUser.role}
                    onChange={(e) =>
                      setNewUser((p) => ({ ...p, role: e.target.value }))
                    }
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-primary-500"
                  >
                    <option value="ADMIN">Admin</option>
                    <option value="RESPONSABLE">Responsable</option>
                  </select>
                </div>
              </div>

              {newUser.role === "RESPONSABLE" && (
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-slate-700">
                    Sites autorisés
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {sites.map((site) => (
                      <button
                        key={site.id}
                        type="button"
                        onClick={() => toggleSite(site.id)}
                        className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
                          newUser.siteIds.includes(site.id)
                            ? "border-primary-500 bg-primary-50 text-primary-700"
                            : "border-slate-200 text-slate-600 hover:border-slate-300"
                        }`}
                      >
                        {site.code}
                      </button>
                    ))}
                  </div>
                  <p className="text-xs text-slate-400">
                    Le responsable aura accès uniquement aux données des sites
                    sélectionnés
                  </p>
                </div>
              )}

              <div className="flex justify-end">
                <button
                  onClick={() => createUserMutation.mutate()}
                  disabled={
                    !newUser.name ||
                    !newUser.email ||
                    !newUser.password ||
                    createUserMutation.isPending
                  }
                  className="rounded-lg bg-primary-600 px-6 py-2 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50"
                >
                  Créer l&apos;utilisateur
                </button>
              </div>
            </div>
          )}

          <div className="space-y-3">
            {users.map((user) => (
              <div
                key={user.id}
                className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-5 py-4 shadow-soft"
              >
                <div>
                  <p className="font-medium text-slate-900">{user.name}</p>
                  <p className="text-xs text-slate-400">{user.email}</p>
                </div>
                <div className="flex items-center gap-3">
                  {user.sites.length > 0 && (
                    <div className="flex gap-1">
                      {user.sites.map((s) => (
                        <span
                          key={s.site.id}
                          className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-500"
                        >
                          {s.site.code}
                        </span>
                      ))}
                    </div>
                  )}
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                      user.role === "ADMIN"
                        ? "bg-red-100 text-red-700"
                        : "bg-blue-100 text-blue-700"
                    }`}
                  >
                    {user.role}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Delete poste dialog */}
      {deletePosteConfirm && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/30"
            onClick={() => setDeletePosteConfirm(null)}
          />
          <div className="fixed left-1/2 top-1/2 z-50 w-full max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-xl border border-slate-200 bg-white p-6 shadow-elevated">
            <h3 className="text-lg font-bold text-slate-900">
              Supprimer &laquo; {deletePosteConfirm.label} &raquo; ?
            </h3>
            <p className="mt-2 text-sm text-slate-500">
              Le poste sera supprimé de la configuration. Les employés associés
              ne seront pas affectés.
            </p>
            <div className="mt-5 flex justify-end gap-3">
              <button
                onClick={() => setDeletePosteConfirm(null)}
                className="rounded-lg border border-slate-200 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50"
              >
                Annuler
              </button>
              <button
                onClick={() =>
                  deletePosteMutation.mutate(deletePosteConfirm.id)
                }
                disabled={deletePosteMutation.isPending}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
              >
                {deletePosteMutation.isPending
                  ? "Suppression..."
                  : "Supprimer"}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
