import type { Metadata } from "next";
import { IBM_Plex_Mono, IBM_Plex_Sans } from "next/font/google";
import Link from "next/link";
import { nomeProvedor } from "@/lib/app";
import "./globals.css";

const sans = IBM_Plex_Sans({ subsets: ["latin"], weight: ["400", "500", "600"], variable: "--font-plex-sans" });
const mono = IBM_Plex_Mono({ subsets: ["latin"], weight: ["400", "500"], variable: "--font-plex-mono" });

export const metadata: Metadata = {
  title: "pedidos-ia-erp",
  description: "Extração de pedidos de e-mail e PDF com revisão humana e lançamento no Bling.",
};

export const dynamic = "force-dynamic";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const bling = process.env.BLING_MODE === "live" ? "live" : "sandbox";
  const storage = process.env.STORAGE === "supabase" ? "supabase" : "memória";
  return (
    <html lang="pt-BR" className={`${sans.variable} ${mono.variable}`}>
      <body className="min-h-screen">
        <header className="border-b border-fio bg-white">
          <div className="mx-auto flex max-w-6xl flex-wrap items-baseline gap-x-8 gap-y-2 px-5 py-3">
            <Link href="/" className="font-semibold tracking-tight">
              pedidos-ia-erp
            </Link>
            <nav className="flex gap-5 text-suave">
              <Link href="/" className="hover:text-tinta">
                Entrada
              </Link>
              <Link href="/revisao" className="hover:text-tinta">
                Revisão
              </Link>
              <Link href="/custos" className="hover:text-tinta">
                Custo e latência
              </Link>
            </nav>
            <p className="ml-auto font-mono text-xs text-suave">
              extração: {nomeProvedor()} · bling: {bling} · dados: {storage}
            </p>
          </div>
        </header>
        <main className="mx-auto max-w-6xl px-5 py-6">{children}</main>
      </body>
    </html>
  );
}
