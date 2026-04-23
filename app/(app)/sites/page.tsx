"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Plus, MapPin, Trash2, Users } from "lucide-react";
import { useSession } from "next-auth/react";

interface Site {
  id: string;
  code: string;
  label: string;
  isActive: boolean;
  _count: { employees: number };
}

export default function SitesPage() {
  const { data: session } = useSession();
  const isAdmin = session?.user?.role === "ADMIN";
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [newCode, setNewCode] = useState("");
  const [newLabel, setNewLabel] = useState("");

  const { data: sites = [], isLoading } = useQuery<Site[]>({
    queryKey: ["sites"],
    queryFn: async () => {
      const res = await fetch("/api/sites");
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
      if (!res.ok) throw new Error("Erreur");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sites"] });
      setNewCode("");
      setNewLabel("");
      setShowForm(false);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/sites/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Erreur");
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["sites"] }),
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Sites</h1>
          <p className="text-sm text-slate-500">{sites.length} site(s)</p>
        </div>
        {isAdmin && (
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
          <p className="col-span-full py-10 text-center text-sm text-slate-400">Chargement...</p>
        ) : (
          sites.map((site) => (
            <div
              key={site.id}
              className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-soft"
            >
              <div className="flex items-center gap-3">
                <MapPin className="h-5 w-5 text-slate-400" />
                <div>
                  <p className="text-sm font-semibold text-slate-700">{site.code}</p>
                  <p className="text-xs text-slate-400">{site.label}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className="flex items-center gap-1 text-xs text-slate-400">
                  <Users className="h-3.5 w-3.5" />
                  {site._count.employees}
                </span>
                {isAdmin && site._count.employees === 0 && (
                  <button
                    onClick={() => {
                      if (confirm(`Supprimer ${site.code} ?`)) deleteMutation.mutate(site.id);
                    }}
                    className="rounded p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-500"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
