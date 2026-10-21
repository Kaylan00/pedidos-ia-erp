import Anthropic from "@anthropic-ai/sdk";
import type { BetaContentBlock, BetaMessageParam, BetaToolUnion } from "@anthropic-ai/sdk/resources/beta/messages/messages";
import { pedidoJsonSchema } from "../schema";
import { custoEstimado, MODELO_PADRAO } from "./pricing";
import { NOME_FERRAMENTA, SYSTEM_PROMPT, mensagemUsuario } from "./prompt";
import type { ProvedorSessao } from "./types";

/**
 * Extração com Claude via tool use. A ferramenta não é "strict" de propósito:
 * o schema tem padrões (CNPJ, CEP, data) que a validação zod confere depois, e
 * quando falha o erro volta para o modelo como tool_result com is_error.
 */
export function criarProvedorAnthropic(opts: { apiKey: string; model?: string; client?: Anthropic }): ProvedorSessao {
  const client = opts.client ?? new Anthropic({ apiKey: opts.apiKey, maxRetries: 2, timeout: 60_000 });
  const model = opts.model ?? MODELO_PADRAO;
  const ferramenta: BetaToolUnion = {
    name: NOME_FERRAMENTA,
    description: "Registra o pedido extraído do texto. Chame exatamente uma vez com todos os campos.",
    input_schema: pedidoJsonSchema() as BetaToolUnion extends { input_schema: infer S } ? S : never,
  };

  return {
    nome: "anthropic",
    iniciar(texto, dataReferencia) {
      const messages: BetaMessageParam[] = [{ role: "user", content: mensagemUsuario(texto, dataReferencia) }];
      let ultimo: { content: BetaContentBlock[]; toolUseId: string | null } | null = null;

      return {
        async tentar(erros) {
          if (erros && ultimo) {
            messages.push({ role: "assistant", content: ultimo.content });
            const instrucao = `O pedido não passou na validação do schema:\n${erros}\nCorrija esses campos e chame ${NOME_FERRAMENTA} de novo.`;
            messages.push({
              role: "user",
              content: ultimo.toolUseId
                ? [{ type: "tool_result", tool_use_id: ultimo.toolUseId, content: instrucao, is_error: true }]
                : instrucao,
            });
          }

          const t0 = performance.now();
          const resp = await client.beta.messages.create({
            model,
            max_tokens: 16000,
            system: [{ type: "text", text: SYSTEM_PROMPT, cache_control: { type: "ephemeral" } }],
            tools: [ferramenta],
            tool_choice: { type: "auto" },
            output_config: { effort: "low" },
            // Se o classificador de segurança recusar, a API tenta outro modelo sozinha.
            betas: ["server-side-fallback-2026-07-01"],
            fallbacks: "default",
            messages,
          });
          const latencia = Math.round(performance.now() - t0);

          if (resp.stop_reason === "refusal") {
            throw new Error(`modelo recusou a requisição (${resp.stop_details?.category ?? "sem categoria"})`);
          }
          const toolUse = resp.content.find((b) => b.type === "tool_use" && b.name === NOME_FERRAMENTA);
          ultimo = { content: resp.content, toolUseId: toolUse && toolUse.type === "tool_use" ? toolUse.id : null };

          return {
            dados: toolUse && toolUse.type === "tool_use" ? toolUse.input : null,
            chamada: {
              provider: "anthropic",
              model: resp.model,
              input_tokens: resp.usage.input_tokens + (resp.usage.cache_read_input_tokens ?? 0) + (resp.usage.cache_creation_input_tokens ?? 0),
              output_tokens: resp.usage.output_tokens,
              custo_usd: custoEstimado(resp.model, resp.usage),
              latencia_ms: latencia,
              simulado: false,
            },
          };
        },
      };
    },
  };
}
