"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import ReactMarkdown from "react-markdown";
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
import { AreaIcon } from "@/components/AreaIcon";
import { DocTypeBadge } from "@/components/DocTypeBadge";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  sources?: Source[];
}

const STATUS_STYLE: Record<string, { label: string; className: string }> = {
  pending: { label: "En cola", className: "bg-ink-100 text-ink-500" },
  processing: { label: "Procesando…", className: "bg-amber-50 text-amber-600" },
  ready: { label: "Listo", className: "bg-emerald-50 text-emerald-600" },
  error: { label: "Error", className: "bg-red-50 text-red-600" },
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

  if (!ready || !area) {
    return (
      <div className="flex min-h-screen items-center justify-center text-ink-400">
        Cargando…
      </div>
    );
  }

  return (
    <main className="min-h-screen">
      <header className="border-b border-ink-100 bg-white/70 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-6 py-4">
          <Link
            href="/"
            className="flex h-8 w-8 items-center justify-center rounded-lg text-ink-400 transition hover:bg-ink-100 hover:text-ink-700"
          >
            ←
          </Link>
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-50 text-brand-700">
            <AreaIcon name={area.name} />
          </div>
          <div>
            <h1 className="font-display text-lg italic leading-tight text-ink-900">
              {area.name}
            </h1>
            <p className="text-xs text-ink-400">IA especializada del área</p>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-6 py-6">
        <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
          {/* Panel de documentos */}
          <aside className="rounded-2xl bg-white p-4 shadow-soft">
            <h2 className="mb-3 text-sm font-semibold text-ink-700">
              Base de conocimiento
            </h2>
            <div className="mb-4 flex gap-2">
              <button
                onClick={() => fileRef.current?.click()}
                className="flex-1 rounded-lg bg-ink-900 py-2 text-sm font-medium text-white transition hover:bg-brand-700"
              >
                Subir archivo
              </button>
              <button
                onClick={handleAddLink}
                className="rounded-lg border border-ink-200 px-3 text-sm text-ink-600 transition hover:border-brand-400 hover:text-brand-700"
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
              {docs.map((d) => {
                const status = STATUS_STYLE[d.status] || {
                  label: d.status,
                  className: "bg-ink-100 text-ink-500",
                };
                return (
                  <li
                    key={d.id}
                    className="group flex items-center gap-3 rounded-xl border border-ink-100 px-3 py-2.5 transition hover:border-ink-200"
                  >
                    <DocTypeBadge type={d.type} />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium text-ink-800">
                        {d.name}
                      </div>
                      <span
                        className={`mt-0.5 inline-block rounded px-1.5 py-0.5 text-[11px] font-medium ${status.className}`}
                      >
                        {status.label}
                      </span>
                      {d.error && (
                        <div className="mt-0.5 truncate text-[11px] text-red-500">
                          {d.error}
                        </div>
                      )}
                    </div>
                    <button
                      onClick={() => handleDelete(d.id)}
                      className="flex-shrink-0 text-ink-300 opacity-0 transition group-hover:opacity-100 hover:text-red-500"
                      aria-label="Eliminar"
                    >
                      ✕
                    </button>
                  </li>
                );
              })}
              {docs.length === 0 && (
                <li className="rounded-xl border border-dashed border-ink-200 px-3 py-6 text-center text-sm text-ink-400">
                  Sin documentos todavía.
                </li>
              )}
            </ul>
          </aside>

          {/* Panel de chat */}
          <section className="flex h-[75vh] flex-col rounded-2xl bg-white shadow-soft">
            <div className="flex-1 space-y-4 overflow-y-auto p-5">
              {messages.length === 0 && (
                <div className="flex h-full flex-col items-center justify-center text-center">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-50 text-brand-700">
                    <AreaIcon name={area.name} className="h-6 w-6" />
                  </div>
                  <p className="mt-3 max-w-sm text-sm text-ink-500">
                    Preguntale a la IA de <strong>{area.name}</strong>.
                    Responde únicamente con la documentación cargada en esta
                    área, citando la fuente exacta.
                  </p>
                </div>
              )}
              {messages.map((m, i) => (
                <div
                  key={i}
                  className={`flex items-start gap-2.5 ${m.role === "user" ? "flex-row-reverse" : ""}`}
                >
                  <span
                    className={`mt-0.5 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full text-[11px] font-semibold ${
                      m.role === "user"
                        ? "bg-ink-800 text-white"
                        : "bg-brand-500 font-display italic text-white"
                    }`}
                  >
                    {m.role === "user" ? "Tú" : "N"}
                  </span>
                  <div
                    className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm ${
                      m.role === "user"
                        ? "bg-ink-900 text-white"
                        : "bg-ink-50 text-ink-800"
                    }`}
                  >
                    {m.role === "assistant" ? (
                      <div className="prose-chat">
                        <ReactMarkdown>{m.content || "…"}</ReactMarkdown>
                      </div>
                    ) : (
                      <div className="whitespace-pre-wrap">{m.content}</div>
                    )}
                    {m.sources && m.sources.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1.5 border-t border-ink-200 pt-2">
                        {m.sources.map((s) => (
                          <span
                            key={s.index}
                            className="rounded bg-white px-1.5 py-0.5 text-[11px] text-ink-500 shadow-soft"
                          >
                            [{s.index}] {s.document_name}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}
              <div ref={bottomRef} />
            </div>
            <form
              onSubmit={handleSend}
              className="flex gap-2 border-t border-ink-100 p-3"
            >
              <input
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                placeholder="Escribí tu pregunta…"
                className="flex-1 rounded-lg border border-ink-200 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
              />
              <button
                disabled={sending}
                className="rounded-lg bg-ink-900 px-5 text-sm font-medium text-white transition hover:bg-brand-700 disabled:opacity-60"
              >
                {sending ? "…" : "Enviar"}
              </button>
            </form>
          </section>
        </div>
      </div>
    </main>
  );
}
