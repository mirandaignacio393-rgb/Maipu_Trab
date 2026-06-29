"use client";

import { supabase } from "./supabaseClient";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

async function authHeader(): Promise<Record<string, string>> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const token = session?.access_token;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers = {
    "Content-Type": "application/json",
    ...(await authHeader()),
    ...(options.headers || {}),
  };
  const res = await fetch(`${API_URL}/api${path}`, { ...options, headers });
  if (!res.ok) {
    const msg = await res.text();
    throw new Error(`API ${res.status}: ${msg}`);
  }
  return res.json() as Promise<T>;
}

// ----- Tipos -----
export interface Company {
  id: string;
  name: string;
  role?: string;
}
export interface Area {
  id: string;
  name: string;
  description?: string | null;
}
export interface DocumentItem {
  id: string;
  name: string;
  type: string;
  status: string;
  error?: string | null;
  source_url?: string | null;
  created_at?: string | null;
}
export interface Source {
  index: number;
  document_id: string;
  document_name: string;
  similarity: number;
}

// ----- Empresas / Áreas -----
export const listCompanies = () => request<Company[]>("/companies");
export const createCompany = (name: string) =>
  request<Company>("/companies", { method: "POST", body: JSON.stringify({ name }) });

export const listAreas = (companyId: string) =>
  request<Area[]>(`/companies/${companyId}/areas`);
export const createArea = (data: {
  company_id: string;
  name: string;
  description?: string;
  system_prompt?: string;
}) => request<Area>("/areas", { method: "POST", body: JSON.stringify(data) });
export const getArea = (areaId: string) => request<Area>(`/areas/${areaId}`);

// ----- Documentos -----
export const listDocuments = (areaId: string) =>
  request<DocumentItem[]>(`/areas/${areaId}/documents`);

export async function uploadDocument(areaId: string, file: File): Promise<DocumentItem> {
  const form = new FormData();
  form.append("file", file);
  const res = await fetch(`${API_URL}/api/areas/${areaId}/documents/upload`, {
    method: "POST",
    headers: { ...(await authHeader()) },
    body: form,
  });
  if (!res.ok) throw new Error(`API ${res.status}: ${await res.text()}`);
  return res.json();
}

export const addLink = (
  areaId: string,
  data: { name: string; url: string; type: "link" | "youtube" }
) =>
  request<DocumentItem>(`/areas/${areaId}/documents/link`, {
    method: "POST",
    body: JSON.stringify(data),
  });

export const deleteDocument = (documentId: string) =>
  request<{ deleted: string }>(`/documents/${documentId}`, { method: "DELETE" });

// ----- Chat (SSE) -----
export interface ChatEvent {
  type: "conversation" | "sources" | "delta" | "done" | "end";
  conversation_id?: string;
  sources?: Source[];
  text?: string;
}

export async function streamChat(
  areaId: string,
  question: string,
  conversationId: string | null,
  onEvent: (ev: ChatEvent) => void
): Promise<void> {
  const res = await fetch(`${API_URL}/api/areas/${areaId}/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(await authHeader()) },
    body: JSON.stringify({ question, conversation_id: conversationId }),
  });
  if (!res.ok || !res.body) throw new Error(`API ${res.status}: ${await res.text()}`);

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const parts = buffer.split("\n\n");
    buffer = parts.pop() || "";
    for (const part of parts) {
      const line = part.trim();
      if (line.startsWith("data:")) {
        try {
          onEvent(JSON.parse(line.slice(5).trim()) as ChatEvent);
        } catch {
          /* ignora líneas parciales */
        }
      }
    }
  }
}
