"use client";

import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";
import { Suspense, useState } from "react";
import { AlertCircle, Loader2 } from "lucide-react";

/* ── Décoration SVG — grille de nœuds logistiques ───── */
function GridDecoration() {
  return (
    <svg
      aria-hidden
      className="pointer-events-none absolute inset-0 h-full w-full opacity-[0.07]"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <pattern id="grid" width="48" height="48" patternUnits="userSpaceOnUse">
          <circle cx="24" cy="24" r="1.5" fill="white" />
        </pattern>
        <radialGradient id="fade" cx="50%" cy="40%" r="60%">
          <stop offset="0%"   stopColor="white" stopOpacity="1" />
          <stop offset="100%" stopColor="white" stopOpacity="0" />
        </radialGradient>
        <mask id="m">
          <rect width="100%" height="100%" fill="url(#fade)" />
        </mask>
      </defs>
      <rect width="100%" height="100%" fill="url(#grid)" mask="url(#m)" />
    </svg>
  );
}

/* ── Lignes de connexion animées ─────────────────────── */
function ConnectionLines() {
  const lines = [
    { x1: "20%",  y1: "30%", x2: "50%",  y2: "55%" },
    { x1: "50%",  y1: "55%", x2: "78%",  y2: "35%" },
    { x1: "50%",  y1: "55%", x2: "65%",  y2: "75%" },
    { x1: "30%",  y1: "70%", x2: "50%",  y2: "55%" },
  ];
  const nodes = [
    { cx: "20%", cy: "30%", r: 4 },
    { cx: "78%", cy: "35%", r: 5 },
    { cx: "65%", cy: "75%", r: 3 },
    { cx: "30%", cy: "70%", r: 4 },
    { cx: "50%", cy: "55%", r: 6 },
  ];
  return (
    <svg
      aria-hidden
      className="pointer-events-none absolute inset-0 h-full w-full opacity-20"
    >
      {lines.map((l, i) => (
        <line
          key={i}
          x1={l.x1} y1={l.y1} x2={l.x2} y2={l.y2}
          stroke="rgba(165,180,252,0.8)"
          strokeWidth="1"
          strokeDasharray="4 4"
        />
      ))}
      {nodes.map((n, i) => (
        <circle key={i} cx={n.cx} cy={n.cy} r={n.r}
          fill="rgba(129,140,248,0.5)" stroke="rgba(199,210,254,0.6)" strokeWidth="1.5" />
      ))}
    </svg>
  );
}

/* ── Formulaire de connexion ─────────────────────────── */
function SignInForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") ?? "/";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    const result = await signIn("credentials", { email, password, redirect: false });
    if (result?.error) {
      setError("Email ou mot de passe incorrect");
      setLoading(false);
    } else {
      router.push(callbackUrl);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {error && (
        <div className="flex items-center gap-2 rounded-lg bg-danger-50 px-3 py-2.5 text-sm text-danger-600">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      <div className="space-y-1.5">
        <label htmlFor="email" className="text-sm font-medium text-slate-700">
          Adresse email
        </label>
        <input
          id="email"
          type="email"
          required
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="prenom.nom@id-logistics.com"
          className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-4 py-2.5 text-sm text-slate-900 placeholder-slate-400 outline-none transition-all focus:border-primary-400 focus:bg-white focus:ring-3 focus:ring-primary-500/15"
        />
      </div>

      <div className="space-y-1.5">
        <label htmlFor="password" className="text-sm font-medium text-slate-700">
          Mot de passe
        </label>
        <input
          id="password"
          type="password"
          required
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-4 py-2.5 text-sm text-slate-900 outline-none transition-all focus:border-primary-400 focus:bg-white focus:ring-3 focus:ring-primary-500/15"
        />
      </div>

      <button
        type="submit"
        disabled={loading}
        className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary-600 py-2.5 text-sm font-semibold text-white shadow-sm transition-all hover:bg-primary-700 hover:shadow-md active:scale-[0.99] disabled:opacity-60"
      >
        {loading ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Connexion…
          </>
        ) : (
          "Se connecter"
        )}
      </button>
    </form>
  );
}

/* ── Page principale ─────────────────────────────────── */
export default function SignInPage() {
  return (
    <div className="flex min-h-screen">

      {/* Panneau gauche — branding */}
      <div
        className="relative hidden flex-col justify-between overflow-hidden p-12 lg:flex lg:w-[52%]"
        style={{
          background: "linear-gradient(145deg, #1a1f42 0%, #0f1729 45%, #0d1117 100%)",
        }}
      >
        {/* Illustration de fond */}
        <div
          className="pointer-events-none absolute inset-0 opacity-20"
          style={{
            backgroundImage: "url('/illustrations/login-bg.svg')",
            backgroundSize: "cover",
            backgroundPosition: "center",
          }}
        />
        <GridDecoration />
        <ConnectionLines />

        {/* Logo */}
        <div className="relative flex items-center gap-3">
          <Image src="/favicon.svg" alt="RH Dispatch" width={40} height={40} className="rounded-xl" />
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-widest text-indigo-400">
              ID Logistics
            </p>
            <p className="text-xl font-bold text-white">RH Dispatch</p>
          </div>
        </div>

        {/* Tagline centrale */}
        <div className="relative">
          <div
            aria-hidden
            className="absolute -inset-8 rounded-3xl opacity-30 blur-3xl"
            style={{ background: "radial-gradient(circle, #4f46e5 0%, transparent 70%)" }}
          />
          <h2 className="relative text-4xl font-bold leading-tight text-white">
            Pilotez vos équipes<br />
            <span className="text-indigo-300">avec précision.</span>
          </h2>
          <p className="relative mt-4 max-w-sm text-base leading-relaxed text-slate-400">
            Planification hebdomadaire, suivi des absences et récapitulatifs mensuels — en un seul outil.
          </p>
        </div>

        {/* Stats footer */}
        <div className="relative flex items-center gap-8 border-t pt-8" style={{ borderColor: "rgba(255,255,255,0.08)" }}>
          {[
            { value: "8", label: "sites" },
            { value: "∞", label: "employés" },
            { value: "100%", label: "en ligne" },
          ].map((s) => (
            <div key={s.label}>
              <p className="text-2xl font-bold text-white">{s.value}</p>
              <p className="text-xs text-slate-500">{s.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Panneau droit — formulaire */}
      <div className="flex flex-1 flex-col items-center justify-center bg-white px-6 py-12">
        {/* Mobile logo */}
        <div className="mb-8 flex items-center gap-3 lg:hidden">
          <Image src="/favicon.svg" alt="RH Dispatch" width={36} height={36} className="rounded-lg" />
          <span className="text-lg font-bold text-slate-900">RH Dispatch</span>
        </div>

        <div className="w-full max-w-sm">
          <div className="mb-8">
            <h1 className="text-2xl font-bold text-slate-900">Connexion</h1>
            <p className="mt-1.5 text-sm text-slate-500">
              Bienvenue — entrez vos identifiants pour accéder à votre espace.
            </p>
          </div>

          <Suspense fallback={
            <div className="flex items-center justify-center py-8 text-sm text-slate-400">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Chargement…
            </div>
          }>
            <SignInForm />
          </Suspense>
        </div>

        <p className="mt-auto pt-12 text-xs text-slate-400">
          © {new Date().getFullYear()} ID Logistics · RH Dispatch
        </p>
      </div>
    </div>
  );
}
