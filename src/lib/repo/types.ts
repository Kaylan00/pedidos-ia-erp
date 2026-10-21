import type { BlingPedidoVenda } from "../bling/types";
import type { Motivo } from "../confidence";
import type { ChamadaModelo } from "../extract/types";
import type { Pedido } from "../schema";

export type StatusPedido = "revisao" | "pronto" | "lancado" | "erro";
export type Origem = "texto" | "pdf" | "exemplo";

export interface Lancamento {
  chave: string;
  pedido_id: string;
  status: "reservado" | "concluido";
  modo: "sandbox" | "live" | null;
  bling_id: number | null;
  payload: BlingPedidoVenda | null;
  criado_em: string;
}

export interface PedidoRegistro {
  id: string;
  criado_em: string;
  origem: Origem;
  texto_original: string;
  provider: string;
  pedido: Pedido | null;
  confianca: number;
  motivos: Motivo[];
  status: StatusPedido;
  erro: string | null;
  revisado_em: string | null;
  chave_idempotencia: string | null;
}

export type NovoPedido = Omit<PedidoRegistro, "id" | "criado_em">;

export interface ChamadaRegistro extends ChamadaModelo {
  id: string;
  pedido_id: string | null;
  criado_em: string;
}

export type Reserva = { ok: true } | { ok: false; existente: Lancamento };

/**
 * Persistência atrás de uma interface só. A demo usa a implementação em memória;
 * com STORAGE=supabase a mesma interface grava no Postgres.
 */
export interface Repositorio {
  /** id opcional: os exemplos da demo usam id fixo para ser o mesmo em qualquer instância. */
  criarPedido(dados: NovoPedido & { id?: string }): Promise<PedidoRegistro>;
  obterPedido(id: string): Promise<PedidoRegistro | null>;
  listarPedidos(filtro?: { status?: StatusPedido }): Promise<PedidoRegistro[]>;
  atualizarPedido(id: string, patch: Partial<NovoPedido>): Promise<PedidoRegistro | null>;

  registrarChamadas(pedidoId: string | null, chamadas: ChamadaModelo[]): Promise<void>;
  listarChamadas(limite?: number): Promise<ChamadaRegistro[]>;

  /** Grava a chave antes de chamar o Bling. Se já existir, devolve o lançamento anterior. */
  reservarLancamento(chave: string, pedidoId: string): Promise<Reserva>;
  concluirLancamento(
    chave: string,
    dados: { modo: "sandbox" | "live"; bling_id: number | null; payload: BlingPedidoVenda },
  ): Promise<Lancamento>;
  /** Desfaz a reserva quando o Bling falha, para permitir nova tentativa. */
  liberarLancamento(chave: string): Promise<void>;
  obterLancamento(chave: string): Promise<Lancamento | null>;

  /**
   * Só na memória: recoloca um pedido que o navegador já tinha recebido. Na Vercel
   * cada instância tem a própria memória; sem isso, abrir ou aprovar um pedido
   * criado em outra instância daria 404.
   */
  restaurar?(registro: PedidoRegistro, lancamento: Lancamento | null): Promise<void>;
}
