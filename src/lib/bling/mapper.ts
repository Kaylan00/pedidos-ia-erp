import { soDigitos } from "../cnpj";
import { type Pedido, arred, totalPedido } from "../schema";
import type { BlingPedidoVenda } from "./types";

function somarDias(dataISO: string, dias: number): string {
  const d = new Date(`${dataISO}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
}

/** "28/35/42 dias" vira [28, 35, 42]; "à vista" ou vazio vira [0]. */
export function prazosDaCondicao(condicao: string | null): number[] {
  if (!condicao) return [0];
  const m = condicao.match(/\d{1,3}(?:\s*\/\s*\d{1,3})*/);
  if (!m) return [0];
  return m[0].split("/").map((n) => Number(n.trim()));
}

/** Divide o total em parcelas; a diferença de centavos fica na última. */
export function gerarParcelas(total: number, condicao: string | null, dataPedido: string, forma: string | null) {
  const prazos = prazosDaCondicao(condicao);
  const base = Math.floor((total / prazos.length) * 100) / 100;
  return prazos.map((dias, i) => ({
    dataVencimento: somarDias(dataPedido, dias),
    valor: i === prazos.length - 1 ? arred(total - base * (prazos.length - 1)) : base,
    observacoes: forma ?? undefined,
  }));
}

export function fretePorConta(modalidade: Pedido["frete"]["modalidade"]): 0 | 1 | 9 {
  if (modalidade === "CIF") return 0;
  if (modalidade === "FOB") return 1;
  return 9;
}

export function mapearParaBling(
  p: Pedido,
  opts: { contatoId: number; chave: string; dataPedido: string },
): BlingPedidoVenda {
  const e = p.endereco_entrega;
  return {
    data: opts.dataPedido,
    dataPrevista: p.data_entrega ?? undefined,
    contato: { id: opts.contatoId },
    itens: p.itens.map((i) => ({
      codigo: i.sku ?? undefined,
      descricao: i.descricao,
      unidade: i.unidade,
      quantidade: i.quantidade,
      valor: i.preco_unitario ?? 0,
    })),
    parcelas: gerarParcelas(totalPedido(p), p.pagamento.condicao, opts.dataPedido, p.pagamento.forma),
    transporte: {
      fretePorConta: fretePorConta(p.frete.modalidade),
      frete: p.frete.valor ?? 0,
      etiqueta: e
        ? {
            nome: p.cliente.razao_social ?? undefined,
            endereco: e.logradouro ?? undefined,
            numero: e.numero ?? undefined,
            bairro: e.bairro ?? undefined,
            municipio: e.cidade ?? undefined,
            uf: e.uf ?? undefined,
            cep: e.cep ? soDigitos(e.cep) : undefined,
          }
        : undefined,
    },
    observacoes: p.observacoes ?? undefined,
    // O Bling não tem campo de idempotência; a chave fica no pedido para auditoria.
    observacoesInternas: `pedidos-ia-erp:${opts.chave}`,
  };
}
