import { NovoPedido } from "@/components/novo-pedido";
import { TabelaPedidos } from "@/components/tabela-pedidos";
import { servico } from "@/lib/app";
import { EXEMPLOS } from "@/lib/samples";

export default async function Entrada() {
  const s = await servico();
  const pedidos = await s.repo.listarPedidos();
  return (
    <div className="grid gap-10">
      <section>
        <h1 className="text-lg font-semibold">Novo pedido</h1>
        <p className="mb-4 max-w-3xl text-suave">
          O texto passa pela extração, é validado contra o schema e recebe uma nota de confiança. Acima de{" "}
          {s.limiarConfianca.toFixed(2)} o pedido vai direto para o Bling; abaixo, para a fila de revisão.
        </p>
        <NovoPedido exemplos={EXEMPLOS} />
      </section>
      <section>
        <h2 className="mb-2 text-base font-semibold">Pedidos recebidos</h2>
        <TabelaPedidos pedidos={pedidos} limiar={s.limiarConfianca} />
      </section>
    </div>
  );
}
