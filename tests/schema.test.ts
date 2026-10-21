import { describe, expect, it } from "vitest";
import { PedidoSchema, formatarErros, pedidoJsonSchema, somaItens, totalPedido } from "@/lib/schema";
import { pedidoBase } from "./helpers";

describe("schema do pedido", () => {
  it("aceita um pedido completo", () => {
    expect(PedidoSchema.safeParse(pedidoBase()).success).toBe(true);
  });

  it("aceita campos opcionais como null", () => {
    const p = pedidoBase({ data_entrega: null, endereco_entrega: null, total_declarado: null });
    p.cliente.cnpj = null;
    p.itens[0].sku = null;
    p.itens[0].preco_unitario = null;
    expect(PedidoSchema.safeParse(p).success).toBe(true);
  });

  it("recusa pedido sem itens", () => {
    const r = PedidoSchema.safeParse(pedidoBase({ itens: [] }));
    expect(r.success).toBe(false);
  });

  it("recusa quantidade zero ou negativa", () => {
    const p = pedidoBase();
    p.itens[1].quantidade = 0;
    const r = PedidoSchema.safeParse(p);
    expect(r.success).toBe(false);
    if (!r.success) expect(formatarErros(r.error)).toContain("itens.1.quantidade");
  });

  it("recusa data fora do formato ISO e UF com 3 letras", () => {
    const p = pedidoBase({ data_entrega: "06/11/2026" });
    p.endereco_entrega!.uf = "SPX";
    const r = PedidoSchema.safeParse(p);
    expect(r.success).toBe(false);
    if (!r.success) {
      const msg = formatarErros(r.error);
      expect(msg).toContain("data_entrega");
      expect(msg).toContain("endereco_entrega.uf");
    }
  });

  it("recusa frete fora de CIF/FOB", () => {
    const r = PedidoSchema.safeParse({ ...pedidoBase(), frete: { modalidade: "por conta", valor: null } });
    expect(r.success).toBe(false);
  });

  it("gera JSON Schema sem a chave $schema para a ferramenta do modelo", () => {
    const js = pedidoJsonSchema();
    expect(js.$schema).toBeUndefined();
    expect(js.type).toBe("object");
    expect(Object.keys(js.properties as object)).toContain("itens");
  });

  it("soma itens e frete com arredondamento em centavos", () => {
    const p = pedidoBase({ frete: { modalidade: "FOB", valor: 10.1 } });
    expect(somaItens(p.itens)).toBe(1077.6);
    expect(totalPedido(p)).toBe(1087.7);
  });
});
