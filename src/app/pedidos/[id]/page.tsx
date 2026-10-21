import Link from "next/link";
import { Revisao } from "@/components/revisao";
import { Status } from "@/components/status";
import { servico } from "@/lib/app";
import { dataHora } from "@/lib/format";

export default async function PaginaPedido({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const s = await servico();
  const registro = await s.repo.obterPedido(id);
  if (!registro) {
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
  }
  const lancamento = registro.chave_idempotencia ? await s.repo.obterLancamento(registro.chave_idempotencia) : null;
  const chamadas = (await s.repo.listarChamadas()).filter((c) => c.pedido_id === id);
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-baseline gap-x-5 gap-y-1">
        <h1 className="text-lg font-semibold">{registro.pedido?.cliente.razao_social ?? "Pedido sem cliente identificado"}</h1>
        <Status status={registro.status} />
        <span className="text-suave">
          recebido {dataHora(registro.criado_em)} · {registro.origem} · extração {registro.provider}
          {chamadas.length > 0 &&
            ` · ${chamadas.length} chamada${chamadas.length > 1 ? "s" : ""}, ${chamadas.reduce((a, c) => a + c.latencia_ms, 0)} ms`}
        </span>
      </div>
      <Revisao registro={registro} lancamento={lancamento} limiar={s.limiarConfianca} />
    </div>
  );
}
