import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "IA por Áreas — Conocimiento de tu empresa",
  description:
    "Cada área de tu empresa con su propio experto en IA, entrenado con su documentación.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es">
      <body className="min-h-screen">{children}</body>
    </html>
  );
}
