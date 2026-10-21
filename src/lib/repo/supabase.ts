import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { TokenStore } from "../bling/client";
import type { ChamadaModelo } from "../extract/types";
import type {
  ChamadaRegistro,
  Lancamento,
  NovoPedido,
  PedidoRegistro,
  Repositorio,
  Reserva,
  StatusPedido,
} from "./types";

/** Implementação sobre as tabelas de supabase/migrations. Usa a service role no servidor. */
export class RepositorioSupabase implements Repositorio {
  private readonly db: SupabaseClient;

  constructor(url: string, serviceRoleKey: string) {
    this.db = createClient(url, serviceRoleKey, { auth: { persistSession: false } });
  }

  private falhar(contexto: string, erro: { message: string } | null): never {
    throw new Error(`${contexto}: ${erro?.message ?? "erro desconhecido"}`);
  }

  async criarPedido(dados: NovoPedido): Promise<PedidoRegistro> {
    const { data, error } = await this.db.from("pedidos").insert(dados).select().single();
    if (error) this.falhar("criar pedido", error);
    return data as PedidoRegistro;
  }

  async obterPedido(id: string) {
    const { data, error } = await this.db.from("pedidos").select().eq("id", id).maybeSingle();
    if (error) this.falhar("obter pedido", error);
    return (data as PedidoRegistro) ?? null;
  }

  async listarPedidos(filtro: { status?: StatusPedido } = {}) {
    let q = this.db.from("pedidos").select().order("criado_em", { ascending: false }).limit(200);
    if (filtro.status) q = q.eq("status", filtro.status);
    const { data, error } = await q;
    if (error) this.falhar("listar pedidos", error);
    return (data ?? []) as PedidoRegistro[];
  }

  async atualizarPedido(id: string, patch: Partial<NovoPedido>) {
    const { data, error } = await this.db.from("pedidos").update(patch).eq("id", id).select().maybeSingle();
    if (error) this.falhar("atualizar pedido", error);
    return (data as PedidoRegistro) ?? null;
  }

  async registrarChamadas(pedidoId: string | null, chamadas: ChamadaModelo[]) {
    if (!chamadas.length) return;
    const { error } = await this.db.from("chamadas_modelo").insert(chamadas.map((c) => ({ ...c, pedido_id: pedidoId })));
    if (error) this.falhar("registrar chamadas", error);
  }

  async listarChamadas(limite = 500) {
    const { data, error } = await this.db
      .from("chamadas_modelo")
      .select()
      .order("criado_em", { ascending: false })
      .limit(limite);
    if (error) this.falhar("listar chamadas", error);
    return (data ?? []) as ChamadaRegistro[];
  }

  async reservarLancamento(chave: string, pedidoId: string): Promise<Reserva> {
    // A chave é primary key: dois inserts simultâneos não passam os dois.
    const { error } = await this.db.from("lancamentos_bling").insert({ chave, pedido_id: pedidoId, status: "reservado" });
    if (!error) return { ok: true };
    if (error.code !== "23505") this.falhar("reservar lançamento", error);
    const existente = await this.obterLancamento(chave);
    if (!existente) this.falhar("reservar lançamento", { message: "conflito sem registro" });
    return { ok: false, existente };
  }

  async concluirLancamento(chave: string, dados: Pick<Lancamento, "modo" | "bling_id" | "payload">) {
    const { data, error } = await this.db
      .from("lancamentos_bling")
      .update({ ...dados, status: "concluido" })
      .eq("chave", chave)
      .select()
      .single();
    if (error) this.falhar("concluir lançamento", error);
    return data as Lancamento;
  }

  async liberarLancamento(chave: string) {
    const { error } = await this.db.from("lancamentos_bling").delete().eq("chave", chave).eq("status", "reservado");
    if (error) this.falhar("liberar lançamento", error);
  }

  async obterLancamento(chave: string) {
    const { data, error } = await this.db.from("lancamentos_bling").select().eq("chave", chave).maybeSingle();
    if (error) this.falhar("obter lançamento", error);
    return (data as Lancamento) ?? null;
  }
}

/** Guarda o refresh token do Bling, que muda a cada renovação. */
export class TokenStoreSupabase implements TokenStore {
  private readonly db: SupabaseClient;

  constructor(url: string, serviceRoleKey: string) {
    this.db = createClient(url, serviceRoleKey, { auth: { persistSession: false } });
  }

  async ler(): Promise<string | null> {
    const { data } = await this.db.from("bling_tokens").select("refresh_token").eq("id", 1).maybeSingle();
    return (data?.refresh_token as string | undefined) ?? null;
  }

  async salvarRefreshToken(token: string): Promise<void> {
    const { error } = await this.db
      .from("bling_tokens")
      .upsert({ id: 1, refresh_token: token, atualizado_em: new Date().toISOString() });
    if (error) throw new Error(`salvar refresh token do Bling: ${error.message}`);
  }
}
