import type { ResultadoExtracao } from "./types";

/**
 * Chama a Edge Function supabase/functions/extract. Ela roda o mesmo laço de
 * extração + validação + retry em Deno e devolve o resultado no mesmo formato.
 */
export function criarExtratorEdge(opts: { url: string; chave: string; fetch?: typeof fetch }) {
  const http = opts.fetch ?? fetch;
  return async (texto: string): Promise<ResultadoExtracao> => {
    const resp = await http(`${opts.url.replace(/\/$/, "")}/functions/v1/extract`, {
      method: "POST",
      headers: { Authorization: `Bearer ${opts.chave}`, "Content-Type": "application/json" },
      body: JSON.stringify({ texto }),
    });
    if (!resp.ok) {
      const msg = `edge function respondeu ${resp.status}`;
      return { provider: "edge", pedido: null, tentativas: 0, chamadas: [], erro: msg };
    }
    return (await resp.json()) as ResultadoExtracao;
  };
}
