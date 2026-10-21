import type { StatusPedido } from "@/lib/repo/types";

const ROTULOS: Record<StatusPedido, { texto: string; cor: string }> = {
  revisao: { texto: "em revisão", cor: "text-alerta" },
  pronto: { texto: "pronto", cor: "text-destaque" },
  lancado: { texto: "lançado", cor: "text-ok" },
  erro: { texto: "falhou na extração", cor: "text-erro" },
};

export function Status({ status }: { status: StatusPedido }) {
  const r = ROTULOS[status];
  return (
    <span className={`inline-flex items-center gap-1.5 whitespace-nowrap ${r.cor}`}>
      <span className="inline-block h-1.5 w-1.5 rounded-full bg-current" aria-hidden />
      {r.texto}
    </span>
  );
}

export function Confianca({ valor, limiar }: { valor: number; limiar: number }) {
  const baixa = valor < limiar;
  return (
    <span className={`font-mono tabular-nums ${baixa ? "text-alerta" : "text-tinta"}`}>
      {valor.toFixed(2)}
    </span>
  );
}
