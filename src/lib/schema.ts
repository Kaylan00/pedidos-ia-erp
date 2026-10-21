import { z } from "zod";

const dataISO = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "use o formato AAAA-MM-DD");

export const ItemSchema = z.object({
  sku: z.string().min(1).nullable().describe("Código do produto como aparece no pedido, ou null"),
  descricao: z.string().min(1).describe("Descrição do item"),
  quantidade: z.number().positive("quantidade deve ser maior que zero"),
  unidade: z.string().min(1).describe("UN, CX, FD, SC, M, KG etc."),
  preco_unitario: z.number().nonnegative().nullable().describe("Preço unitário em reais, ou null se ausente"),
});

export const EnderecoSchema = z.object({
  logradouro: z.string().nullable(),
  numero: z.string().nullable(),
  bairro: z.string().nullable(),
  cidade: z.string().nullable(),
  uf: z.string().length(2, "UF com 2 letras").nullable(),
  cep: z.string().regex(/^\d{5}-?\d{3}$/, "CEP com 8 dígitos").nullable(),
});

export const PedidoSchema = z.object({
  cliente: z.object({
    razao_social: z.string().min(1).nullable(),
    cnpj: z
      .string()
      .regex(/^\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2}$/, "CNPJ com 14 dígitos")
      .nullable(),
    email: z.string().nullable(),
  }),
  itens: z.array(ItemSchema).min(1, "o pedido precisa de ao menos um item"),
  frete: z.object({
    modalidade: z.enum(["CIF", "FOB"]).nullable().describe("CIF = fornecedor paga; FOB = cliente paga"),
    valor: z.number().nonnegative().nullable(),
  }),
  pagamento: z.object({
    condicao: z.string().nullable().describe("Ex.: '28/35/42 dias', 'à vista'"),
    forma: z.string().nullable().describe("Ex.: boleto, pix, cartão"),
  }),
  data_entrega: dataISO.nullable(),
  endereco_entrega: EnderecoSchema.nullable(),
  total_declarado: z.number().nonnegative().nullable().describe("Total escrito no pedido, se houver"),
  observacoes: z.string().nullable(),
});

export type Pedido = z.infer<typeof PedidoSchema>;
export type Item = z.infer<typeof ItemSchema>;

/** JSON Schema enviado ao modelo como input_schema da ferramenta. */
export function pedidoJsonSchema(): Record<string, unknown> {
  const schema = z.toJSONSchema(PedidoSchema) as Record<string, unknown>;
  delete schema.$schema;
  return schema;
}

/** Converte os erros do zod em texto curto, um por linha, para devolver ao modelo. */
export function formatarErros(error: z.ZodError): string {
  return error.issues
    .map((i) => `- ${i.path.length ? i.path.join(".") : "(raiz)"}: ${i.message}`)
    .join("\n");
}

export function somaItens(itens: Item[]): number {
  return arred(itens.reduce((acc, i) => acc + i.quantidade * (i.preco_unitario ?? 0), 0));
}

export function totalPedido(p: Pedido): number {
  return arred(somaItens(p.itens) + (p.frete.valor ?? 0));
}

export function arred(n: number): number {
  return Math.round(n * 100) / 100;
}
