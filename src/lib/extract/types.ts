import type { Pedido } from "../schema";

/** Registro de uma chamada ao modelo (ou ao mock), gravado para o painel de custo. */
export interface ChamadaModelo {
  provider: string;
  model: string;
  tentativa: number;
  input_tokens: number;
  output_tokens: number;
  custo_usd: number;
  latencia_ms: number;
  ok: boolean;
  simulado: boolean;
  erro?: string | null;
}

export interface ResultadoExtracao {
  provider: string;
  pedido: Pedido | null;
  tentativas: number;
  chamadas: ChamadaModelo[];
  /** Erros de schema da última tentativa, se nenhuma passou. */
  erro: string | null;
}

export interface RespostaBruta {
  dados: unknown;
  chamada: Omit<ChamadaModelo, "tentativa" | "ok" | "erro">;
}

/**
 * Uma sessão de extração. A primeira chamada recebe só o texto; se o resultado
 * não passar no schema, a segunda recebe a lista de erros para corrigir.
 */
export interface SessaoExtracao {
  tentar(errosDaTentativaAnterior?: string): Promise<RespostaBruta>;
}

export interface ProvedorSessao {
  nome: string;
  iniciar(texto: string, dataReferencia: string): SessaoExtracao;
}
