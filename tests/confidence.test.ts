import { describe, expect, it } from "vitest";
import { calcularConfianca, precisaRevisao } from "@/lib/confidence";
import { pedidoBase } from "./helpers";

const codigos = (p: ReturnType<typeof pedidoBase>, tentativas?: number) =>
  calcularConfianca(p, { tentativas }).motivos.map((m) => m.codigo);

describe("confiança", () => {
  it("pedido completo e coerente tem confiança 1", () => {
    const c = calcularConfianca(pedidoBase());
    expect(c.score).toBe(1);
    expect(c.motivos).toEqual([]);
    expect(precisaRevisao(c)).toBe(false);
  });

  it("CNPJ inválido derruba abaixo do limiar", () => {
    const p = pedidoBase();
    p.cliente.cnpj = "12.345.678/0001-96";
    const c = calcularConfianca(p);
    expect(codigos(p)).toEqual(["cnpj_invalido"]);
    expect(c.score).toBe(0.65);
    expect(precisaRevisao(c)).toBe(true);
  });

  it("soma dos itens diferente do total declarado", () => {
    const p = pedidoBase({ total_declarado: 1000 });
    const c = calcularConfianca(p);
    expect(codigos(p)).toEqual(["total_divergente"]);
    expect(c.motivos[0].mensagem).toContain("1.077,60");
  });

  it("o frete entra na conferência do total", () => {
    const p = pedidoBase({ frete: { modalidade: "FOB", valor: 22.4 }, total_declarado: 1100 });
    expect(codigos(p)).toEqual([]);
  });

  it("SKU fora do catálogo", () => {
    const p = pedidoBase();
    p.itens[0].sku = "XYZ-999";
    expect(codigos(p)).toEqual(["sku_desconhecido"]);
  });

  it("preço muito diferente da tabela", () => {
    const p = pedidoBase({ total_declarado: 1143.6 });
    p.itens[0].preco_unitario = 41.65; // tabela 38,90 -> +7%, ainda aceitável
    expect(codigos(p)).toEqual([]);
    p.itens[0].preco_unitario = 60;
    p.total_declarado = 1584;
    expect(codigos(p)).toEqual(["preco_divergente"]);
  });

  it("campos ausentes descontam e explicam qual campo", () => {
    const p = pedidoBase({ data_entrega: null, endereco_entrega: null });
    p.pagamento.condicao = null;
    const c = calcularConfianca(p);
    expect(c.motivos.map((m) => m.campo)).toEqual(["pagamento.condicao", "data_entrega", "endereco_entrega"]);
    expect(c.score).toBe(0.7);
  });

  it("penalidade por item tem teto para um pedido longo não zerar só por isso", () => {
    const p = pedidoBase({ total_declarado: null });
    p.itens = Array.from({ length: 8 }, (_, i) => ({ sku: null, descricao: `item ${i}`, quantidade: 1, unidade: "UN", preco_unitario: 1 }));
    const c = calcularConfianca(p);
    const sku = c.motivos.filter((m) => m.codigo === "sku_ausente").reduce((a, m) => a + m.penalidade, 0);
    expect(sku).toBeCloseTo(0.3);
    expect(c.score).toBeCloseTo(0.65);
  });

  it("retry desconta um pouco", () => {
    expect(codigos(pedidoBase(), 2)).toEqual(["precisou_retry"]);
    expect(calcularConfianca(pedidoBase(), { tentativas: 2 }).score).toBe(0.95);
  });

  it("score nunca fica negativo", () => {
    const p = pedidoBase({ data_entrega: null, endereco_entrega: null, total_declarado: 1 });
    p.cliente = { razao_social: null, cnpj: "11.111.111/1111-11", email: null };
    p.pagamento.condicao = null;
    p.itens = p.itens.map((i) => ({ ...i, sku: null, preco_unitario: null }));
    expect(calcularConfianca(p).score).toBe(0);
  });

  it("limiar é configurável", () => {
    const c = { score: 0.75, motivos: [] };
    expect(precisaRevisao(c, 0.8)).toBe(true);
    expect(precisaRevisao(c, 0.7)).toBe(false);
  });
});
