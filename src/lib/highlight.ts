import { dataBR, numeroBRFixo } from "./format";
import type { Pedido } from "./schema";

export interface Trecho {
  campo: string;
  valor: string;
}

export interface Segmento {
  texto: string;
  campo: string | null;
}

/**
 * Valores do pedido na forma em que provavelmente aparecem no texto
 * (preço com vírgula, data dd/mm/aaaa). Serve para marcar o original e para
 * apontar campo que o extrator preencheu mas não existe no texto.
 */
export function trechosDoPedido(p: Pedido): Trecho[] {
  const t: Trecho[] = [];
  const add = (campo: string, valor: string | null | undefined) => {
    if (valor && valor.trim().length >= 2) t.push({ campo, valor: valor.trim() });
  };
  add("cliente.razao_social", p.cliente.razao_social);
  add("cliente.cnpj", p.cliente.cnpj);
  add("cliente.email", p.cliente.email);
  p.itens.forEach((i, n) => {
    add(`itens.${n}.sku`, i.sku);
    if (i.preco_unitario != null) add(`itens.${n}.preco_unitario`, numeroBRFixo(i.preco_unitario));
  });
  if (p.frete.valor != null) add("frete.valor", numeroBRFixo(p.frete.valor));
  add("frete.modalidade", p.frete.modalidade);
  add("pagamento.condicao", p.pagamento.condicao?.replace(/\s*dias$/, ""));
  add("pagamento.forma", p.pagamento.forma);
  if (p.data_entrega) add("data_entrega", dataBR(p.data_entrega));
  add("endereco_entrega.logradouro", p.endereco_entrega?.logradouro);
  add("endereco_entrega.cep", p.endereco_entrega?.cep);
  if (p.total_declarado != null) add("total_declarado", numeroBRFixo(p.total_declarado));
  return t;
}

export function aparece(texto: string, valor: string): boolean {
  return texto.toLowerCase().includes(valor.toLowerCase());
}

/** Quebra o texto em segmentos marcados, sem sobreposição (vence o que começa antes). */
export function segmentar(texto: string, trechos: Trecho[]): Segmento[] {
  const baixo = texto.toLowerCase();
  const achados: { ini: number; fim: number; campo: string }[] = [];
  for (const t of trechos) {
    const alvo = t.valor.toLowerCase();
    let i = baixo.indexOf(alvo);
    while (i >= 0) {
      achados.push({ ini: i, fim: i + alvo.length, campo: t.campo });
      i = baixo.indexOf(alvo, i + alvo.length);
    }
  }
  achados.sort((a, b) => a.ini - b.ini || b.fim - a.fim);

  const out: Segmento[] = [];
  let pos = 0;
  for (const a of achados) {
    if (a.ini < pos) continue;
    if (a.ini > pos) out.push({ texto: texto.slice(pos, a.ini), campo: null });
    out.push({ texto: texto.slice(a.ini, a.fim), campo: a.campo });
    pos = a.fim;
  }
  if (pos < texto.length) out.push({ texto: texto.slice(pos), campo: null });
  return out;
}
