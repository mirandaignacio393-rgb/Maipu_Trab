"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSignUp, setIsSignUp] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const fn = isSignUp
        ? supabase.auth.signUp({ email, password })
        : supabase.auth.signInWithPassword({ email, password });
      const { error } = await fn;
      if (error) throw error;
      router.push("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error de autenticación");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen">
      {/* Panel de marca — visible en pantallas grandes */}
      <div className="relative hidden w-1/2 flex-col justify-between overflow-hidden bg-ink-900 p-12 text-ink-50 lg:flex">
        <div
          className="pointer-events-none absolute inset-0 opacity-40"
          style={{
            backgroundImage:
              "radial-gradient(circle at 20% 20%, rgb(47 128 120 / 0.5), transparent 45%), radial-gradient(circle at 80% 85%, rgb(217 122 63 / 0.35), transparent 45%)",
          }}
        />
        <div className="relative z-10 flex items-center gap-2 text-lg font-semibold tracking-tight">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-500 font-display text-base italic text-white">
            N
          </span>
          Núcleo
        </div>
        <div className="relative z-10 max-w-md">
          <h1 className="font-display text-4xl italic leading-tight text-white">
            El conocimiento de tu empresa, en un solo lugar.
          </h1>
          <p className="mt-4 text-ink-300">
            Cada área con su propio experto en IA: manuales, procedimientos y
            videos convertidos en respuestas al instante, con la fuente exacta
            de cada una.
          </p>
        </div>
        <p className="relative z-10 text-sm text-ink-400">
          Recursos Humanos · Marketing · Ventas · Logística · Administración
        </p>
      </div>

      {/* Formulario */}
      <div className="flex w-full flex-1 items-center justify-center bg-ink-50 p-6 lg:w-1/2">
        <div className="w-full max-w-sm">
          <div className="mb-8 flex items-center gap-2 lg:hidden">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-500 font-display text-base italic text-white">
              N
            </span>
            <span className="text-lg font-semibold">Núcleo</span>
          </div>

          <h2 className="font-display text-2xl italic text-ink-900">
            {isSignUp ? "Creá tu cuenta" : "Bienvenido de nuevo"}
          </h2>
          <p className="mt-1 text-sm text-ink-500">
            {isSignUp
              ? "Empezá a centralizar el conocimiento de tu empresa."
              : "Ingresá para consultar el conocimiento de tu equipo."}
          </p>

          <form onSubmit={handleSubmit} className="mt-6 space-y-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-ink-600">
                Email
              </label>
              <input
                type="email"
                required
                placeholder="nombre@empresa.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-lg border border-ink-200 bg-white px-3 py-2.5 text-sm text-ink-900 shadow-soft outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-ink-600">
                Contraseña
              </label>
              <input
                type="password"
                required
                minLength={6}
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-lg border border-ink-200 bg-white px-3 py-2.5 text-sm text-ink-900 shadow-soft outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
              />
            </div>

            {error && (
              <p className="rounded-lg bg-accent-light/25 px-3 py-2 text-sm text-accent-dark">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-lg bg-ink-900 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:opacity-60"
            >
              {loading ? "Un momento…" : isSignUp ? "Crear cuenta" : "Ingresar"}
            </button>
          </form>

          <button
            onClick={() => {
              setIsSignUp(!isSignUp);
              setError(null);
            }}
            className="mt-5 w-full text-center text-sm text-brand-700 hover:text-brand-800"
          >
            {isSignUp
              ? "Ya tengo una cuenta"
              : "¿Primera vez? Creá una cuenta nueva"}
          </button>
        </div>
      </div>
    </main>
  );
}
