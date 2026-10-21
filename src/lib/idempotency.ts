import { createHash } from "node:crypto";
import { soDigitos } from "./cnpj";
import type { Pedido } from "./schema";

/**
 * Chave de idempotência do lançamento: hash do que define o pedido comercialmente
 * (cliente, itens, quantidades, preços, frete e data). Mudar a razão social, a
 * ordem dos itens ou espaços na descrição não gera uma chave nova; mudar uma
 * quantidade gera, porque aí é outro pedido.
 */
export function chaveIdempotencia(p: Pedido): string {
  const itens = p.itens
    .map((i) => [
      (i.sku ?? i.descricao).trim().toUpperCase().replace(/\s+/g, " "),
      i.quantidade,
      i.unidade.toUpperCase(),
      i.preco_unitario ?? null,
    ])
    .sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
  const canonico = JSON.stringify({
    cnpj: p.cliente.cnpj ? soDigitos(p.cliente.cnpj) : null,
    itens,
    frete: [p.frete.modalidade, p.frete.valor],
    entrega: p.data_entrega,
  });
  return createHash("sha256").update(canonico).digest("hex").slice(0, 32);
}
