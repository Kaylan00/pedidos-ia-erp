import { describe, expect, it } from "vitest";
import type { ChamadaModelo } from "@/lib/extract/types";
import { segmentar, trechosDoPedido } from "@/lib/highlight";
import { percentil, resumirChamadas } from "@/lib/metrics";
import { pedidoBase } from "./helpers";

const c = (latencia_ms: number, model = "claude-opus-5-5", ok = true): ChamadaModelo => ({
  provider: "anthropic", model, tentativa: 1, input_tokens: 1000, output_tokens: 200,
  custo_usd: 0.008, latencia_ms, ok, simulado: false,
});

describe("métricas", () => {
  it("p95 pelo método nearest-rank", () => {
    const v = Array.from({ length: 100 }, (_, i) => i + 1);
    expect(percentil(v, 95)).toBe(95);
    expect(percentil(v, 50)).toBe(50);
    expect(percentil([7], 95)).toBe(7);
    expect(percentil([], 95)).toBe(0);
  });

  it("resume custo, tokens e latência por modelo", () => {
    const r = resumirChamadas([c(100), c(300), c(2000, "claude-haiku-5-5", false)]);
    expect(r.chamadas).toBe(3);
    expect(r.falhas).toBe(1);
    expect(r.tokensEntrada).toBe(3000);
    expect(r.custoTotal).toBe(0.024);
    expect(r.p95).toBe(2000);
    expect(r.porModelo.find((m) => m.model === "claude-opus-5-5")?.chamadas).toBe(2);
  });
});

describe("destaque no texto original", () => {
  it("marca CNPJ, SKU e preço no formato em que aparecem", () => {
    const texto = "CNPJ: 12.345.678/0001-95\n- 24 CX BEB-REF-350 Refrigerante - R$ 38,90";
    const seg = segmentar(texto, trechosDoPedido(pedidoBase()));
    const marcados = seg.filter((s) => s.campo).map((s) => [s.campo, s.texto]);
    expect(marcados).toContainEqual(["cliente.cnpj", "12.345.678/0001-95"]);
    expect(marcados).toContainEqual(["itens.0.sku", "BEB-REF-350"]);
    expect(marcados).toContainEqual(["itens.0.preco_unitario", "38,90"]);
    expect(seg.map((s) => s.texto).join("")).toBe(texto);
  });
});
