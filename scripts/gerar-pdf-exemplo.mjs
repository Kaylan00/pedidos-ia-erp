// Gera docs/exemplo-pedido.pdf, um PDF de pedido com texto selecionável para testar o upload.
// Escrito à mão (sem dependência): uma página, Helvetica, WinAnsiEncoding.
import { writeFileSync } from "node:fs";

const linhas = [
  "PEDIDO DE COMPRA N. 2291",
  "",
  "Razão social: Casa & Obra Materiais de Construção Ltda",
  "CNPJ: 23.456.789/0001-95",
  "E-mail: compras@casaeobra.com.br",
  "",
  "SKU | Descrição | Qtd | Un | Preço",
  "CON-CIM-50 | Cimento CP II 50kg | 120 | SC | 36,50",
  "CON-TUB-100 | Tubo PVC esgoto 100mm 6m | 25 | UN | 68,00",
  "CON-ARG-20 | Argamassa AC-II 20kg | 60 | SC | 24,90",
  "",
  "Frete CIF",
  "Condição de pagamento: 30/60 dias - boleto",
  "Entrega até 12/11/2026",
  "Endereço: Rua Marechal Deodoro, 950 - Centro, Joinville/SC, CEP 89201-100",
  "Total do pedido: R$ 7.574,00",
];

const esc = (s) => s.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
const conteudo =
  "BT /F1 11 Tf 56 780 Td 15 TL\n" + linhas.map((l) => `(${esc(l)}) Tj T*`).join("\n") + "\nET";
const stream = Buffer.from(conteudo, "latin1");

const objetos = [
  "<< /Type /Catalog /Pages 2 0 R >>",
  "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
  "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>",
  null,
  "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>",
];

const partes = [Buffer.from("%PDF-1.4\n%\xe2\xe3\xcf\xd3\n", "latin1")];
const offsets = [];
let pos = partes[0].length;
objetos.forEach((o, i) => {
  const corpo =
    o ?? Buffer.concat([Buffer.from(`<< /Length ${stream.length} >>\nstream\n`), stream, Buffer.from("\nendstream")]);
  const buf = Buffer.concat([Buffer.from(`${i + 1} 0 obj\n`), Buffer.isBuffer(corpo) ? corpo : Buffer.from(corpo, "latin1"), Buffer.from("\nendobj\n")]);
  offsets.push(pos);
  partes.push(buf);
  pos += buf.length;
});
const xref =
  `xref\n0 ${objetos.length + 1}\n0000000000 65535 f \n` +
  offsets.map((o) => `${String(o).padStart(10, "0")} 00000 n \n`).join("") +
  `trailer\n<< /Size ${objetos.length + 1} /Root 1 0 R >>\nstartxref\n${pos}\n%%EOF\n`;
partes.push(Buffer.from(xref));
writeFileSync(new URL("../docs/exemplo-pedido.pdf", import.meta.url), Buffer.concat(partes));
console.log("docs/exemplo-pedido.pdf gerado");
