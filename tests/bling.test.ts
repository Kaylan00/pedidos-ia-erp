import { describe, expect, it, vi } from "vitest";
import { BlingClient, BLING_API, LancadorSandbox, lancadorDoAmbiente } from "@/lib/bling/client";
import { fretePorConta, gerarParcelas, mapearParaBling, prazosDaCondicao } from "@/lib/bling/mapper";
import { pedidoBase } from "./helpers";

describe("mapeamento para o Bling", () => {
  const payload = mapearParaBling(pedidoBase(), { contatoId: 77, chave: "abc", dataPedido: "2026-10-21" });

  it("monta itens com código, unidade, quantidade e valor", () => {
    expect(payload.contato).toEqual({ id: 77 });
    expect(payload.itens[0]).toEqual({ codigo: "BEB-REF-350", descricao: "Refrigerante cola lata", unidade: "CX", quantidade: 24, valor: 38.9 });
    expect(payload.data).toBe("2026-10-21");
    expect(payload.dataPrevista).toBe("2026-11-06");
  });

  it("endereço vai para a etiqueta de transporte com CEP só em dígitos", () => {
    expect(payload.transporte.etiqueta).toMatchObject({ municipio: "Campinas", uf: "SP", cep: "13010110", numero: "410" });
  });

  it("chave de idempotência fica nas observações internas", () => {
    expect(payload.observacoesInternas).toBe("pedidos-ia-erp:abc");
  });

  it("CIF é frete do remetente (0), FOB do destinatário (1), sem informação é 9", () => {
    expect(fretePorConta("CIF")).toBe(0);
    expect(fretePorConta("FOB")).toBe(1);
    expect(fretePorConta(null)).toBe(9);
  });

  it("lê prazos da condição de pagamento", () => {
    expect(prazosDaCondicao("28/35/42 dias")).toEqual([28, 35, 42]);
    expect(prazosDaCondicao("30 dias")).toEqual([30]);
    expect(prazosDaCondicao("à vista")).toEqual([0]);
    expect(prazosDaCondicao(null)).toEqual([0]);
  });

  it("parcelas somam o total e o resto de centavos vai na última", () => {
    const p = gerarParcelas(100, "30/60/90", "2026-10-21", "boleto");
    expect(p.map((x) => x.valor)).toEqual([33.33, 33.33, 33.34]);
    expect(p.map((x) => x.dataVencimento)).toEqual(["2026-11-20", "2026-12-20", "2027-01-19"]);
    expect(p[0].observacoes).toBe("boleto");
  });

  it("parcelas do pedido incluem o frete", () => {
    const comFrete = mapearParaBling(pedidoBase({ frete: { modalidade: "FOB", valor: 22.4 } }), { contatoId: 1, chave: "k", dataPedido: "2026-10-21" });
    expect(comFrete.parcelas.reduce((a, p) => a + p.valor, 0)).toBeCloseTo(1100);
    expect(comFrete.transporte).toMatchObject({ fretePorConta: 1, frete: 22.4 });
  });

  it("item sem preço vai com valor 0 e sem código", () => {
    const p = pedidoBase();
    p.itens[0] = { ...p.itens[0], sku: null, preco_unitario: null };
    const m = mapearParaBling(p, { contatoId: 1, chave: "k", dataPedido: "2026-10-21" });
    expect(m.itens[0].codigo).toBeUndefined();
    expect(m.itens[0].valor).toBe(0);
  });
});

describe("cliente da API v3", () => {
  const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

  it("renova o token com Basic auth e guarda o refresh token novo", async () => {
    const fetchFalso = vi.fn(async () => json(200, { access_token: "A1", refresh_token: "R2", expires_in: 21600 }));
    const salvar = vi.fn(async () => {});
    const c = new BlingClient({ clientId: "id", clientSecret: "seg", refreshToken: "R1", fetch: fetchFalso as unknown as typeof fetch, tokenStore: { salvarRefreshToken: salvar } });
    expect(await c.renovarToken()).toBe("A1");
    const [url, init] = fetchFalso.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe(`${BLING_API}/oauth/token`);
    expect((init.headers as Record<string, string>).Authorization).toBe(`Basic ${Buffer.from("id:seg").toString("base64")}`);
    expect(String(init.body)).toContain("grant_type=refresh_token");
    expect(String(init.body)).toContain("refresh_token=R1");
    expect(salvar).toHaveBeenCalledWith("R2");
  });

  it("em 401 renova o token e repete a chamada uma vez", async () => {
    const respostas = [
      json(200, { access_token: "A1", refresh_token: "R1", expires_in: 21600 }),
      json(401, { error: "invalid_token" }),
      json(200, { access_token: "A2", refresh_token: "R1", expires_in: 21600 }),
      json(201, { data: { id: 555 } }),
    ];
    const fetchFalso = vi.fn(async () => respostas.shift()!);
    const c = new BlingClient({ clientId: "id", clientSecret: "s", refreshToken: "R1", fetch: fetchFalso as unknown as typeof fetch });
    const id = await c.criarPedidoVenda(mapearParaBling(pedidoBase(), { contatoId: 1, chave: "k", dataPedido: "2026-10-21" }));
    expect(id).toBe(555);
    const urls = fetchFalso.mock.calls.map((x) => (x as unknown as [string])[0]);
    expect(urls.filter((u) => u.endsWith("/pedidos/vendas"))).toHaveLength(2);
    const ultimo = fetchFalso.mock.calls[3] as unknown as [string, RequestInit];
    expect((ultimo[1].headers as Record<string, string>).Authorization).toBe("Bearer A2");
  });

  it("procura o contato pelo CNPJ antes de criar", async () => {
    const respostas = [json(200, { access_token: "A", refresh_token: "R", expires_in: 21600 }), json(200, { data: [{ id: 9 }] })];
    const fetchFalso = vi.fn(async () => respostas.shift()!);
    const c = new BlingClient({ clientId: "id", clientSecret: "s", refreshToken: "R", fetch: fetchFalso as unknown as typeof fetch });
    expect(await c.buscarOuCriarContato(pedidoBase())).toBe(9);
    expect((fetchFalso.mock.calls[1] as unknown as [string])[0]).toContain("/contatos?numeroDocumento=12345678000195");
  });

  it("sem credenciais o modo é sandbox e só devolve o payload", async () => {
    expect(lancadorDoAmbiente({ BLING_MODE: "live" }).modo).toBe("sandbox");
    const r = await new LancadorSandbox().lancar(pedidoBase(), "k", "2026-10-21");
    expect(r.blingId).toBeNull();
    expect(r.payload.itens).toHaveLength(2);
  });
});
