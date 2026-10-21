import { PedidoSchema, formatarErros } from "../schema";
import { criarProvedorAnthropic } from "./anthropic";
import { provedorMock } from "./mock";
import type { ChamadaModelo, ProvedorSessao, ResultadoExtracao } from "./types";

export const MAX_TENTATIVAS = 2;

/**
 * Roda a extração com validação por schema e no máximo uma nova tentativa,
 * devolvendo ao provedor a lista de erros da primeira.
 */
export async function extrairComValidacao(
  provedor: ProvedorSessao,
  texto: string,
  dataReferencia = new Date().toISOString().slice(0, 10),
): Promise<ResultadoExtracao> {
  const sessao = provedor.iniciar(texto, dataReferencia);
  const chamadas: ChamadaModelo[] = [];
  let erros: string | undefined;

  for (let tentativa = 1; tentativa <= MAX_TENTATIVAS; tentativa++) {
    let resposta;
    try {
      resposta = await sessao.tentar(erros);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      chamadas.push({
        provider: provedor.nome, model: "-", tentativa, input_tokens: 0, output_tokens: 0,
        custo_usd: 0, latencia_ms: 0, ok: false, simulado: false, erro: msg,
      });
      return { provider: provedor.nome, pedido: null, tentativas: tentativa, chamadas, erro: msg };
    }

    const validado = PedidoSchema.safeParse(resposta.dados);
    chamadas.push({
      ...resposta.chamada,
      tentativa,
      ok: validado.success,
      erro: validado.success ? null : formatarErros(validado.error),
    });
    if (validado.success) {
      return { provider: provedor.nome, pedido: validado.data, tentativas: tentativa, chamadas, erro: null };
    }
    erros = resposta.dados == null ? "- a ferramenta não foi chamada" : formatarErros(validado.error);
  }
  return { provider: provedor.nome, pedido: null, tentativas: MAX_TENTATIVAS, chamadas, erro: erros ?? null };
}

/** Escolhe o provedor pelas variáveis de ambiente. Sem chave, sempre mock. */
export function provedorDoAmbiente(env: Record<string, string | undefined> = process.env): ProvedorSessao {
  const escolhido = env.EXTRACT_PROVIDER ?? (env.ANTHROPIC_API_KEY ? "anthropic" : "mock");
  if (escolhido === "anthropic" && env.ANTHROPIC_API_KEY) {
    return criarProvedorAnthropic({ apiKey: env.ANTHROPIC_API_KEY, model: env.ANTHROPIC_MODEL || undefined });
  }
  return provedorMock;
}

export type { ChamadaModelo, ResultadoExtracao, ProvedorSessao } from "./types";
