"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import {
  Area,
  ChatEvent,
  DocumentItem,
  Source,
  addLink,
  deleteDocument,
  getArea,
  listDocuments,
  streamChat,
  uploadDocument,
} from "@/lib/api";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  sources?: Source[];
}

const STATUS_LABEL: Record<string, string> = {
  pending: "En cola",
  processing: "Procesando…",
  ready: "Listo",
  error: "Error",
};

export default function AreaPage() {
  const router = useRouter();
  const params = useParams();
  const areaId = params.areaId as string;

  const [ready, setReady] = useState(false);
  const [area, setArea] = useState<Area | null>(null);
  const [docs, setDocs] = useState<DocumentItem[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [question, setQuestion] = useState("");
  const [sending, setSending] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (!data.session) router.replace("/login");
      else setReady(true);
    });
  }, [router]);

  useEffect(() => {
    if (!ready) return;
    getArea(areaId).then(setArea).catch(() => router.replace("/"));
    refreshDocs();
  }, [ready, areaId]);

  // Refresca documentos en proceso cada 4s
  useEffect(() => {
    if (!ready) return;
    const hasPending = docs.some((d) => d.status === "pending" || d.status === "processing");
    if (!hasPending) return;
    const t = setInterval(refreshDocs, 4000);
    return () => clearInterval(t);
  }, [ready, docs]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  function refreshDocs() {
    listDocuments(areaId).then(setDocs).catch(() => {});
  }

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      await uploadDocument(areaId, file);
      refreshDocs();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Error al subir");
    } finally {
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function handleAddLink() {
    const url = prompt("URL del enlace o video de YouTube:");
    if (!url) return;
    const name = prompt("Nombre del recurso:") || url;
    const type = url.includes("youtube.com") || url.includes("youtu.be") ? "youtube" : "link";
    await addLink(areaId, { name, url, type });
    refreshDocs();
  }

  async function handleDelete(id: string) {
    if (!confirm("¿Eliminar este documento?")) return;
    await deleteDocument(id);
    refreshDocs();
  }

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    const q = question.trim();
    if (!q || sending) return;
    setQuestion("");
    setSending(true);
    setMessages((m) => [...m, { role: "user", content: q }, { role: "assistant", content: "" }]);

    try {
      await streamChat(areaId, q, conversationId, (ev: ChatEvent) => {
        if (ev.type === "conversation" && ev.conversation_id) {
          setConversationId(ev.conversation_id);
        } else if (ev.type === "delta" && ev.text) {
          setMessages((m) => {
            const copy = [...m];
            copy[copy.length - 1] = {
              ...copy[copy.length - 1],
              content: copy[copy.length - 1].content + ev.text,
            };
            return copy;
          });
        } else if (ev.type === "done") {
          setMessages((m) => {
            const copy = [...m];
            copy[copy.length - 1] = {
              role: "assistant",
              content: ev.text || copy[copy.length - 1].content,
              sources: ev.sources,
            };
            return copy;
          });
        }
      });
    } catch (err) {
      setMessages((m) => {
        const copy = [...m];
        copy[copy.length - 1] = {
          role: "assistant",
          content: "⚠️ " + (err instanceof Error ? err.message : "Error"),
        };
        return copy;
      });
    } finally {
      setSending(false);
    }
  }

  if (!ready || !area) return <div className="p-8 text-slate-500">Cargando…</div>;

  return (
    <main className="mx-auto max-w-6xl p-6">
      <div className="mb-6 flex items-center gap-3">
        <Link href="/" className="text-sm text-brand hover:underline">
          ← Volver
        </Link>
        <h1 className="text-2xl font-bold">{area.name}</h1>
      </div>

      <div className="grid gap-6 lg:grid-cols-[340px_1fr]">
        {/* Panel de documentos */}
        <aside className="rounded-xl bg-white p-4 shadow-sm">
          <h2 className="mb-3 font-semibold">Base de conocimiento</h2>
          <div className="mb-3 flex gap-2">
            <button
              onClick={() => fileRef.current?.click()}
              className="flex-1 rounded-lg bg-brand py-2 text-sm font-medium text-white hover:bg-brand-dark"
            >
              Subir archivo
            </button>
            <button
              onClick={handleAddLink}
              className="rounded-lg border border-slate-300 px-3 text-sm"
            >
              + Link
            </button>
          </div>
          <input
            ref={fileRef}
            type="file"
            hidden
            onChange={handleUpload}
            accept=".pdf,.docx,.doc,.xlsx,.xls,.pptx,.ppt,.png,.jpg,.jpeg,.gif,.webp,.txt,.md"
          />
          <ul className="space-y-2">
            {docs.map((d) => (
              <li
                key={d.id}
                className="flex items-center justify-between rounded-lg border border-slate-100 px-3 py-2 text-sm"
              >
                <div className="min-w-0">
                  <div className="truncate font-medium">{d.name}</div>
                  <div
                    className={`text-xs ${
                      d.status === "error"
                        ? "text-red-600"
                        : d.status === "ready"
                        ? "text-green-600"
                        : "text-amber-600"
                    }`}
                  >
                    {STATUS_LABEL[d.status] || d.status}
                    {d.error ? ` — ${d.error}` : ""}
                  </div>
                </div>
                <button
                  onClick={() => handleDelete(d.id)}
                  className="ml-2 text-slate-400 hover:text-red-600"
                >
                  ✕
                </button>
              </li>
            ))}
            {docs.length === 0 && (
              <li className="text-sm text-slate-500">Sin documentos todavía.</li>
            )}
          </ul>
        </aside>

        {/* Panel de chat */}
        <section className="flex h-[70vh] flex-col rounded-xl bg-white shadow-sm">
          <div className="flex-1 space-y-4 overflow-y-auto p-4">
            {messages.length === 0 && (
              <p className="text-sm text-slate-500">
                Preguntale a la IA de {area.name}. Responde solo con la documentación de esta área.
              </p>
            )}
            {messages.map((m, i) => (
              <div
                key={i}
                className={`max-w-[85%] rounded-2xl px-4 py-2 text-sm ${
                  m.role === "user"
                    ? "ml-auto bg-brand text-white"
                    : "bg-slate-100 text-slate-900"
                }`}
              >
                <div className="whitespace-pre-wrap">{m.content || "…"}</div>
                {m.sources && m.sources.length > 0 && (
                  <div className="mt-2 border-t border-slate-200 pt-2 text-xs text-slate-500">
                    Fuentes:{" "}
                    {m.sources.map((s) => (
                      <span key={s.index} className="mr-2">
                        [{s.index}] {s.document_name}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))}
            <div ref={bottomRef} />
          </div>
          <form onSubmit={handleSend} className="flex gap-2 border-t border-slate-100 p-3">
            <input
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="Escribí tu pregunta…"
              className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
            <button
              disabled={sending}
              className="rounded-lg bg-brand px-5 text-sm font-medium text-white hover:bg-brand-dark disabled:opacity-60"
            >
              {sending ? "…" : "Enviar"}
            </button>
          </form>
        </section>
      </div>
    </main>
  );
}
