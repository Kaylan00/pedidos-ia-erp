import { describe, expect, it, vi } from "vitest";
import { LancadorSandbox } from "@/lib/bling/client";
import type { Lancador } from "@/lib/bling/types";
import { extrairComValidacao } from "@/lib/extract";
import { provedorMock } from "@/lib/extract/mock";
import { chaveIdempotencia } from "@/lib/idempotency";
import { ServicoPedidos } from "@/lib/pipeline";
import { RepositorioMemoria } from "@/lib/repo/memory";
import { buscarExemplo } from "@/lib/samples";
import { pedidoBase } from "./helpers";

function montar(lancador: Lancador = new LancadorSandbox()) {
  const repo = new RepositorioMemoria();
  const servico = new ServicoPedidos({
    repo,
    lancador,
    extrair: (t) => extrairComValidacao(provedorMock, t, "2026-10-21"),
    hoje: () => "2026-10-21",
  });
  return { repo, servico };
}
const texto = (id: string) => buscarExemplo(id)!.texto;

describe("chave de idempotência", () => {
  it("é estável para o mesmo pedido", () => {
    expect(chaveIdempotencia(pedidoBase())).toBe(chaveIdempotencia(pedidoBase()));
  });

  it("ignora ordem dos itens, máscara do CNPJ e razão social", () => {
    const a = pedidoBase();
    const b = pedidoBase();
    b.itens.reverse();
    b.cliente.cnpj = "12345678000195";
    b.cliente.razao_social = "Emporio Serra Azul";
    expect(chaveIdempotencia(a)).toBe(chaveIdempotencia(b));
  });

  it("muda quando muda quantidade, preço ou data", () => {
    const base = chaveIdempotencia(pedidoBase());
    const q = pedidoBase();
    q.itens[0].quantidade = 25;
    const pr = pedidoBase();
    pr.itens[0].preco_unitario = 39;
    expect(chaveIdempotencia(q)).not.toBe(base);
    expect(chaveIdempotencia(pr)).not.toBe(base);
    expect(chaveIdempotencia(pedidoBase({ data_entrega: "2026-11-07" }))).not.toBe(base);
  });
});

describe("fluxo do pedido", () => {
  it("confiança alta: lança direto no Bling (sandbox) e grava a chamada", async () => {
    const { repo, servico } = montar();
    const r = await servico.receber(texto("bebidas"), "exemplo");
    expect(r.status).toBe("lancado");
    expect(r.chave_idempotencia).toHaveLength(32);
    const l = await repo.obterLancamento(r.chave_idempotencia!);
    expect(l?.modo).toBe("sandbox");
    expect(l?.payload?.itens).toHaveLength(3);
    expect(await repo.listarChamadas()).toHaveLength(1);
  });

  it("confiança baixa: vai para a fila de revisão e não lança", async () => {
    const { repo, servico } = montar();
    const r = await servico.receber(texto("limpeza"), "exemplo");
    expect(r.status).toBe("revisao");
    expect(r.motivos.map((m) => m.codigo)).toContain("cnpj_invalido");
    expect(await repo.listarPedidos({ status: "revisao" })).toHaveLength(1);
  });

  it("o mesmo e-mail recebido duas vezes não gera dois pedidos no Bling", async () => {
    const lancar = vi.fn(new LancadorSandbox().lancar);
    const { servico } = montar({ modo: "sandbox", lancar });
    const a = await servico.receber(texto("construcao"), "exemplo");
    const b = await servico.receber(texto("construcao"), "exemplo");
    expect(lancar).toHaveBeenCalledTimes(1);
    expect(b.status).toBe("lancado");
    expect(b.erro).toContain(a.id);
  });

  it("aprovar duas vezes devolve o lançamento existente", async () => {
    const lancar = vi.fn(new LancadorSandbox().lancar);
    const { servico } = montar({ modo: "sandbox", lancar });
    const r = await servico.receber(texto("mercearia"), "exemplo");
    const p1 = await servico.aprovar(r.id);
    const p2 = await servico.aprovar(r.id);
    expect(p1.ok && p1.duplicado).toBe(false);
    expect(p2.ok && p2.duplicado).toBe(true);
    expect(lancar).toHaveBeenCalledTimes(1);
  });

  it("correção na revisão recalcula a confiança", async () => {
    const { servico } = montar();
    const r = await servico.receber(texto("limpeza"), "exemplo");
    const corrigido = { ...r.pedido!, cliente: { ...r.pedido!.cliente, cnpj: "45.678.123/0001-14" } };
    const c = await servico.corrigir(r.id, corrigido);
    expect(c.ok && c.pedido.confianca).toBe(1);
    expect(c.ok && c.pedido.revisado_em).toBeTruthy();
  });

  it("correção que não passa no schema é recusada com o erro", async () => {
    const { servico } = montar();
    const r = await servico.receber(texto("limpeza"), "exemplo");
    const c = await servico.corrigir(r.id, { ...r.pedido!, itens: [] });
    expect(c.ok).toBe(false);
    expect(!c.ok && c.status).toBe(422);
  });

  it("falha no Bling libera a chave para tentar de novo", async () => {
    const lancar = vi.fn().mockRejectedValueOnce(new Error("Bling respondeu 503")).mockImplementation(new LancadorSandbox().lancar);
    const { repo, servico } = montar({ modo: "live", lancar });
    const r = await servico.receber(texto("papelaria"), "exemplo");
    expect(r.status).toBe("pronto");
    expect(r.erro).toContain("503");
    expect(await repo.obterLancamento(chaveIdempotencia(r.pedido!))).toBeNull();
    const again = await servico.aprovar(r.id);
    expect(again.ok).toBe(true);
  });

  it("reserva concorrente do mesmo pedido: só uma passa", async () => {
    const repo = new RepositorioMemoria();
    const [a, b] = await Promise.all([repo.reservarLancamento("k", "p1"), repo.reservarLancamento("k", "p2")]);
    expect([a.ok, b.ok].sort()).toEqual([false, true]);
  });
});

describe("restauração da demo em memória", () => {
  it("recoloca um pedido criado em outra instância e permite aprovar", async () => {
    const a = montar();
    const b = montar();
    const r = await a.servico.receber(texto("mercearia"), "exemplo");
    expect(await b.repo.obterPedido(r.id)).toBeNull();
    await b.repo.restaurar!(r, null);
    const aprovado = await b.servico.aprovar(r.id);
    expect(aprovado.ok).toBe(true);
  });

  it("não troca uma cópia lançada por uma mais atrasada", async () => {
    const { repo, servico } = montar();
    const r = await servico.receber(texto("bebidas"), "exemplo");
    expect(r.status).toBe("lancado");
    await repo.restaurar!({ ...r, status: "revisao" }, null);
    expect((await repo.obterPedido(r.id))?.status).toBe("lancado");
  });

  it("aceita id fixo na criação, usado pelos exemplos da demo", async () => {
    const { repo, servico } = montar();
    const r = await servico.receber(texto("papelaria"), "exemplo", { id: "00000000-0000-4000-a000-000000000001" });
    expect(r.id).toBe("00000000-0000-4000-a000-000000000001");
    expect(await repo.obterPedido(r.id)).not.toBeNull();
  });
});
