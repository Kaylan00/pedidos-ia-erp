import { NextResponse } from "next/server";
import { servico } from "@/lib/app";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Ctx) {
  const { id } = await params;
  const s = await servico();
  const pedido = await s.repo.obterPedido(id);
  if (!pedido) return NextResponse.json({ erro: "pedido não encontrado" }, { status: 404 });
  const lancamento = pedido.chave_idempotencia ? await s.repo.obterLancamento(pedido.chave_idempotencia) : null;
  return NextResponse.json({ pedido, lancamento });
}

/** PATCH { pedido } com os campos corrigidos na revisão. */
export async function PATCH(req: Request, { params }: Ctx) {
  const { id } = await params;
  const corpo = (await req.json().catch(() => null)) as { pedido?: unknown } | null;
  const s = await servico();
  const r = await s.corrigir(id, corpo?.pedido);
  if (!r.ok) return NextResponse.json({ erro: r.erro }, { status: r.status });
  return NextResponse.json({ pedido: r.pedido });
}
