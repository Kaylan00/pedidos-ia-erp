import type Anthropic from "@anthropic-ai/sdk";
import { describe, expect, it, vi } from "vitest";
import { criarProvedorAnthropic } from "@/lib/extract/anthropic";
import { extrairComValidacao, provedorDoAmbiente } from "@/lib/extract";
import { custoEstimado } from "@/lib/extract/pricing";
import type { ProvedorSessao, RespostaBruta } from "@/lib/extract/types";
import { pedidoBase } from "./helpers";

const chamada = { provider: "fake", model: "fake", input_tokens: 100, output_tokens: 50, custo_usd: 0.001, latencia_ms: 10, simulado: false };

function provedorFalso(respostas: unknown[]): ProvedorSessao & { recebidos: (string | undefined)[] } {
  const recebidos: (string | undefined)[] = [];
  return {
    nome: "fake",
    recebidos,
    iniciar() {
      let i = 0;
      return {
        async tentar(erros?: string): Promise<RespostaBruta> {
          recebidos.push(erros);
          return { dados: respostas[i++], chamada };
        },
      };
    },
  };
}

describe("extração com validação e retry", () => {
  it("primeira resposta válida: uma chamada só", async () => {
    const p = provedorFalso([pedidoBase()]);
    const r = await extrairComValidacao(p, "texto");
    expect(r.pedido).not.toBeNull();
    expect(r.tentativas).toBe(1);
    expect(r.chamadas).toHaveLength(1);
    expect(r.chamadas[0].ok).toBe(true);
  });

  it("resposta inválida: devolve os erros do schema e aceita a correção", async () => {
    const invalido = { ...pedidoBase(), data_entrega: "06/11/2026" };
    const p = provedorFalso([invalido, pedidoBase()]);
    const r = await extrairComValidacao(p, "texto");
    expect(r.tentativas).toBe(2);
    expect(r.pedido?.data_entrega).toBe("2026-11-06");
    expect(p.recebidos[0]).toBeUndefined();
    expect(p.recebidos[1]).toContain("data_entrega");
    expect(r.chamadas.map((c) => c.ok)).toEqual([false, true]);
  });

  it("para depois de duas tentativas inválidas", async () => {
    const p = provedorFalso([{ itens: [] }, { itens: [] }, pedidoBase()]);
    const r = await extrairComValidacao(p, "texto");
    expect(r.pedido).toBeNull();
    expect(r.tentativas).toBe(2);
    expect(r.erro).toContain("itens");
  });

  it("erro de rede vira registro de chamada com falha, sem estourar exceção", async () => {
    const p: ProvedorSessao = {
      nome: "fake",
      iniciar: () => ({ tentar: async () => Promise.reject(new Error("timeout")) }),
    };
    const r = await extrairComValidacao(p, "texto");
    expect(r.pedido).toBeNull();
    expect(r.erro).toBe("timeout");
    expect(r.chamadas[0].ok).toBe(false);
  });

  it("sem chave de API o ambiente escolhe o mock", () => {
    expect(provedorDoAmbiente({}).nome).toBe("mock");
    expect(provedorDoAmbiente({ EXTRACT_PROVIDER: "anthropic" }).nome).toBe("mock");
    expect(provedorDoAmbiente({ ANTHROPIC_API_KEY: "sk-test" }).nome).toBe("anthropic");
  });
});

describe("provedor Anthropic", () => {
  function clienteFalso(respostas: object[]) {
    const create = vi.fn();
    respostas.forEach((r) => create.mockResolvedValueOnce(r));
    return { client: { beta: { messages: { create } } } as unknown as Anthropic, create };
  }
  const resposta = (input: unknown, id = "toolu_1") => ({
    model: "claude-opus-5-5",
    stop_reason: "tool_use",
    stop_details: null,
    content: [{ type: "tool_use", id, name: "registrar_pedido", input }],
    usage: { input_tokens: 1200, output_tokens: 300, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 },
  });

  it("usa tool use e devolve o erro do schema como tool_result com is_error", async () => {
    const { client, create } = clienteFalso([resposta({ ...pedidoBase(), data_entrega: "amanhã" }), resposta(pedidoBase(), "toolu_2")]);
    const provedor = criarProvedorAnthropic({ apiKey: "x", client });
    const r = await extrairComValidacao(provedor, "pedido", "2026-10-21");

    expect(r.pedido).not.toBeNull();
    expect(create).toHaveBeenCalledTimes(2);
    const primeira = create.mock.calls[0][0];
    expect(primeira.tools[0].name).toBe("registrar_pedido");
    expect(primeira.output_config).toEqual({ effort: "low" });
    expect(primeira.messages[0].content).toContain("Data de referência: 2026-10-21");

    const segunda = create.mock.calls[1][0];
    const ultima = segunda.messages[segunda.messages.length - 1];
    expect(ultima.content[0]).toMatchObject({ type: "tool_result", tool_use_id: "toolu_1", is_error: true });
    expect(ultima.content[0].content).toContain("data_entrega");
  });

  it("grava tokens, custo pelo modelo que respondeu e latência", async () => {
    const { client } = clienteFalso([resposta(pedidoBase())]);
    const r = await extrairComValidacao(criarProvedorAnthropic({ apiKey: "x", client }), "pedido");
    const c = r.chamadas[0];
    expect(c.input_tokens).toBe(1200);
    expect(c.output_tokens).toBe(300);
    expect(c.custo_usd).toBe(custoEstimado("claude-opus-5-5", { input_tokens: 1200, output_tokens: 300 }));
    expect(c.latencia_ms).toBeGreaterThanOrEqual(0);
  });

  it("recusa do modelo vira erro registrado", async () => {
    const { client } = clienteFalso([{ ...resposta(null), stop_reason: "refusal", stop_details: { category: "cyber" }, content: [] }]);
    const r = await extrairComValidacao(criarProvedorAnthropic({ apiKey: "x", client }), "pedido");
    expect(r.pedido).toBeNull();
    expect(r.erro).toContain("recusou");
  });

  it("calcula custo com preço de cache", () => {
    expect(custoEstimado("claude-opus-5-5", { input_tokens: 1_000_000, output_tokens: 0 })).toBe(4);
    expect(custoEstimado("claude-opus-5-5", { input_tokens: 0, output_tokens: 0, cache_read_input_tokens: 1_000_000 })).toBe(0.4);
  });
});
