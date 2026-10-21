import "server-only";
import { lancadorDoAmbiente } from "./bling/client";
import { LIMIAR_PADRAO } from "./confidence";
import { criarExtratorEdge } from "./extract/edge";
import { extrairComValidacao, provedorDoAmbiente } from "./extract";
import { ServicoPedidos, type Extrator } from "./pipeline";
import { RepositorioMemoria } from "./repo/memory";
import { RepositorioSupabase, TokenStoreSupabase } from "./repo/supabase";
import type { Repositorio } from "./repo/types";
import { EXEMPLOS } from "./samples";

function repositorio(): Repositorio {
  if (process.env.STORAGE === "supabase") {
    const url = process.env.SUPABASE_URL;
    const chave = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !chave) throw new Error("STORAGE=supabase exige SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY");
    return new RepositorioSupabase(url, chave);
  }
  return new RepositorioMemoria();
}

function extrator(): Extrator {
  if (process.env.EXTRACT_PROVIDER === "edge" && process.env.SUPABASE_URL && process.env.SUPABASE_ANON_KEY) {
    return criarExtratorEdge({ url: process.env.SUPABASE_URL, chave: process.env.SUPABASE_ANON_KEY });
  }
  const provedor = provedorDoAmbiente();
  return (texto) => extrairComValidacao(provedor, texto);
}

export function nomeProvedor(): string {
  if (process.env.EXTRACT_PROVIDER === "edge") return "edge";
  return provedorDoAmbiente().nome;
}

type Global = { __servico?: Promise<ServicoPedidos> };
const g = globalThis as Global;

async function lancador() {
  const { STORAGE, BLING_MODE, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = process.env;
  if (STORAGE === "supabase" && BLING_MODE === "live" && SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY) {
    const tokenStore = new TokenStoreSupabase(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    return lancadorDoAmbiente(process.env, { refreshToken: await tokenStore.ler(), tokenStore });
  }
  return lancadorDoAmbiente();
}

async function montar(): Promise<ServicoPedidos> {
  const servico = new ServicoPedidos({
    repo: repositorio(),
    extrair: extrator(),
    lancador: await lancador(),
    limiar: Number(process.env.CONFIDENCE_THRESHOLD) || LIMIAR_PADRAO,
    autoLancar: process.env.AUTO_LANCAR !== "false",
  });
  // Na demo em memória, cada instância nova começa com os exemplos processados.
  if (process.env.STORAGE !== "supabase" && process.env.SEED_DEMO !== "false") {
    for (const e of [...EXEMPLOS].reverse()) await servico.receber(e.texto, "exemplo");
  }
  return servico;
}

/** Instância única por processo (sobrevive ao hot reload do next dev). */
export function servico(): Promise<ServicoPedidos> {
  g.__servico ??= montar().catch((e) => {
    g.__servico = undefined;
    throw e;
  });
  return g.__servico;
}
