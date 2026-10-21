// Edge Function (Deno) que faz a extração no Supabase: recebe { texto }, chama o
// Claude com tool use, valida com o mesmo schema zod do app, tenta de novo uma
// vez com os erros e devolve tokens, custo e latência de cada chamada. Quem
// grava em chamadas_modelo é o app, junto com o pedido, para ligar as duas coisas.
//
// Schema, prompt e tabela de preços vêm de src/lib, para não haver duas versões.
import Anthropic from "@anthropic-ai/sdk";
import { PedidoSchema, formatarErros, pedidoJsonSchema } from "../../../src/lib/schema.ts";
import { NOME_FERRAMENTA, SYSTEM_PROMPT, mensagemUsuario } from "../../../src/lib/extract/prompt.ts";
import { MODELO_PADRAO, custoEstimado } from "../../../src/lib/extract/pricing.ts";

const MAX_TENTATIVAS = 2;

interface Chamada {
  provider: string;
  model: string;
  tentativa: number;
  input_tokens: number;
  output_tokens: number;
  custo_usd: number;
  latencia_ms: number;
  ok: boolean;
  simulado: boolean;
  erro: string | null;
}

const anthropic = new Anthropic({ apiKey: Deno.env.get("ANTHROPIC_API_KEY") });
const model = Deno.env.get("ANTHROPIC_MODEL") ?? MODELO_PADRAO;

const json = (corpo: unknown, status = 200) =>
  new Response(JSON.stringify(corpo), { status, headers: { "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ erro: "use POST" }, 405);
  const corpo = await req.json().catch(() => null);
  const texto: unknown = corpo?.texto;
  if (typeof texto !== "string" || texto.length < 10) return json({ erro: "envie { texto }" }, 400);

  const hoje = new Date().toISOString().slice(0, 10);
  const messages: Anthropic.Beta.Messages.BetaMessageParam[] = [{ role: "user", content: mensagemUsuario(texto, hoje) }];
  const chamadas: Chamada[] = [];
  let erros: string | null = null;

  for (let tentativa = 1; tentativa <= MAX_TENTATIVAS; tentativa++) {
    const t0 = performance.now();
    const resp = await anthropic.beta.messages.create({
      model,
      max_tokens: 16000,
      system: [{ type: "text", text: SYSTEM_PROMPT, cache_control: { type: "ephemeral" } }],
      tools: [
        {
          name: NOME_FERRAMENTA,
          description: "Registra o pedido extraído do texto. Chame exatamente uma vez com todos os campos.",
          input_schema: pedidoJsonSchema() as Anthropic.Beta.Messages.BetaTool.InputSchema,
        },
      ],
      tool_choice: { type: "auto" },
      output_config: { effort: "low" },
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      messages,
    });
    const latencia = Math.round(performance.now() - t0);
    const toolUse = resp.content.find((b) => b.type === "tool_use" && b.name === NOME_FERRAMENTA);
    const dados = toolUse?.type === "tool_use" ? toolUse.input : null;
    const v = PedidoSchema.safeParse(dados);
    erros = resp.stop_reason === "refusal" ? "modelo recusou a requisição" : v.success ? null : formatarErros(v.error);

    chamadas.push({
      provider: "edge",
      model: resp.model,
      tentativa,
      input_tokens:
        resp.usage.input_tokens + (resp.usage.cache_read_input_tokens ?? 0) + (resp.usage.cache_creation_input_tokens ?? 0),
      output_tokens: resp.usage.output_tokens,
      custo_usd: custoEstimado(resp.model, resp.usage),
      latencia_ms: latencia,
      ok: v.success,
      simulado: false,
      erro: erros,
    });

    if (v.success || resp.stop_reason === "refusal") {
      return json({ provider: "edge", pedido: v.success ? v.data : null, tentativas: tentativa, chamadas, erro: erros });
    }

    messages.push({ role: "assistant", content: resp.content });
    const instrucao = `O pedido não passou na validação do schema:\n${erros}\nCorrija esses campos e chame ${NOME_FERRAMENTA} de novo.`;
    messages.push({
      role: "user",
      content:
        toolUse?.type === "tool_use"
          ? [{ type: "tool_result", tool_use_id: toolUse.id, content: instrucao, is_error: true }]
          : instrucao,
    });
  }

  return json({ provider: "edge", pedido: null, tentativas: MAX_TENTATIVAS, chamadas, erro: erros });
});
