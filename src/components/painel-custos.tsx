"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { dataHora, dolares } from "@/lib/format";
import type { ResumoCusto } from "@/lib/metrics";
import type { ChamadaRegistro } from "@/lib/repo/types";

const int = (n: number) => n.toLocaleString("pt-BR");

export function PainelCustos() {
  const [r, setR] = useState<(ResumoCusto & { ultimas: ChamadaRegistro[] }) | null>(null);
  const [erro, setErro] = useState(false);

  useEffect(() => {
    fetch("/api/metricas", { cache: "no-store" })
      .then((x) => (x.ok ? x.json() : Promise.reject()))
      .then(setR)
      .catch(() => setErro(true));
  }, []);

  if (erro) return <p className="text-erro">Não foi possível carregar as métricas.</p>;
  if (!r) return <p className="text-suave">Carregando...</p>;

  const simuladas = r.ultimas.filter((c) => c.simulado).length;
  const linhas: [string, string][] = [
    ["Chamadas", `${int(r.chamadas)} (${int(r.falhas)} sem passar no schema)`],
    ["Tokens de entrada", int(r.tokensEntrada)],
    ["Tokens de saída", int(r.tokensSaida)],
    ["Custo estimado", dolares(r.custoTotal)],
    ["Custo médio por chamada", r.chamadas ? dolares(r.custoTotal / r.chamadas) : "-"],
    ["Latência média", `${r.latenciaMedia} ms`],
    ["Latência p50", `${r.p50} ms`],
    ["Latência p95", `${r.p95} ms`],
  ];

  return (
    <div className="space-y-8">
      <section>
        {simuladas > 0 && (
          <p className="mb-4 max-w-3xl text-suave">
            {simuladas} de {r.ultimas.length} chamadas vieram do provedor mock: os tokens são estimados pelo tamanho do
            texto e o custo é o que a chamada custaria no modelo padrão. A latência é a do próprio mock.
          </p>
        )}
        <table className="tabela max-w-xl">
          <tbody>
            {linhas.map(([k, v]) => (
              <tr key={k}>
                <td className="text-suave">{k}</td>
                <td className="num font-mono">{v}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {r.porModelo.length > 0 && (
        <section>
          <h2 className="mb-2 font-semibold">Por modelo</h2>
          <table className="tabela max-w-xl">
            <thead>
              <tr>
                <th>Modelo</th>
                <th className="num">Chamadas</th>
                <th className="num">Custo</th>
                <th className="num">p95</th>
              </tr>
            </thead>
            <tbody>
              {r.porModelo.map((m) => (
                <tr key={m.model}>
                  <td className="font-mono">{m.model}</td>
                  <td className="num">{m.chamadas}</td>
                  <td className="num font-mono">{dolares(m.custo)}</td>
                  <td className="num font-mono">{m.p95} ms</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      <section>
        <h2 className="mb-2 font-semibold">Últimas chamadas</h2>
        <div className="overflow-x-auto">
          <table className="tabela">
            <thead>
              <tr>
                <th>Quando</th>
                <th>Pedido</th>
                <th>Modelo</th>
                <th className="num">Tentativa</th>
                <th className="num">Entrada</th>
                <th className="num">Saída</th>
                <th className="num">Custo</th>
                <th className="num">Latência</th>
                <th>Schema</th>
              </tr>
            </thead>
            <tbody>
              {r.ultimas.map((c) => (
                <tr key={c.id}>
                  <td className="whitespace-nowrap text-suave">{dataHora(c.criado_em)}</td>
                  <td>
                    {c.pedido_id ? (
                      <Link href={`/pedidos/${c.pedido_id}`} className="font-mono text-destaque hover:underline">
                        {c.pedido_id.slice(0, 8)}
                      </Link>
                    ) : (
                      "-"
                    )}
                  </td>
                  <td className="font-mono">{c.model}</td>
                  <td className="num">{c.tentativa}</td>
                  <td className="num font-mono">{int(c.input_tokens)}</td>
                  <td className="num font-mono">{int(c.output_tokens)}</td>
                  <td className="num font-mono">{dolares(c.custo_usd)}</td>
                  <td className="num font-mono">{c.latencia_ms} ms</td>
                  <td className={c.ok ? "text-ok" : "text-erro"} title={c.erro ?? undefined}>
                    {c.ok ? "válido" : "inválido"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
