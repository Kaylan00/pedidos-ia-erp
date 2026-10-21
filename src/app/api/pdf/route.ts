import { NextResponse } from "next/server";
import { extractText, getDocumentProxy } from "unpdf";
import { servico } from "@/lib/app";

const LIMITE = 5 * 1024 * 1024;

/** multipart com campo "arquivo" (PDF com texto). PDF escaneado sem OCR não tem texto para extrair. */
export async function POST(req: Request) {
  const form = await req.formData().catch(() => null);
  const arquivo = form?.get("arquivo");
  if (!(arquivo instanceof File)) return NextResponse.json({ erro: "envie o PDF no campo 'arquivo'" }, { status: 400 });
  if (arquivo.size > LIMITE) return NextResponse.json({ erro: "PDF maior que 5 MB" }, { status: 413 });

  let texto: string;
  try {
    const pdf = await getDocumentProxy(new Uint8Array(await arquivo.arrayBuffer()));
    const r = await extractText(pdf, { mergePages: true });
    texto = r.text.trim();
  } catch {
    return NextResponse.json({ erro: "não foi possível ler o PDF" }, { status: 422 });
  }
  if (texto.length < 10)
    return NextResponse.json({ erro: "o PDF não tem texto selecionável (provavelmente é imagem escaneada)" }, { status: 422 });

  const s = await servico();
  const pedido = await s.receber(texto, "pdf");
  return NextResponse.json({ pedido }, { status: 201 });
}
