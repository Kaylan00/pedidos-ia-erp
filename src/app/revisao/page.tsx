import { ListaPedidos } from "@/components/lista-pedidos";
import { limiarDoAmbiente } from "@/lib/app";

export default function FilaRevisao() {
  return (
    <section>
      <h1 className="text-lg font-semibold">Fila de revisão</h1>
      <p className="mb-4 max-w-3xl text-suave">
        Pedidos com confiança abaixo de {limiarDoAmbiente().toFixed(2)} ou que não passaram no schema. Abra o pedido
        para ver o texto original ao lado dos campos, corrigir e aprovar.
      </p>
      <ListaPedidos status="erro,revisao" />
    </section>
  );
}
