import type { ReactElement } from "react";

const ICONS: Record<string, ReactElement> = {
  rrhh: (
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M16 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0ZM12 14c-4.4 0-8 2.2-8 5v1h16v-1c0-2.8-3.6-5-8-5Z"
    />
  ),
  marketing: (
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M3 11v2a1 1 0 0 0 1 1h2l4 4V6L6 10H4a1 1 0 0 0-1 1ZM14 8a4 4 0 0 1 0 8M17 5a8 8 0 0 1 0 14"
    />
  ),
  comercial: (
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M3 17 9 11l4 4 8-8M15 6h6v6"
    />
  ),
  logistica: (
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M3 7h11v8H3V7ZM14 10h4l3 3v2h-7v-5ZM6.5 18.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3ZM17.5 18.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Z"
    />
  ),
  finanzas: (
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M12 3v18M17 7.5c0-1.7-2.2-3-5-3s-5 1.1-5 2.6 2.2 2.4 5 2.9c2.8.5 5 1.4 5 2.9S14.8 16 12 16s-5-1.3-5-3"
    />
  ),
  it: (
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="m8 9-3 3 3 3M16 9l3 3-3 3M13 6l-2 12"
    />
  ),
  produccion: (
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M3 21V10l6-4v4l6-4v4l6-4v15H3Z"
    />
  ),
  default: (
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M4 21V7l8-4 8 4v14M9 21v-6h6v6M4 21h16"
    />
  ),
};

const KEYWORD_MAP: [RegExp, keyof typeof ICONS][] = [
  [/rh|rrhh|humano|personal|talento/i, "rrhh"],
  [/marketing|marca|comunicaci/i, "marketing"],
  [/comercial|venta|cliente/i, "comercial"],
  [/log[ií]stica|almac|dep[oó]sito|distrib/i, "logistica"],
  [/finanz|administra|contab|factur/i, "finanzas"],
  [/^it$|tecnolog|sistemas|soporte/i, "it"],
  [/producci[oó]n|planta|f[aá]brica/i, "produccion"],
];

export function getAreaIconKey(name: string): keyof typeof ICONS {
  const match = KEYWORD_MAP.find(([pattern]) => pattern.test(name));
  return match ? match[1] : "default";
}

export function AreaIcon({
  name,
  className = "h-5 w-5",
}: {
  name: string;
  className?: string;
}) {
  const key = getAreaIconKey(name);
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      className={className}
    >
      {ICONS[key]}
    </svg>
  );
}
