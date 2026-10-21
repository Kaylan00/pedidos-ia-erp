import { buscarSku } from "./catalog";
import { cnpjValido } from "./cnpj";
import { reais } from "./format";
import { type Pedido, totalPedido } from "./schema";

export interface Motivo {
  codigo:
    | "campo_ausente"
    | "cnpj_invalido"
    | "sku_ausente"
    | "sku_desconhecido"
    | "preco_ausente"
    | "preco_divergente"
    | "total_divergente"
    | "total_ausente"
    | "precisou_retry";
  campo: string;
  mensagem: string;
  penalidade: number;
}

export interface Confianca {
  score: number;
  motivos: Motivo[];
}

export const LIMIAR_PADRAO = 0.8;

export const PENALIDADES = {
  campoObrigatorio: 0.15,
  campoSecundario: 0.1,
  cnpjAusente: 0.25,
  cnpjInvalido: 0.35,
  porItem: 0.1,
  skuDesconhecido: 0.15,
  tetoPorTipoDeItem: 0.3,
  precoDivergente: 0.05,
  totalDivergente: 0.3,
  totalAusente: 0.05,
  retry: 0.05,
} as const;

/** Diferença acima da qual o preço do pedido é considerado fora da tabela. */
const TOLERANCIA_PRECO = 0.2;

/**
 * Confiança explicável: começa em 1 e cada problema encontrado desconta um
 * valor fixo, com o motivo registrado. Nada aqui depende do modelo dizer o
 * quanto confia em si mesmo; são conferências que um conferente humano faria.
 */
export function calcularConfianca(p: Pedido, opts: { tentativas?: number } = {}): Confianca {
  const motivos: Motivo[] = [];
  const add = (m: Motivo) => motivos.push(m);

  if (!p.cliente.razao_social)
    add({ codigo: "campo_ausente", campo: "cliente.razao_social", mensagem: "Razão social não encontrada", penalidade: PENALIDADES.campoObrigatorio });

  if (!p.cliente.cnpj)
    add({ codigo: "campo_ausente", campo: "cliente.cnpj", mensagem: "CNPJ não encontrado", penalidade: PENALIDADES.cnpjAusente });
  else if (!cnpjValido(p.cliente.cnpj))
    add({ codigo: "cnpj_invalido", campo: "cliente.cnpj", mensagem: `CNPJ ${p.cliente.cnpj} não confere no dígito verificador`, penalidade: PENALIDADES.cnpjInvalido });

  const porTipo = new Map<string, number>();
  const addItem = (m: Motivo, teto: number) => {
    const usado = porTipo.get(m.codigo) ?? 0;
    const pen = Math.min(m.penalidade, Math.max(0, teto - usado));
    porTipo.set(m.codigo, usado + pen);
    add({ ...m, penalidade: Math.round(pen * 100) / 100 });
  };

  p.itens.forEach((item, i) => {
    const campo = `itens.${i}`;
    if (!item.sku) {
      addItem({ codigo: "sku_ausente", campo: `${campo}.sku`, mensagem: `Item ${i + 1} sem SKU ("${item.descricao}")`, penalidade: PENALIDADES.porItem }, PENALIDADES.tetoPorTipoDeItem);
    } else {
      const produto = buscarSku(item.sku);
      if (!produto) {
        addItem({ codigo: "sku_desconhecido", campo: `${campo}.sku`, mensagem: `SKU ${item.sku} não existe no catálogo`, penalidade: PENALIDADES.skuDesconhecido }, PENALIDADES.tetoPorTipoDeItem);
      } else if (item.preco_unitario != null && Math.abs(item.preco_unitario - produto.preco) / produto.preco > TOLERANCIA_PRECO) {
        addItem({ codigo: "preco_divergente", campo: `${campo}.preco_unitario`, mensagem: `Preço de ${item.sku} difere mais de 20% da tabela (${reais(produto.preco)})`, penalidade: PENALIDADES.precoDivergente }, 0.15);
      }
    }
    if (item.preco_unitario == null)
      addItem({ codigo: "preco_ausente", campo: `${campo}.preco_unitario`, mensagem: `Item ${i + 1} sem preço`, penalidade: PENALIDADES.porItem }, PENALIDADES.tetoPorTipoDeItem);
  });

  if (!p.pagamento.condicao)
    add({ codigo: "campo_ausente", campo: "pagamento.condicao", mensagem: "Condição de pagamento não informada", penalidade: PENALIDADES.campoSecundario });
  if (!p.data_entrega)
    add({ codigo: "campo_ausente", campo: "data_entrega", mensagem: "Data de entrega não informada", penalidade: PENALIDADES.campoSecundario });
  if (!p.endereco_entrega)
    add({ codigo: "campo_ausente", campo: "endereco_entrega", mensagem: "Endereço de entrega não encontrado", penalidade: PENALIDADES.campoSecundario });

  if (p.total_declarado == null) {
    add({ codigo: "total_ausente", campo: "total_declarado", mensagem: "Pedido sem total escrito; não há como conferir a soma", penalidade: PENALIDADES.totalAusente });
  } else {
    const calculado = totalPedido(p);
    if (Math.abs(calculado - p.total_declarado) > 0.01)
      add({
        codigo: "total_divergente",
        campo: "total_declarado",
        mensagem: `Soma dos itens + frete dá ${reais(calculado)}, o pedido diz ${reais(p.total_declarado)}`,
        penalidade: PENALIDADES.totalDivergente,
      });
  }

  if ((opts.tentativas ?? 1) > 1)
    add({ codigo: "precisou_retry", campo: "-", mensagem: "A primeira extração não passou no schema", penalidade: PENALIDADES.retry });

  const total = motivos.reduce((acc, m) => acc + m.penalidade, 0);
  return { score: Math.max(0, Math.round((1 - total) * 100) / 100), motivos };
}

export function precisaRevisao(c: Confianca, limiar = LIMIAR_PADRAO): boolean {
  return c.score < limiar;
}
