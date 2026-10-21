"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { chamar, lembrar, sincronizar } from "@/lib/cliente-api";
import type { ChamadaRegistro, Lancamento, PedidoRegistro } from "@/lib/repo/types";
import { dataHora } from "@/lib/format";
import { Revisao } from "./revisao";
import { Status } from "./status";

interface Dados {
  pedido: PedidoRegistro;
  lancamento: Lancamento | null;
  chamadas: ChamadaRegistro[];
  limiar: number;
}

export function PaginaPedido({ id }: { id: string }) {
  const [dados, setDados] = useState<Dados | null>(null);
  const [status, setStatus] = useState<"carregando" | "ok" | "ausente" | "erro">("carregando");
  const [versao, setVersao] = useState(0);
  const [aviso, setAviso] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    let r = await chamar(`/api/pedidos/${id}`, {}, id);
    if (r.status === 404) return setStatus("ausente");
    if (!r.ok) return setStatus("erro");
    let d: Dados = await r.json();
    if (await sincronizar(d.pedido)) {
      r = await chamar(`/api/pedidos/${id}`, {}, id);
      if (r.ok) d = await r.json();
    }
    lembrar(d.pedido, d.lancamento);
    setDados(d);
    setStatus("ok");
    setVersao((v) => v + 1);
  }, [id]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  if (status === "carregando") return <p className="text-suave">Carregando...</p>;
  if (status === "erro") return <p className="text-erro">Não foi possível carregar o pedido.</p>;
  if (status === "ausente" || !dados)
    return (
      <section>
        <h1 className="text-lg font-semibold">Pedido não encontrado</h1>
        <p className="text-suave">
          Na demo os dados ficam em memória; se a instância do servidor reiniciou, o pedido se perdeu.{" "}
          <Link href="/" className="text-destaque underline">
            Voltar para a entrada
          </Link>
          .
        </p>
      </section>
    );

  const { pedido: registro, chamadas } = dados;
  const ms = chamadas.reduce((a, c) => a + c.latencia_ms, 0);
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-baseline gap-x-5 gap-y-1">
        <h1 className="text-lg font-semibold">{registro.pedido?.cliente.razao_social ?? "Pedido sem cliente identificado"}</h1>
        <Status status={registro.status} />
        <span className="text-suave">
          recebido {dataHora(registro.criado_em)} · {registro.origem} · extração {registro.provider}
          {chamadas.length > 0 && ` · ${chamadas.length} chamada${chamadas.length > 1 ? "s" : ""}, ${Math.round(ms * 100) / 100} ms`}
        </span>
      </div>
      {aviso && <p className="text-ok">{aviso}</p>}
      <Revisao
        key={versao}
        registro={registro}
        lancamento={dados.lancamento}
        limiar={dados.limiar}
        onAtualizado={(m) => {
          setAviso(m);
          carregar();
        }}
      />
    </div>
  );
}
