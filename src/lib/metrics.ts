import type { ChamadaModelo } from "./extract/types";

/** Percentil pelo método nearest-rank. Lista vazia devolve 0. */
export function percentil(valores: number[], p: number): number {
  if (valores.length === 0) return 0;
  const ordenados = [...valores].sort((a, b) => a - b);
  const rank = Math.ceil((p / 100) * ordenados.length);
  return ordenados[Math.min(Math.max(rank, 1), ordenados.length) - 1];
}

export interface ResumoCusto {
  chamadas: number;
  falhas: number;
  tokensEntrada: number;
  tokensSaida: number;
  custoTotal: number;
  latenciaMedia: number;
  p50: number;
  p95: number;
  porModelo: { model: string; chamadas: number; custo: number; p95: number }[];
}

export function resumirChamadas(chamadas: ChamadaModelo[]): ResumoCusto {
  const lat = chamadas.map((c) => c.latencia_ms);
  const grupos = new Map<string, ChamadaModelo[]>();
  for (const c of chamadas) grupos.set(c.model, [...(grupos.get(c.model) ?? []), c]);
  return {
    chamadas: chamadas.length,
    falhas: chamadas.filter((c) => !c.ok).length,
    tokensEntrada: chamadas.reduce((a, c) => a + c.input_tokens, 0),
    tokensSaida: chamadas.reduce((a, c) => a + c.output_tokens, 0),
    custoTotal: Math.round(chamadas.reduce((a, c) => a + c.custo_usd, 0) * 1e6) / 1e6,
    latenciaMedia: lat.length ? Math.round((lat.reduce((a, b) => a + b, 0) / lat.length) * 10) / 10 : 0,
    p50: percentil(lat, 50),
    p95: percentil(lat, 95),
    porModelo: [...grupos.entries()].map(([model, cs]) => ({
      model,
      chamadas: cs.length,
      custo: Math.round(cs.reduce((a, c) => a + c.custo_usd, 0) * 1e6) / 1e6,
      p95: percentil(cs.map((c) => c.latencia_ms), 95),
    })),
  };
}
