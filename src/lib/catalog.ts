/**
 * Catálogo de produtos do fornecedor. Em produção viria do próprio Bling
 * (GET /produtos); aqui é estático para a demo e para os testes.
 */
export interface Produto {
  sku: string;
  descricao: string;
  unidade: string;
  preco: number;
}

export const CATALOGO: Produto[] = [
  { sku: "BEB-REF-350", descricao: "Refrigerante cola lata 350 ml (cx 12)", unidade: "CX", preco: 38.9 },
  { sku: "BEB-AGU-500", descricao: "Água mineral sem gás 500 ml (fd 12)", unidade: "FD", preco: 14.4 },
  { sku: "BEB-CER-600", descricao: "Cerveja pilsen garrafa 600 ml (cx 24)", unidade: "CX", preco: 189.0 },
  { sku: "BEB-SUC-1L", descricao: "Suco de uva integral 1 L (cx 6)", unidade: "CX", preco: 71.7 },
  { sku: "CON-CIM-50", descricao: "Cimento CP II 50 kg", unidade: "SC", preco: 36.5 },
  { sku: "CON-ARG-20", descricao: "Argamassa AC-II 20 kg", unidade: "SC", preco: 24.9 },
  { sku: "CON-VER-10", descricao: "Vergalhão CA-50 10 mm barra 12 m", unidade: "UN", preco: 52.8 },
  { sku: "CON-TUB-100", descricao: "Tubo PVC esgoto 100 mm barra 6 m", unidade: "UN", preco: 68.0 },
  { sku: "PAP-A4-500", descricao: "Papel sulfite A4 75 g (resma 500 fls)", unidade: "RESMA", preco: 27.9 },
  { sku: "PAP-CAN-AZ", descricao: "Caneta esferográfica azul (cx 50)", unidade: "CX", preco: 42.0 },
  { sku: "PAP-CAD-10", descricao: "Caderno universitário 10 matérias", unidade: "UN", preco: 19.9 },
  { sku: "PAP-PAS-AZ", descricao: "Pasta polionda azul com elástico", unidade: "UN", preco: 4.5 },
  { sku: "LIM-DET-5L", descricao: "Detergente neutro 5 L", unidade: "GL", preco: 22.9 },
  { sku: "LIM-ALC-70", descricao: "Álcool 70% 1 L (cx 12)", unidade: "CX", preco: 95.4 },
  { sku: "LIM-PAP-TOA", descricao: "Papel toalha interfolha (fd 1000 fls)", unidade: "FD", preco: 18.6 },
  { sku: "ALI-ARR-5", descricao: "Arroz tipo 1 5 kg (fd 6)", unidade: "FD", preco: 154.8 },
  { sku: "ALI-FEI-1", descricao: "Feijão carioca 1 kg (fd 10)", unidade: "FD", preco: 79.0 },
  { sku: "ALI-OLE-900", descricao: "Óleo de soja 900 ml (cx 20)", unidade: "CX", preco: 139.0 },
];

const porSku = new Map(CATALOGO.map((p) => [p.sku.toUpperCase(), p]));

export function buscarSku(sku: string | null | undefined): Produto | undefined {
  if (!sku) return undefined;
  return porSku.get(sku.trim().toUpperCase());
}

function normalizar(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9 ]/g, " ");
}

/**
 * Sugere um produto do catálogo pela descrição (sobreposição de palavras).
 * Usado só como sugestão na tela de revisão, nunca para preencher o SKU sozinho.
 */
export function sugerirPorDescricao(descricao: string): Produto | undefined {
  const palavras = new Set(normalizar(descricao).split(/\s+/).filter((w) => w.length > 2));
  let melhor: { p: Produto; score: number } | undefined;
  for (const p of CATALOGO) {
    const alvo = normalizar(p.descricao).split(/\s+/).filter((w) => w.length > 2);
    const comuns = alvo.filter((w) => palavras.has(w)).length;
    const score = comuns / Math.max(alvo.length, 1);
    if (comuns >= 2 && (!melhor || score > melhor.score)) melhor = { p, score };
  }
  return melhor?.p;
}
