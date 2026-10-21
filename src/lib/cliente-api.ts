import type { Lancamento, PedidoRegistro } from "./repo/types";
import { maisAdiantado } from "./versao";

/*
 * Lado do navegador da restauração usada na demo (ver Repositorio.restaurar).
 * O navegador guarda os pedidos que já viu; se a instância que atende a próxima
 * requisição não conhece o pedido, ele é reenviado e a requisição é repetida.
 * Com STORAGE=supabase a rota de restauração não existe e nada disso entra em jogo.
 */

const CHAVE = "pedidos-ia-erp:pedidos";
const MAXIMO = 50;

type Guardado = { registro: PedidoRegistro; lancamento: Lancamento | null };

function ler(): Record<string, Guardado> {
  try {
    return JSON.parse(localStorage.getItem(CHAVE) ?? "{}");
  } catch {
    return {};
  }
}

export function lembrar(registro: PedidoRegistro, lancamento?: Lancamento | null) {
  try {
    const todos = ler();
    const anterior = todos[registro.id];
    // Uma instância atrasada não pode apagar o que o navegador já viu adiante.
    const melhor = anterior ? maisAdiantado(registro, anterior.registro) : registro;
    todos[registro.id] = { registro: melhor, lancamento: lancamento ?? anterior?.lancamento ?? null };
    const recentes = Object.values(todos)
      .sort((a, b) => b.registro.criado_em.localeCompare(a.registro.criado_em))
      .slice(0, MAXIMO);
    localStorage.setItem(CHAVE, JSON.stringify(Object.fromEntries(recentes.map((g) => [g.registro.id, g]))));
  } catch {
    // Sem localStorage (aba privada, cota) a demo só perde a restauração.
  }
}

/** Se o navegador tem uma cópia mais adiantada que a do servidor, reenvia. */
export async function sincronizar(doServidor: PedidoRegistro): Promise<boolean> {
  const local = ler()[doServidor.id];
  if (!local || maisAdiantado(local.registro, doServidor) !== local.registro || local.registro === doServidor) return false;
  if (JSON.stringify(local.registro) === JSON.stringify(doServidor)) return false;
  const r = await fetch("/api/pedidos/restaurar", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(local),
  });
  return r.ok;
}

export function lembrados(): PedidoRegistro[] {
  return Object.values(ler()).map((g) => g.registro);
}

export async function chamar(url: string, init: RequestInit, id?: string): Promise<Response> {
  const resp = await fetch(url, { cache: "no-store", ...init });
  if (resp.status !== 404 || !id) return resp;
  const guardado = ler()[id];
  if (!guardado) return resp;
  const restaurado = await fetch("/api/pedidos/restaurar", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(guardado),
  });
  return restaurado.ok ? fetch(url, { cache: "no-store", ...init }) : resp;
}
