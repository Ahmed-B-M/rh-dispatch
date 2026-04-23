"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useSession } from "next-auth/react";
import { Plus, Shield, UserPlus, Trash2 } from "lucide-react";

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
    },
  });

  function toggleSite(siteId: string) {
    setNewUser((prev) => ({
      ...prev,
      siteIds: prev.siteIds.includes(siteId)
        ? prev.siteIds.filter((id) => id !== siteId)
        : [...prev.siteIds, siteId],
    }));
  }

  if (!isAdmin) {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-sm text-slate-400">Accès réservé aux administrateurs</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Paramètres</h1>
        <p className="text-sm text-slate-500">Gestion des utilisateurs et des accès</p>
      </div>

      {/* Users section */}
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
                <label className="text-sm font-medium text-slate-700">Nom</label>
                <input
                  value={newUser.name}
                  onChange={(e) => setNewUser((p) => ({ ...p, name: e.target.value }))}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-primary-500"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-700">Email</label>
                <input
                  type="email"
                  value={newUser.email}
                  onChange={(e) => setNewUser((p) => ({ ...p, email: e.target.value }))}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-primary-500"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-700">Mot de passe</label>
                <input
                  type="password"
                  value={newUser.password}
                  onChange={(e) => setNewUser((p) => ({ ...p, password: e.target.value }))}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-primary-500"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-700">Rôle</label>
                <select
                  value={newUser.role}
                  onChange={(e) => setNewUser((p) => ({ ...p, role: e.target.value }))}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-primary-500"
                >
                  <option value="ADMIN">Admin</option>
                  <option value="RESPONSABLE">Responsable</option>
                </select>
              </div>
            </div>

            {newUser.role === "RESPONSABLE" && (
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-700">Sites autorisés</label>
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
                  Le responsable aura accès uniquement aux données des sites sélectionnés
                </p>
              </div>
            )}

            <div className="flex justify-end">
              <button
                onClick={() => createUserMutation.mutate()}
                disabled={!newUser.name || !newUser.email || !newUser.password || createUserMutation.isPending}
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
    </div>
  );
}
