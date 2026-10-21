import Link from "next/link";
import { formatarCnpj } from "@/lib/cnpj";
import { dataHora, reais } from "@/lib/format";
import type { PedidoRegistro } from "@/lib/repo/types";
import { totalPedido } from "@/lib/schema";
import { Confianca, Status } from "./status";

export function TabelaPedidos({ pedidos, limiar }: { pedidos: PedidoRegistro[]; limiar: number }) {
  if (!pedidos.length) return <p className="py-6 text-suave">Nenhum pedido aqui.</p>;
  return (
    <div className="overflow-x-auto">
      <table className="tabela">
        <thead>
          <tr>
            <th>Recebido</th>
            <th>Cliente</th>
            <th>CNPJ</th>
            <th className="num">Itens</th>
            <th className="num">Total</th>
            <th className="num">Confiança</th>
            <th>Situação</th>
          </tr>
        </thead>
        <tbody>
          {pedidos.map((r) => (
            <tr key={r.id}>
              <td className="whitespace-nowrap text-suave">{dataHora(r.criado_em)}</td>
              <td>
                <Link href={`/pedidos/${r.id}`} className="text-destaque underline-offset-2 hover:underline">
                  {r.pedido?.cliente.razao_social ?? "(sem cliente)"}
                </Link>
                {r.origem !== "texto" && <span className="ml-2 text-xs text-suave">{r.origem}</span>}
              </td>
              <td className="whitespace-nowrap font-mono text-[13px]">
                {r.pedido?.cliente.cnpj ? formatarCnpj(r.pedido.cliente.cnpj) : "-"}
              </td>
              <td className="num">{r.pedido?.itens.length ?? 0}</td>
              <td className="num whitespace-nowrap">{r.pedido ? reais(totalPedido(r.pedido)) : "-"}</td>
              <td className="num">
                <Confianca valor={r.confianca} limiar={limiar} />
              </td>
              <td>
                <Status status={r.status} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
