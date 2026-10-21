import { describe, expect, it } from "vitest";
import { calcularConfianca, LIMIAR_PADRAO } from "@/lib/confidence";
import { extrairHeuristico, numeroBR, provedorMock } from "@/lib/extract/mock";
import { EXEMPLOS, buscarExemplo } from "@/lib/samples";
import { PedidoSchema } from "@/lib/schema";

const exemplo = (id: string) => extrairHeuristico(buscarExemplo(id)!.texto);

describe("provedor mock", () => {
  it("converte número no formato brasileiro", () => {
    expect(numeroBR("1.234,56")).toBe(1234.56);
    expect(numeroBR("38,90")).toBe(38.9);
  });

  it.each(EXEMPLOS.map((e) => e.id))("o exemplo %s sai válido no schema", (id) => {
    expect(PedidoSchema.safeParse(exemplo(id)).success).toBe(true);
  });

  it("lê lista com SKU, unidade e preço", () => {
    const p = exemplo("bebidas");
    expect(p.cliente.cnpj).toBe("12.345.678/0001-95");
    expect(p.itens).toHaveLength(3);
    expect(p.itens[0]).toEqual({ sku: "BEB-REF-350", descricao: "Refrigerante cola lata 350ml", quantidade: 24, unidade: "CX", preco_unitario: 38.9 });
    expect(p.pagamento).toEqual({ condicao: "28/35 dias", forma: "boleto" });
    expect(p.data_entrega).toBe("2026-11-06");
    expect(p.total_declarado).toBe(2022.6);
  });

  it("lê tabela separada por barras e frete FOB com valor", () => {
    const p = exemplo("construcao");
    expect(p.itens.map((i) => i.sku)).toEqual(["CON-CIM-50", "CON-ARG-20", "CON-VER-10"]);
    expect(p.itens[0].quantidade).toBe(80);
    expect(p.frete).toEqual({ modalidade: "FOB", valor: 180 });
    expect(p.endereco_entrega?.cidade).toBe("Londrina");
    expect(p.endereco_entrega?.uf).toBe("PR");
  });

  it("mensagem informal: itens sem SKU e sem preço ficam null, não inventados", () => {
    const p = exemplo("bar");
    expect(p.itens).toHaveLength(3);
    expect(p.itens.every((i) => i.sku === null && i.preco_unitario === null)).toBe(true);
    expect(p.itens[0].unidade).toBe("CX");
    expect(p.pagamento.condicao).toBeNull();
    expect(p.data_entrega).toBeNull();
  });

  it("os três primeiros exemplos passam do limiar e os outros três vão para revisão", () => {
    const acima = EXEMPLOS.map((e) => calcularConfianca(extrairHeuristico(e.texto)).score >= LIMIAR_PADRAO);
    expect(acima).toEqual([true, true, true, false, false, false]);
  });

  it("é determinístico e registra tokens e custo simulados", async () => {
    const texto = buscarExemplo("papelaria")!.texto;
    const a = await provedorMock.iniciar(texto, "2026-10-21").tentar();
    const b = await provedorMock.iniciar(texto, "2026-10-21").tentar();
    expect(a.dados).toEqual(b.dados);
    expect(a.chamada.simulado).toBe(true);
    expect(a.chamada.input_tokens).toBeGreaterThan(100);
    expect(a.chamada.custo_usd).toBeGreaterThan(0);
  });
});
