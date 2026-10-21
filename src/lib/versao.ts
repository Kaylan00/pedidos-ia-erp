import type { PedidoRegistro } from "./repo/types";

/**
 * Qual de duas cópias do mesmo pedido está mais adiantada: lançado vence o resto,
 * depois vence a revisão mais recente. Usado só na restauração da demo em memória.
 */
export function maisAdiantado(a: PedidoRegistro, b: PedidoRegistro): PedidoRegistro {
  const lancA = a.status === "lancado" ? 1 : 0;
  const lancB = b.status === "lancado" ? 1 : 0;
  if (lancA !== lancB) return lancA > lancB ? a : b;
  return (a.revisado_em ?? "") >= (b.revisado_em ?? "") ? a : b;
}
