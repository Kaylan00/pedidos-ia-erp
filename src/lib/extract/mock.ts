import type { Pedido, Item } from "../schema";
import { custoEstimado, MODELO_PADRAO } from "./pricing";
import { SYSTEM_PROMPT, mensagemUsuario } from "./prompt";
import type { ProvedorSessao } from "./types";

/**
 * Provedor determinístico baseado em expressões regulares. Existe para a demo
 * funcionar sem chave de API e para os testes não dependerem de rede. Entende
 * os formatos mais comuns (lista com SKU, tabela com "|", itens descritos) e
 * deixa null o que não reconhece, como o modelo faria.
 */

const UNIDADES: Record<string, string> = {
  cx: "CX", cxs: "CX", caixa: "CX", caixas: "CX",
  fd: "FD", fds: "FD", fardo: "FD", fardos: "FD",
  un: "UN", und: "UN", unid: "UN", unidade: "UN", unidades: "UN", pc: "UN", pcs: "UN",
  sc: "SC", saco: "SC", sacos: "SC",
  gl: "GL", galao: "GL", galão: "GL", galoes: "GL", galões: "GL",
  resma: "RESMA", resmas: "RESMA",
  kg: "KG", m: "M", pct: "PCT", pacote: "PCT", pacotes: "PCT",
};

const RE_SKU = /\b[A-Z]{2,4}-[A-Z0-9]{1,5}(?:-[A-Z0-9]{1,5})?\b/;
const RE_PRECO = /R\$\s*([\d.]+,\d{2})/;
const RE_CNPJ = /\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2}/;

export function numeroBR(v: string): number {
  return Number(v.replace(/\./g, "").replace(",", "."));
}

function unidade(token: string): string | undefined {
  return UNIDADES[token.toLowerCase()];
}

function limparDescricao(s: string): string {
  return s.replace(/\s+-\s*$/, "").replace(/^[\s\-–•:]+|[\s\-–•:]+$/g, "").replace(/\s{2,}/g, " ");
}

function itemDeTabela(linha: string): Item | null {
  const cel = linha.split("|").map((c) => c.trim());
  if (cel.length < 4) return null;
  const iSku = cel.findIndex((c) => RE_SKU.test(c) && c.match(RE_SKU)![0] === c);
  if (iSku < 0) return null;
  const numeros = cel.map((c, i) => ({ c, i })).filter(({ c, i }) => i !== iSku && /^[\d.]+(,\d+)?$/.test(c));
  const iUn = cel.findIndex((c) => unidade(c) !== undefined);
  const iDesc = cel.findIndex((c, i) => i !== iSku && i !== iUn && /[a-zA-Z]{3,}/.test(c));
  if (numeros.length < 1 || iDesc < 0) return null;
  const quantidade = numeroBR(numeros[0].c);
  const preco = numeros.length > 1 ? numeroBR(numeros[numeros.length - 1].c) : null;
  return {
    sku: cel[iSku],
    descricao: cel[iDesc],
    quantidade,
    unidade: iUn >= 0 ? unidade(cel[iUn])! : "UN",
    preco_unitario: preco,
  };
}

function itemDeLista(linha: string): Item | null {
  const m = linha.match(/^\s*[-•*]\s*(\d+(?:,\d+)?)\s+([A-Za-zçãõ]+)\s+(.+)$/);
  if (!m) return null;
  const un = unidade(m[2]);
  if (!un) return null;
  let resto = m[3];
  const preco = resto.match(RE_PRECO);
  if (preco) resto = resto.replace(preco[0], "");
  const sku = resto.match(RE_SKU);
  if (sku) resto = resto.replace(sku[0], "");
  const descricao = limparDescricao(resto.replace(/^de\s+/i, ""));
  return {
    sku: sku ? sku[0] : null,
    descricao: descricao || "(sem descrição)",
    quantidade: numeroBR(m[1]),
    unidade: un,
    preco_unitario: preco ? numeroBR(preco[1]) : null,
  };
}

function razaoSocial(texto: string): string | null {
  const rotulo = texto.match(/(?:raz[aã]o social|cliente)\s*:?\s*([^\n]+)/i);
  if (rotulo) return limparDescricao(rotulo[1].split(/\s+CNPJ/i)[0]);
  const ltda = texto.match(/([A-ZÀ-Ú][\wÀ-ú ]+?\s(?:Ltda|ME|EIRELI|S\.?A\.?))\b/);
  return ltda ? ltda[1].trim() : null;
}

