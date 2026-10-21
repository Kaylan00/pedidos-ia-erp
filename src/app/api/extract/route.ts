import { NextResponse } from "next/server";
import { z } from "zod";
import { servico } from "@/lib/app";
import { buscarExemplo } from "@/lib/samples";

const Entrada = z.union([
  z.object({ texto: z.string().min(10).max(50_000), origem: z.enum(["texto", "exemplo"]).optional() }),
  z.object({ exemplo: z.string() }),
]);

/** POST { texto } ou { exemplo: "bebidas" } -> pedido extraído e classificado. */
export async function POST(req: Request) {
  const corpo = Entrada.safeParse(await req.json().catch(() => null));
  if (!corpo.success) return NextResponse.json({ erro: "envie { texto } com pelo menos 10 caracteres ou { exemplo }" }, { status: 400 });

  let texto: string;
  let origem: "texto" | "exemplo";
  if ("exemplo" in corpo.data) {
    const ex = buscarExemplo(corpo.data.exemplo);
    if (!ex) return NextResponse.json({ erro: "exemplo não existe" }, { status: 404 });
    texto = ex.texto;
    origem = "exemplo";
  } else {
    texto = corpo.data.texto;
    origem = corpo.data.origem ?? "texto";
  }

  const s = await servico();
  const pedido = await s.receber(texto, origem);
  return NextResponse.json({ pedido }, { status: 201 });
}
