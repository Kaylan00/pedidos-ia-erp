/** Preço em US$ por milhão de tokens. Atualize quando a tabela da Anthropic mudar. */
export const PRECOS: Record<string, { entrada: number; saida: number }> = {
  "claude-opus-5-5": { entrada: 4, saida: 20 },
  "claude-sonnet-5-5": { entrada: 2, saida: 10 },
  "claude-haiku-5-5": { entrada: 0.1, saida: 0.5 },
};

export const MODELO_PADRAO = "claude-opus-5-5";

export interface Uso {
  input_tokens: number;
  output_tokens: number;
  cache_creation_input_tokens?: number | null;
  cache_read_input_tokens?: number | null;
}

/** Custo estimado em US$. Escrita em cache custa 1,25x a entrada; leitura, 0,1x. */
export function custoEstimado(modelo: string, uso: Uso): number {
  const preco = PRECOS[modelo] ?? PRECOS[MODELO_PADRAO];
  const entrada =
    uso.input_tokens +
    (uso.cache_creation_input_tokens ?? 0) * 1.25 +
    (uso.cache_read_input_tokens ?? 0) * 0.1;
  const custo = (entrada * preco.entrada + uso.output_tokens * preco.saida) / 1_000_000;
  return Math.round(custo * 1_000_000) / 1_000_000;
}