function endereco(texto: string): Pedido["endereco_entrega"] {
  const m = texto.match(
    /((?:Rua|R\.|Av\.|Avenida|Rodovia|Rod\.|Estrada|Travessa|Alameda)\s[^,\n]+),\s*(?:n[ºo°]\s*)?(\d+[A-Za-z]?)(?:\s*-\s*([^,\n]+))?,\s*([^/\n,]+)\/([A-Z]{2})(?:,\s*CEP\s*(\d{5}-?\d{3}))?/,
  );
  if (!m) return null;
  return {
    logradouro: m[1].trim(),
    numero: m[2],
    bairro: m[3]?.trim() ?? null,
    cidade: m[4].trim(),
    uf: m[5],
    cep: m[6] ?? null,
  };
}

function dataEntrega(texto: string): string | null {
  const m = texto.match(/entreg\w*[^\n]*?(\d{2})\/(\d{2})\/(\d{4})/i);
  return m ? `${m[3]}-${m[2]}-${m[1]}` : null;
}

function pagamento(texto: string): Pedido["pagamento"] {
  const linha = texto.split("\n").find((l) => /pagamento|condi[cç][aã]o/i.test(l)) ?? "";
  let condicao: string | null = null;
  const prazo = linha.match(/(\d{1,3}(?:\/\d{1,3})*)\s*(?:dias|dd)/i);
  if (prazo) condicao = `${prazo[1]} dias`;
  else if (/[aà] vista/i.test(linha)) condicao = "à vista";
  const forma = linha.match(/\b(boleto|pix|cart[aã]o|transfer[eê]ncia|dep[oó]sito)\b/i);
  return { condicao, forma: forma ? forma[1].toLowerCase() : null };
}

function frete(texto: string): Pedido["frete"] {
  const linha = texto.split("\n").find((l) => /frete/i.test(l)) ?? "";
  const mod = linha.match(/\b(CIF|FOB)\b/i);
  const valor = linha.match(RE_PRECO);
  return {
    modalidade: mod ? (mod[1].toUpperCase() as "CIF" | "FOB") : null,
    valor: valor ? numeroBR(valor[1]) : null,
  };
}

function totalDeclarado(texto: string): number | null {
  const linhas = texto.split("\n").filter((l) => /\btotal\b/i.test(l) && !/subtotal/i.test(l));
  for (const l of linhas.reverse()) {
    const m = l.match(RE_PRECO);
    if (m) return numeroBR(m[1]);
  }
  return null;
}

/** Extração heurística pura: texto entra, objeto no formato do schema sai. */
export function extrairHeuristico(texto: string): Pedido {
  const itens: Item[] = [];
  for (const linha of texto.split("\n")) {
    const item = linha.includes("|") ? itemDeTabela(linha) : itemDeLista(linha);
    if (item) itens.push(item);
  }
  const cnpj = texto.match(RE_CNPJ);
  const email = texto.match(/[\w.+-]+@[\w-]+\.[\w.]+/);
  return {
    cliente: { razao_social: razaoSocial(texto), cnpj: cnpj ? cnpj[0] : null, email: email ? email[0] : null },
    itens,
    frete: frete(texto),
    pagamento: pagamento(texto),
    data_entrega: dataEntrega(texto),
    endereco_entrega: endereco(texto),
    total_declarado: totalDeclarado(texto),
    observacoes: null,
  };
}

const tokens = (s: string) => Math.ceil(s.length / 4);

export const provedorMock: ProvedorSessao = {
  nome: "mock",
  iniciar(texto, dataReferencia) {
    return {
      async tentar() {
        const t0 = performance.now();
        const dados = extrairHeuristico(texto);
        const entrada = tokens(SYSTEM_PROMPT) + tokens(mensagemUsuario(texto, dataReferencia));
        const saida = tokens(JSON.stringify(dados));
        return {
          dados,
          chamada: {
            provider: "mock",
            model: "mock-heuristico",
            input_tokens: entrada,
            output_tokens: saida,
            // Custo que essa chamada teria no modelo padrão, para o painel fazer sentido na demo.
            custo_usd: custoEstimado(MODELO_PADRAO, { input_tokens: entrada, output_tokens: saida }),
            latencia_ms: Math.round((performance.now() - t0) * 100) / 100,
            simulado: true,
          },
        };
      },
    };
  },
};
