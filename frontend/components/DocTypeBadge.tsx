const STYLES: Record<string, { label: string; className: string }> = {
  pdf: { label: "PDF", className: "bg-red-50 text-red-600" },
  docx: { label: "DOC", className: "bg-blue-50 text-blue-600" },
  xlsx: { label: "XLS", className: "bg-emerald-50 text-emerald-600" },
  pptx: { label: "PPT", className: "bg-orange-50 text-orange-600" },
  image: { label: "IMG", className: "bg-violet-50 text-violet-600" },
  text: { label: "TXT", className: "bg-ink-100 text-ink-600" },
  link: { label: "URL", className: "bg-brand-50 text-brand-700" },
  youtube: { label: "YT", className: "bg-red-50 text-red-600" },
};

export function DocTypeBadge({ type }: { type: string }) {
  const style = STYLES[type] || { label: type.slice(0, 3).toUpperCase(), className: "bg-ink-100 text-ink-500" };
  return (
    <span
      className={`inline-flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg text-[10px] font-bold tracking-tight ${style.className}`}
    >
      {style.label}
    </span>
  );
}
