import { NextResponse } from "next/server";
import { servico } from "@/lib/app";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const s = await servico();
  const r = await s.aprovar(id);
  if (!r.ok) return NextResponse.json({ erro: r.erro }, { status: r.status });
  return NextResponse.json({ duplicado: r.duplicado, lancamento: r.lancamento, pedido: r.pedido });
}
