"use client";

import { useEffect, useState } from "react";
import { lembrados } from "@/lib/cliente-api";
import type { PedidoRegistro } from "@/lib/repo/types";
import { TabelaPedidos } from "./tabela-pedidos";

export function ListaPedidos({ status }: { status?: string }) {
  const [dados, setDados] = useState<{ pedidos: PedidoRegistro[]; limiar: number } | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    const url = status ? `/api/pedidos?status=${status}` : "/api/pedidos";
    fetch(url, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`erro ${r.status}`))))
      .then((d: { pedidos: PedidoRegistro[]; limiar: number }) => {
        // Pedidos que este navegador criou e a instância atual não conhece (demo em memória).
        const filtro = status?.split(",");
        const ids = new Set(d.pedidos.map((p) => p.id));
        const extras = lembrados().filter((p) => !ids.has(p.id) && (!filtro || filtro.includes(p.status)));
        const pedidos = [...d.pedidos, ...extras].sort((a, b) => b.criado_em.localeCompare(a.criado_em));
        setDados({ pedidos, limiar: d.limiar });
      })
      .catch((e: Error) => setErro(e.message));
  }, [status]);

  if (erro) return <p className="py-6 text-erro">Não foi possível carregar os pedidos ({erro}).</p>;
  if (!dados) return <p className="py-6 text-suave">Carregando...</p>;
  return <TabelaPedidos pedidos={dados.pedidos} limiar={dados.limiar} />;
}
