import { PainelCustos } from "@/components/painel-custos";

export default function Custos() {
  return (
    <div>
      <h1 className="text-lg font-semibold">Custo e latência das chamadas ao modelo</h1>
      <p className="mb-4 max-w-3xl text-suave">
        Cada tentativa de extração grava tokens de entrada e saída, custo estimado pela tabela de preços do modelo que
        respondeu e tempo de resposta.
      </p>
      <PainelCustos />
    </div>
  );
}
