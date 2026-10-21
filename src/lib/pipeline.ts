import type { Lancador } from "./bling/types";
import { type Confianca, calcularConfianca, LIMIAR_PADRAO } from "./confidence";
import type { ResultadoExtracao } from "./extract/types";
import { chaveIdempotencia } from "./idempotency";
import type { Lancamento, Origem, PedidoRegistro, Repositorio } from "./repo/types";
import { PedidoSchema, formatarErros } from "./schema";

export type Extrator = (texto: string) => Promise<ResultadoExtracao>;

export interface Dependencias {
  repo: Repositorio;
  extrair: Extrator;
  lancador: Lancador;
  limiar?: number;
  /** Lança direto no Bling quando a confiança passa do limiar. */
  autoLancar?: boolean;
  hoje?: () => string;
}

export type ResultadoLancar =
  | { ok: true; duplicado: boolean; lancamento: Lancamento; pedido: PedidoRegistro }
  | { ok: false; status: number; erro: string };

export class ServicoPedidos {
  private readonly limiar: number;
  private readonly autoLancar: boolean;
  private readonly hoje: () => string;

  constructor(private readonly d: Dependencias) {
    this.limiar = d.limiar ?? LIMIAR_PADRAO;
    this.autoLancar = d.autoLancar ?? true;
    this.hoje = d.hoje ?? (() => new Date().toISOString().slice(0, 10));
  }

  get repo() {
    return this.d.repo;
  }

  get limiarConfianca() {
    return this.limiar;
  }

  /** Texto entra, pedido sai classificado: pronto (e lançado) ou na fila de revisão. */
  async receber(texto: string, origem: Origem, opts: { id?: string } = {}): Promise<PedidoRegistro> {
    const r = await this.d.extrair(texto);
    const confianca: Confianca = r.pedido
      ? calcularConfianca(r.pedido, { tentativas: r.tentativas })
      : { score: 0, motivos: [] };

    const registro = await this.d.repo.criarPedido({
      id: opts.id,
      origem,
      texto_original: texto,
      provider: r.provider,
      pedido: r.pedido,
      confianca: confianca.score,
      motivos: confianca.motivos,
      status: !r.pedido ? "erro" : confianca.score >= this.limiar ? "pronto" : "revisao",
      erro: r.erro,
      revisado_em: null,
      chave_idempotencia: null,
    });
    await this.d.repo.registrarChamadas(registro.id, r.chamadas);

    if (registro.status === "pronto" && this.autoLancar) {
      const l = await this.lancar(registro.id);
      if (l.ok) return l.pedido;
    }
    return (await this.d.repo.obterPedido(registro.id)) ?? registro;
  }

  /** Grava a correção feita na revisão e recalcula a confiança. Não lança. */
  async corrigir(id: string, dados: unknown): Promise<{ ok: true; pedido: PedidoRegistro } | { ok: false; status: number; erro: string }> {
    const atual = await this.d.repo.obterPedido(id);
    if (!atual) return { ok: false, status: 404, erro: "pedido não encontrado" };
    if (atual.status === "lancado") return { ok: false, status: 409, erro: "pedido já lançado no Bling" };
    const v = PedidoSchema.safeParse(dados);
    if (!v.success) return { ok: false, status: 422, erro: formatarErros(v.error) };
    const c = calcularConfianca(v.data);
    const pedido = await this.d.repo.atualizarPedido(id, {
      pedido: v.data,
      confianca: c.score,
      motivos: c.motivos,
      status: "revisao",
      erro: null,
      revisado_em: new Date().toISOString(),
    });
    return { ok: true, pedido: pedido! };
  }

  /** Aprovação humana: lança mesmo abaixo do limiar, desde que o pedido passe no schema. */
  async aprovar(id: string): Promise<ResultadoLancar> {
    const atual = await this.d.repo.obterPedido(id);
    if (!atual) return { ok: false, status: 404, erro: "pedido não encontrado" };
    if (!atual.pedido || !PedidoSchema.safeParse(atual.pedido).success)
      return { ok: false, status: 422, erro: "corrija os campos antes de aprovar" };
    await this.d.repo.atualizarPedido(id, { revisado_em: new Date().toISOString() });
    return this.lancar(id);
  }

  async lancar(id: string): Promise<ResultadoLancar> {
    const atual = await this.d.repo.obterPedido(id);
    if (!atual?.pedido) return { ok: false, status: 404, erro: "pedido não encontrado" };

    const chave = chaveIdempotencia(atual.pedido);
    const reserva = await this.d.repo.reservarLancamento(chave, id);
    if (!reserva.ok) {
      if (reserva.existente.status === "reservado")
        return { ok: false, status: 409, erro: "lançamento deste pedido já está em andamento" };
      // Mesmo pedido já foi lançado (por este registro ou por um e-mail repetido).
      const pedido = await this.d.repo.atualizarPedido(id, {
        status: "lancado",
        chave_idempotencia: chave,
        erro: reserva.existente.pedido_id === id ? null : `duplicado do pedido ${reserva.existente.pedido_id}`,
      });
      return { ok: true, duplicado: true, lancamento: reserva.existente, pedido: pedido! };
    }

    try {
      const r = await this.d.lancador.lancar(atual.pedido, chave, this.hoje());
      const lancamento = await this.d.repo.concluirLancamento(chave, {
        modo: r.modo,
        bling_id: r.blingId,
        payload: r.payload,
      });
      const pedido = await this.d.repo.atualizarPedido(id, { status: "lancado", chave_idempotencia: chave, erro: null });
      return { ok: true, duplicado: false, lancamento, pedido: pedido! };
    } catch (e) {
      await this.d.repo.liberarLancamento(chave);
      const msg = e instanceof Error ? e.message : String(e);
      await this.d.repo.atualizarPedido(id, { erro: `falha ao lançar no Bling: ${msg}` });
      return { ok: false, status: 502, erro: msg };
    }
  }
}
