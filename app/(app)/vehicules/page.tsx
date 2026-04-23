"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Plus, Truck, Trash2, Pencil, X, Check } from "lucide-react";
import { useSession } from "next-auth/react";
import { toast } from "sonner";

interface Vehicle {
  id: string;
  registration: string;
  isActive: boolean;
}

export default function VehiculesPage() {
  const { data: session } = useSession();
  const canManage =
    session?.user?.role === "ADMIN" || session?.user?.role === "RESPONSABLE";
  const queryClient = useQueryClient();
  const [newRegistration, setNewRegistration] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editRegistration, setEditRegistration] = useState("");
  const [deleteConfirm, setDeleteConfirm] = useState<Vehicle | null>(null);

  const { data: vehicles = [], isLoading } = useQuery<Vehicle[]>({
    queryKey: ["vehicles"],
    queryFn: async () => {
      const res = await fetch("/api/vehicles");
      if (!res.ok) throw new Error(`Erreur ${res.status}`);
      return res.json();
    },
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/vehicles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ registration: newRegistration }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Erreur de création");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vehicles"] });
      setNewRegistration("");
      setShowForm(false);
      toast.success("Véhicule ajouté");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, registration }: { id: string; registration: string }) => {
      const res = await fetch(`/api/vehicles/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ registration }),
      });
      if (!res.ok) throw new Error("Erreur de modification");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vehicles"] });
      setEditingId(null);
      toast.success("Véhicule mis à jour");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/vehicles/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Erreur de suppression");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vehicles"] });
      setDeleteConfirm(null);
      toast.success("Véhicule supprimé");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Véhicules</h1>
          <p className="text-sm text-slate-500">
            {vehicles.length} véhicule(s)
          </p>
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
            placeholder="Immatriculation (ex: DE-854-MV)"
            value={newRegistration}
            onChange={(e) => setNewRegistration(e.target.value.toUpperCase())}
            className="flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-primary-500"
          />
          <button
            onClick={() => createMutation.mutate()}
            disabled={!newRegistration || createMutation.isPending}
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
          vehicles.map((v) => (
            <div
              key={v.id}
              className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-soft"
            >
              {editingId === v.id ? (
                <div className="flex flex-1 items-center gap-2">
                  <input
                    value={editRegistration}
                    onChange={(e) =>
                      setEditRegistration(e.target.value.toUpperCase())
                    }
                    className="flex-1 rounded border border-primary-300 px-2 py-1 font-mono text-sm outline-none focus:ring-2 focus:ring-primary-500/20"
                  />
                  <button
                    onClick={() =>
                      updateMutation.mutate({
                        id: v.id,
                        registration: editRegistration,
                      })
                    }
                    disabled={
                      !editRegistration.trim() || updateMutation.isPending
                    }
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
                    <Truck className="h-5 w-5 text-slate-400" />
                    <span className="font-mono text-sm font-medium text-slate-700">
                      {v.registration}
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    {canManage && (
                      <button
                        onClick={() => {
                          setEditingId(v.id);
                          setEditRegistration(v.registration);
                        }}
                        className="rounded p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                    )}
                    {canManage && (
                      <button
                        onClick={() => setDeleteConfirm(v)}
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
              Supprimer {deleteConfirm.registration} ?
            </h3>
            <p className="mt-2 text-sm text-slate-500">
              Cette action est irréversible. Le véhicule sera définitivement
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
