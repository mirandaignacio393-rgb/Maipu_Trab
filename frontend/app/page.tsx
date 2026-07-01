"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import {
  Area,
  Company,
  createArea,
  createCompany,
  listAreas,
  listCompanies,
} from "@/lib/api";
import { AreaIcon } from "@/components/AreaIcon";

export default function Dashboard() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [selected, setSelected] = useState<Company | null>(null);
  const [areas, setAreas] = useState<Area[]>([]);
  const [newCompany, setNewCompany] = useState("");
  const [newArea, setNewArea] = useState("");
  const [showNewCompany, setShowNewCompany] = useState(false);
  const [showNewArea, setShowNewArea] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (!data.session) router.replace("/login");
      else setReady(true);
    });
  }, [router]);

  useEffect(() => {
    if (ready) refreshCompanies();
  }, [ready]);

  useEffect(() => {
    if (selected) listAreas(selected.id).then(setAreas);
    else setAreas([]);
  }, [selected]);

  async function refreshCompanies() {
    const cs = await listCompanies();
    setCompanies(cs);
    if (cs.length && !selected) setSelected(cs[0]);
  }

  async function handleCreateCompany(e: React.FormEvent) {
    e.preventDefault();
    if (!newCompany.trim()) return;
    await createCompany(newCompany.trim());
    setNewCompany("");
    setShowNewCompany(false);
    refreshCompanies();
  }

  async function handleCreateArea(e: React.FormEvent) {
    e.preventDefault();
    if (!selected || !newArea.trim()) return;
    await createArea({ company_id: selected.id, name: newArea.trim() });
    setNewArea("");
    setShowNewArea(false);
    listAreas(selected.id).then(setAreas);
  }

  async function logout() {
    await supabase.auth.signOut();
    router.replace("/login");
  }

  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center text-ink-400">
        Cargando…
      </div>
    );
  }

  return (
    <main className="min-h-screen">
      {/* Nav */}
      <header className="border-b border-ink-100 bg-white/70 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-500 font-display text-base italic text-white">
              N
            </span>
            <span className="text-lg font-semibold text-ink-900">Núcleo</span>
          </div>
          <button
            onClick={logout}
            className="text-sm text-ink-400 transition hover:text-ink-700"
          >
            Salir
          </button>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-6 py-10">
        <h1 className="font-display text-3xl italic text-ink-900">
          Mis empresas
        </h1>
        <p className="mt-1 text-sm text-ink-500">
          Elegí una empresa y explorá el conocimiento de cada área.
        </p>

        {/* Empresas */}
        <section className="mt-8">
          <div className="flex flex-wrap items-center gap-2">
            {companies.map((c) => (
              <button
                key={c.id}
                onClick={() => setSelected(c)}
                className={`rounded-full px-4 py-1.5 text-sm font-medium transition ${
                  selected?.id === c.id
                    ? "bg-ink-900 text-white shadow-soft"
                    : "bg-white text-ink-600 shadow-soft hover:text-ink-900"
                }`}
              >
                {c.name}
              </button>
            ))}
            <button
              onClick={() => setShowNewCompany((s) => !s)}
              className="rounded-full border border-dashed border-ink-300 px-4 py-1.5 text-sm text-ink-500 transition hover:border-brand-400 hover:text-brand-700"
            >
              + Nueva empresa
            </button>
          </div>

          {showNewCompany && (
            <form
              onSubmit={handleCreateCompany}
              className="mt-3 flex max-w-sm gap-2"
            >
              <input
                autoFocus
                value={newCompany}
                onChange={(e) => setNewCompany(e.target.value)}
                placeholder="Nombre de la empresa…"
                className="flex-1 rounded-lg border border-ink-200 bg-white px-3 py-2 text-sm shadow-soft outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
              />
              <button className="rounded-lg bg-ink-900 px-4 text-sm font-medium text-white hover:bg-brand-700">
                Crear
              </button>
            </form>
          )}
        </section>

        {/* Áreas */}
        {selected && (
          <section className="mt-10">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-display text-xl italic text-ink-900">
                Áreas de {selected.name}
              </h2>
              <button
                onClick={() => setShowNewArea((s) => !s)}
                className="text-sm font-medium text-brand-700 hover:text-brand-800"
              >
                + Nueva área
              </button>
            </div>

            {showNewArea && (
              <form
                onSubmit={handleCreateArea}
                className="mb-6 flex max-w-sm gap-2"
              >
                <input
                  autoFocus
                  value={newArea}
                  onChange={(e) => setNewArea(e.target.value)}
                  placeholder="Ej. Recursos Humanos…"
                  className="flex-1 rounded-lg border border-ink-200 bg-white px-3 py-2 text-sm shadow-soft outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
                />
                <button className="rounded-lg bg-ink-900 px-4 text-sm font-medium text-white hover:bg-brand-700">
                  Crear
                </button>
              </form>
            )}

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {areas.map((a) => (
                <Link
                  key={a.id}
                  href={`/areas/${a.id}`}
                  className="group rounded-2xl bg-white p-5 shadow-soft transition hover:-translate-y-0.5 hover:shadow-card"
                >
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-50 text-brand-700">
                    <AreaIcon name={a.name} />
                  </div>
                  <div className="mt-3 font-semibold text-ink-900">
                    {a.name}
                  </div>
                  <div className="mt-1 text-sm text-ink-500">
                    {a.description || "IA especializada del área"}
                  </div>
                  <div className="mt-3 text-sm font-medium text-brand-700 opacity-0 transition group-hover:opacity-100">
                    Abrir chat →
                  </div>
                </Link>
              ))}
              {areas.length === 0 && !showNewArea && (
                <div className="col-span-full rounded-2xl border border-dashed border-ink-200 bg-white/50 p-8 text-center text-sm text-ink-400">
                  Todavía no hay áreas en {selected.name}. Creá la primera con
                  "+ Nueva área".
                </div>
              )}
            </div>
          </section>
        )}
      </div>
    </main>
  );
}
