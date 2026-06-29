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

export default function Dashboard() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [selected, setSelected] = useState<Company | null>(null);
  const [areas, setAreas] = useState<Area[]>([]);
  const [newCompany, setNewCompany] = useState("");
  const [newArea, setNewArea] = useState("");

  // Auth gate
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (!data.session) {
        router.replace("/login");
      } else {
        setReady(true);
      }
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
    refreshCompanies();
  }

  async function handleCreateArea(e: React.FormEvent) {
    e.preventDefault();
    if (!selected || !newArea.trim()) return;
    await createArea({ company_id: selected.id, name: newArea.trim() });
    setNewArea("");
    listAreas(selected.id).then(setAreas);
  }

  async function logout() {
    await supabase.auth.signOut();
    router.replace("/login");
  }

  if (!ready) return <div className="p-8 text-slate-500">Cargando…</div>;

  return (
    <main className="mx-auto max-w-5xl p-6">
      <header className="mb-8 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Mis empresas</h1>
        <button onClick={logout} className="text-sm text-slate-500 hover:underline">
          Salir
        </button>
      </header>

      {/* Empresas */}
      <section className="mb-8">
        <div className="mb-3 flex flex-wrap gap-2">
          {companies.map((c) => (
            <button
              key={c.id}
              onClick={() => setSelected(c)}
              className={`rounded-full px-4 py-1.5 text-sm ${
                selected?.id === c.id
                  ? "bg-brand text-white"
                  : "bg-white text-slate-700 shadow-sm"
              }`}
            >
              {c.name}
            </button>
          ))}
        </div>
        <form onSubmit={handleCreateCompany} className="flex gap-2">
          <input
            value={newCompany}
            onChange={(e) => setNewCompany(e.target.value)}
            placeholder="Nueva empresa…"
            className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
          <button className="rounded-lg bg-slate-800 px-4 text-sm font-medium text-white">
            Crear
          </button>
        </form>
      </section>

      {/* Áreas */}
      {selected && (
        <section>
          <h2 className="mb-3 text-lg font-semibold">
            Áreas de {selected.name}
          </h2>
          <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {areas.map((a) => (
              <Link
                key={a.id}
                href={`/areas/${a.id}`}
                className="rounded-xl bg-white p-4 shadow-sm transition hover:shadow-md"
              >
                <div className="font-medium">{a.name}</div>
                <div className="mt-1 text-sm text-slate-500">
                  {a.description || "IA especializada del área"}
                </div>
              </Link>
            ))}
            {areas.length === 0 && (
              <p className="text-sm text-slate-500">
                Todavía no hay áreas. Creá la primera.
              </p>
            )}
          </div>
          <form onSubmit={handleCreateArea} className="flex gap-2">
            <input
              value={newArea}
              onChange={(e) => setNewArea(e.target.value)}
              placeholder="Nueva área (ej. Recursos Humanos)…"
              className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
            <button className="rounded-lg bg-slate-800 px-4 text-sm font-medium text-white">
              Crear área
            </button>
          </form>
        </section>
      )}
    </main>
  );
}
