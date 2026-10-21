import { randomUUID } from "node:crypto";
import type { ChamadaModelo } from "../extract/types";
import { maisAdiantado } from "../versao";
import type {
  ChamadaRegistro,
  Lancamento,
  NovoPedido,
  PedidoRegistro,
  Repositorio,
  Reserva,
  StatusPedido,
} from "./types";

const clone = <T>(v: T): T => structuredClone(v);

export class RepositorioMemoria implements Repositorio {
  private pedidos = new Map<string, PedidoRegistro>();
  private chamadas: ChamadaRegistro[] = [];
  private lancamentos = new Map<string, Lancamento>();

  async criarPedido({ id, ...dados }: NovoPedido & { id?: string }): Promise<PedidoRegistro> {
    const registro: PedidoRegistro = { ...clone(dados), id: id ?? randomUUID(), criado_em: new Date().toISOString() };
    this.pedidos.set(registro.id, registro);
    return clone(registro);
  }

  async obterPedido(id: string) {
    const p = this.pedidos.get(id);
    return p ? clone(p) : null;
  }

  async listarPedidos(filtro: { status?: StatusPedido } = {}) {
    return [...this.pedidos.values()]
      .filter((p) => !filtro.status || p.status === filtro.status)
      .sort((a, b) => b.criado_em.localeCompare(a.criado_em))
      .map(clone);
  }

  async atualizarPedido(id: string, patch: Partial<NovoPedido>) {
    const atual = this.pedidos.get(id);
    if (!atual) return null;
    const novo = { ...atual, ...clone(patch) };
    this.pedidos.set(id, novo);
    return clone(novo);
  }

  async registrarChamadas(pedidoId: string | null, chamadas: ChamadaModelo[]) {
    for (const c of chamadas) {
      this.chamadas.push({ ...c, id: randomUUID(), pedido_id: pedidoId, criado_em: new Date().toISOString() });
    }
  }

  async listarChamadas(limite = 500) {
    return this.chamadas.slice(-limite).reverse().map(clone);
  }

  // Operação síncrona do início ao fim: no Node não há outra requisição intercalando aqui.
  async reservarLancamento(chave: string, pedidoId: string): Promise<Reserva> {
    const existente = this.lancamentos.get(chave);
    if (existente) return { ok: false, existente: clone(existente) };
    this.lancamentos.set(chave, {
      chave,
      pedido_id: pedidoId,
      status: "reservado",
      modo: null,
      bling_id: null,
      payload: null,
      criado_em: new Date().toISOString(),
    });
    return { ok: true };
  }

  async concluirLancamento(chave: string, dados: Pick<Lancamento, "modo" | "bling_id" | "payload">) {
    const atual = this.lancamentos.get(chave);
    if (!atual) throw new Error(`lançamento ${chave} não reservado`);
    const novo: Lancamento = { ...atual, ...clone(dados), status: "concluido" };
    this.lancamentos.set(chave, novo);
    return clone(novo);
  }

  async liberarLancamento(chave: string) {
    this.lancamentos.delete(chave);
  }

  async restaurar(registro: PedidoRegistro, lancamento: Lancamento | null) {
    const atual = this.pedidos.get(registro.id);
    if (!atual || (maisAdiantado(registro, atual) === registro && registro !== atual)) this.pedidos.set(registro.id, clone(registro));
    if (lancamento && !this.lancamentos.has(lancamento.chave)) this.lancamentos.set(lancamento.chave, clone(lancamento));
  }

  async obterLancamento(chave: string) {
    const l = this.lancamentos.get(chave);
    return l ? clone(l) : null;
  }
}
