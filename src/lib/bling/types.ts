import type { Pedido } from "../schema";

/** Recorte do payload de POST /pedidos/vendas da API v3 do Bling usado aqui. */
export interface BlingPedidoVenda {
  data: string;
  dataPrevista?: string;
  contato: { id: number };
  itens: {
    codigo?: string;
    descricao: string;
    unidade: string;
    quantidade: number;
    valor: number;
  }[];
  parcelas: { dataVencimento: string; valor: number; observacoes?: string }[];
  transporte: {
    /** 0 = remetente (CIF), 1 = destinatário (FOB), 9 = sem frete. */
    fretePorConta: 0 | 1 | 9;
    frete: number;
    etiqueta?: {
      nome?: string;
      endereco?: string;
      numero?: string;
      bairro?: string;
      municipio?: string;
      uf?: string;
      cep?: string;
    };
  };
  observacoes?: string;
  observacoesInternas: string;
}

export interface ResultadoLancamento {
  modo: "sandbox" | "live";
  blingId: number | null;
  contatoId: number;
  payload: BlingPedidoVenda;
}

export interface Lancador {
  modo: "sandbox" | "live";
  lancar(pedido: Pedido, chave: string, dataPedido: string): Promise<ResultadoLancamento>;
}
