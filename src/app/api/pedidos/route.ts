import { NextResponse } from "next/server";
import { servico } from "@/lib/app";
import type { StatusPedido } from "@/lib/repo/types";

const STATUS: StatusPedido[] = ["revisao", "pronto", "lancado", "erro"];

export async function GET(req: Request) {
  const status = new URL(req.url).searchParams.get("status") as StatusPedido | null;
  if (status && !STATUS.includes(status)) return NextResponse.json({ erro: "status inválido" }, { status: 400 });
  const s = await servico();
  return NextResponse.json({ pedidos: await s.repo.listarPedidos({ status: status ?? undefined }) });
}
