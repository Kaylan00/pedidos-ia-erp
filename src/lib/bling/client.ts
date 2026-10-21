import { soDigitos } from "../cnpj";
import type { Pedido } from "../schema";
import { mapearParaBling } from "./mapper";
import type { BlingPedidoVenda, Lancador, ResultadoLancamento } from "./types";

export const BLING_API = "https://api.bling.com.br/Api/v3";

export interface TokenStore {
  /** O Bling troca o refresh token a cada renovação; o novo precisa ser guardado. */
  salvarRefreshToken(token: string): Promise<void>;
}

interface Opcoes {
  clientId: string;
  clientSecret: string;
  refreshToken: string;
  fetch?: typeof fetch;
  tokenStore?: TokenStore;
  agora?: () => number;
}

export class BlingErro extends Error {
  constructor(
    public status: number,
    public corpo: unknown,
  ) {
    super(`Bling respondeu ${status}`);
  }
}

/** Cliente mínimo da API v3 do Bling com OAuth2 (refresh token). */
export class BlingClient {
  private accessToken: string | null = null;
  private expiraEm = 0;
  private refreshToken: string;
  private readonly http: typeof fetch;
  private readonly agora: () => number;

  constructor(private readonly opts: Opcoes) {
    this.refreshToken = opts.refreshToken;
    this.http = opts.fetch ?? fetch;
    this.agora = opts.agora ?? Date.now;
  }

  async renovarToken(): Promise<string> {
    const basic = Buffer.from(`${this.opts.clientId}:${this.opts.clientSecret}`).toString("base64");
    const resp = await this.http(`${BLING_API}/oauth/token`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${basic}`,
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "1.0",
      },
      body: new URLSearchParams({ grant_type: "refresh_token", refresh_token: this.refreshToken }).toString(),
    });
    const corpo = (await resp.json().catch(() => null)) as {
      access_token: string;
      refresh_token: string;
      expires_in: number;
    } | null;
    if (!resp.ok || !corpo) throw new BlingErro(resp.status, corpo);
    this.accessToken = corpo.access_token;
    // Renova um minuto antes de expirar para não perder requisição no limite.
    this.expiraEm = this.agora() + (corpo.expires_in - 60) * 1000;
    if (corpo.refresh_token && corpo.refresh_token !== this.refreshToken) {
      this.refreshToken = corpo.refresh_token;
      await this.opts.tokenStore?.salvarRefreshToken(corpo.refresh_token);
    }
    return this.accessToken;
  }

  private async token(): Promise<string> {
    if (this.accessToken && this.agora() < this.expiraEm) return this.accessToken;
    return this.renovarToken();
  }

  async request<T>(metodo: "GET" | "POST", caminho: string, corpo?: unknown, tentativa = 1): Promise<T> {
    const resp = await this.http(`${BLING_API}${caminho}`, {
      method: metodo,
      headers: {
        Authorization: `Bearer ${await this.token()}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: corpo === undefined ? undefined : JSON.stringify(corpo),
    });
    if (resp.status === 401 && tentativa === 1) {
      this.accessToken = null;
      return this.request<T>(metodo, caminho, corpo, 2);
    }
    const json = await resp.json().catch(() => null);
    if (!resp.ok) throw new BlingErro(resp.status, json);
    return json as T;
  }

  async buscarOuCriarContato(p: Pedido): Promise<number> {
    const doc = p.cliente.cnpj ? soDigitos(p.cliente.cnpj) : "";
    if (doc) {
      const achados = await this.request<{ data: { id: number }[] }>("GET", `/contatos?numeroDocumento=${doc}`);
      if (achados.data?.length) return achados.data[0].id;
    }
    const e = p.endereco_entrega;
    const criado = await this.request<{ data: { id: number } }>("POST", "/contatos", {
      nome: p.cliente.razao_social ?? "Cliente sem nome",
      numeroDocumento: doc || undefined,
      tipo: "J",
      situacao: "A",
      email: p.cliente.email ?? undefined,
      endereco: e
        ? {
            geral: {
              endereco: e.logradouro,
              numero: e.numero,
              bairro: e.bairro,
              municipio: e.cidade,
              uf: e.uf,
              cep: e.cep ? soDigitos(e.cep) : undefined,
            },
          }
        : undefined,
    });
    return criado.data.id;
  }

  async criarPedidoVenda(payload: BlingPedidoVenda): Promise<number> {
    const r = await this.request<{ data: { id: number } }>("POST", "/pedidos/vendas", payload);
    return r.data.id;
  }
}

export class LancadorBling implements Lancador {
  readonly modo = "live" as const;
  constructor(private readonly client: BlingClient) {}

  async lancar(pedido: Pedido, chave: string, dataPedido: string): Promise<ResultadoLancamento> {
    const contatoId = await this.client.buscarOuCriarContato(pedido);
    const payload = mapearParaBling(pedido, { contatoId, chave, dataPedido });
    const blingId = await this.client.criarPedidoVenda(payload);
    return { modo: "live", blingId, contatoId, payload };
  }
}

/** Não chama a API: monta o payload que seria enviado e devolve para registro. */
export class LancadorSandbox implements Lancador {
  readonly modo = "sandbox" as const;
  async lancar(pedido: Pedido, chave: string, dataPedido: string): Promise<ResultadoLancamento> {
    const payload = mapearParaBling(pedido, { contatoId: 0, chave, dataPedido });
    return { modo: "sandbox", blingId: null, contatoId: 0, payload };
  }
}

export function lancadorDoAmbiente(
  env: Record<string, string | undefined> = process.env,
  tokens: { refreshToken?: string | null; tokenStore?: TokenStore } = {},
): Lancador {
  const refreshToken = tokens.refreshToken ?? env.BLING_REFRESH_TOKEN;
  if (env.BLING_MODE === "live" && env.BLING_CLIENT_ID && env.BLING_CLIENT_SECRET && refreshToken) {
    return new LancadorBling(
      new BlingClient({
        clientId: env.BLING_CLIENT_ID,
        clientSecret: env.BLING_CLIENT_SECRET,
        refreshToken,
        tokenStore: tokens.tokenStore,
      }),
    );
  }
  return new LancadorSandbox();
}
