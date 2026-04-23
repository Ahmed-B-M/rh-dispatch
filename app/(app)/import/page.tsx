"use client";

import { useState, useCallback } from "react";
import { Upload, FileSpreadsheet, Check, AlertTriangle, Loader2 } from "lucide-react";

type Step = "upload" | "preview" | "result";

interface PreviewData {
  employees: number;
  entries: number;
  months: string[];
  errors: string[];
  sampleEmployees: { matricule: string; nomPrenom: string; typeContrat: string }[];
}

interface ImportResult {
  success: boolean;
  employeesImported: number;
  entriesImported: number;
  entriesSkipped: number;
  errors: string[];
}

export default function ImportPage() {
  const [step, setStep] = useState<Step>("upload");
  const [file, setFile] = useState<File | null>(null);
  const [source, setSource] = useState("HEURES_ROSNY");
  const [categorie, setCategorie] = useState("LOGISTIQUE");
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState<PreviewData | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState("");

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile?.name.endsWith(".xlsx")) {
      setFile(droppedFile);
    }
  }, []);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) setFile(selectedFile);
  }, []);

  async function handlePreview() {
    if (!file) return;
    setLoading(true);
    setError("");

    const formData = new FormData();
    formData.append("file", file);
    formData.append("source", source);
    formData.append("categorie", categorie);
    formData.append("dryRun", "true");

    try {
      const res = await fetch("/api/import", { method: "POST", body: formData });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Erreur de prévisualisation");
      }
      const data = await res.json();
      setPreview(data);
      setStep("preview");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  async function handleImport() {
    if (!file) return;
    setLoading(true);
    setError("");

    const formData = new FormData();
    formData.append("file", file);
    formData.append("source", source);
    formData.append("categorie", categorie);

    try {
      const res = await fetch("/api/import", { method: "POST", body: formData });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Erreur d'import");
      }
      const data = await res.json();
      setResult(data);
      setStep("result");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  function reset() {
    setStep("upload");
    setFile(null);
    setPreview(null);
    setResult(null);
    setError("");
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Import Excel</h1>
        <p className="text-sm text-slate-500">
          Importez les fichiers HEURES Excel pour alimenter la base de données
        </p>
      </div>

      {/* Step indicator */}
      <div className="flex items-center gap-3">
        {(["upload", "preview", "result"] as const).map((s, i) => (
          <div key={s} className="flex items-center gap-2">
            <div
              className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold ${
                step === s
                  ? "bg-primary-600 text-white"
                  : i < ["upload", "preview", "result"].indexOf(step)
                    ? "bg-emerald-500 text-white"
                    : "bg-slate-200 text-slate-400"
              }`}
            >
              {i + 1}
            </div>
            <span className="text-sm text-slate-600">
              {s === "upload" ? "Upload" : s === "preview" ? "Prévisualisation" : "Résultat"}
            </span>
            {i < 2 && <div className="mx-2 h-px w-8 bg-slate-200" />}
          </div>
        ))}
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600">
          <AlertTriangle className="h-4 w-4" />
          {error}
        </div>
      )}

      {/* Step 1: Upload */}
      {step === "upload" && (
        <div className="space-y-4 rounded-xl border border-slate-200 bg-white p-6 shadow-soft">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-slate-700">Source</label>
              <select
                value={source}
                onChange={(e) => setSource(e.target.value)}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-primary-500"
              >
                <option value="HEURES_ROSNY">HEURES ROSNY (Logistique)</option>
                <option value="HEURES_CARREFOUR">HEURES CARREFOUR (Transport)</option>
                <option value="HEURES_DISPATCHEURS">HEURES DISPATCHEURS (Transport)</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-slate-700">Catégorie</label>
              <select
                value={categorie}
                onChange={(e) => setCategorie(e.target.value)}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-primary-500"
              >
                <option value="LOGISTIQUE">Logistique</option>
                <option value="TRANSPORT">Transport</option>
                <option value="SEDENTAIRE">Sédentaire</option>
              </select>
            </div>
          </div>

          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleDrop}
            className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 p-10 transition-colors hover:border-primary-400 hover:bg-primary-50/30"
          >
            {file ? (
              <>
                <FileSpreadsheet className="h-10 w-10 text-emerald-500" />
                <p className="mt-3 text-sm font-medium text-slate-700">{file.name}</p>
                <p className="text-xs text-slate-400">
                  {(file.size / 1024 / 1024).toFixed(1)} MB
                </p>
                <button
                  onClick={() => setFile(null)}
                  className="mt-2 text-xs text-red-500 hover:underline"
                >
                  Retirer
                </button>
              </>
            ) : (
              <>
                <Upload className="h-10 w-10 text-slate-400" />
                <p className="mt-3 text-sm text-slate-500">
                  Glissez un fichier .xlsx ici ou{" "}
                  <label className="cursor-pointer text-primary-600 hover:underline">
                    parcourir
                    <input
                      type="file"
                      accept=".xlsx"
                      onChange={handleFileSelect}
                      className="hidden"
                    />
                  </label>
                </p>
              </>
            )}
          </div>

          <div className="flex justify-end">
            <button
              onClick={handlePreview}
              disabled={!file || loading}
              className="inline-flex items-center gap-2 rounded-lg bg-primary-600 px-6 py-2.5 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50"
            >
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              Prévisualiser
            </button>
          </div>
        </div>
      )}

      {/* Step 2: Preview */}
      {step === "preview" && preview && (
        <div className="space-y-4 rounded-xl border border-slate-200 bg-white p-6 shadow-soft">
          <h2 className="text-lg font-semibold text-slate-900">Prévisualisation</h2>

          <div className="grid grid-cols-3 gap-4">
            <div className="rounded-lg border border-slate-200 p-4 text-center">
              <p className="text-2xl font-bold text-primary-600">{preview.employees}</p>
              <p className="text-xs text-slate-400">Employés</p>
            </div>
            <div className="rounded-lg border border-slate-200 p-4 text-center">
              <p className="text-2xl font-bold text-primary-600">
                {preview.entries.toLocaleString("fr-FR")}
              </p>
              <p className="text-xs text-slate-400">Entrées</p>
            </div>
            <div className="rounded-lg border border-slate-200 p-4 text-center">
              <p className="text-2xl font-bold text-primary-600">{preview.months.length}</p>
              <p className="text-xs text-slate-400">Mois</p>
            </div>
          </div>

          {preview.sampleEmployees.length > 0 && (
            <div>
              <p className="mb-2 text-sm font-medium text-slate-700">Employés détectés (10 premiers) :</p>
              <div className="overflow-auto rounded-lg border border-slate-100">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-slate-50">
                      <th className="px-3 py-2 text-left text-slate-400">Matricule</th>
                      <th className="px-3 py-2 text-left text-slate-400">Nom Prénom</th>
                      <th className="px-3 py-2 text-left text-slate-400">Contrat</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.sampleEmployees.map((emp) => (
                      <tr key={emp.matricule} className="border-t border-slate-50">
                        <td className="px-3 py-1.5 font-mono">{emp.matricule}</td>
                        <td className="px-3 py-1.5">{emp.nomPrenom}</td>
                        <td className="px-3 py-1.5">{emp.typeContrat}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {preview.errors.length > 0 && (
            <div className="rounded-lg bg-amber-50 p-3">
              <p className="text-xs font-medium text-amber-700">
                {preview.errors.length} avertissement(s)
              </p>
            </div>
          )}

          <div className="flex justify-between">
            <button
              onClick={() => setStep("upload")}
              className="rounded-lg border border-slate-200 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50"
            >
              Retour
            </button>
            <button
              onClick={handleImport}
              disabled={loading}
              className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-6 py-2.5 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
            >
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              Lancer l&apos;import
            </button>
          </div>
        </div>
      )}

      {/* Step 3: Result */}
      {step === "result" && result && (
        <div className="space-y-4 rounded-xl border border-slate-200 bg-white p-6 shadow-soft">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-100">
              <Check className="h-5 w-5 text-emerald-600" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Import terminé</h2>
              <p className="text-sm text-slate-500">Le fichier a été traité avec succès</p>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-center">
              <p className="text-2xl font-bold text-emerald-600">{result.employeesImported}</p>
              <p className="text-xs text-emerald-600">Employés importés</p>
            </div>
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-center">
              <p className="text-2xl font-bold text-emerald-600">
                {result.entriesImported.toLocaleString("fr-FR")}
              </p>
              <p className="text-xs text-emerald-600">Entrées importées</p>
            </div>
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-center">
              <p className="text-2xl font-bold text-amber-600">{result.entriesSkipped}</p>
              <p className="text-xs text-amber-600">Ignorées</p>
            </div>
          </div>

          {result.errors.length > 0 && (
            <div className="max-h-40 overflow-auto rounded-lg bg-red-50 p-3">
              <p className="mb-1 text-xs font-medium text-red-700">Erreurs :</p>
              {result.errors.map((err, i) => (
                <p key={i} className="text-xs text-red-600">
                  {err}
                </p>
              ))}
            </div>
          )}

          <div className="flex justify-end">
            <button
              onClick={reset}
              className="rounded-lg bg-primary-600 px-6 py-2.5 text-sm font-medium text-white hover:bg-primary-700"
            >
              Nouvel import
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
