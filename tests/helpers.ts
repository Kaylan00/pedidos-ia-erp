import type { Pedido } from "@/lib/schema";

/** Pedido válido e completo; os testes alteram só o campo que interessa. */
export function pedidoBase(over: Partial<Pedido> = {}): Pedido {
  return {
    cliente: { razao_social: "Empório Serra Azul Ltda", cnpj: "12.345.678/0001-95", email: "compras@exemplo.com.br" },
    itens: [
      { sku: "BEB-REF-350", descricao: "Refrigerante cola lata", quantidade: 24, unidade: "CX", preco_unitario: 38.9 },
      { sku: "BEB-AGU-500", descricao: "Água mineral 500ml", quantidade: 10, unidade: "FD", preco_unitario: 14.4 },
    ],
    frete: { modalidade: "CIF", valor: null },
    pagamento: { condicao: "28/35 dias", forma: "boleto" },
    data_entrega: "2026-11-06",
    endereco_entrega: {
      logradouro: "Rua das Palmeiras",
      numero: "410",
      bairro: "Centro",
      cidade: "Campinas",
      uf: "SP",
      cep: "13010-110",
    },
    total_declarado: 1077.6,
    observacoes: null,
    ...over,
  };
}
