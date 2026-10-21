/**
 * Pedidos de exemplo no formato em que costumam chegar: e-mail com lista,
 * tabela colada de planilha, mensagem informal. CNPJs fictícios.
 * Os três primeiros devem passar direto; os outros têm problemas de propósito.
 */
export interface Exemplo {
  id: string;
  titulo: string;
  texto: string;
}

export const EXEMPLOS: Exemplo[] = [
  {
    id: "bebidas",
    titulo: "Distribuidora de bebidas, e-mail com lista",
    texto: `De: compras@emporioserraazul.com.br
Assunto: Pedido semanal - Empório Serra Azul

Bom dia, segue o pedido desta semana.

Razão social: Empório Serra Azul Comércio de Alimentos Ltda
CNPJ: 12.345.678/0001-95

- 24 CX BEB-REF-350 Refrigerante cola lata 350ml - R$ 38,90
- 10 FD BEB-AGU-500 Água mineral sem gás 500ml - R$ 14,40
- 5 CX BEB-CER-600 Cerveja pilsen 600ml - R$ 189,00

Frete: CIF
Pagamento: 28/35 dias, boleto
Entrega até 06/11/2026
Endereço de entrega: Rua das Palmeiras, 410 - Centro, Campinas/SP, CEP 13010-110

Total do pedido: R$ 2.022,60

Obrigado,
Márcia - Compras`,
  },
  {
    id: "construcao",
    titulo: "Material de construção, tabela colada",
    texto: `De: suprimentos@constrularobras.com.br
Assunto: PC 4471 - Obra Residencial Ipês

Prezados, favor faturar conforme abaixo.

Cliente: Constrular Obras e Reformas Ltda
CNPJ 23.456.789/0001-95

SKU | Descrição | Qtd | Un | Preço
CON-CIM-50 | Cimento CP II 50kg | 80 | SC | 36,50
CON-ARG-20 | Argamassa AC-II 20kg | 40 | SC | 24,90
CON-VER-10 | Vergalhão CA-50 10mm 12m | 30 | UN | 52,80

Frete FOB, valor do frete R$ 180,00
Condição: 28/35/42 dias - boleto
Entregar em 10/11/2026 na obra: Av. Brasil, 1500 - Jardim Ipê, Londrina/PR, CEP 86010-200
Total geral: R$ 5.680,00

Att.,
Rogério Lima
Suprimentos`,
  },
  {
    id: "papelaria",
    titulo: "Papelaria, pedido de reposição",
    texto: `De: contato@papelariapontofinal.com.br
Assunto: Reposição de estoque

Olá! Pedido de reposição da Papelaria Ponto Final.

Razão social: Papelaria Ponto Final ME
CNPJ: 34.567.812/0001-35

- 50 RESMA PAP-A4-500 Papel sulfite A4 75g - R$ 27,90
- 6 CX PAP-CAN-AZ Caneta esferográfica azul - R$ 42,00
- 40 UN PAP-CAD-10 Caderno universitário 10 matérias - R$ 19,90
- 100 UN PAP-PAS-AZ Pasta polionda azul - R$ 4,50

Frete: CIF
Pagamento: à vista no pix
Entrega até 04/11/2026
Endereço: Rua XV de Novembro, 233 - Centro, Curitiba/PR, CEP 80020-310
Total: R$ 2.893,00`,
  },
  {
    id: "mercearia",
    titulo: "Mercearia, SKU fora do catálogo e total divergente",
    texto: `De: pedidos@merceariabomgosto.com.br
Assunto: Pedido mercearia

Boa tarde, pessoal.

Razão social: Mercearia Bom Gosto Ltda
CNPJ: 67.812.345/0001-10

- 4 FD ALI-ARR-5 Arroz tipo 1 5kg - R$ 154,80
- 6 FD ALI-FEI-1 Feijão carioca 1kg - R$ 79,00
- 5 FD ALI-ACU-5 Açúcar cristal 5kg - R$ 98,50
- 2 CX ALI-OLE-900 Óleo de soja 900ml - R$ 139,00

Frete: CIF
Pagamento: 21 dias, boleto
Entrega até 07/11/2026
Endereço: Rua Sete de Setembro, 88 - Vila Nova, Blumenau/SC, CEP 89035-000
Total: R$ 1.836,70`,
  },
  {
    id: "limpeza",
    titulo: "Clínica, CNPJ com dígito errado",
    texto: `De: administrativo@clinicavidaplena.com.br
Assunto: Pedido material de limpeza

Prezados,

Razão social: Clínica Vida Plena Serviços Médicos Ltda
CNPJ: 45.678.123/0001-41

- 12 GL LIM-DET-5L Detergente neutro 5L - R$ 22,90
- 3 CX LIM-ALC-70 Álcool 70% 1L - R$ 95,40
- 20 FD LIM-PAP-TOA Papel toalha interfolha - R$ 18,60

Frete: CIF
Pagamento: 30 dias, boleto
Entrega até 05/11/2026
Endereço: Av. Afonso Pena, 1200 - Funcionários, Belo Horizonte/MG, CEP 30130-005
Total: R$ 933,00`,
  },
  {
    id: "bar",
    titulo: "Bar, mensagem informal sem SKU nem preço",
    texto: `De: barodojoca@gmail.com
Assunto: pedido

oi, aqui é o Joca do Bar do Joca (Bar e Lanchonete do Joca Ltda, CNPJ 56.781.234/0001-78)

preciso pra sexta:
- 3 caixas cerveja pilsen 600ml
- 2 fardos água mineral sem gás 500ml
- 4 caixas refrigerante cola lata

entrega no bar mesmo, Rua do Comércio, 12 - Centro, Santos/SP

valeu`,
  },
];

export function buscarExemplo(id: string): Exemplo | undefined {
  return EXEMPLOS.find((e) => e.id === id);
}
