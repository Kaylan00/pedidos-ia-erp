import { TabelaPedidos } from "@/components/tabela-pedidos";
import { servico } from "@/lib/app";

export default async function FilaRevisao() {
  const s = await servico();
  const [revisao, erro] = await Promise.all([
    s.repo.listarPedidos({ status: "revisao" }),
    s.repo.listarPedidos({ status: "erro" }),
  ]);
  return (
    <section>
      <h1 className="text-lg font-semibold">Fila de revisão</h1>
      <p className="mb-4 max-w-3xl text-suave">
        Pedidos com confiança abaixo de {s.limiarConfianca.toFixed(2)} ou que não passaram no schema. Abra o pedido
        para ver o texto original ao lado dos campos, corrigir e aprovar.
      </p>
      <TabelaPedidos pedidos={[...erro, ...revisao]} limiar={s.limiarConfianca} />
    </section>
  );
}
